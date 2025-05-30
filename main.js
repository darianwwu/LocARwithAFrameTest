import 'aframe';
//import './locar-aframe/dist/locar-aframe.es.js';
import 'locar-aframe';
import 'aframe-look-at-component';

let firstLocation = true;
const locarCamera = document.querySelector('[locar-camera]');
const scene = document.querySelector('a-scene');

// Einfaches Textfeld für Heading anzeigen
const headingDisplay = document.createElement('div');
headingDisplay.style.position = 'absolute';
headingDisplay.style.top = '10px';
headingDisplay.style.left = '10px';
headingDisplay.style.padding = '8px 12px';
headingDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
headingDisplay.style.color = 'white';
headingDisplay.style.fontFamily = 'monospace';
headingDisplay.style.fontSize = '14px';
headingDisplay.style.zIndex = '999';
headingDisplay.innerText = 'Heading: --°';
document.body.appendChild(headingDisplay);

locarCamera.addEventListener('gpsupdate', e => {
    // Default location is lat 0, lon 0 so ignore gpsupdate if for this location
    if (
        e.detail.position.coords.latitude != 0 &&
        e.detail.position.coords.longitude != 0 &&
        firstLocation
    ) {
        alert(`Got the initial location: longitude ${e.detail.position.coords.longitude}, latitude ${e.detail.position.coords.latitude}`);

        const testMarkers = [
            {
                longitude: 7.651059,
                latitude: 51.935260
            },
            {
                longitude: 7.651110,
                latitude: 51.933416
            },
            {
                longitude: 7.653852,
                latitude: 51.934496
            },
            {
                longitude: 7.658851,
                latitude: 51.934513
            },
            {
                longitude: 7.648327,
                latitude: 51.934420
            }
        ];

        for (const marker of testMarkers) {
            const box = document.createElement("a-image");
            box.setAttribute("locar-entity-place", {
                latitude: marker.latitude,
                longitude: marker.longitude
            });
            box.setAttribute('src', "./images/map-marker-schwarz.png");
            box.setAttribute('scale', {
                x: 10,
                y: 10,
                z: 10
            });
            box.setAttribute('look-at', '[locar-camera]');
            scene.appendChild(box);
        }

        firstLocation = false;
    }
});

setInterval(() => {
    const yRotation = THREE.MathUtils.radToDeg(locarCamera.object3D.rotation.y);
    let heading = (360 - yRotation) % 360;
    headingDisplay.innerText = `Heading: ${heading.toFixed(0)}°`;
}, 200);