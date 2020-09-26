const elPanorama = document.querySelector('.panorama');

const elReveal = document.querySelector('.reveal');
const elRevealName = document.querySelector('.reveal__name');
// const elRevealCursor = document.querySelector('.reveal__cursor');
const elRevealLink = document.querySelector('.reveal__link');

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
  const connection = new WebSocket(`ws://${location.hostname}:9000`, 'geo');

  console.log(`Reqesting position for location ${locationID}`);
  connection.addEventListener(
    'open',
    () => {
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
        case 'position':
          initPanorama(payload.latitude, payload.longitude);
          break;

        case 'reveal':
          reveal(payload.name, payload.link);
          break;
      }
    },
  );

  window.sendRevealMessage = () => {
    connection.send(JSON.stringify({
      type: 'reveal',
    }));
  };
};

// const initCursor = () => {
//   window.addEventListener('mousemove', (event) => {
//     // screenX, pageX, layerX, clientX
//     elRevealCursor.style.transform =
//       `translate(calc(${event.clientX}px - 50%), calc(${event.clientY}px - 50%))`;
//   });
// };

const reveal = (name, link) => {
  const longestWordLength = name
    .split(' ')
    .map(part => part.length)
    .reduce((a, b) => Math.max(a, b));
  elReveal.style.fontSize = `${100 / longestWordLength}vw`;

  splitSpanLetters(name);

  setTimeout(
    () => {
      elReveal.classList.add('reveal--revealed');
    },
    50,
  );

  // initCursor();
  elRevealLink.href = link;
};

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

// INIT
const locationID = location.pathname.slice(1) || location.hash.slice(1);
initConnection(locationID);
// reveal('Newcasle upon Tyne');
