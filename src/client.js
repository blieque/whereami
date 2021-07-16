const elPanorama = document.querySelector('.panorama');

const elCover = document.querySelector('.cover');
const elCoverCountdown = document.querySelector('.cover__countdown');

const elRevealer = document.querySelector('.revealer');

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

let position;

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

const initPanorama = () => {
  const streetViewPanorama = new google.maps.StreetViewPanorama(
    elPanorama,
    {
      ...(position.panoramaID != undefined
        ? {
          pano: position.panoramaID,
        }
        : {
          position: {
            lat: position.latitude,
            lng: position.longitude,
          },
        }),
      pov: {
        heading: 0,
        pitch: 0,
      },
      zoom: 0,
      addressControl: false,
      clickToGo: false,
      linksControl: false,
      motionTrackingControl: false,
      // panControl: false,
      // zoomControl: false,
      showRoadLabels: false,
    },
  );

  // Fetch the latitude and longitude from the Street View panorama instance and
  // add them to the global `position` object if the current location has none.
  setTimeout(
    () => {
      const panoramaLocation = streetViewPanorama.getLocation();
      if (
        position.panoramaID != undefined &&
        position.latitude == undefined &&
        position.longitude == undefined &&
        panoramaLocation.latLng != undefined
      ) {
        console.log('Using latitude and longitude from StreetViewPanorama');
        position.latitude = panoramaLocation.latLng.lat();
        position.longitude = panoramaLocation.latLng.lng();
      }
    },
    2000,
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
  );

  // If Google Maps gets too expensive, there's also the predictably lacklustre
  // Bing "Streetside".
  // https://www.bing.com/api/maps/sdk/mapcontrol/isdk/setviewtostreetside#JS
  /*
  var map = new Microsoft.Maps.Map(document.getElementById('myMap'), {
    // `credentials` if not passed in URL
    mapTypeId: Microsoft.Maps.MapTypeId.road,
    zoom: 18,
    center: new Microsoft.Maps.Location(28.332823, -81.492279),
    streetsideOptions: {
      showCurrentAddress: false,
      showExitButton: false,
      showProblemReporting: false,
      disablePanoramaNavigation: true,
      overviewMapMode: Microsoft.Maps.OverviewMapMode.hidden,
    },
  });
  map.setView({ mapTypeId: Microsoft.Maps.MapTypeId.streetside });
  */
};

const createUpdateCountdown = (hideCoverAt) => {
  return () => {
    const msUntilStart = hideCoverAt - Date.now();
    const secUntilStart = Math.ceil(msUntilStart / 1000);
    elCoverCountdown.innerText = secUntilStart;
  };
};

const showAndHideCover = (hideCoverAt) => {
  const now = Date.now();

  if (hideCoverAt > now) {
    elCover.classList.add('cover--show');

    const updateCountdown = createUpdateCountdown(hideCoverAt);
    updateCountdown();
    const intervalID = setInterval(updateCountdown, 100);

    setTimeout(
      () => {
        setTimeout(() => clearInterval(intervalID), 150);
        elCover.classList.remove('cover--show');
      },
      hideCoverAt - now,
    );
  }
};

const initConnection = ({
  locationID,
  silent,
  solo,
}) => {
  const wsScheme = location.protocol === 'http:' ? 'ws:' : 'wss:';
  const url = `${wsScheme}//${location.host}/socket`;
  console.log(`Opening WebSocket connection to ${url}`);
  const connection = new WebSocket(url, 'whoami');

  connection.addEventListener(
    'open',
    () => {
      console.log(`Reqesting position for location "${locationID}"`);
      connection.send(JSON.stringify({
        type: 'getPosition',
        locationID,
        silent,
        solo,
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
          initPanorama();
          if (typeof payload.startRoundAt === 'number') {
            showAndHideCover(payload.startRoundAt);
          }
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

  const delays = [...Array(name.length)].map(_ => Math.random());
  const minDelay = delays.reduce((a, b) => Math.min(a, b), 1);
  const scaleFactor = 1 / (
    delays.reduce((a, b) => Math.max(a, b), 0) -
    minDelay
  );
  // Offset and scale the delays so that the smallest is always 0 and the
  // largest is always 1.
  const offsetDelays = delays.map(delay => (delay - minDelay) * scaleFactor);

  name
    .split('')
    .map((character, i) => {
      const el = document.createElement(character !== ' ' ? 'span' : 'br');
      if (character !== ' ') {
        el.classList.add('reveal__character');
        el.innerText = character;
        el.style.transitionDelay = `${offsetDelays[i] * 5}s`;
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
  elRevealer.classList.add('revealer--hidden');

  const longestWordLength = name
    .split(' ')
    .map(part => part.length)
    .reduce((a, b) => Math.max(a, b));
  elRevealName.style.fontSize = `${80 / longestWordLength}vmin`;
  splitSpanLetters(name);

  if (typeof flag === 'string') {
    elRevealFlag.innerText = flag;
    // Fix idiot operating systems with no flag emoji using OpenMoji.
    const codePoints = [0, 2]
      .map(index => flag.codePointAt(index))
      .map(codePoint => codePoint.toString(16))
      .map(codePoint => codePoint.toUpperCase())
      .join('-');
    const imageURL = `https://openmoji.org/data/color/svg/${codePoints}.svg`;
    elRevealFlag.innerHTML += `<img class="reveal__flag-image" src="${imageURL}"/>`;
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

  if (
    typeof position === 'object' &&
    position.latitude != undefined &&
    position.longitude != undefined
  ) {
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

// Parse config from URL
const configString = location.pathname.slice(1) || location.hash.slice(1);
const configArray = configString.split('!');
const config = {
  locationID: configArray[0],
  silent: configArray.includes('silent') || configArray.includes('solo'),
  solo: configArray.includes('solo'),
};

// Initialisation
if (navigator.userAgent.includes('Windows')) {
  document.body.classList.add('os--windows');
}

window.addEventListener(
  'keydown',
  (event) => {
    if (
      ['ArrowUp', 'ArrowDown'].includes(event.key) &&
      !event.metaKey &&
      !event.altKey &&
      !event.ctrlKey
    ) {
      event.stopPropagation()
    };
  },
  { capture: true },
);

if (config.solo) {
  elRevealer.classList.remove('revealer--hidden');
  elRevealer.addEventListener('click', () => {
    console.log(window.sendRevealMessage);
    window.sendRevealMessage();
  });
}

if (
  typeof config.locationID === 'string' &&
  config.locationID.length > 0
) {
  elReveal.style.display = 'none';
  makeElementDraggable(elRevealCluesContainer, elRevealClues);
  makeElementDraggable(elRevealBonusContainer, elRevealBonus);
  initConnection(config);
} else {
  console.error('No `locationID` found in `location.pathname` or `location.hash`');
}

// setTimeout(() => reveal('Novosibirsk', '🇷🇺', ['a clue']), 1500);
