var render = require('./lib/render');
var chess = require('chess.js');
var uuid = require('node-uuid');
var monk = require('monk');

module.exports.home = function *home() {
    this.redirect('/g/' + uuid.v4().replace(/-/g, ''));
}

module.exports.game = function *game(id) {
    this.body = yield render('game.jade', { id: id });
}

var db = monk('localhost/chess');

var GamesCollection = db.get('chess');

function Game(doc) {
    this.record = doc;
    this.engine = chess.Chess();

    if (doc.pgn) {
        this.engine.load_pgn(doc.pgn)
    }
}

Game.prototype.setPlayer = function(color, id) {
    this.record[color + "Player"] = id;
    return this.save();
}

Game.prototype.syncPGN = function() {
    this.record.pgn = this.engine.pgn();
    return this.save();
}

Game.prototype.save = function() {
    var self = this;
    return new Promise(function(resolve, reject) {
        GamesCollection.updateById(self.record._id, {
            $set: self.record
        }).success(function(doc) {
            resolve(doc);
        }).error(function(err) {
            reject(err);
        });
    });
}

Game.instances = new Map();

Game.create = function(slug) {
    if (Game.instances.has(slug)) {
        return Promise.resolve(Game.instances.get(slug));
    }

    return new Promise(function(resolve, reject) {
        GamesCollection.insert({ slug: slug })
        .success(function(doc) {
            var game = new Game(doc);
            Game.instances.set(slug, game);
            resolve(game);
        })
        .error(function(err) { reject(err); })
    });
};

Game.get = function(slug) {
    if (Game.instances.has(slug)) {
        return Promise.resolve(Game.instances.get(slug));
    }

    return new Promise(function(resolve, reject) {
        GamesCollection.findOne({ slug: slug })
        .success(function(doc) {
            if (!doc) {
                return resolve(null);
            }

            var game = new Game(doc);
            Game.instances.set(slug, game);
            return resolve(game);
        })
        .error(function(err) { reject(err); })
    });
};

Game.getOrCreate = function(slug) {
    if (Game.instances.has(slug)) {
        return Promise.resolve(Game.instances.get(slug));
    }

    return new Promise(function(resolve, reject) {
        Game.get(slug).then(function(doc) {
            if (doc) {
                return resolve(doc);
            } else {
                Game.create(slug).then(function(doc) {
                    return resolve(doc);
                });
            }
        });
    });
}

module.exports.socket = function(socket) {
    var gameId;
    var game;

    socket.on('connected', function(data) {
        gameId = data.id;

        socket.join(gameId);

        // Get game.
        Game.getOrCreate(gameId).then(function(g) {
            game = g;

            game.nope = uuid.v4();

            socket.emit('gamestate', {
                id: gameId,
                pgn: game.engine.pgn()
            });
        });
    });

    socket.on('move piece', function(data) {
        var move = game.engine.move(data.move);

        if (move != null) {
            game.syncPGN().then(function() {
                socket.emit('moved piece', {
                    success: true,
                    move: move,
                    pgn: game.engine.pgn()
                });

                socket.broadcast.to(gameId).emit('moved piece', {
                    move: move,
                    pgn: game.engine.pgn()
                });
            });

        } else {
            console.error("!!!");
            console.error(game.engine.ascii());
        }
        /*
        var possibleMoves = game.moves();

        // game over
        if (possibleMoves.length === 0) return;

        var randomIndex = Math.floor(Math.random() * possibleMoves.length);
        game.move(possibleMoves[randomIndex]);

        setTimeout(function() {
            socket.emit('moved piece', {
                move: data.move,
                fen: game.fen()
            });
            socket.broadcast.emit('moved piece', {
                move: data.move,
                fen: game.fen()
            });
        }, 250);
        */
    });

    socket.on('select color', function(data) {
        if (data.color == "black" || data.color == "white") {
            if (false/*session.get(data.color + 'Player')*/) {
                socket.emit('selected color', {
                    success: false,
                    color: data.color,
                    reason: "Player " + data.color + " already taken."
                });
            } else {
                //session.set(data.color + 'Player', socket.id);
                //session.save();
                socket.emit('selected color', {
                    success: true,
                    color: data.color
                });
            }
        }
    });
};
