const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

const WebSocketServer = require('websocket').server;

// Utilities

const log = (message) => {
  console.log(`${(new Date()).toISOString()}: ${message}`);
};

const warn = (message) => {
  console.warn(`${(new Date()).toISOString()}: ${message}`);
};

const getLocationByID = (locationID) => {
  return locations.find(location => location.id === locationID);
};

const defaultToTrue = (value) => {
  return typeof value === 'boolean'
    ? value
    : true;
};

const objectArrayToTable = (input, keys) => {
  const stringifiedInput = input.map(item => keys.reduce(
    (acc, key) => {
      const type = typeof item[key];
      let value;

      if (type === 'string') value = item[key];
      if (type === 'number') value = `${item[key]}`;
      if (type === 'boolean') value = item[key] ? '✓' : '✕';
      if (value === undefined) value = '';

      return {
        ...acc,
        [key]: value,
      };
    },
    {},
  ));

  const maxValueLengths = keys.reduce(
    (acc, key) => {
      return {
        ...acc,
        [key]: stringifiedInput
          .map(item => item[key])
          .map(s => s.length)
          .reduce(
            (a, b) => Math.max(a, b),
            key.length
          ),
      }
    },
    {},
  );

  return [
    // Heading row
    keys
      .map(k => k.toUpperCase().padEnd(maxValueLengths[k]))
      .join('  '),
    // Content rows
    ...stringifiedInput.map(item => keys
      .map(k => item[k].padEnd(maxValueLengths[k]))
      .join('  ')),
  ]
    .map(line => `  ${line}`)
    .join('\n');
};

/**
  `id` can be omitted when adding new locations. It will be added by the server
  at startup and saved back to `locations.json`.

  Some properties are optional:
  - `isEnabled`, default `true`
  - `isUsed`, default `false`
  - `flag`, default `undefined`
  - `bonus`, default `undefined`

  `locations.json` is in the form:

  ```
  [
    {
      "id": "231b158",
      "isEnabled": true,
      "isUsed": false,
      "name": "London",
      "clues": [
        "\"Royal Observatory\" the south-east",
        "London skyline to the north-north-west"
      ],
      "difficulty": 2,
      latitude: 51.4779733,
      longitude: -0.0015356,
    },
    ...
  ]
  ```
 */
const locations = require('./locations.json');

// Process locations

let modifiedLocations = 0;

log(`Validating locations`);
locations.forEach((location) => {
  if (typeof location.id === 'undefined') {
    const hash = crypto.createHash('md5');
    hash.update(`${location.latitude},${location.longitude}`);
    location.id = hash.digest('hex').slice(0, 7);
    modifiedLocations += 1;
  }
});
log(` └ modified ${modifiedLocations} locations`);

log(`Sorting locations`);
locations.sort((a, b) => {
  if (defaultToTrue(a.isEnabled) !== defaultToTrue(b.isEnabled)) {
    return defaultToTrue(a.isEnabled) ? -1 : 1;
  }

  if (a.name !== b.name) {
    return a.name < b.name ? -1 : 1;
  }

  if (a.difficulty !== b.difficulty) {
    return a.difficulty < b.difficulty ? -1 : 1;
  }

  return 0;
});

log(`Updating \`locations.json\` on the filesystem`);
const locationsJSON = JSON.stringify(
  locations,
  [
    'id',
    'isEnabled',
    'isUsed',
    'name',
    'flag',
    'difficulty',
    'latitude',
    'longitude',
    'clues',
    'bonus',
  ],
  2,
);
fs.writeFile(
  'locations.json',
  `${locationsJSON}\n`,
  'utf8',
  (error) => {
    if (error !== null) {
      log('Error encountered saving `locations.json`:');
      console.log(error);
    }
  },
);

log(`Loaded ${locations.length} locations:`);
console.log(objectArrayToTable(
  locations,
  ['id', 'name', 'difficulty', 'isEnabled', 'isUsed'],
));

// Initialise server

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

  // Create object to maintain per-connection state.
  connection._meta = {};

  connection.on(
    'message',
    (message) => {
      // Drop connection on unexpected message format.
      if (message.type !== 'utf8') connection.close();

      if (message.type === 'utf8') {
        log(`Received: "${message.utf8Data}"`);
        const payload = JSON.parse(message.utf8Data);

        switch (payload.type) {
          /**
           * Client requests that the server provide it the latitude and
           * longitude of a specified location (by `locationID`).
           */
          case 'getPosition':
            if (!(payload?.locationID?.length > 0)) {
              warn(`Ignoring request from ${connection.remoteAddress} for non-specified location`);
              break;
            }

            const location = getLocationByID(payload.locationID);
            if (
              location === undefined ||
              location.isEnabled === false // but not `undefined`
            ) {
              warn(`Ignoring request from ${connection.remoteAddress} for non-existent location "${payload.locationID}"`);
              break;
            }

            log(`Providing map position for location "${payload.locationID}" to ${connection.remoteAddress}`);
            connection.sendUTF(JSON.stringify({
              type: 'position',
              latitude: location.latitude,
              longitude: location.longitude,
            }));

            log(`Remembering location "${payload.locationID}" for ${connection.remoteAddress}`);
            connection._meta.locationID = payload.locationID;

            break;

          /**
           * Client requests that the server tell all connected clients to
           * reveal their respective locations.
           */
          case 'reveal':
            log(`Sending solutions`);
            connections.forEach((connection) => {
              const location = getLocationByID(connection._meta.locationID);
              if (location === undefined) {
                warn(`Couldn't find location "${connection._meta.locationID}" for ${connection.remoteAddress}`);
              } else {
                connection.sendUTF(JSON.stringify({
                  type: 'reveal',
                  name: location.name,
                  flag: location.flag,
                  clues: location.clues,
                  bonus: location.bonus,
                }));
              }
            });
            break;

          default:
            // Drop connection on unexpected payload type.
            warn(`Unrecognised payload type "${payload.type}"; dropping connection to ${connection.remoteAddress}`);
            connection.close();
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
      log(`Connection to ${connection.remoteAddress} closed`);
      log(` └ current connections: ${connections.length}`);
    },
  );
});
