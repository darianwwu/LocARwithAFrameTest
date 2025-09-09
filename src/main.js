/**
 * Hauptlogik der AR-Navigation (A-Frame + Three.js + LoCAR)
 * - Verwaltung von Zielmarkern und Pfaden
 * - UI/Settings für Kompass, GPS, Karte, Farben, Rettungspunkte, ...
 * - AR-Initialisierung, GPS-Update-Handling und Animationsschleifen
 *
 * Struktur:
 *  1) Imports & DOM-Referenzen
 *  2) Globaler State
 *  3) Utilities (Helferfunktionen)
 *  4) UI/Settings (Event-Handler)
 *  5) AR-/Karten-Elemente (Kompass, Pfeil, Marker)
 *  6) Pfadverwaltung (laden/aktivieren/AR-Objekte)
 *  7) Initialisierung (init, initPathNavigation)
 *  8) GPS-Updates & Renderloop
 *  9) Buttons/Listener (Start, Pfade laden/wechseln)
 */

import 'aframe';
import 'locar-aframe';
import 'aframe-look-at-component';

import { CompassGUI, addCompassToScene } from './compassGUI.js';
import { ARNavigationArrow, addArrowToScene } from './arNavigationArrow.js';
import { ARPathNavigationArrow, addPathArrowToScene } from './pathNavigationArrow.js';
import { TargetMarker } from './targetMarker.js';
import { updateDistance, updatePathDistance } from './distanceOverlay.js';
import { MapView } from './mapView.js';
import { showPopup, handleCameraError, handleGpsError, handleSensorError, checkBrowserSupport, checkSensorAvailability, handleGenericError } from './errorHandler.js';
import { PathManager } from './pathManager.js';
import { ARPathTube } from './arPathTube.js';
import { ARPathFlowLine } from './arPathFlowLine.js';
import { ARPathChevrons } from './arPathChevrons.js';

/* ============================================================================
 * 1) DOM-Referenzen
 * ========================================================================== */

// Container & Grund-UI
const overlayContainer  = document.getElementById('overlayContainer');
const arContainer       = document.getElementById('arContainer');

// Marker-Eingabe
const lonInput          = document.getElementById('longitude');
const latInput          = document.getElementById('latitude');
const latitudeGroup     = document.getElementById('latitudeGroup');
const longitudeGroup    = document.getElementById('longitudeGroup');

// Buttons/Controls
const btnAdd            = document.getElementById('btnAddMarker');
const btnStart          = document.getElementById('btnStart');
const btnTest           = document.getElementById('btnTestAdd');
const btnLoadPaths      = document.getElementById('btnLoadPaths');

// Marker-Popup
const markerPopup       = document.getElementById('markerPopup');
const closeButton       = document.getElementById('popupClose');

// Overlays/Indikatoren
const distanceOverlay   = document.getElementById('distance-overlay');
const gpsIndicator      = document.querySelector('.gps-indicator');
const gpsAccuracyValue  = document.querySelector('.gps-accuracy-value');
const gpsAccuracy       = document.querySelector('.gps-accuracy');

// Settings
const settingsButton    = document.getElementById('settingsButton');
const settingsMenu      = document.getElementById('settingsMenu');
const toggleCompass     = document.getElementById('toggleCompass');
const toggleGPS         = document.getElementById('toggleGPS');
const toggleMap         = document.getElementById('toggleMap');
const toggleRescuePoints= document.getElementById('toggleRescuePoints');
const rescuePointsInfo  = document.getElementById('rescuePointsInfo');
const arrowColorPicker  = document.getElementById('arrowColorPicker');
const colorPreview      = document.getElementById('colorPreview');
const compassContainer  = document.getElementById('compassContainer');
const mapContainer      = document.getElementById('mapContainer');

// Copyright-Modal
const copyrightModal      = document.getElementById('copyrightModal');
const copyrightModalClose = document.getElementById('copyrightModalClose');

// Path-Switcher
const btnPrevPath       = document.getElementById('btnPrevPath');
const btnNextPath       = document.getElementById('btnNextPath');

/* ============================================================================
 * 2) Globaler State
 * ========================================================================== */

/** @type {AFRAME.Scene} */
let sceneEl;
/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {AFRAME.Entity} */
let cameraEl;
/** @type {THREE.PerspectiveCamera} */
let threeCamera;

/** @type {import('./compassGUI').CompassGUI} */
let compass;
/** @type {import('./arNavigationArrow').ARNavigationArrow} */
let arrow;
/** @type {import('./pathNavigationArrow').ARPathNavigationArrow} */
let pathArrow;

/** @type {MapView} */
let mapView;

/** @type {any} LoCAR-Instanz (aus locar-camera Komponente) */
let locar;
/** @type {any} DeviceOrientationControls von LoCAR */
let controls;

// Marker-/Ziel-Verwaltung
/** @type {TargetMarker[]} */
let markers = [];
/** @type {{latitude:number, longitude:number, popupContent?:string, markerType?:string}[]} */
let targetCoords = [];
/** Aktiver Zielmarker-Index */
let indexActive = 0;

// Anzeige-Modus für das Distanz-Overlay
/** @type {'distance'|'minutes'|'both'} */
let distanceMode = 'both';

// Sichtbarkeit der Koordinaten-Eingabefelder
let coordinateFieldsVisible = false;

// Aktuelle GPS-Position
const currentCoords = { latitude: null, longitude: null };

// Orientierung (für Kartenrotation/Korrektur)
let screenOrientation = { type: screen.orientation?.type, angle: screen.orientation?.angle };

// Pfade/Navigation
/** @type {PathManager} */
let pathManager;
window.pathManager = pathManager; // Globale Referenz für pathNavigationArrow
let arPaths = [];
let activePathIndex = -1;

// Rettungspunkte
let rescuePointsVisible = false;

// Plattform
const isIOS = navigator.userAgent.match(/iPhone|iPad|iPod/i);

