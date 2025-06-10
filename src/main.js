import 'aframe';
import './locar-aframenew.js';
import { DeviceOrientationControlsOptional as DeviceOrientationControls } from './locarnew.js';
import 'aframe-look-at-component';
import { CompassGUI } from './compassGUI.js';
import { ARNavigationArrow } from './arNavigationArrow.js';
import { TargetMarker } from './targetMarker.js';
import { updateDistance } from './distanceOverlay.js';

// Elemente
const overlayContainer = document.getElementById('overlayContainer');
const arContainer      = document.getElementById('arContainer');
const lonInput         = document.getElementById('longitude');
const latInput         = document.getElementById('latitude');
const btnAdd           = document.getElementById('btnAddMarker');
const btnStart         = document.getElementById('btnStart');
const btnTest          = document.getElementById('btnTestAdd');
const markerPopup      = document.getElementById('markerPopup');
const markerPopupText  = document.getElementById('markerPopupText');
const closeButton      = document.getElementById('popupClose');
const distanceOverlay  = document.getElementById('distance-overlay');
const gpsIndicator      = document.querySelector('.gps-indicator');
const gpsAccuracyValue  = document.querySelector('.gps-accuracy-value');

// State
let sceneEl, renderer, cameraEl, threeCamera;
let locar, controls;
let compass, arrow;
let markers = [];
let targetCoords = [];
let indexActive = 0;
const currentCoords = { latitude: null, longitude: null };
let screenOrientation = { type: screen.orientation?.type, angle: screen.orientation?.angle };
const isIOS = navigator.userAgent.match(/iPhone|iPad|iPod/i);

// UI-Event-Handler
closeButton.addEventListener('click', () => {
  markerPopup.classList.remove('marker-popup--visible');
});

btnAdd.addEventListener('click', () => {
  console.log('Add marker clicked', lonInput.value, latInput.value);
  targetCoords.push({
    longitude: parseFloat(lonInput.value),
    latitude:  parseFloat(latInput.value),
    popupContent: 'Ziel aktualisiert!'
  });
  console.log('Current targetCoords:', targetCoords);
  showPopup('Marker hinzugefügt!', 1500);
});

// Test-Button zum Hinzufügen von Testmarkern, wird in der produktiven Version entfernt
btnTest.addEventListener('click', async () => {
  // Für Test Button aktuelle Position abrufen um Testpunkte zu setzen
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
    console.log('Current position:', pos);
    currentCoords.latitude  = pos.coords.latitude;
    currentCoords.longitude = pos.coords.longitude;
    console.log('Aktuelle Koordinaten gesetzt:', currentCoords);

    // Erzeuge 5 Testpunkte mit einfachen Offsets in unterschiedlichen Entfernungen und Richtungen
    const baseLat = currentCoords.latitude;
    const baseLon = currentCoords.longitude;

    const tests = [
      { latitude: baseLat + 0.00027, longitude: baseLon, popupContent: 'Testpunkt ~30m Nord' },
      { latitude: baseLat, longitude: baseLon + 0.0011, popupContent: 'Testpunkt ~80m Ost' },
      { latitude: baseLat - 0.0027, longitude: baseLon, popupContent: 'Testpunkt ~300m Süd' },
      { latitude: baseLat, longitude: baseLon - 0.0054, popupContent: 'Testpunkt ~400m West' },
      { latitude: baseLat + 0.0081, longitude: baseLon + 0.0081, popupContent: 'Testpunkt ~900m Nordost' }
    ];
    targetCoords.push(...tests);
    showPopup('5 Marker hinzugefügt!', 1500);
  } catch (err) {
    console.error('Fehler beim Abrufen der aktuellen Position:', err);
    showPopup('Fehler beim Abrufen der aktuellen Position', 3000);
  }
});

