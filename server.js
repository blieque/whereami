const WebSocketServer = require('websocket').server;
const http = require('http');

const locations = require('./locations.json');

const connections = [];

const server = http.createServer((request, response) => {
  log(`Received request for ${request.url}`);
  response.writeHead(404);
  response.end();
});

server.listen(
  9000,
  () => {
    log('Server is listening on port 9000');
  },
);

wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false,
});

const log = (message) => {
  console.log(`${(new Date()).toISOString()}: ${message}`);
};

wsServer.on('request', (request) => {
  // Make sure we only accept requests from an allowed origin
  if (
    ![
      'http://localhost:8000',
      'http://192.168.1.1:8000',
      'https://geolite.blieque.co.uk',
    ].includes(request.origin)
  ) {
    request.reject();
    log(`Connection from origin '${request.origin}' rejected`);
    return;
  }

  const connection = request.accept('geo', request.origin);
  connections.push(connection);
  log(`Connection from ${connection.remoteAddress} accepted`);
  log(` └ current connections: ${connections.length}`);

  connection._meta = {};

  connection.on(
    'message',
    (message) => {
      // if (message.type !== 'utf8') connection.close();
      if (message.type === 'utf8') {
        log(`Received: "${message.utf8Data}"`);
        const payload = JSON.parse(message.utf8Data);

        switch (payload.type) {
          case 'getPosition':
            if (locations[payload.locationID] !== undefined) {
              log(`Providing map position for location "${payload.locationID}" to ${connection.remoteAddress}`);
              connection.sendUTF(JSON.stringify({
                type: 'position',
                latitude: locations[payload.locationID].latitude,
                longitude: locations[payload.locationID].longitude,
              }));
              log(`Remembering location "${payload.locationID}" for ${connection.remoteAddress}`);
              connection._meta.locationID = payload.locationID;
            } else {
              log(`Ignoring request from ${connection.remoteAddress} for non-existent location "${payload.locationID}"`);
            }
            break;

          case 'reveal':
            log(`Sending solutions`);
            connections.forEach((connection) => {
              connection.sendUTF(JSON.stringify({
                type: 'reveal',
                name: locations[connection._meta.locationID].name,
              }));
            });
            break;
        }
      }
    },
  );

  connection.on(
    'close',
    () => {
      connections.splice(
        connections.indexOf(connection),
        1,
      );
      log(`Connection to ${connection.remoteAddress} closed.`);
      log(` └ current connections: ${connections.length}`);
    },
  );
});