// Pfadstil (AR-Darstellung): 'flowline' | 'chevrons' | 'tube'
let pathStyle = 'chevrons';
let pathColorScheme = 'electricCyan'; // 'electricCyan' | 'royalBlue' | 'vividMagenta'

window.setPathStyle = (style) => {
  pathStyle = style;
  if (pathManager?.paths?.length > 0 && activePathIndex >= 0) {
    createARPaths(pathManager.paths[activePathIndex]);
    showPopup(`Pfad-Stil: ${style}`, 1500);
  } else {
    showPopup(`Pfad-Stil gesetzt: ${style} (wirkt beim nächsten Pfad-Laden)`, 2000);
  }
};

window.setPathColorScheme = (scheme) => {
  pathColorScheme = scheme;
  // Aktualisiere bestehende Chevron-Pfade
  if (arPaths?.length > 0) {
    arPaths.forEach(path => {
      if (path && typeof path.setColorScheme === 'function') {
        path.setColorScheme(scheme);
      }
    });
  }
  const schemeNames = {
    electricCyan: 'Electric Cyan',
    royalBlue: 'Royal Blue', 
    vividMagenta: 'Vivid Magenta'
  };
  showPopup(`Farbschema: ${schemeNames[scheme] || scheme}`, 1500);
};

/**
 * Prüft ob genügend Navigationsdaten vorhanden sind und aktiviert/deaktiviert den Start-Button
 */
function checkNavigationReadiness() {
  const hasTargets = targetCoords.length > 0;
  const hasPaths = pathManager?.paths?.length > 0;
  const isReady = hasTargets || hasPaths;
  
  if (btnStart) {
    btnStart.disabled = !isReady;
    btnStart.classList.toggle('btn--disabled', !isReady);
    
    if (!isReady) {
      btnStart.title = 'Bitte erst Marker oder Pfade hinzufügen';
    } else {
      btnStart.title = '';
    }
  }
}

/* ============================================================================
 * 3) Utilities
 * ========================================================================== */

/**
 * Prüft, ob bereits ein Marker an den gegebenen Koordinaten existiert.
 * @param {number} lat Breitengrad
 * @param {number} lon Längengrad
 * @param {number} [tolerance=1e-6] Toleranz in Grad (~0,1 m)
 * @returns {boolean}
 */
function isDuplicateMarker(lat, lon, tolerance = 1e-6) {
  return targetCoords.some(m =>
    Math.abs(m.latitude - lat) < tolerance &&
    Math.abs(m.longitude - lon) < tolerance
  );
}

/**
 * Findet den Index eines Markers anhand Lat/Lon (mit Toleranz).
 * @param {number} lat Breitengrad
 * @param {number} lon Längengrad
 * @param {number} [eps=1e-5] Toleranz in Grad
 * @returns {number} Index oder -1
 */
function findMarkerIndexByLatLon(lat, lon, eps = 1e-5) {
  return targetCoords.findIndex(m =>
    Math.abs(m.latitude  - lat) < eps &&
    Math.abs(m.longitude - lon) < eps
  );
}

/**
 * Bindet eine Checkbox als Sichtbarkeits-Toggle an ein DOM-Element.
 * @param {HTMLInputElement|null} checkbox
 * @param {HTMLElement} el
 */
function bindToggle(checkbox, el) {
  checkbox?.addEventListener('change', (e) => {
    el.style.display = e.target.checked ? '' : 'none';
  });
}

/**
 * Aktualisiert die Materialfarbe des Navigationspfeils.
 * @param {string} color HEX-Farbe, z.B. "#ff8800"
 */
function updateArrowColor(color) {
  if (!arrow?.arrowObject) return;
  arrow.arrowObject.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      child.material.color.setHex(color.replace('#', '0x'));
      child.material.needsUpdate = true;
    }
  });
}

// Initial den Button deaktivieren
if (btnStart) {
  btnStart.disabled = true;
  btnStart.classList.add('btn--disabled');
  btnStart.title = 'Bitte erst Marker oder Pfade hinzufügen';
}

/* ============================================================================
 * 4) UI / Settings
 * ========================================================================== */

// Marker-Popup schließen
closeButton?.addEventListener('click', () => {
  markerPopup.classList.remove('marker-popup--visible');
});

// Einstellungsmenü toggeln
settingsButton?.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsMenu.classList.toggle('settings-menu--visible');
});
settingsMenu?.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', (e) => {
  const isModalVisible = copyrightModal.classList.contains('copyright-modal--visible');
  const isClickOnModal = copyrightModal.contains(e.target);
  if (settingsMenu.classList.contains('settings-menu--visible') &&
      !settingsMenu.contains(e.target) &&
      !settingsButton.contains(e.target) &&
      !isModalVisible &&
      !isClickOnModal) {
    settingsMenu.classList.remove('settings-menu--visible');
  }
});

// Sichtbarkeits-Toggles
bindToggle(toggleCompass, compassContainer);
bindToggle(toggleGPS,    gpsAccuracy);
bindToggle(toggleMap,    mapContainer);

// Copyright-Modal öffnet/schließt
rescuePointsInfo?.addEventListener('click', (e) => {
  e.stopPropagation();
  copyrightModal.classList.add('copyright-modal--visible');
});
copyrightModalClose?.addEventListener('click', (e) => {
  e.stopPropagation();
  copyrightModal.classList.remove('copyright-modal--visible');
});
copyrightModal?.addEventListener('click', (e) => {
  if (e.target === copyrightModal || e.target.classList.contains('copyright-modal__overlay')) {
    e.stopPropagation();
    copyrightModal.classList.remove('copyright-modal--visible');
  }
});

// Pfeilfarbe wählen
arrowColorPicker?.addEventListener('change', (e) => {
  const selectedColor = e.target.value;
  colorPreview && (colorPreview.style.background = selectedColor);
  if (arrow?.arrowObject) updateArrowColor(selectedColor);
  window.selectedArrowColor = selectedColor;
});
if (colorPreview && arrowColorPicker) {
  colorPreview.style.background = arrowColorPicker.value;
}