btnStart.addEventListener('click', async() => {
  console.log('Start button clicked');
  init();
  if (
    window.DeviceOrientationEvent &&
    typeof window.DeviceOrientationEvent.requestPermission === "function"
  ) {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result === "granted") {
        controls.connect();
      } else {
        alert("Ohne Zugriff auf Bewegungsdaten kann AR nicht starten.");
      }
    } catch (err) {
      console.error("Permission-Request schlug fehl:", err);
    }
  } else {
    controls.connect();
  }
  overlayContainer.remove();
  arContainer.style.display = 'block';

  console.log('Overlay removed, AR container shown');
});

/**
 * Hilfsfunktion, um ein Popup anzuzeigen.
 * @param {*} text Der Text, der im Popup angezeigt werden soll
 * @param {*} d Die Dauer in Millisekunden, nach der das Popup automatisch geschlossen wird (0 für kein automatisches Schließen)
 */
function showPopup(text, d) {
  markerPopupText.textContent = text;
  markerPopup.classList.add('marker-popup--visible');
  if (d > 0) {
    setTimeout(() => {
      markerPopup.classList.remove('marker-popup--visible');
    }, d);
  }
}

/**
 * Initialisiert die AR-Szene, setzt die Kamera und registriert Event-Listener. Registriert den Window-Resize-Handler für die Kamera und Renderer (wichtig für Landscape Korrektur auf iOS).
 * @returns 
 */
function init() {
  console.log('init() aufgerufen');
  sceneEl  = document.querySelector('a-scene');
  renderer = sceneEl.renderer;
  cameraEl = document.getElementById('camera');
  console.log('sceneEl, renderer, cameraEl:', sceneEl, renderer, cameraEl);

  const threeCam = cameraEl.getObject3D('camera');
  if (!threeCam) {
    console.warn('Kamera noch nicht da, warte 100 ms …');
    return setTimeout(init, 100);
  }
  threeCamera = threeCam;
  console.log('threeCamera gesetzt:', threeCamera);

  window.addEventListener("resize", () => {
    if (isIOS) {
      setTimeout(() => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        threeCamera.aspect = window.innerWidth / window.innerHeight;
        threeCamera.updateProjectionMatrix();
      }, 200);
    } else {
      renderer.setSize(window.innerWidth, window.innerHeight);
      threeCamera.aspect = window.innerWidth / window.innerHeight;
      console.log('Kamera aktualisiert vorher: ', threeCamera);
      threeCamera.updateProjectionMatrix();
      console.log('Kamera aktualisiert nachher: ', threeCamera);
    }
  });

  controls = new DeviceOrientationControls(threeCamera, {
    smoothingFactor: 0.05,
    enablePermissionDialog: false
  });
  console.log('DeviceOrientationControls initialisiert');

  const comp = cameraEl.components['locar-camera'];
  console.log('locar-camera component:', comp);
  if (comp?.locar) {
    locar = comp.locar;
    console.log('locar.startGps() aufgerufen');
    locar.startGps();
  } else {
    console.warn('locar-camera fehlt oder locar nicht initialisiert.');
  }

  cameraEl.addEventListener('gpsupdate', onGpsUpdate);
  renderer.setAnimationLoop(animate);
  console.log('Animation loop gestartet');
}

// GPS-Update
function onGpsUpdate(e) {
  console.log('gpsupdate event:', e.detail.position);
  const pos = e.detail.position.coords;
  currentCoords.latitude  = pos.latitude;
  currentCoords.longitude = pos.longitude;
  console.log('currentCoords:', currentCoords);

  const accuracy = pos.accuracy; // in Metern
  if (gpsAccuracyValue && gpsIndicator) {
    // Text aktualisieren:
    gpsAccuracyValue.innerText = `~${Math.round(accuracy)}m`;

    // Klasse setzen je nach Schwellenwert:
    // <5m = high, <15m = medium, sonst low
    gpsIndicator.classList.remove('gps-indicator--high', 'gps-indicator--medium', 'gps-indicator--low');
    if (accuracy < 5) {
      gpsIndicator.classList.add('gps-indicator--high');
    } else if (accuracy < 15) {
      gpsIndicator.classList.add('gps-indicator--medium');
    } else {
      gpsIndicator.classList.add('gps-indicator--low');
    }
  }

  // Alle UI-Elemente hinzufügen
  if (targetCoords.length && markers.length === 0) {
    addCompass();
    addArrow();
    addAllMarkers();
    setActive(0);
  }

  if (arrow) arrow.update();
  
  // Sicherstellen, dass Marker aktualisiert werden, wenn sie existieren
  if (markers.length > 0) {
    markers.forEach(m => {
      // Überprüfen, ob das Marker-Objekt noch existiert
      if (m.markerObject && m.markerObject.parent) {
        m.update();
      } else {
        console.warn('Marker exists but markerObject is detached or missing');
      }
    });
  }
  
  updateDistance(currentCoords, targetCoords[indexActive], distanceOverlay);
}

