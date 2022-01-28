# [Where Am I?](https://whereami.blieque.co.uk/)

*Where Am I?* is a simple geography game which can be played solo or with
others. It's a lot like GeoGuessr but is built to be played with group in a
conference call.

## Playing the Game

1. One person acts as gamemaster. The visit the
   [homepage](https://whereami.blieque.co.uk/) and choose a game to play.

1. The gamemaster presses S. This will:

    - **S**how the answers.
    - Remove `!solo` from the location links.
    - Enable *Copy* buttons on each round of each game.

1. The gamemaster clicks *Copy* on the first round of the chosen game and pastes
   the result in the text chat of the conference call.

1. The players simultaneously click the provided link and attempt to guess the
   city they're shown. Anyone may shout out an answer.

1. When the gamemaster hears the correct answer, they reveal the location to
   everyone by running `sendRevealMessage()` in the JavaScript console of the
   game page (not the list page).

1. For each subsequent round, the gamemaster clicks the corresponding *Copy*
   button and *replaces* their previous chat message with the new version. The
   players click the new link and the process repeats.

## Features

### Moving and Non-Moving Locations

Locations have a boolean `allowMovement` property. This controls whether players
can move down the road after the Street View panorama loads. If `false`, this
property means the players will be limited to the initial photosphere.

### Clues

Particularly useful for non-moving locations, a list of clues may be specified
with each location to show players what they should look out for in future
rounds.

### Bonuses

Particularly useful for the last round of a game, each location may specify a
bonus video filename. This video will be shown to the players shortly after the
city name is revealed. Videos are not included in the Git repository.

### Fairness Countdown

The first player to join the game at a particular city will trigger a
synchronised 10-second countdown for all players playing that same city. This
gives players a little more time to click the link when it appears in chat and
avoids penalising players with slower a internet connections. Google Maps loads
but is hidden from view while the countdown runs.

Additionally, after finishing, the countdown has its own 15-second cooldown,
preventing late arrivals to the game from triggering a second countdown and
being obstructed while others play.

### Solo and Silent Modes

URLs of game pages may have flags added to them, e.g., `https://whereami.blieque.co.uk/7b9453e!silent`

- `!solo` – Show the player their own "Reveal" button on the game page. Do not
  reveal other simultaneous games when a "solo" player presses reveal, only
  their own game.

- `!silent` – Join the game without triggering the fairness countdown.

## Adding Content

Locations are stored in `src/locations.json` and games are stored in
`src/games.json`. These files are pretty intuitive.

### Locations

`id` should be omitted when adding new locations. It will be added by the server
at startup and saved back to `locations.json`.

Some properties are optional:
- `isEnabled`, default `true`
- `latitude` and `longitude` if `panoramaID` is provided
- `panoramaID` if both `latitude` and `longitude` are provided
- `flag`, default `undefined`
- `allowMovement`, default `false`
- `clues`, default `undefined`
- `bonus`, default `undefined`

It is recommended to:

- Specify locations by `panoramaID` rather than `latitude` and `longitude` where
  possible, unless `allowMovement` is `true`. 

- Always either set `allowMovement` to `true` or provide an array of `clues`.
  `flag` will not be used if `clues` is not an array of clues.

`locations.json` is in the form:

```json
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
  // ...
]
```

### Games

Each game consists of an array of rounds. Each round is specified by a location
ID or an array of location IDs. In the latter case, all locations should be in
the same city and should be of differing difficulty.

`games.json` is in the form:

```json
[
  {
    "series": 1,
    "date": "2020-10-02",
    "locationIDs": [
      ["d282f31", "45523f4"],
      ["83751fe", "b0a8a17"],
      "cf3ff15"
    ]
  },
  // ...
]
```

## Deployment

The server application is started with `npm run start`. The application may be
deployed behind a webserver to handle TLS termination, serving bonuses, etc.
Below is a sample partial nginx `server` block.

```nginx
server {
  # ...

  location /bonus {}

  # Forward requests, including WebSockets, to the application server.
  location / {
    # Allow upgrading to WebSockets.
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';

    proxy_http_version 1.1;
    proxy_cache off;
    proxy_cache_bypass $http_upgrade;

    # Prevent 502 error.
    proxy_buffers 8 32k;
    proxy_buffer_size 64k;
    proxy_read_timeout 3600;

    proxy_pass http://127.0.0.1:8080/;
  }
}
```
