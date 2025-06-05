import 'aframe';
import 'locar-aframe';
import 'aframe-look-at-component';
import { CompassGUI } from './compassGUI.js';
import { ARNavigationArrow } from './arNavigationArrow.js';
import { TargetMarker } from './targetMarker.js';
import { updateDistance } from './distanceOverlay.js';
import { DeviceOrientationControls } from 'locar';

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

// State
let sceneEl, renderer, cameraEl, threeCamera;
let locar, controls;
let compass, arrow;
let markers = [];
let targetCoords = [];
let indexActive = 0;
const currentCoords = { latitude: null, longitude: null };
let screenOrientation = { 
  type: screen.orientation?.type || 'portrait-primary', 
  angle: screen.orientation?.angle || 0 
};
const isIOS = navigator.userAgent.match(/iPhone|iPad|iPod/i);

// Debug-Funktion zum Rekonstruieren der Marker
function rebuildAllMarkers() {
  console.log('Rebuilding all markers...');
  
  // Alte Marker entfernen
  markers.forEach(marker => {
    if (marker.markerObject && marker.markerObject.parent) {
      marker.markerObject.parent.remove(marker.markerObject);
    }
    marker.dispose();
  });
  
  markers = [];
  
  // Marker neu erstellen
  addAllMarkers();
  setActive(indexActive);
  
  console.log('Markers rebuilt, count:', markers.length);
}

// UI-Event-Handler
console.log('Binding UI events');
closeButton.addEventListener('click', () => {
  markerPopup.classList.remove('marker-popup--visible');
});

// iOS-spezifischer Orientierungs-Fix
let lastOrientation = window.orientation || 0;

window.addEventListener('load', () => {
  // Orientierungsänderungen überwachen und darauf reagieren
  if (screen.orientation) {
    screen.orientation.addEventListener("change", (event) => {
      console.log('Orientation changed:', event.target.type, event.target.angle);
      screenOrientation.type = event.target.type;
      screenOrientation.angle = event.target.angle;
      
      if (isIOS) {
        // Verzögerte Neuberechnung für iOS
        setTimeout(() => {
          updateSceneDimensions();
          rebuildAllMarkers();
        }, 300);
      }
    });
  } else {
    // Fallback für Browser/Geräte ohne screen.orientation
    window.addEventListener('orientationchange', () => {
      // Für ältere iOS-Versionen: window.orientation gibt Gradwerte zurück (0, 90, -90, 180)
      const currentOrientation = window.orientation || 0;
      let type = 'portrait-primary';
      if (currentOrientation === 90) type = 'landscape-primary';
      else if (currentOrientation === -90) type = 'landscape-secondary';
      
      console.log('Old-style orientation changed:', type, currentOrientation);
      screenOrientation.type = type;
      screenOrientation.angle = currentOrientation;
      
      if (isIOS && lastOrientation !== currentOrientation) {
        lastOrientation = currentOrientation;
        setTimeout(() => {
          updateSceneDimensions();
          rebuildAllMarkers();
        }, 300);
      }
    });
  }
});

// Aktualisiert das AR-Rendering nach Orientierungsänderungen
function updateSceneDimensions() {
  if (!renderer || !threeCamera) return;
  
  console.log('Updating scene dimensions');
  
  // Sicherstellen, dass wir die aktuelle Fenstergröße verwenden
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  
  // Renderer und Kamera aktualisieren
  renderer.setSize(width, height);
  threeCamera.aspect = width / height;
  threeCamera.updateProjectionMatrix();
  
  // A-Frame updaten
  if (sceneEl && typeof sceneEl.resize === 'function') {
    console.log('Resizing A-Frame scene');
    sceneEl.resize();
  }
  
  // Locar neuberechnen, falls vorhanden
  if (locar && typeof locar.updateProjection === 'function') {
    console.log('Updating locar projection');
    locar.updateProjection();
  }
}

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