// Distanz-Overlay klickbar (Umschalten zwischen Metern/Gehminuten)
if (distanceOverlay) {
  distanceOverlay.style.cursor = 'pointer';
  distanceOverlay.title = 'Klicken zum Umschalten zwischen Meter/Gehminuten';
  distanceOverlay.addEventListener('click', () => {
    distanceMode = distanceMode === 'distance' ? 'minutes' :
                   distanceMode === 'minutes' ? 'both' : 'distance';
    updateDistanceDisplay();
  });
}

/**
 * Aktualisiert die Distanzanzeige basierend auf aktivem Pfad oder Zielmarker
 */
function updateDistanceDisplay() {
  if (!distanceOverlay) return;
  
  // Prüfe ob ein Pfad aktiv ist
  const isPathActive = activePathIndex >= 0 && pathManager?.paths?.length > activePathIndex;
  
  if (isPathActive && pathArrow) {
    // Zeige Pfad-Distanz an
    const pathInfo = pathArrow.getPathDistanceInfo();
    if (pathInfo) {
      updatePathDistance(pathInfo, distanceOverlay, { mode: distanceMode });
      return;
    }
  }
  
  // Fallback: Zeige normale Zielmarker-Distanz an
  if (targetCoords[indexActive]) {
    updateDistance(currentCoords, targetCoords[indexActive], distanceOverlay, { mode: distanceMode });
  } else {
    distanceOverlay.innerHTML = '';
  }
}

/**
 * Button „Marker hinzufügen“
 * - 1. Klick: Koordinatenfelder anzeigen
 * - ab 2. Klick: Marker mit eingegebenen Koordinaten anlegen
 */
btnAdd?.addEventListener('click', () => {
  if (!coordinateFieldsVisible) {
    latitudeGroup.style.display  = 'block';
    longitudeGroup.style.display = 'block';
    coordinateFieldsVisible = true;
    showPopup('Koordinaten eingeben und erneut auf „Marker hinzufügen“ klicken', 2500);
    return;
  }

  const lon = parseFloat(lonInput.value);
  const lat = parseFloat(latInput.value);
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    showPopup('Ungültige Koordinaten!', 3000);
    return;
  }
  if (isDuplicateMarker(lat, lon)) {
    showPopup('Marker an dieser Position existiert bereits!', 3000);
    return;
  }

  const markerData = { longitude: lon, latitude: lat, popupContent: 'Ziel aktualisiert!' };
  targetCoords.push(markerData);

  // Kartenmarker (falls Karte existiert)
  if (mapView) {
    const isActive = targetCoords.length === 1;
    mapView.addTargetMarker(markerData.latitude, markerData.longitude, markerData.popupContent, isActive);
  }

  showPopup('Marker hinzugefügt!', 1500);
  checkNavigationReadiness(); // Navigation-Bereitschaft prüfen
});

/**
 * DEBUG: fügt mehrere Testmarker in der Nähe hinzu (optional nutzbar).
 */
btnTest?.addEventListener('click', async () => {
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0 });
    });
    currentCoords.latitude  = pos.coords.latitude;
    currentCoords.longitude = pos.coords.longitude;

    const ms = [
      { latitude: currentCoords.latitude + 0.00027, longitude: currentCoords.longitude,            popupContent: 'Testpunkt ~30m Nord' },
      { latitude: currentCoords.latitude,            longitude: currentCoords.longitude + 0.0011,  popupContent: 'Testpunkt ~80m Ost' },
      { latitude: currentCoords.latitude - 0.0027,   longitude: currentCoords.longitude,            popupContent: 'Testpunkt ~300m Süd' },
      { latitude: currentCoords.latitude,            longitude: currentCoords.longitude - 0.0054,  popupContent: 'Testpunkt ~400m West' },
      { latitude: currentCoords.latitude + 0.0081,   longitude: currentCoords.longitude + 0.0081,  popupContent: 'Testpunkt ~900m Nordost' }
    ];

    const unique = ms.filter(m => !isDuplicateMarker(m.latitude, m.longitude));
    if (!unique.length) return showPopup('Alle Testmarker existieren bereits!', 3000);

    targetCoords.push(...unique);
    if (mapView) {
      unique.forEach((m, idx) => {
        const globalIndex = targetCoords.length - unique.length + idx;
        mapView.addTargetMarker(m.latitude, m.longitude, m.popupContent, globalIndex === 0);
      });
    }

    const skipped = ms.length - unique.length;
    showPopup(`${unique.length} Marker hinzugefügt${skipped ? `, ${skipped} Duplikate übersprungen` : ''}!`, 2000);
    checkNavigationReadiness(); // Navigation-Bereitschaft prüfen
  } catch (err) {
    handleGpsError(err);
  }
});

/* ============================================================================
 * 5) AR-/Karten-Elemente: Kompass, Pfeil, Marker
 * ========================================================================== */

/**
 * Fügt das Kompass-UI hinzu.
 */
function addCompass() {
  compass = addCompassToScene({
    deviceOrientationControl: controls,
    compassArrowId: 'compassArrow',
    compassTextId: 'compassText',
    compassDirectionsId: 'compassDirections',
    isIOS,
    getScreenOrientation: () => screenOrientation
  });
}

/**
 * Fügt den Navigationspfeil hinzu.
 * Setzt zusätzlich window.arrow, damit andere UI-Teile (z. B. Farbwähler) darauf zugreifen können.
 */
function addArrow() {
  arrow = addArrowToScene({
    locar,
    camera: threeCamera,
    deviceOrientationControl: controls,
    getTargetCoords: () => targetCoords,
    currentCoords,
    isIOS,
    getScreenOrientation: () => screenOrientation,
    getIndexActiveMarker: () => indexActive
  });
  window.arrow = arrow; // für Farbwähler etc.
  
  // Callback für nach dem GLTF-Laden hinzufügen
  arrow.onArrowReady = () => {
    updateArrowVisibility();
  };
}

