#!/usr/bin/env node

import {
  readdirSync,
  writeFileSync,
  readFileSync,
} from 'fs';

const locations = JSON.parse(readFileSync('locations.json'));
const games = JSON.parse(readFileSync('games.json'));

const enabledGames = games.filter(game => game.isEnabled !== false);
const allLocationIDs = locations.map(location => location.id);
const gameLocationIDs = enabledGames.flatMap(game => game.locationIDs.flat());
const unusedLocationIDs = allLocationIDs
  .filter(locationID => !gameLocationIDs.includes(locationID));

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
*,
*::before,
*::after {
  position: relative;
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 2em 2em 2em 3em;
  /*
  background: linear-gradient(
    0deg,
    #eba 0.8px,
    transparent 0.8px
  );
  background-size: 0.6em 1em;
  */

  font-family:
    'Inter',
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    Helvetica Neue,
    Helvetica,
    Segoe UI,
    sans-serif,
    Apple Color Emoji,
    Segoe UI Emoji;
  line-height: 1;
  font-size: 1em;
  letter-spacing: 0.01em;
}

article {
  margin-left: -1em;
  padding-left: 1em;
  position: relative;
}
article:not(:first-child) {
  margin-top: 2em;
}
article.isToday {
  color: #085b2c;
}
article.isToday::before {
  content: '';
  display: block;
  position: absolute;
  top: 0.25em;
  left: 0;
  bottom: 0.05em;
  width: 0.2em;
  background: #168c49;
}
article.isInPast {
  opacity: 0.7;
}

h1,
h2 {
  margin: 0;
  font-weight: 600;
  letter-spacing: 0.02em;
}
h1 {
  font-size: 1.1em;
  line-height: calc(1 / 1.1);
}
h2 {
  font-size: 1em;
}

p,
ol,
ul {
  margin: 0;
}

article ::marker {
  content: '';
}

li {
  display: flex;
  align-items: baseline;
}

ol,
ul {
  padding-left: 0;
}

article > ol {
  counter-reset: listItems;
}
article ol ol {
  counter-reset: subListItems;
  flex-grow: 1;
  list-style: lower-alpha;
}

article > ol > li {
  counter-increment: listItems;
}
article ol ol li {
  counter-increment: subListItems;
}

article > ol > li::before,
article > ol ol li::before {
  padding-right: 0.3em;
  text-align: right;
}
article > ol > li::before {
  content: counter(listItems) '.';
  flex-basis: 2em;
}
article > ol ol li::before {
  content: counter(subListItems, lower-alpha) '.';
  flex-basis: 1.5em;
}

article > ol,
article > ol > li:not(:first-child),
h1 + ul,
h1 + ul > li:not(:first-child) {
  margin-top: 0.5em;
}

article li > a,
h1 + ul a {
  margin-left: 0.3em;
}

time {
  opacity: 0.5;
  font-size: 0.8em;
}

a {
  /* Fix Firefox and Chrome leading */
  line-height: 0.9;
}

code {
  font-family:
    Menlo,
    Consolas,
    monospace;
}

body:not(.show-secrets) hr,
body:not(.show-secrets) hr ~ *,
body:not(.show-secrets) li span,
body:not(.show-secrets) article.isInFuture {
  display: none;
}

ul li::before {
  content: '—';
  flex-basis: 2em;
  padding-right: 0.4em;
  text-align: right;
}

li span {
  flex-grow: 1;
  text-indent: calc(100% - 100vw + 38em);
  opacity: 0.7;
}

li span.isUsed {
  opacity: 0.5;
  text-decoration: line-through;
}

hr {
  margin: 2em 0 1.875em;
  border: none;
  border-top: 0.125em solid rgba(0, 0, 0, 0.25);
}
`;

const locationAsHTML = (location) => {
  const difficultyPair = DIFFICULTIES[location.difficulty - 1];
  const difficulty = `${difficultyPair[1]} (${location.difficulty}/10)`;

  const url = `${URL_BASE}${location.id}`;
  const link = h('a', { href: url }, h('code', location.id));

  const extra = h(
    'span',
    { class: location.isUsed ? 'isUsed' : '' },
    [
      `${location.flag} ${location.name}`,
      location.bonus
        ? ` – ${h('a', { href: `${URL_BASE}bonus/${location.bonus}` }, location.bonus)}`
        : '',
    ],
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

const gameListHTML = h([
  h('h1', 'Games'),

  enabledGames.map((game) => {
    return h(
      'article',
      { class: 'game' },
      [
        game.date
          ? h('p', h('time', { datetime: game.date }, game.date))
          : [],

        h('h2', [
          'Where Am I?',
          game.title ? ` – ${game.title}` : '',
        ]),

        h('ol',
          game.locationIDs
            .map(shorthandLocationAsHTML)
            .map(content => h('li', content))
            .join('\n')
        ),
      ],
    );
  }),
]);

const locatonListHTML = h([
  h('h1', 'Unused locations'),
  h('ul', unusedLocationIDs
    .map(getLocationByID)
    .map(locationAsHTML)
    .map(wrapH('li', {}))
  ),
]);

const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Geolite Games</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600" rel="stylesheet">
    <style>
      ${STYLES}
    </style>
  </head>
  <body>
    ${gameListHTML}

    ${unusedLocationIDs.length > 0
      ? `<hr>${locatonListHTML}`
      : ''}

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
      Array.from(document.querySelectorAll('article'))
        .forEach(elArticle => {
          const elTime = elArticle.querySelector('time');
          if (dateToday.startsWith(elTime.innerText)) {
            elArticle.classList.add('isToday');
          } else if (dateToday > elTime.innerText) {
            elArticle.classList.add('isInPast');
          } else {
            elArticle.classList.add('isInFuture');
          }
        });
    </script>
  </body>
</html>
`;

writeFileSync('games.html', html);
