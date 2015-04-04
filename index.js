var logger = require('koa-logger');
var route = require('koa-route');
var serve = require('koa-static');

var koa = require('koa');
var app = module.exports = koa();

// middleware

app.use(logger());

// route middleware
var routes = require('./routes.js');
app.use(route.get('/', routes.home));
app.use(route.get('/g/:id', routes.game));

app.use(serve(__dirname + "/static", { maxage: 2592000000 }));
app.use(serve(__dirname + "/node_modules/chess.js", { maxage: 2592000000 }));

// init server
var server = require('http').createServer(app.callback());
var io = require('socket.io')(server);

// socket middleware
io.on('connection', routes.socket);

// listen
server.listen(3000);
console.log('listening on port 3000');
