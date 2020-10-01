const elPanorama = document.querySelector('.panorama');

const elReveal = document.querySelector('.reveal');
const elRevealName = document.querySelector('.reveal__name');
const elRevealLink = document.querySelector('.reveal__link');
const elRevealCluesContainer = document.querySelector('.reveal__clues-container');
const elRevealClues = document.querySelector('.reveal__clues');

const initCluesDragging = () => {
  let initialMousePosition = null;
  let initialCluesPosition = { x: 0, y: 0 };

  // Move the card
  const moveClues = (event) => {
    const deltaX = event.clientX - initialMousePosition.x;
    const deltaY = event.clientY - initialMousePosition.y;

    const positionX = initialCluesPosition.x + deltaX;
    const positionY = initialCluesPosition.y + deltaY;

    elRevealCluesContainer.style.transform =
      `translate(${positionX}px, ${positionY}px)`;
  };

  // Drop the card
  const dropClues = () => {
    initialMousePosition = null;

    window.removeEventListener('mousemove', moveClues);
    window.removeEventListener('touchmove', moveClues);

    window.removeEventListener('mouseup', dropClues);
    window.removeEventListener('touchend', dropClues);
    window.removeEventListener('touchcancel', dropClues);
    // document.removeEventListener('mouseout', dropClues);
  };

  // Pick up the card
  const pickUpClues = (event) => {
    initialMousePosition = {
      x: event.clientX,
      y: event.clientY,
    };

    if (elRevealCluesContainer.style.transform.includes('translate')) {
      initialCluesMatch = elRevealCluesContainer.style.transform
        .match(/translate\(([-0-9.]+)px, ?([-0-9.]+)px\)/);
      initialCluesPosition = {
        x: parseFloat(initialCluesMatch[1]),
        y: parseFloat(initialCluesMatch[2]),
      };
    }

    window.addEventListener('mousemove', moveClues);
    window.addEventListener('touchmove', moveClues);

    window.addEventListener('mouseup', dropClues);
    window.addEventListener('touchend', dropClues);
    window.addEventListener('touchcancel', dropClues);
    // document.addEventListener('mouseout', dropClues);
  };

  elRevealClues.addEventListener('mousedown', pickUpClues);
  elRevealClues.addEventListener('touchstart', pickUpClues);
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
            reveal(payload.name, payload.clues, position);
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

/**
 * Update the Google Maps link based on the provided position, and then reveal
 * the name of the location, all smooth like.
 */
const reveal = (name, clues, position) => {
  const longestWordLength = name
    .split(' ')
    .map(part => part.length)
    .reduce((a, b) => Math.max(a, b));
  elRevealName.style.fontSize = `${100 / longestWordLength}vmin`;
  splitSpanLetters(name);

  if (clues?.length > 0) {
    setClues(clues);
    elReveal.classList.add('reveal--showClues');
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

const setClues = (clues) => {
  elRevealClues.innerHTML = '';

  clues.forEach((clue) => {
    const elClue = document.createElement('li');
    elClue.innerText = clue;
    elRevealClues.appendChild(elClue);
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

// Initialisation
const locationID = location.pathname.slice(1) || location.hash.slice(1);
if (locationID?.length > 0) {
  elReveal.style.display = 'none';
  initCluesDragging();
  initConnection(locationID);
} else {
  console.error('No `locationID` found in `location.pathname` or `location.hash`');
}
// reveal('Novosibirsk');
