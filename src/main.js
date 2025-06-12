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

// Settings-Elemente
const settingsButton = document.getElementById('settingsButton');
const settingsMenu = document.getElementById('settingsMenu');
const settingsClose = document.getElementById('settingsClose');
const toggleCompass = document.getElementById('toggleCompass');
const toggleGPS = document.getElementById('toggleGPS');
const arrowColorPicker = document.getElementById('arrowColorPicker');
const colorPreview = document.getElementById('colorPreview');
const compassContainer = document.getElementById('compassContainer');
const gpsAccuracy = document.querySelector('.gps-accuracy');

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
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0
      });
    });
    
    currentCoords.latitude = pos.coords.latitude;
    currentCoords.longitude = pos.coords.longitude;
    console.log('Aktuelle Koordinaten gesetzt:', currentCoords);

    // Testpunkte vordefinieren und in einem Batch erstellen
    const newMarkers = [
      { 
        latitude: currentCoords.latitude + 0.00027,
        longitude: currentCoords.longitude,
        popupContent: 'Testpunkt ~30m Nord'
      },
      { 
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude + 0.0011,
        popupContent: 'Testpunkt ~80m Ost'
      },
      { 
        latitude: currentCoords.latitude - 0.0027,
        longitude: currentCoords.longitude,
        popupContent: 'Testpunkt ~300m Süd'
      },
      { 
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude - 0.0054,
        popupContent: 'Testpunkt ~400m West'
      },
      { 
        latitude: currentCoords.latitude + 0.0081,
        longitude: currentCoords.longitude + 0.0081,
        popupContent: 'Testpunkt ~900m Nordost'
      }
    ];

    // Alle Marker auf einmal hinzufügen
    targetCoords.push(...newMarkers);
    
    showPopup('5 Marker hinzugefügt!', 1500);
  } catch (err) {
    console.error('Fehler beim Abrufen der aktuellen Position:', err);
    showPopup('Fehler beim Abrufen der aktuellen Position', 3000);
  }
});

btnStart.addEventListener('click', async() => {
  console.log('Start button clicked');
  
  try {
    // Starte Initialisierung
    const initProcess = init();
    
    // Parallel dazu: Device Orientation Permissions
    let permissionPromise = Promise.resolve();
    if (window.DeviceOrientationEvent?.requestPermission) {
      permissionPromise = DeviceOrientationEvent.requestPermission()
        .then(result => {
          if (result !== "granted") {
            throw new Error("Ohne Zugriff auf Bewegungsdaten kann AR nicht starten.");
          }
        });
    }
    
    // Warte auf beide Prozesse
    await Promise.all([initProcess, permissionPromise]);
    
    // Verbinde Controls und zeige AR-Container
    controls.connect();
    overlayContainer.style.display = 'none';
    arContainer.style.display = 'block';
    
    console.log('AR-Modus erfolgreich gestartet');
  } catch (err) {
    console.error("Fehler beim Starten des AR-Modus:", err);
    showPopup('Fehler beim Starten des AR-Modus', 3000);
  }
});

// Settings Event Listeners
settingsButton.addEventListener('click', (e) => {
  e.stopPropagation(); // Verhindert das Schließen durch document-click
  settingsMenu.classList.toggle('settings-menu--visible');
});

settingsClose.addEventListener('click', () => {
  settingsMenu.classList.remove('settings-menu--visible');
});

// Außerhalb des Menüs klicken um zu schließen
document.addEventListener('click', (e) => {
  if (!settingsMenu.contains(e.target) && !settingsButton.contains(e.target)) {
    settingsMenu.classList.remove('settings-menu--visible');
  }
});

// Kompass Toggle
toggleCompass.addEventListener('change', (e) => {
  if (e.target.checked) {
    compassContainer.style.display = 'flex';
  } else {
    compassContainer.style.display = 'none';
  }
});

// GPS Accuracy Toggle
toggleGPS.addEventListener('change', (e) => {
  if (e.target.checked) {
    gpsAccuracy.style.display = 'flex';
  } else {
    gpsAccuracy.style.display = 'none';
  }
});

// Farbauswahl für Navigationspfeil
arrowColorPicker.addEventListener('change', (e) => {
  const selectedColor = e.target.value;
  
  // Farbvorschau aktualisieren
  colorPreview.style.background = selectedColor;
  
  // Pfeilfarbe ändern (wenn der Pfeil bereits existiert)
  if (window.arrow && window.arrow.arrowObject) {
    updateArrowColor(selectedColor);
  }
  
  // Farbe für zukünftige Pfeile speichern
  window.selectedArrowColor = selectedColor;
});

// Funktion zum Aktualisieren der Pfeilfarbe
function updateArrowColor(color) {
  if (!window.arrow || !window.arrow.arrowObject) return;
  
  window.arrow.arrowObject.traverse((child) => {
    if (child.isMesh && child.material) {
      // Erstelle neues Material mit der gewählten Farbe
      child.material = child.material.clone();
      child.material.color.setHex(color.replace('#', '0x'));
      child.material.needsUpdate = true;
    }
  });
}

// Farbvorschau beim Laden initialisieren
if (colorPreview) {
  colorPreview.style.background = arrowColorPicker.value;
}

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

// AR-Szene initialisieren

/**
 * Initialisiert die AR-Szene, setzt die Kamera und registriert Event-Listener.
 * @returns {Promise} Promise, das resolved wird, wenn die Initialisierung abgeschlossen ist
 */
async function init() {
  console.log('init() aufgerufen');
  
  // Scene und Renderer Setup
  sceneEl = document.querySelector('a-scene');
  renderer = sceneEl.renderer;
  cameraEl = document.getElementById('camera');
  
  // Kamera Setup mit Retry
  const setupCamera = async () => {
    const threeCam = cameraEl.getObject3D('camera');
    if (!threeCam) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return setupCamera();
    }
    return threeCam;
  };

  try {
    threeCamera = await setupCamera();
    console.log('threeCamera initialisiert:', threeCamera);

    // Event Listener für Resize
    const handleResize = () => {
      const updateCamera = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        threeCamera.aspect = window.innerWidth / window.innerHeight;
        threeCamera.updateProjectionMatrix();
      };
      
      if (isIOS) {
        setTimeout(updateCamera, 200);
      } else {
        updateCamera();
      }
    };
    window.addEventListener("resize", handleResize);

    // Device Controls initialisieren
    controls = new DeviceOrientationControls(threeCamera, {
      smoothingFactor: 0.15,
      enablePermissionDialog: false
    });
    
    // LocAR Setup
    const comp = cameraEl.components['locar-camera'];
    if (comp?.locar) {
      locar = comp.locar;
      locar.startGps();
    } else {
      throw new Error('locar-camera fehlt oder locar nicht initialisiert');
    }    // Event Listeners
    cameraEl.addEventListener('gpsupdate', onGpsUpdate);
    renderer.setAnimationLoop(animate);
    
    console.log('AR-Szene erfolgreich initialisiert');
  } catch (error) {
    console.error('Fehler bei der Initialisierung:', error);
    throw error;
  }
}

/**
 * GPS-Update
 */
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
    );  });
}