/**
 * Fügt den Pfad-Navigationspfeil hinzu.
 * Dieser Pfeil zeigt auf den nächsten Punkt des aktiven Pfads und ist oran44444444ge.
 */
function addPathArrow() {
  pathArrow = addPathArrowToScene({
    locar,
    camera: threeCamera,
    deviceOrientationControl: controls,
    getPathManager: () => pathManager, // Verwende Getter-Funktion statt direkter Referenz
    currentCoords,
    isIOS,
    getScreenOrientation: () => screenOrientation,
    getActivePathIndex: () => activePathIndex
  });
  window.pathArrow = pathArrow; // für debugging etc.
  
  // Callback für nach dem GLTF-Laden hinzufügen
  pathArrow.onArrowReady = () => {
    updateArrowVisibility();
  };
}

/**
 * Stellt sicher, dass alle AR-Elemente (Compass, Pfeile) erstellt sind, wenn AR bereit ist.
 * @param {boolean} updateVisibility - Ob die Pfeil-Sichtbarkeit sofort aktualisiert werden soll
 */
function ensureARElementsCreated(updateVisibility = true) {
  if (!locar || !threeCamera) return;
  
  if (!compass) {
    addCompass();
  }
  
  if (!arrow) {
    addArrow();
  }
  
  if (!pathArrow) {
    addPathArrow();
  }
  
  // Pfeil-Sichtbarkeit nur aktualisieren, wenn gewünscht
  if (updateVisibility) {
    updateArrowVisibility();
  }
}
function updateArrowVisibility() {
  const isPathActive = activePathIndex >= 0 && pathManager?.paths?.length > activePathIndex;
  
  if (arrow?.arrowObject) {
    arrow.arrowObject.visible = !isPathActive;
  }
  
  if (pathArrow?.arrowObject) {
    pathArrow.arrowObject.visible = isPathActive;
  }
}

/**
 * Erstellt (oder findet) den Zielmarker am Endpunkt eines Pfades.
 * Erzeugt bei laufender AR den 3D-Marker sofort.
 * @param {{wgs84Coords:number[][], name?:string}} path
 * @returns {number} Index des (neu erstellten oder vorhandenen) Markers, -1 bei Fehler
 */
function addPathEndpointMarker(path) {
  if (!path?.wgs84Coords?.length) return -1;

  const last = path.wgs84Coords[path.wgs84Coords.length - 1];
  const lon = last[0], lat = last[1];

  const existingIndex = findMarkerIndexByLatLon(lat, lon, 1e-5);
  if (existingIndex !== -1) return existingIndex;

  const markerData = { latitude: lat, longitude: lon, popupContent: `Ziel: ${path.name || 'Pfad-Ende'}` };
  targetCoords.push(markerData);
  const newIndex = targetCoords.length - 1;

  if (locar && threeCamera) addMarker(markerData, newIndex);
  return newIndex;
}

/**
 * Fügt einen einzelnen AR-Marker hinzu und registriert Klick-Handling.
 * @param {{latitude:number, longitude:number, popupContent?:string, markerType?:string}} data
 * @param {number} i Index in targetCoords
 */
function addMarker(data, i) {
  const marker = new TargetMarker({
    locar,
    camera: threeCamera,
    markerCoords: { latitude: data.latitude, longitude: data.longitude },
    isIOS,
    getScreenOrientation: () => screenOrientation,
    onClick: () => {
      if (i !== indexActive) {
        setActive(i);
        showPopup('Ziel aktualisiert!', 2000);
      } else {
        showPopup(data.popupContent || `Ziel ${i + 1}`, 1200);
      }
    },
    deviceOrientationControl: controls
  });
  
  // Icon basierend auf Marker-Typ wählen
  const iconPath = data.markerType === 'rescue' 
    ? './images/schild_rettungspunkt.png'
    : './images/map-marker-orange.png';
  
  marker.initMarker(iconPath);
  markers.push(marker);

  // Kartenmarker synchronisieren
  if (mapView?.map) {
    mapView.addTargetMarker(
      data.latitude,
      data.longitude,
      data.popupContent || `Ziel ${i + 1}`,
      i === indexActive,
      i
    );
  }
}

/**
 * Fügt alle Marker aus targetCoords in die AR-Szene ein und synchronisiert die Karte.
 */
function addAllMarkers() {
  targetCoords.forEach((d, i) => addMarker(d, i));
  if (mapView?.map) syncAllMarkersToMap();
}

/**
 * Setzt den aktiven Marker (rot) und synchronisiert Karte/Overlay.
 * @param {number} i Index des aktiven Markers
 */
function setActive(i) {
  indexActive = i;

  // AR-Marker-Bild aktualisieren
  markers.forEach((m, idx) => {
    // Rettungspunkte behalten ihr spezielles Icon
    if (targetCoords[idx]?.markerType === 'rescue') {
      m.updateMarkerImage('./images/schild_rettungspunkt.png');
    } else {
      m.updateMarkerImage(idx === i ? './images/map-marker-rot.png' : './images/map-marker-orange.png');
    }
  });

  // Kartenmarker aktualisieren
  mapView?.setActiveMarker(i);
}

/**
 * Synchronisiert alle Zielmarker mit der Karte (löscht/fügt neu hinzu).
 */
/**
 * Synchronisiert alle Marker zur Karte - optimiert für batch operations.
 */
