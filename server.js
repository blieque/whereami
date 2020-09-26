const WebSocketServer = require('websocket').server;
const http = require('http');

const locations = {
  '7b9453e': {
    name: 'Rotterdam',
    notes: [
      'Name on building to the north-north-east',
      'Bikes',
      'Driving on the right',
    ],
    difficulty: 5,
    latitude: 51.9123495,
    longitude: 4.4830536,
    link: 'https://www.google.co.uk/maps/@51.9123495,4.4830536,20z',
  },
  '723431c': {
    name: 'Marseille',
    notes: [
      'Name on sign to university',
      'South of France feel',
    ],
    difficulty: 3,
    latitude: 43.3051315,
    longitude: 5.3806031,
    link: 'https://www.google.co.uk/maps/@43.3051315,5.3806031,20z',
  },
  '0cf9997': {
    name: 'Sofia',
    notes: [
      'Name on barrier, right of Jesus',
      'Flag',
      'Cyrillic and English',
    ],
    difficulty: 8,
    latitude: 42.6974833,
    longitude: 23.3220823,
    link: 'https://www.google.co.uk/maps/@42.6974833,23.3220823,20z',
  },
  '88376cd': {
    name: 'Vienna',
    notes: [
      'Zurich insurance trickery',
    ],
    difficulty: 9,
    latitude: 48.22213,
    longitude: 16.3977179,
    link: 'https://www.google.co.uk/maps/@48.22213,16.3977179,20z',
  },
  'd282f31': {
    name: 'Sydney',
    notes: [
      'Name in "Sydney\'s Best Fish and Chips"',
    ],
    difficulty: 4,
    latitude: -33.891112,
    longitude: 151.2743281,
    link: 'https://www.google.co.uk/maps/@-33.891112,151.2743281,20z',
  },
  '83751fe': {
    name: 'Geneva',
    notes: [
      'Jet d\'Eau',
      'Swiss flag',
    ],
    difficulty: 2,
    latitude: 46.2079471,
    longitude: 6.14877,
    link: 'https://www.google.co.uk/maps/@46.2079471,6.14877,20z',
  },
  'b0a8a17': {
    name: 'Geneva',
    notes: [
      'Jet d\'Eau',
      'Name in "Genevoiseries?"',
    ],
    difficulty: 7,
    latitude: 46.2113501,
    longitude: 6.1525779,
    link: 'https://www.google.co.uk/maps/@46.2113501,6.1525779,20z',
  },
  '7630e90': {
    name: 'Rio de Janeiro',
    notes: [
      'No name',
      'Sugar Loaf',
      'Canadian red herring',
    ],
    difficulty: 6,
    latitude: -22.9074212,
    longitude: -43.1269323,
    link: 'https://www.google.co.uk/maps/@-22.9074212,-43.1269323,20z',
  },
};

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
            log(`Providing map position for location ${payload.locationID} to ${connection.remoteAddress}`);
            connection.sendUTF(JSON.stringify({
              type: 'position',
              latitude: locations[payload.locationID].latitude,
              longitude: locations[payload.locationID].longitude,
            }));
            log(`Remembering location ${payload.locationID} for ${connection.remoteAddress}`);
            connection._meta.locationID = payload.locationID;
            break;

          case 'reveal':
            log(`Sending solutions`);
            connections.forEach((connection) => {
              connection.sendUTF(JSON.stringify({
                type: 'reveal',
                name: locations[connection._meta.locationID].name,
                link: locations[connection._meta.locationID].link,
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
