import {
  readdirSync,
  writeFileSync,
  readFileSync,
} from 'fs';

const URL_BASE = 'https://whereami.blieque.co.uk/';

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

const locations = JSON.parse(readFileSync(new URL('./locations.json', import.meta.url), 'utf8'));
const games = JSON.parse(readFileSync(new URL('./games.json', import.meta.url), 'utf8'));
const gamesTemplateHTML = readFileSync(new URL('./games.template.html', import.meta.url), 'utf8');

const enabledGames = games.filter(game => game.isEnabled !== false);
const allLocationIDs = locations.map(location => location.id || location.name);
const gameLocationIDs = enabledGames.flatMap(game => game.locationIDs.flat());
const unusedLocationIDs = allLocationIDs
  .filter(locationID => !gameLocationIDs.includes(locationID));

const parseTagShorthand = (input) => {
  if (
    typeof input !== 'string' ||
    input.length === 0
  ) return null;

  // No attempt to validate element, class or ID names.
  const parts = input.match(/((?:^|\.|#)[^#.\n\s]+)/g);

  return {
    name: (
      !parts[0].startsWith('.') &&
      !parts[0].startsWith('#')
    ) ? parts[0] : 'div',
    id: parts
      .find(part => part.startsWith('#'))
      ?.slice(1),
    class: parts
      .filter(part => part.startsWith('.'))
      .map(part => part.slice(1)),
  };
};

const h = (...args) => {
  const element = parseTagShorthand(args[0]);

  const attributes = (
    typeof args[1] === 'object' &&
    !Array.isArray(args[1])
  ) ? args[1] : {};

  if (element !== null) {
    const classNames = [
      attributes?.class || [],
      element.class,
    ].flat().join(' ');
    if (classNames.length > 0) {
      attributes.class = classNames;
    }

    if (typeof attributes.id !== 'string') {
      attributes.id = element.id;
    }
  }

  const children = (
    args.find(argument => Array.isArray(argument)) ||
    args.slice(1).filter(argument => typeof argument === 'string').slice(0, 1)
  );

  const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']

  const attributeString = attributes != null
    ? Object.entries(attributes)
      .filter(([_, value]) => value !== false && value != null)
      .map(([key, value]) => {
        const valueString = key === 'class' && Array.isArray(attributes[key])
          ? value
            .filter(className => typeof className === 'string' && className.length > 0)
            .join(' ')
          : value;
        return value === true
          ? ` ${key}`
          : ` ${key}="${valueString}"`;
      })
      .join('')
    : '';

  const content = children
    .flat(10)
    .join('');

  if (args[0] === children) return content;

  return voidElements.includes(element.name)
    ? `<${element.name}${attributeString}>`
    : `<${element.name}${attributeString}>${content}</${element.name}>`;
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

const {
  code,
  li,
} = wrapH('code', 'li');

/**
 * If `round` is an array, this assumes all locations have the same `name` and
 * `bonus`.
 *
 * @param {Location | Array<Location>} round
 * @returns {string}
 */
const roundAsHTML = (round) => {
  const locations = Array.isArray(round) ? round : [round];

  const locationsHTML = locations.map((location) => {
    const difficultyPair = DIFFICULTIES[location.difficulty - 1];
    const difficulty = `${difficultyPair[1]} (${location.difficulty}/10)`;

    const url = `${URL_BASE}${location.id}`;
    const link = h('a', { href: url }, location.id);

    return h(
      '.location',
      {
        class: [
          location.isEnabled === false ? 'location--isDisabled' : '',
        ],
      },
      [
        difficulty,
        ': ',
        link,
      ],
    );
  });

  return h(
    '.round',
    [
      Array.isArray(round)
        ? h('ul', locationsHTML.map(li))
        : locationsHTML[0],
      h(
        'button',
        h('span', 'Copy'),
      ),
      h(
        '.round__locationName',
        [
          `${locations[0].flag} ${locations[0].name}`,
          locations[0].bonus
            ? ` – ${h('a', { href: `${URL_BASE}bonus/${locations[0].bonus}` }, locations[0].bonus)}`
            : '',
        ]
      ),
    ],
  );
};

/**
 * @param {string} locationIDOrName
 * @returns {Location}
 */
const getLocationByID = (locationIDOrName) => {
  return locations.find(location => (
    location.id === locationIDOrName ||
    location.name === locationIDOrName
  ));
};

const formatDate = (date) => {
  const monthAndDate = date.match(/[0-9]{2}-[0-9]{2}$/)?.[0] || '';
  return (
    monthAndDate > '12-11' &&
    monthAndDate <= '12-25'
  )
    ? `${date} 🌲`
    : date;
};

const gameListHTML = h(
  'section.gameList',
  enabledGames.map((game, i) => {
    return h(
      'article',
      { class: 'game' },
      [
        game.date
          ? h('p', h(
            'time',
            { datetime: game.date },
            formatDate(game.date),
          ))
          : [],

        h('h2', [
          'Where Am I?',
          h(
            'small',
            { style: 'font-weight: 400' },
            [
              ' – ',
              h(
                'a',
                { href: 'https://geolite.blieque.co.uk/games.html' },
                'Play previous games',
              ),
            ],
          ),
          ...(game.title || (i + 1) % 10 === 0
            ? [
              h('br'),
              h(
                'span',
                { style: 'font-weight: 500' },
                game.title || `Game ${(i + 1)}`,
              ),
            ]
            : []),
        ]),

        h(
          'ol',
          game.locationIDs
            .map(round => Array.isArray(round)
              ? round.map(getLocationByID)
              : getLocationByID(round))
            .map(roundAsHTML)
            .map(li),
        ),
      ],
    );
  }),
);

const unusedLocationListHTML = h(
  'section.unusedLocationList',
  [
    h('h2', 'Unused locations'),
    h('ul', unusedLocationIDs
      .map(getLocationByID)
      .map(roundAsHTML)
      .map(li)
    ),
  ],
);

const fileListHTML = h(
  'section.fileList',
  h(
    'ul',
    readdirSync(new URL('./', import.meta.url))
      .filter(file => file.endsWith('.html') || file.endsWith('.js'))
      .map(file => h('a', { href: `${URL_BASE}${file}` }, file))
      .map(code)
      .map(li),
  ),
);

const gamesDocumentHTML = gamesTemplateHTML.replace(
  '{content}',
  [
    gameListHTML,
    unusedLocationIDs.length > 0
      ? `${unusedLocationListHTML}`
      : '',
    fileListHTML,
  ]
    .filter(part => part.length > 0)
    .join('<hr>'),
);

writeFileSync(new URL('./games.html', import.meta.url), gamesDocumentHTML);
