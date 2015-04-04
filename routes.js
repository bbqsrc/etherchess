var render = require('./lib/render');
var chess = require('chess.js');

module.exports.home = function *home() {
    this.body = yield render('home.jade');
}

module.exports.game = function *game(id) {
    this.body = yield render('game.jade', { id: id });
}

function Session(id) { this.id = id; this.record = Object.create(null); }

Session.prototype.set = function(key, value) {
    if (arguments.length == 1) {
        Object.keys(key).forEach(function(k) {
            var v = key[k];
            this.record[k] = v;
        }, this);
    } else {
        this.record[key] = value;
    }
}

Session.prototype.get = function(key) {
    return this.record[key];
}

var Games = {
    _sessions: {},

    get: function(gameId) {
        return this._sessions[gameId];
    },

    create: function(gameId) {
        this._sessions[gameId] = new Session(gameId);
        return this._sessions[gameId];
    }
};

module.exports.socket = function(socket) {
    var gameId = null;

    var game;

    var session; //= { get: function() { return false; }, set: function() {} };

    socket.on('connected', function(data) {
        gameId = data.id;

        socket.join(gameId);

        session = Games.get(gameId);

        if (session == null) {
            session = Games.create(gameId);
            session.set('game', chess.Chess());
        }

        game = session.get('game');

        socket.emit('gamestate', {
            id: gameId,
            pgn: game.pgn()
        });
    });

    socket.on('move piece', function(data) {
        var move = game.move(data.move);

        if (move != null) {
            socket.emit('moved piece', {
                success: true,
                move: move,
                pgn: game.pgn()
            });

            socket.broadcast.to(gameId).emit('moved piece', {
                move: move,
                pgn: game.pgn()
            });
        } else {
            socket.emit('moved piece', {
                success: false,
                move: move,
                pgn: game.pgn()
            });

            socket.broadcast.to(gameId).emit('moved piece', "ERROR");
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
                session.set(data.color + 'Player', socket.id);
                socket.emit('selected color', {
                    success: true,
                    color: data.color
                });
            }
        }
    });
};
