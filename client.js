const elPanorama = document.querySelector('.panorama');

const elReveal = document.querySelector('.reveal');
const elRevealName = document.querySelector('.reveal__name');
const elRevealLink = document.querySelector('.reveal__link');
const elRevealCluesContainer = document.querySelector('.reveal__clues-container');
const elRevealClues = document.querySelector('.reveal__clues');
const elRevealCluesList = document.querySelector('.reveal__clues-list');
const elRevealFlag = document.querySelector('.reveal__flag');
const elRevealBonusContainer = document.querySelector('.reveal__bonus-container');
const elRevealBonus = document.querySelector('.reveal__bonus');
const elRevealBonusVideo = document.querySelector('.reveal__bonus-video');

if (navigator.userAgent.includes('Windows')) {
  document.body.classList.add('os--windows');
}

const makeElementDraggable = (el, elHandle) => {
  let initialMousePosition = null;
  let initialElementPosition = { x: 0, y: 0 };

  const moveElement = (event) => {
    const deltaX = event.clientX - initialMousePosition.x;
    const deltaY = event.clientY - initialMousePosition.y;

    const positionX = initialElementPosition.x + deltaX;
    const positionY = initialElementPosition.y + deltaY;

    el.style.transform =
      `translate(${positionX}px, ${positionY}px)`;
  };

  const dropElement = () => {
    initialMousePosition = null;

    window.removeEventListener('mousemove', moveElement);
    window.removeEventListener('touchmove', moveElement);

    window.removeEventListener('mouseup', dropElement);
    window.removeEventListener('touchend', dropElement);
    window.removeEventListener('touchcancel', dropElement);
  };

  const pickUpElement = (event) => {
    initialMousePosition = {
      x: event.clientX,
      y: event.clientY,
    };

    if (el.style.transform.includes('translate')) {
      initialElementMatch = el.style.transform
        .match(/translate\(([-0-9.]+)px(?:, ?([-0-9.]+)px)?\)/);

      initialElementPosition = {
        x: parseFloat(initialElementMatch[1]),
        y: parseFloat(initialElementMatch[2] || '0'),
      };
    }

    window.addEventListener('mousemove', moveElement);
    window.addEventListener('touchmove', moveElement);

    window.addEventListener('mouseup', dropElement);
    window.addEventListener('touchend', dropElement);
    window.addEventListener('touchcancel', dropElement);
  };

  (elHandle || el).addEventListener('mousedown', pickUpElement);
  (elHandle || el).addEventListener('touchstart', pickUpElement);
};

const initPanorama = (latitude, longitude) => {
  new google.maps.StreetViewPanorama(
    elPanorama,
    {
      position: {
        lat: latitude,
        lng: longitude,
      },
      pov: {
        heading: 0,
        pitch: 0,
      },
      zoom: 1,
      clickToGo: false,
      addressControl: false,
      linksControl: false,
      motionTrackingControl: false,
      // panControl: false,
      zoomControl: false,
      showRoadLabels: false,
    },
  );

  // Move `.reveal` inside the maps panorama element so that the overlay still
  // shows when the panorama is made full-screen.
  setTimeout(
    () => {
      const elGMStyle = document.querySelector('.panorama > .gm-style');
      if (elGMStyle !== null) {
        elGMStyle.appendChild(elReveal);
      }
    },
    1000,
  )
};

const initConnection = (locationID) => {
  // HTTP implies development server, HTTPS implies production
  const url = location.protocol === 'http:'
    ? `ws://${location.hostname}:9000`
    : `wss://${location.hostname}/socket`;
  console.log(`Opening WebSocket connection to ${url}`);
  const connection = new WebSocket(url, 'geo');

  let position;

  connection.addEventListener(
    'open',
    () => {
      console.log(`Reqesting position for location "${locationID}"`);
      connection.send(JSON.stringify({
        type: 'getPosition',
        locationID,
      }));
    },
  );

  connection.addEventListener(
    'message',
    (event) => {
      const message = event.data;
      const payload = JSON.parse(message);
      console.log(`Recieved: ${message}`);

      switch (payload.type) {
        /**
         * Server requests that the provided latitude and longitude be passed
         * to the Street View API.
         */
        case 'position':
          position = payload;
          initPanorama(payload.latitude, payload.longitude);
          break;

        /**
         * Server requests that the client reveal the provided name as the
         * solution.
         */
        case 'reveal':
          if (position === undefined) {
            console.warn('Received reveal request before receiving a position');
          } else {
            reveal(payload, position);
          }
          break;

        default:
          console.warn(`Unrecognised payload type "${payload.type}"`);
      }
    },
  );

  window.sendRevealMessage = () => {
    connection.send(JSON.stringify({
      type: 'reveal',
    }));
  };
};

const setClues = (clues) => {
  elRevealCluesList.innerHTML = '';

  clues.forEach((clue) => {
    const elClue = document.createElement('li');
    elClue.innerText = clue;
    elRevealCluesList.appendChild(elClue);
  })
};

/**
 * Split the word characters in `.reveal__name` into individual `<span>`s, and
 * replace any spaces with `<br>`s. Each `<span>` is given a random
 * `transition-delay` CSS property between 0 and 5 seconds.
 */
const splitSpanLetters = (name) => {
  elRevealName.innerHTML = '';
  name
    .split('')
    .map(character => {
      const el = document.createElement(character !== ' ' ? 'span' : 'br');
      if (character !== ' ') {
        el.classList.add('reveal__character');
        el.innerText = character;
        el.style.transitionDelay = `${Math.random() * 5}s`;
      }
      return el;
    })
    .forEach(elSpan => {
      elRevealName.appendChild(elSpan);
    });
};

/**
 * Update the Google Maps link based on the provided position, and then reveal
 * the name of the location, all smooth like.
 */
const reveal = ({name, flag, clues, bonus}, position) => {
  const longestWordLength = name
    .split(' ')
    .map(part => part.length)
    .reduce((a, b) => Math.max(a, b));
  elRevealName.style.fontSize = `${100 / longestWordLength}vmin`;
  splitSpanLetters(name);

  if (typeof flag === 'string') {
    elRevealFlag.innerText = flag;
  }

  if (
    clues != null &&
    clues.length > 0
  ) {
    elReveal.classList.add('reveal--showClues');
    setClues(clues);
  }

  if (bonus != null) {
    elReveal.classList.add('reveal--showBonus');
    elRevealBonusVideo.src = `bonus/${bonus}`;
    setTimeout(() => { elRevealBonusVideo.play() }, 8500);
  }

  if (typeof position === 'object') {
    elReveal.classList.add('reveal--showLink');
    elRevealLink.href =
      `https://www.google.co.uk/maps/@${position.latitude},${position.longitude},20z`;
  }

  elReveal.style = '';
  setTimeout(
    () => {
      elReveal.classList.add('reveal--revealed');
    },
    50,
  );
};

// Initialisation
const locationID = location.pathname.slice(1) || location.hash.slice(1);
if (
  typeof locationID === 'string' &&
  locationID.length > 0
) {
  elReveal.style.display = 'none';
  makeElementDraggable(elRevealCluesContainer, elRevealClues);
  makeElementDraggable(elRevealBonusContainer, elRevealBonus);
  initConnection(locationID);
} else {
  console.error('No `locationID` found in `location.pathname` or `location.hash`');
}

// setTimeout(() => reveal('Novosibirsk', '🇷🇺', ['a clue']), 1500);
