// note, io.listen(<port>) will create a http server for you
var _ = require('underscore')._;

var io = require('socket.io').listen(9999);

io.enable('browser client minification'); // send minified client
io.enable('browser client etag'); // apply etag caching logic based on version number
io.enable('browser client gzip'); // gzip the file
io.set('log level', 0); // reduce logging
io.set('transports', ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']);

var Room = io.sockets.on('connection', function(socket) {

  var joinedRoom = null;
  var clientRole = null; // as default, game is manager
  var maxClients = 0;
  var name = null;

  socket.on('connect', function() {
    // socket.broadcast.emit('user connected');
  });

  socket.on('disconnect', function() {
    if (clientRole == 'manager') {
      socket.broadcast.to(joinedRoom).emit('managerDisconnected', true);
    } else {
      io.sockets.in(joinedRoom).emit('clientLeftTheRoom', {
        name: name,
        socketId: socket.id
      });
    }
  });

  socket.on('subscribe', function(data, fn) {
    // console.log(io.transports[socket.id].name); // connection type, eg. websocket

    // if manager (game)
    if (!_.isUndefined(data.clientRole) && data.clientRole == 'manager') {

      socket.join(data.room);

      joinedRoom = data.room; // string (client id)
      clientRole = data.clientRole; // MANAGER || CLIENT
      maxClients = data.maxClients; // int

      socket.store.data = {
        clientRole: data.clientRole,
        maxClients: data.maxClients
      };

      fn({
        'room': data.room
      });

    } else if (!_.isUndefined(data.clientRole) && data.clientRole == 'client') { // if client

      var result = {};

      name = data.name;
      clientRole = data.clientRole;

      // check that room exists
      if (!io.sockets.clients(data.room).length) {
        result = {
          'code': 404,
          'msg': 'Pelihuonetta ei löydy'
        };
      } else {

        if (!_.isNull(io.sockets.clients(data.room)[0].store.data)) {
          maxClients = io.sockets.clients(data.room)[0].store.data.maxClients || 0;
        }

        // room maxClients count
        if (io.sockets.clients(data.room).length > maxClients) {
          result = {
            'code': 403,
            'msg': 'Pelihuone on täynnä'
          };
        } else {
          // join to the room
          socket.join(data.room);

          joinedRoom = data.room;
          name = data.name;

          io.sockets.in(joinedRoom).emit('clientJoinedToRoom', {
            name: name,
            socketId: socket.id
          });

          result = {
            'code': 200,
            'msg': 'Liityit pelihuoneeseen'
          };
        }
      }

      fn(result);

    } else { // with no role
      // join to the room
      socket.join(data.room);

      joinedRoom = data.room;
      name = data.name;

      io.sockets.in(joinedRoom).emit('clientJoinedToRoom', {
        name: name,
        socketId: socket.id
      });

      fn({
        'code': 200,
        'msg': 'Liityit pelihuoneeseen'
      });

    }
  });

socket.on('c', function(data) {

    // add from value
    if (clientRole == 'client') {
      // send control message to game
      io.sockets.socket(joinedRoom).emit('c', socket.id, data.obj);
    } else {
      // send control message to all clients
      io.sockets.in(joinedRoom).emit('c', null, data.obj);
    }

  });

socket.on('unsubscribe', function(data) {
  io.sockets.in(joinedRoom).emit('clientLeftTheRoom', {
    name: name,
    socketId: socket.id
  });
  socket.leave(data.room);
});

});

