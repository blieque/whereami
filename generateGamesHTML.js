#!/usr/bin/env node

import {
  readdirSync,
  writeFileSync,
  readFileSync,
} from 'fs';

const locations = JSON.parse(readFileSync('locations.json', 'utf8'));
const games = JSON.parse(readFileSync('games.json', 'utf8'));
const gamesTemplateHTML = readFileSync('games.template.html', 'utf8');

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
      .map((key) => {
        const value = key === 'class' && Array.isArray(attributes[key])
          ? attributes[key]
            .filter(className => typeof className === 'string' && className.length > 0)
            .join(' ')
          : attributes[key];
        return attributes[key] === true
          ? ` ${key}`
          : ` ${key}="${value}"`;
      })
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

const locationAsHTML = (location) => {
  const difficultyPair = DIFFICULTIES[location.difficulty - 1];
  const difficulty = `${difficultyPair[1]} (${location.difficulty}/10)`;

  const url = `${URL_BASE}${location.id}`;
  const link = h('a', { href: url }, location.id);

  const extra = h(
    'span',
    [
      `${location.flag} ${location.name}`,
      location.bonus
        ? ` – ${h('a', { href: `${URL_BASE}bonus/${location.bonus}` }, location.bonus)}`
        : '',
    ],
  );

  return h(
    'div',
    {
      class: [
        location.isEnabled === false ? 'isDisabled' : '',
      ],
    },
    [difficulty, ': ', link, extra],
  );
};

const getLocationByID = (locationID) => {
  return locations.find(location => location.id === locationID);
};

const shorthandLocationAsHTML = (shorthandLocation) => {
  return Array.isArray(shorthandLocation)
    ? h('ul', shorthandLocation
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
            .map(content => h('li', [
              content,
              h(
                'button',
                h('span', 'Copy'),
              ),
            ]))
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

const gamesContentHTML = `
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
`;

const gamesDocumentHTML = gamesTemplateHTML.replace('{content}', gamesContentHTML);

writeFileSync('games.html', gamesDocumentHTML);