function syncAllMarkersToMap() {
  if (!mapView?.map) return;

  // Batch-Operation: erst alle entfernen, dann alle hinzufügen
  mapView.removeAllTargetMarkers();
  
  // Marker in kleineren Batches hinzufügen (verhindert UI-Blockierung)
  const batchSize = 10;
  let index = 0;
  
  const processBatch = () => {
    const endIndex = Math.min(index + batchSize, targetCoords.length);
    
    for (let i = index; i < endIndex; i++) {
      const coords = targetCoords[i];
      // Rettungspunkte werden separat über addRescuePointMarker hinzugefügt
      if (coords.markerType !== 'rescue') {
        mapView.addTargetMarker(
          coords.latitude,
          coords.longitude,
          coords.popupContent || `Ziel ${i + 1}`,
          i === indexActive,
          i
        );
      }
    }
    
    index = endIndex;
    
    // Nächsten Batch verarbeiten, falls noch Marker vorhanden
    if (index < targetCoords.length) {
      requestAnimationFrame(processBatch);
    } else {
      // Nach allen Markern: User-Position aktualisieren
      if (currentCoords.latitude && currentCoords.longitude) {
        mapView.updateUserPosition(currentCoords.latitude, currentCoords.longitude);
      }
    }
  };
  
  // Erste Batch starten
  if (targetCoords.length > 0) {
    processBatch();
  } else if (currentCoords.latitude && currentCoords.longitude) {
    mapView.updateUserPosition(currentCoords.latitude, currentCoords.longitude);
  }
}

/* ============================================================================
 * 6) Pfade / AR-Darstellungen
 * ========================================================================== */

/**
 * Erzeugt die AR-Darstellung für den aktiven Pfad (Flowline/Chevrons/Tube).
 * @param {{name?:string}} activePath
 */
function createARPaths(activePath) {
  removeARPaths();
  if (!activePath) return;

  const common = { locar, camera: threeCamera, path: activePath, isActive: true };
  let arPath;

  if (pathStyle === 'flowline') {
    arPath = new ARPathFlowLine({ ...common, color: 0x00ff88, width: 0.5, height: 2.6, dashSize: 3, gapSize: 1.2, speed: 2.2 });
  } else if (pathStyle === 'chevrons') {
    arPath = new ARPathChevrons({ ...common, colorScheme: pathColorScheme, spacing: 12.0, scale: 1.5, height: 0.5, speed: 1.5 });
  } else {
    arPath = new ARPathTube({ ...common, color: 0x00ff00, radius: 0.3, height: 0.5 });
  }

  arPath.createPathObject();
  arPaths = [arPath];
}

/** Entfernt alle AR-Pfadobjekte. */
function removeARPaths() {
  arPaths.forEach(p => p.removePath());
  arPaths = [];
}

/**
 * Setzt den aktiven Pfad (inkl. AR-Darstellung, Karten-Highlight und Zielmarker-Aktualisierung).
 * @param {number} index Pfadindex
 */
function setActivePath(index) {
  if (!pathManager || index < 0 || index >= pathManager.paths.length) {
    activePathIndex = -1;
    removeARPaths();
    // Pfeil-Sichtbarkeit aktualisieren
    updateArrowVisibility();
    return;
  }

  activePathIndex = index;
  pathManager.setActivePath(index);
  mapView?.setActivePath(index);

  if (locar && threeCamera) createARPaths(pathManager.paths[activePathIndex]);

  // Zugehörigen Endpunkt-Marker aktivieren (auto-Erzeugung bei Bedarf)
  const activePath = pathManager.paths[activePathIndex];
  if (activePath?.wgs84Coords?.length) {
    const last = activePath.wgs84Coords[activePath.wgs84Coords.length - 1];
    const lon = last[0], lat = last[1];
    let markerIndex = findMarkerIndexByLatLon(lat, lon, 1e-5);
    if (markerIndex === -1) markerIndex = addPathEndpointMarker(activePath);
    if (markerIndex >= 0) setActive(markerIndex);
  }

  updatePathSwitcherUI();

  // Pfeil-Sichtbarkeit aktualisieren
  updateArrowVisibility();

  const path = pathManager.paths[index];
  const distance = path.distance ? `${(path.distance / 1000).toFixed(2)} km` : '';
  const name = path.properties?.name || `Weg ${index + 1}`;
  showPopup(`${name} ${distance ? `(${distance})` : ''}`, 2000);
}

/**
 * Lädt und zeigt Rettungspunkte im 10 km-Umkreis.
 */
async function loadAndShowRescuePoints() {
  try {
    if (!currentCoords.latitude || !currentCoords.longitude) {
      showPopup('GPS-Position noch nicht verfügbar. Bitte auf Signal warten…', 3000);
      return;
    }

    if (!pathManager) {
    pathManager = new PathManager({ locar, camera: threeCamera });
    window.pathManager = pathManager; // Globale Referenz setzen
  }

    showPopup('Lade Rettungspunkte…', 0);
    const rescuePoints = await pathManager.loadRescuePointsFromGPX(
      './rescuepoints/NordrheinWestfalen.gpx',
      currentCoords,
      10000
    );
    showPopup('', 0, true); // Ladeindikator aus

    if (!rescuePoints.length) return showPopup('Keine Rettungspunkte im 10 km-Umkreis gefunden', 3000);

    rescuePoints.forEach((rp) => {
      const markerData = {
        latitude: rp.latitude,
        longitude: rp.longitude,
        popupContent: `🚑 ${rp.name}\nEntfernung: ${(rp.distance / 1000).toFixed(1)} km`,
        markerType: 'rescue',
        rescuePointId: rp.id
      };

      const dup = targetCoords.some(coord =>
        Math.abs(coord.latitude - rp.latitude) < 1e-4 &&
        Math.abs(coord.longitude - rp.longitude) < 1e-4
      );
      if (!dup) {
        targetCoords.push(markerData);
        if (locar && threeCamera) addMarker(markerData, targetCoords.length - 1);
      }

      // Rettungspunkt immer zur MapView hinzufügen (auch wenn Karte noch nicht initialisiert)
      if (mapView) {
        mapView.addRescuePointMarker(rp.latitude, rp.longitude, rp.name, rp.distance);
      }
    });

    rescuePointsVisible = true;
    const count = rescuePoints.length;
    const nearestKm = (rescuePoints[0].distance / 1000).toFixed(1);
    showPopup(`${count} Rettungspunkte geladen (nächster: ${nearestKm} km)\n© KWF-Rettungspunkte v2.18`, 4000);
  } catch (error) {
    console.error('Fehler beim Laden der Rettungspunkte: ', error);
    showPopup('Fehler beim Laden der Rettungspunkte', 3000);
  }
}