btnTest.addEventListener('click', () => {
  //console.log('Test marker button clicked');
  const tests = [
    { longitude:7.651058, latitude:51.935260, popupContent:'Polter 1…' },
    { longitude:7.651110, latitude:51.933416, popupContent:'Polter 2…' },
    { longitude:7.653852, latitude:51.934496, popupContent:'Lichtung 1…' },
    { longitude:7.658851, latitude:51.934513, popupContent:'Lichtung 2…' },
    { longitude:7.648327, latitude:51.934420, popupContent:'Sonstiger POI 1…' }
  ];
  /** 
  const tests = [
    { longitude:7.593485, latitude:51.938087, popupContent:'Polter 1…' },
    { longitude:7.590000, latitude:51.933416, popupContent:'Polter 2…' },
    { longitude:7.600000, latitude:51.939496, popupContent:'Lichtung 1…' },
    { longitude:7.595000, latitude:51.940513, popupContent:'Lichtung 2…' },
    { longitude:7.597500, latitude:51.934420, popupContent:'Sonstiger POI 1…' }
  ];
  */
  targetCoords.push(...tests);
  //console.log('Added test markers, count:', targetCoords.length);
  showPopup('5 Marker hinzugefügt!', 1500);
});

btnStart.addEventListener('click', () => {
  console.log('Start button clicked');
  overlayContainer.remove();
  arContainer.style.display = 'block';
  console.log('Overlay removed, AR container shown');
  init();
});

// Hilfsfunktion für Popup
function showPopup(text, d) {
  markerPopupText.textContent = text;
  markerPopup.classList.add('marker-popup--visible');
  if (d > 0) {
    setTimeout(() => {
      markerPopup.classList.remove('marker-popup--visible');
    }, d);
  }
}

// Initialisierung
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

  controls = new DeviceOrientationControls(threeCamera);
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

  window.addEventListener("resize", () => {
    if (isIOS) {
      setTimeout(() => {
        console.log('iOS resize handler with delay');
        updateSceneDimensions();
        
        const widthChange = Math.abs(window.innerWidth - previousWidth) / previousWidth;
        const heightChange = Math.abs(window.innerHeight - previousHeight) / previousHeight;
        
        if (widthChange > 0.2 || heightChange > 0.2) {
          console.log('Significant size change detected, rebuilding markers');
          rebuildAllMarkers();
        } else {
          if (markers.length > 0) {
            markers.forEach(m => m.update());
          }
        }
        
        previousWidth = window.innerWidth;
        previousHeight = window.innerHeight;
      }, 300);
    } else {
      updateSceneDimensions();
    }
  });
  
  let previousWidth = window.innerWidth;
  let previousHeight = window.innerHeight;

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

  if (targetCoords.length && markers.length === 0) {
    console.log('Erster GPS-Fix, UI initialisieren');
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

// Haupt-Loop
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

// Compass erzeugen
function addCompass() {
  console.log('addCompass()');
  compass = new CompassGUI({
    deviceOrientationControl: controls,
    compassArrowId: 'compassArrow',
    compassTextId: 'compassText',
    getScreenOrientation: () => screenOrientation
  });
}

// Navigation Arrow
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

// Marker erzeugen
function addMarker(data, i) {
  console.log('addMarker', i, data);
  const marker = new TargetMarker({
    locar,
    camera: threeCamera,
    markerCoords: { latitude: data.latitude, longitude: data.longitude },
    isIOS,
    getScreenOrientation: () => screenOrientation,
    getCurrentCoords: () => currentCoords,
    onClick: () => {
      if (i !== indexActive) {
        setActive(i);
        showPopup('Ziel aktualisiert!', 5000);
      } else {
        showPopup(data.popupContent, 50000);
      }
    },
    deviceOrientationControl: controls
  });
  marker.initMarker('./images/map-marker-schwarz.png');
  markers.push(marker);
  console.log('Markers array length:', markers.length);
}

// Alle Marker hinzufügen
function addAllMarkers() {
  console.log('addAllMarkers, count:', targetCoords.length);
  targetCoords.forEach((d, i) => addMarker(d, i));
}

// Aktiven Marker setzen
function setActive(i) {
  console.log('setActive marker:', i);
  indexActive = i;
  markers.forEach((m, idx) => {
    m.updateMarkerImage(
      idx === i
        ? './images/map-marker.png'
        : './images/map-marker-schwarz.png'
    );
  });
}