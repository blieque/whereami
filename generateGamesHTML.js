#!/usr/bin/env node

import {
  readdirSync,
  writeFileSync,
  readFileSync,
} from 'fs';

const locations = JSON.parse(readFileSync('locations.json'));
const games = JSON.parse(readFileSync('games.json'));

const h = (...args) => {
  const name = typeof args[0] === 'string' ? args[0] : null;
  const attributes = (
    typeof args[1] === 'object' &&
    !Array.isArray(args[1])
  ) ? args[1] : null;
  const children = (
    args.find(argument => Array.isArray(argument)) ||
    args.slice(1).filter(argument => typeof argument === 'string').slice(0, 1)
  );

  const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']

  const attributeString = attributes != null
    ? Object.keys(attributes)
      .filter(key => attributes[key] !== false && attributes[key] != null)
      .map(key => attributes[key] === true ? ` ${key}` : ` ${key}="${attributes[key]}"`)
      .join('')
    : '';

  const content = children
    .flat(10)
    .join('');

  if (args[0] === children) return content;

  return voidElements.includes(name)
    ? `<${name}${attributeString}>`
    : `<${name}${attributeString}>${content}</${name}>`;
};

/**
 * ```
 * const {h1, h2} = wrapH('h1', 'h2');
 * const br = wrapH('br');
 * const mark = wrapH('mark', { 'data-m': true });
 * ```
 */
const wrapH = function (defaultName, defaultAttributes, defaultChildren) {
  const argumentsArray = [...arguments];
  if (
    argumentsArray.length > 1 &&
    argumentsArray.every(argument => typeof argument === 'string')
  ) {
    return argumentsArray
      .reduce((acc, argument) => ({
        ...acc,
        [argument]: (attributes = {}, children = []) => h(argument, attributes, children),
      }), {});
  } else {
    if (defaultAttributes === undefined) {
      return (...args) => h(defaultName, args[0], args[1]);
    }
    if (defaultChildren === undefined) {
      return (...args) => h(defaultName, defaultAttributes, args[0]);
    }
    return () => h(defaultName, defaultAttributes, defaultChildren);
  }
};

const URL_BASE = 'https://geolite.blieque.co.uk/';

const DIFFICULTIES = [
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

time {
  color: rgba(0, 0, 0, 0.5);
  font-variant: small-caps;
}

time.today,
time.today ~ strong {
  color: #4bb503;
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

const locationAsHTML = (location) => {
  const difficultyPair = DIFFICULTIES[location.difficulty - 1];
  const difficulty = `${difficultyPair[1]} (${location.difficulty}/10)`;

  const url = `${URL_BASE}${location.id}`;
  const link = h('a', { href: url }, url);

  const extra = h(
    'span',
    { class: location.isUsed ? 'isUsed' : '' },
    [
      `${location.flag} ${location.name}`,
      location.bonus
        ? ` – ${h('a', { href: `${URL_BASE}bonus/${location.bonus}` }, location.bonus)}`
        : '',
    ]
  );

  return `${difficulty}: ${link}${extra}`;
};

const getLocationByID = (locationID) => {
  return locations.find(location => location.id === locationID);
};

const shorthandLocationAsHTML = (shorthandLocation) => {
  return Array.isArray(shorthandLocation)
  ? h('ol', shorthandLocation
    .map(getLocationByID)
    .map(locationAsHTML)
    .map(content => h('li', content))
    .join('\n'))
  : locationAsHTML(getLocationByID(shorthandLocation));
};

const content = games
  .filter(game => game.isEnabled !== false)
  .map((game) => {
    const title = h('p', [
      game.date ? [
        h('time', { datetime: game.date }, game.date),
        h('br'),
      ] : [],
      h('strong', [
        'Where Am I?',
        game.title ? ` – ${game.title}` : '',
      ]),
    ]);
    const list = h('ol',
      game.locations
        .map(shorthandLocationAsHTML)
        .map(content => h('li', content))
        .join('\n')
    );
    return `${title}${list}`;
  })
  .join('\n');

const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Geolite Games</title>
    <style>
      ${STYLES}
    </style>
  </head>
  <body>
    ${content}
    <hr>
    <ul>
      ${readdirSync('.')
        .filter(file => file.endsWith('.html') || file.endsWith('.js'))
        .map(file => h('a', { href: `${URL_BASE}${file}` }, file))
        .map(wrapH('code', {}))
        .map(wrapH('li', {}))
        .join('')}
    </ul>

    <script>
      window.addEventListener(
        'keydown',
        (event) => {
          if (
            event.key === 'S' &&
            event.shiftKey
          ) document.body.classList.toggle('show-secrets');
        }
      );

      const dateToday = (new Date()).toISOString();
      Array.from(document.getElementsByTagName('time'))
        .forEach(elTime => {
          if (dateToday.startsWith(elTime.innerText)) {
            elTime.classList.add('today');
          }
        });
    </script>
  </body>
</html>
`;

writeFileSync('games.html', html);
