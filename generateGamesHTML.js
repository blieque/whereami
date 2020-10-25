#!/usr/bin/env node

const fs = require('fs');

const locations = require('./locations.json');
const games = require('./games.json');

const URL_BASE = 'https://geolite.blieque.co.uk/';

DIFFICULTIES = [
  // 1
  ['🔵', 'Dead easy'],
  // 2
  ['🟢', 'Real Easy'],
  // 3
  ['🟢', 'Easy'],
  // 4
  ['🟡', 'Easy-ish'],
  // 5
  ['🟡', 'Mild'],
  // 6
  ['🟠', 'Medium'],
  // 7
  ['🟠', 'Tricky'],
  // 8
  ['🔴', 'Tough'],
  // 9
  ['🔴', 'Hard'],
  // 10
  ['⚫', 'Cruel'],
];

const STYLES = `
body {
  margin: 2em;
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    Helvetica Neue,
    Helvetica,
    Segoe UI,
    sans-serif,
    Apple Color Emoji,
    Segoe UI Emoji;
}

p,
ol {
  margin: 0;
  line-height: 1;
}

p:not(:first-child) {
  margin-top: 2em;
}

ol {
  padding-left: 2em;
}

ol ol {
  padding-left: 1.5em;
  list-style: lower-alpha;
}

p + ol > li {
  margin-top: 0.5em;
}

strong {
  font-weight: 600;
}

body:not(.show-secrets) hr,
body:not(.show-secrets) hr ~ *,
body:not(.show-secrets) li span {
  display: none;
}

li span {
  float: right;
  width: calc(100vw - 38em);
  opacity: 0.7;
}

li span.isUsed {
  opacity: 0.5;
  text-decoration: line-through;
}

hr {
  margin: 2em 0;
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.5);
}

hr ~ ul {
  padding-left: 1.3em;
}

hr ~ ul li {
  list-style: '— ';
}

code {
  font-family:
    Menlo,
    Consolas,
    monospace;
}
`;

const wrapInAnchorTag = (url, content) => {
  return `<a href="${url}">${content || url}</a>`;
};

const wrapInTag = (tag) => {
  return (input) => {
    return `<${tag}>${input}</${tag}>`;
  };
};

const locationAsHTML = (location) => {
  const difficultyPair = DIFFICULTIES[location.difficulty - 1];
  const difficulty = `${difficultyPair[1]} (${location.difficulty}/10)`;
  const link = wrapInAnchorTag(`${URL_BASE}${location.id}`);
  const bonus = location.bonus
    ? ` – ${wrapInAnchorTag(`${URL_BASE}bonus/${location.bonus}`, location.bonus)}`
    : '';
  const extra = `<span class="${location.isUsed ? 'isUsed' : ''}">${location.flag} ${location.name}${bonus}</span>`;
  return `${difficulty}: ${link}${extra}`;
};

const getLocationByID = (locationID) => {
  return locations.find(location => location.id === locationID);
};

const shorthandLocationAsHTML = (shorthandLocation) => {
  return Array.isArray(shorthandLocation)
  ? `<ol>${shorthandLocation
    .map(getLocationByID)
    .map(locationAsHTML)
    .map(wrapInTag('li'))
    .join('\n')}</ol>`
  : locationAsHTML(getLocationByID(shorthandLocation));
};

const content = games
  .filter(game => game.isEnabled !== false)
  .map((game) => {
    const title = `<p><strong>Where Am I?</strong>${game.title ? ` – ${game.title}` : ''}</p>`;
    const list = `<ol>${game.locations
      .map(shorthandLocationAsHTML)
      .map(wrapInTag('li'))
      .join('\n')}</ol>`;
    return `${title}${list}`;
  })
  .join('\n');

const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Geolite Games</title>
    <script>
      window.addEventListener(
        'keydown',
        (event) => {
          if (
            event.key === 'S' &&
            event.shiftKey
          ) document.body.classList.toggle('show-secrets');
        }
      )
    </script>
    <style>
      ${STYLES}
    </style>
  </head>
  <body>
    ${content}
    <hr>
    <ul>
      ${fs.readdirSync('.')
        .filter(file => file.endsWith('.html') || file.endsWith('.js'))
        .map(file => wrapInAnchorTag(`${URL_BASE}${file}`, file))
        .map(wrapInTag('code'))
        .map(wrapInTag('li'))
        .join('')}
    </ul>
  </body>
</html>
`;

fs.writeFileSync('games.html', html);