/** Blendet alle Rettungspunkte (AR+Karte) aus und bereinigt Ziel-/Marker-Arrays. */
function hideRescuePoints() {
  const originalLength = targetCoords.length;
  const rescueIndices = [];

  targetCoords.forEach((coord, index) => { if (coord.markerType === 'rescue') rescueIndices.push(index); });

  // Ziel-Liste filtern
  targetCoords = targetCoords.filter(coord => coord.markerType !== 'rescue');

  // Marker (AR) entfernen – in umgekehrter Reihenfolge, um Indizes zu bewahren
  rescueIndices.reverse().forEach(index => {
    const marker = markers[index];
    if (!marker) return;
    if (marker.markerAnchor?.parentNode) marker.markerAnchor.parentNode.removeChild(marker.markerAnchor);
    else if (marker.markerObject?.parent) marker.markerObject.parent.remove(marker.markerObject);
    marker.dispose();
    markers.splice(index, 1);
  });

  // Aktiven Index korrigieren
  if (rescueIndices.includes(indexActive)) {
    indexActive = targetCoords.length ? 0 : -1;
    if (indexActive >= 0) setActive(indexActive);
  } else if (indexActive >= targetCoords.length && targetCoords.length) {
    indexActive = targetCoords.length - 1;
    setActive(indexActive);
  }

  // Kartenmarker aktualisieren
  if (mapView) {
    mapView.removeAllTargetMarkers();
    targetCoords.forEach((coord, index) => {
      mapView.addTargetMarker(coord.latitude, coord.longitude, coord.popupContent, index === indexActive, index);
    });
    mapView.removeRescuePointMarkers();
  }

  rescuePointsVisible = false;
}

/* ============================================================================
 * 7) Initialisierung
 * ========================================================================== */

/**
 * Initialisiert die AR-Szene, Kamera/Renderer, LoCAR, MapView und Events.
 * Optimiert für schnelle UI-Responsivität nach Kamera-Start.
 */
async function init() {
  sceneEl  = document.querySelector('a-scene');
  renderer = sceneEl.renderer;
  cameraEl = document.getElementById('camera');

  // Kamera-Objekt (Three) mit kleinem Retry
  const setupCamera = async () => {
    const cam = cameraEl.getObject3D('camera');
    if (!cam) {
      await new Promise(r => setTimeout(r, 100));
      return setupCamera();
    }
    return cam;
  };

  try {
    // Setup Event Handlers früh (lightweight)
    const handleResize = () => {
      screenOrientation = { type: screen.orientation?.type, angle: screen.orientation?.angle };
      const update = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (threeCamera) {
          threeCamera.aspect = window.innerWidth / window.innerHeight;
          threeCamera.updateProjectionMatrix();
        }
      };
      isIOS ? setTimeout(update, 200) : update();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        screenOrientation = { type: screen.orientation?.type, angle: screen.orientation?.angle };
      }, 100);
    });

    // Kamera setup
    threeCamera = await setupCamera();

    // LoCAR aus der A-Frame-Komponente holen
    const comp = cameraEl.components['locar-camera'];
    if (comp?.locar) {
      locar     = comp.locar;
      controls  = comp.deviceOrientationControls;
      try { locar.startGps(); } catch (err) { handleGpsError(err); }
    } else {
      throw new Error('locar-camera fehlt oder locar nicht initialisiert');
    }

    // GPS Event registrieren (kritisch für AR-Updates)
    cameraEl.addEventListener('gpsupdate', onGpsUpdate);
    
    // Renderloop starten - UI ist ab hier responsive!
    renderer.setAnimationLoop(animate);

    // Karte asynchron initialisieren (non-blocking für UI)
    setTimeout(() => {
      initMapViewAsync();
    }, 10); // Minimal delay, damit UI-Thread freigegeben wird

  } catch (error) {
    handleGenericError(error);
    throw error;
  }
}

/**
 * Asynchrone Karten-Initialisierung - blockiert nicht die UI-Updates.
 */
function initMapViewAsync() {
  try {
    mapView = new MapView({
      onMarkerClick: (index, title) => {
        if (index !== indexActive) {
          setActive(index);
          showPopup('Ziel aktualisiert!', 2000);
          updateDistanceDisplay();
        } else {
          showPopup(title, 3000);
        }
      },
      onRescuePointClick: (lat, lon, name) => {
        // Rettungspunkt als neuen Zielmarker hinzufügen
        const data = { 
          latitude: lat, 
          longitude: lon, 
          popupContent: `Rettungspunkt: ${name}` 
        };
        
        targetCoords.push(data);
        const newIndex = targetCoords.length - 1;
        
        // Marker in AR hinzufügen (falls AR aktiv)
        addMarker(data, newIndex);
        
        // Marker auf Karte hinzufügen
        mapView?.addTargetMarker(data.latitude, data.longitude, data.popupContent, false);
        
        // Neuen Marker aktivieren
        setActive(newIndex);
        
        showPopup(`Rettungspunkt "${name}" als Ziel hinzugefügt!`, 3000);
        updateDistanceDisplay();
      },
      onMapInitialized: () => {
        // Marker/Pfade in nächstem Frame synchronisieren (non-blocking)
        requestAnimationFrame(() => {
          syncAllMarkersToMap();

          if (pathManager?.paths?.length > 0) {
            mapView.addPaths(pathManager.paths, activePathIndex);
          } else if (window.pendingMapPaths?.length > 0) {
            mapView.addPaths(window.pendingMapPaths, activePathIndex);
            window.pendingMapPaths = null;
          }
        });
      }
    });
  } catch (error) {
    console.error('MapView Initialisierung fehlgeschlagen:', error);
    handleGenericError(error);
  }
}