/**
 * Haupt-Animationsschleife, die regelmäßig aufgerufen wird, aktualisiert die Eigenschaften der AR-Elemente.
 */
function animate() {
  if (controls) controls.update();
  
  if (arrow) arrow.update();
  
  // Marker aktualisieren, wenn sie existieren
  if (markers.length > 0) {
    markers.forEach(m => {
      if (m.markerObject && m.markerObject.parent) {
        m.update();
      }
    });
  }
  
  if (compass) compass.update();
  updateDistance(currentCoords, targetCoords[indexActive], distanceOverlay);
  
  // Nur rendern, wenn erforderlich
  if (renderer && threeCamera) {
    renderer.render(sceneEl.object3D, threeCamera);
  }
}

/**
 * Fügt das Kompass UI zur AR-Szene hinzu.
 */
function addCompass() {
  console.log('addCompass()');
  compass = new CompassGUI({
    deviceOrientationControl: controls,
    compassArrowId: 'compassArrow',
    compassTextId: 'compassText',
    compassDirectionsId: 'compassDirections',
    getScreenOrientation: () => screenOrientation
  });
}

/**
 * Fügt den Navigationspfeil zur AR-Szene mit ensprechendem glb Modell hinzu.
 */
function addArrow() {
  console.log('addArrow()');
  arrow = new ARNavigationArrow({
    locar,
    camera: threeCamera,
    deviceOrientationControl: controls,
    getTargetCoords: () => targetCoords,
    currentCoords,
    isIOS,
    getScreenOrientation: () => screenOrientation,
    getIndexActiveMarker: () => indexActive
  });
  arrow.initArrow('./glbmodell/Pfeil5.glb');
}

/**
 * Fügt einen Marker zur AR-Szene hinzu und registriert einen Klick-Handler.
 * @param {*} data Daten für den Marker, einschließlich Latitude, Longitude und Popup-Inhalt
 * @param {*} i Index des Markers im targetCoords Array
 */
function addMarker(data, i) {
  console.log('addMarker', i, data);
  const marker = new TargetMarker({
    locar,
    camera: threeCamera,
    markerCoords: { latitude: data.latitude, longitude: data.longitude },
    isIOS,
    getScreenOrientation: () => screenOrientation,
    onClick: () => {
      if (i !== indexActive) {
        setActive(i);
        showPopup('Ziel aktualisiert!', 5000);
      } else {
        showPopup(data.popupContent, 0);
      }
    },
    deviceOrientationControl: controls
  });
  marker.initMarker('./images/map-marker.png');
  markers.push(marker);
  console.log('Markers array length:', markers.length);
}

/**
 * Ruft für alle Marker aus dem Array targetCoords die addMarker-Funktion auf.
 */
function addAllMarkers() {
  console.log('addAllMarkers, count:', targetCoords.length);
  targetCoords.forEach((d, i) => addMarker(d, i));
}

/**
 * Setzt den aktiven Marker und aktualisiert die Marker-Bildquellen.
 * @param {*} i der Index des zu aktiv werdenden Markers
 */
function setActive(i) {
  console.log('setActive marker:', i);
  indexActive = i;
  markers.forEach((m, idx) => {
    m.updateMarkerImage(
      idx === i
        ? './images/map-marker-rot.png'
        : './images/map-marker.png'
    );
  });
}