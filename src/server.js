import { writeFile, readFileSync } from 'fs';
import { createServer } from 'http';
import { createHash } from 'crypto';

import websocket from 'websocket';

// Utilities

const prependLogMessage = (message) => {
  const messageString = Array.isArray(message) ? message.join('\n') : message;
  const prefix = `${(new Date()).toISOString()}: `;
  return messageString.replace(/^/gm, (_, index) => {
    return index === 0
      ? prefix
      : ' '.repeat(prefix.length)
  });
}

const log = (message) => {
  console.log(prependLogMessage(message));
};

const warn = (message) => {
  console.warn(prependLogMessage(message));
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
  - `latitude` and `longitude` if `panoramaID` is provided
  - `panoramaID` if both `latitude` and `longitude` are provided
  - `flag`, default `undefined`
  - `allowMovement`, default `false`
  - `clues`, default `undefined`
  - `bonus`, default `undefined`

  It is recommended to specify locations by `panoramaID` rather than `latitude`
  and `longitude` where possible, unless `allowMovement` is `true`. It is
  recommeded to always set `allowMovement` to `true` or provide an array of
  `clues`. `flag` will not be used if `clues` is not an array of clues.

  `locations.json` is in the form:

  ```
  [
    {
      "id": "231b158",
      "isEnabled": true,
      "name": "London",
      "panormaID": "AuEPJltHzwIzwxBBEDekQA",
      "latitude": 51.4779302,
      "longitude": -0.0014511,
      "difficulty": 2,
      "flag": "🇬🇧",
      "allowMovement": false,
      "clues": [
        "\"Royal Observatory\" the southeast",
        "London skyline to the north-northwest"
      ],
      "bonus": "01.mp4"
    },
    ...
  ]
  ```
 */
const locations = JSON.parse(readFileSync(new URL('./locations.json', import.meta.url)));

// Process locations

let modifiedLocations = 0;

log(`Validating locations`);
locations.forEach((location) => {
  if (
    location.isEnabled !== false &&
    typeof location.id === 'undefined'
  ) {
    const hash = createHash('md5');
    hash.update(
      location.panoramaID ||
      `${location.latitude},${location.longitude}`
    );
    location.id = hash.digest('hex').slice(0, 7);
    modifiedLocations += 1;
  }
});
log([
  'Validated locations',
  ` └ modified ${modifiedLocations} location(s)`,
]);

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
    'name',
    'panoramaID',
    'latitude',
    'longitude',
    'flag',
    'difficulty',
    'allowMovement',
    'clues',
    'bonus',
  ],
  2,
);
writeFile(
  new URL('./locations.json', import.meta.url),
  `${locationsJSON}\n`,
  'utf8',
  (error) => {
    if (error !== null) {
      log('Error encountered saving `locations.json`:');
      log(error);
    }
  },
);

log(`Loaded ${locations.length} locations:\n${
  objectArrayToTable(
    locations,
    ['id', 'name', 'difficulty', 'isEnabled'],
  )
}`);

// Initialise server

const origins = process.env.WHEREAMI_ORIGINS?.split(',');
if (Array.isArray(origins)) {
  const originsString = origins
    .map(origin => `\n ─ ${origin}`)
    .join('');
  log(`Loaded origin list:${originsString}`);
} else {
  warn(`No origin list found in $WHEREAMI_ORIGINS`);
}

const connections = [];
let startRoundAt = {};

const server = createServer((request, response) => {
  const url = new URL(
    request.url,
    `http://${request.headers.host || 'no-host-header-received'}`,
  );

  const publicFiles = [
    '/index.html',
    '/games.html',
    '/games.template.html',
    '/client.js',
    '/server.js',
    '/generateGamesHTML.js',
  ];

  let filePath = url.pathname;
  let redirect = '';

  if (filePath === '/games.html') redirect = '/';

  if (filePath.match(/^\/[0-9a-f]{7}(?:!.+)?$/) !== null) {
    filePath = '/index.html';
  }

  if (filePath === '/') filePath = '/games.html';

  let staticBody;
  if (publicFiles.includes(filePath)) {
    try {
      staticBody = readFileSync(new URL(`.${filePath}`, import.meta.url));
    } catch (error) {}
  }

  if (redirect?.length > 0) {
    response.writeHead(302, { 'Location': redirect });
    response.end();
  } else if (staticBody?.length > 0) {
    if (filePath.endsWith('.html')) {
      response.setHeader('Content-Type', 'text/html; charset=UTF-8');
    }
    if (filePath.endsWith('.js')) {
      response.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    }
    response.writeHead(200);
    response.write(staticBody);
    response.end();
  } else {
    response.writeHead(404);
    response.write('Not Found\n');
    response.end();
  }
});

server.listen(
  8080,
  () => {
    log('Server is listening on port 8080');
  },
);

const wsServer = new websocket.server({
  httpServer: server,
  autoAcceptConnections: false,
});

wsServer.on('request', (request) => {
  if (request.resource !== '/socket') return;

  // Only accept requests from allowed origins.
  if (
    Array.isArray(origins) &&
    !origins.includes(request.origin)
  ) {
    request.reject();
    log(`Connection from origin '${request.origin}' rejected`);
    return;
  }

  const connection = request.accept('whoami', request.origin);
  connections.push(connection);
  log([
    `Connection from ${connection.remoteAddress} accepted`,
    ` └ current connections: ${connections.length}`,
  ]);

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
           * Client requests that the server provide it the `panoramaID` or
           * `latitude` and `longitude` of a specified location (by
           * `locationID`).
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

            if (!payload?.silent) {
              const now = Date.now();
              // Wait 15 seconds after the round starts before starting another
              // countdown to allow for late arrivals
              if (now - (startRoundAt[location.name] || 0) > 15000) {
                log(`Setting round start time for ${location.name} location(s) to 10 seconds in the future`);
                startRoundAt[location.name] = now + 10000;

                // Clean up some time after the timestamp becomes irrelvant.
                setTimeout(
                  () => delete startRoundAt[location.name],
                  60000,
                );
              }
            }

            log(`Providing map position for location "${payload.locationID}" to ${connection.remoteAddress}`);
            connection.sendUTF(JSON.stringify({
              type: 'position',

              ...(!payload?.silent
                ? { startRoundAt: startRoundAt[location.name] }
                : null),

              ...(location.panoramaID !== undefined
                ? {
                  panoramaID: location.panoramaID,
                }
                : {
                  latitude: location.latitude,
                  longitude: location.longitude,
                }
              ),

              allowMovement: location.allowMovement,
            }));

            log(`Remembering location "${payload.locationID}" for ${connection.remoteAddress}`);
            connection._meta.locationID = payload.locationID;
            connection._meta.solo = payload.solo;

            break;

          /**
           * Client requests that the server tell all connected clients to
           * reveal their respective locations.
           */
          case 'reveal':
            const connectionsToReveal = connection._meta.solo
              ? [connection]
              : connections.filter(connection => !connection._meta.solo);
            log(`Sending solution to ${connectionsToReveal.length}${payload.solo ? ' solo' : ''} ${connectionsToReveal.length === 1 ? 'client' : 'clients'}`);
            connectionsToReveal.forEach((connection) => {
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
      log([
        `Connection to ${connection.remoteAddress} closed`,
        ` └ current connections: ${connections.length}`,
      ]);
    },
  );
});