/** Initialisiert die Pfad-Navigation (PathManager). */
async function initPathNavigation() {
  if (!pathManager) {
    pathManager = new PathManager({ locar, camera: threeCamera });
    window.pathManager = pathManager; // Globale Referenz setzen
  }
}

/* ============================================================================
 * 8) GPS-Updates & Renderloop
 * ========================================================================== */

/**
 * GPS-Update-Handler:
 * - Aktualisiert Position/Genauigkeit, Kartenposition
 * - Fügt AR-/UI-Elemente initial hinzu
 * - Aktiviert sinnvoll den richtigen Zielmarker (Endpunkt aktiver Pfad bevorzugt)
 * - Erstellt ausstehende AR-Pfade, aktualisiert Pfeil/Marker/Pfade/Kompass
 */
function onGpsUpdate(e) {
  try {
    const pos = e.detail.position.coords;
    currentCoords.latitude  = pos.latitude;
    currentCoords.longitude = pos.longitude;
    window.currentGPSPosition = { latitude: pos.latitude, longitude: pos.longitude };

    // GPS-Genauigkeit anzeigen
    const accuracy = pos.accuracy; // in Metern
    if (gpsAccuracyValue && gpsIndicator) {
      gpsAccuracyValue.innerText = `~${Math.round(accuracy)}m`;
      gpsIndicator.classList.remove('gps-indicator--high', 'gps-indicator--medium', 'gps-indicator--low');
      if (accuracy < 5)      gpsIndicator.classList.add('gps-indicator--high');
      else if (accuracy < 15)gpsIndicator.classList.add('gps-indicator--medium');
      else                   gpsIndicator.classList.add('gps-indicator--low');
    }

    // Kartenposition aktualisieren
    mapView?.updateUserPosition(pos.latitude, pos.longitude);

    // Initiale AR-/UI-Elemente hinzufügen (einmalig)
    if (targetCoords.length && markers.length === 0) {
      ensureARElementsCreated(); // Stelle sicher, dass alle AR-Elemente existieren
      addAllMarkers();

      // Bereits gewählten Index beibehalten, ansonsten Endpunkt aktiven Pfads, sonst 0
      let desiredIndex =
        (typeof indexActive === 'number' && indexActive >= 0 && indexActive < targetCoords.length)
          ? indexActive
          : -1;

      if (desiredIndex === -1) {
        const ap = (pathManager && activePathIndex >= 0) ? pathManager.paths[activePathIndex] : null;
        if (ap?.wgs84Coords?.length) {
          const last = ap.wgs84Coords[ap.wgs84Coords.length - 1];
          const lon = last[0], lat = last[1];
          let idx = findMarkerIndexByLatLon(lat, lon);
          if (idx === -1) idx = addPathEndpointMarker(ap);
          if (idx >= 0) desiredIndex = idx;
        }
      }

      if (desiredIndex === -1) desiredIndex = 0;
      setActive(desiredIndex);
    }

    // Ausstehende AR-Pfade erstellen, wenn AR bereit ist
    if (window.pendingPaths && locar && threeCamera && !arPaths.length) {
      ensureARElementsCreated(false); // Pfeile erstellen, aber Sichtbarkeit noch nicht setzen
      const activePath = window.pendingPaths[activePathIndex] || window.pendingPaths[0];
      if (activePath) createARPaths(activePath);
      window.pendingPaths = null;
    }

    // Laufende Updates
    arrow?.update();
    pathArrow?.update();

    if (markers.length > 0) {
      markers.forEach(m => {
        if (m.markerObject?.parent) m.update();
      });
    }

    if (pathManager?.paths?.length > 0) {
      const nearest = pathManager.findNearestPath({ latitude: pos.latitude, longitude: pos.longitude });
      if (nearest) {
        const distance = nearest.distance;
        const nearestPathIndex = pathManager.paths.findIndex(p => p.id === nearest.path.id);
        // DEAKTIVIERT: Automatische Pfadaktivierung (überschreibt Nutzerauswahl)
        // if (distance < 100 && nearestPathIndex !== activePathIndex) setActivePath(nearestPathIndex);
      }
    }
  } catch (err) {
    handleGpsError(err);
  }
}

/**
 * Render-/Animationsschleife:
 * - aktualisiert Controls, Pfeil, Marker, aktiven AR-Pfad, Kompass
 * - rotiert Karte gemäß Geräteausrichtung (inkl. Landscape-Korrektur)
 * - rendert Szene
 */
let frameCount = 0; // Für Throttling weniger kritischer Updates

function animate() {
  frameCount++;
  
  // Kritische Updates (jedes Frame)
  controls?.update();
  arrow?.update();
  pathArrow?.update();

  // AR-Objekte Updates (jedes Frame)
  if (markers.length > 0) {
    markers.forEach(m => { if (m.markerObject?.parent) m.update(); });
  }

  if (arPaths?.length > 0 && arPaths[0]?.update) {
    arPaths[0].update();
  }

  compass?.update();

  // Weniger kritische Updates (alle 3 Frames = ~20Hz bei 60 FPS)
  if (frameCount % 3 === 0) {
    // Benutzer-Richtung auf Karte anzeigen (statt Kartenrotation)
    if (mapView?.map && controls?.getCorrectedHeading) {
      let heading = controls.getCorrectedHeading();
      if (isIOS) {
        mapView.updateUserHeading(-heading); // iOS: Vorzeichen invertiert
      } else {
        // Android: Korrektur im Landscape-Modus
        let orientationOffset = 0;
        if (screenOrientation.type?.includes('landscape') || Math.abs(screenOrientation.angle) === 90) {
          if (screenOrientation.type === 'landscape-primary' || screenOrientation.angle === 90) {
            orientationOffset = 90;  // Gerät nach links gedreht
          } else if (screenOrientation.type === 'landscape-secondary' ||
                     screenOrientation.angle === 270 || screenOrientation.angle === -90) {
            orientationOffset = -90; // Gerät nach rechts gedreht
          }
        }
        mapView.updateUserHeading(heading + orientationOffset);
      }
    }

    // Distanzanzeige aktualisieren
    updateDistanceDisplay();
  }

  // Render (jedes Frame - kritisch für flüssige AR)
  if (renderer && threeCamera) renderer.render(sceneEl.object3D, threeCamera);
}

/* ============================================================================
 * 9) Buttons / Listener (Start, Pfade laden/wechseln)
 * ========================================================================== */

/**
 * Startet den AR-Modus (Berechtigungen prüfen, init, Pfadnavigation starten, UI-Wechsel).
 */
btnStart?.addEventListener('click', async () => {
  try {
    // Zusätzliche Prüfung zur Sicherheit
    if (!targetCoords?.length && (!pathManager?.paths?.length)) {
      return showPopup('Bitte mindestens ein Ziel oder einen Pfad hinzufügen!', 3000);
    }
    if (!checkBrowserSupport()) return;

    // AR init parallel zu iOS-Orientation-Permission
    const initProcess = init();
    let permissionPromise = Promise.resolve();

    if (window.DeviceOrientationEvent?.requestPermission) {
      permissionPromise = DeviceOrientationEvent.requestPermission()
        .then(result => {
          if (result !== 'granted') {
            throw { name: 'NotAllowedError', message: 'Ohne Zugriff auf Bewegungsdaten kann AR nicht starten.' };
          }
        })
        .catch(err => { handleSensorError(err); throw err; });
    }

    await Promise.all([initProcess, permissionPromise]);

    await initPathNavigation();

    overlayContainer.style.display = 'none';
    arContainer.style.display = 'block';
  } catch (err) {
    if (err?.name === 'NotAllowedError') handleSensorError(err);
    else handleGenericError(err);
  }
});

/** Lädt mehrere Pfade aus JSON und richtet AR/Karte/Marker ein. */
btnLoadPaths?.addEventListener('click', async () => {
  try {
    if (!pathManager) {
      pathManager = new PathManager();
      window.pathManager = pathManager; // Globale Referenz setzen
    }

    showPopup('Lade Wegedaten…', 0);
    const pathUrls = [
      './test-paths/route_corrected.json',
      './test-paths/new_route_alt.json'
    ];
    const paths = await pathManager.loadMultiplePathsFromJson(pathUrls);
    showPopup('', 0, true);

    if (!paths.length) return showPopup('Keine Wege gefunden', 3000);

    // Pfade in der Karte
    if (mapView) mapView.addPaths(paths);
    else window.pendingMapPaths = paths;

    // AR-Pfeile vorbereiten, aber noch keine Pfade erstellen
    if (sceneEl && locar && threeCamera && paths.length > 0) {
      ensureARElementsCreated(false); // Pfeile erstellen, aber Sichtbarkeit noch nicht setzen
    } else {
      window.pendingPaths = paths;
    }

    // Endpunkt-Marker für alle Pfade anlegen
    paths.forEach(p => addPathEndpointMarker(p));

    // Ersten Pfad aktivieren (setzt zugehörigen Zielmarker aktiv und erstellt AR-Pfad)
    if (paths.length > 0) {
      setActivePath(0);
      updatePathSwitcherUI();
    }

    showPopup(`${paths.length} Wege geladen`, 2000);
    checkNavigationReadiness(); // Navigation-Bereitschaft prüfen
  } catch (error) {
    console.error('Fehler beim Laden der Pfade:', error);
    showPopup('Fehler beim Laden der Pfade', 3000);
  }
});

/** Aktualisiert die Path-Switcher-UI (Sichtbarkeit, Beschriftung, Button-Zustände). */
function updatePathSwitcherUI() {
  const pathSwitcher = document.getElementById('pathSwitcher');
  const pathInfo     = document.getElementById('pathInfo');
  if (!pathSwitcher || !pathInfo) return;

  if (!pathManager?.paths?.length || pathManager.paths.length <= 1) {
    pathSwitcher.style.display = 'none';
    return;
  }

  pathSwitcher.style.display = 'flex';
  pathInfo.textContent = `Weg ${activePathIndex + 1} von ${pathManager.paths.length}`;

  btnPrevPath && (btnPrevPath.disabled = activePathIndex <= 0);
  btnNextPath && (btnNextPath.disabled = activePathIndex >= pathManager.paths.length - 1);
}

/** Wechselt zum vorherigen Pfad. */
function switchToPreviousPath() {
  if (activePathIndex > 0) {
    setActivePath(activePathIndex - 1);
    updatePathSwitcherUI();
    switchToPathEndpoint(pathManager.paths[activePathIndex]);
  }
}

/** Wechselt zum nächsten Pfad. */
function switchToNextPath() {
  if (pathManager && activePathIndex < pathManager.paths.length - 1) {
    setActivePath(activePathIndex + 1);
    updatePathSwitcherUI();
    switchToPathEndpoint(pathManager.paths[activePathIndex]);
  }
}

/**
 * Aktiviert den Zielmarker am Endpunkt des angegebenen Pfades.
 * @param {{wgs84Coords:number[][]}} path
 */
function switchToPathEndpoint(path) {
  if (!path?.wgs84Coords?.length) return;

  const last = path.wgs84Coords[path.wgs84Coords.length - 1];
  const lon = last[0], lat = last[1];

  let idx = findMarkerIndexByLatLon(lat, lon, 1e-5);
  if (idx !== -1) {
    setActive(idx);
  } else {
    const created = addPathEndpointMarker(path);
    if (created >= 0) setActive(created);
  }
}

// Path-Switcher Buttons
btnPrevPath?.addEventListener('click', switchToPreviousPath);
btnNextPath?.addEventListener('click', switchToNextPath);

// Rettungspunkte Toggle
toggleRescuePoints?.addEventListener('change', async (e) => {
  if (e.target.checked) await loadAndShowRescuePoints();
  else hideRescuePoints();
});
