import 'aframe';
import 'locar-aframe';
import 'aframe-look-at-component';
import { CompassGUI, addCompassToScene } from './compassGUI.js';
import { ARNavigationArrow, addArrowToScene } from './arNavigationArrow.js';
import { TargetMarker } from './targetMarker.js';
import { updateDistance } from './distanceOverlay.js';
import { MapView } from './mapView.js';
import { showPopup, handleCameraError, handleGpsError, handleSensorError, checkBrowserSupport, checkSensorAvailability, handleGenericError } from './errorHandler.js';
import { PathManager } from './pathManager.js';
import { ARPathTube } from './arPathTube.js';

// Elemente
const overlayContainer = document.getElementById('overlayContainer');
const arContainer      = document.getElementById('arContainer');
const lonInput         = document.getElementById('longitude');
const latInput         = document.getElementById('latitude');
const btnAdd           = document.getElementById('btnAddMarker');
const btnStart         = document.getElementById('btnStart');
const btnTest          = document.getElementById('btnTestAdd');
const markerPopup      = document.getElementById('markerPopup');
const closeButton      = document.getElementById('popupClose');
const distanceOverlay  = document.getElementById('distance-overlay');
const gpsIndicator      = document.querySelector('.gps-indicator');
const gpsAccuracyValue  = document.querySelector('.gps-accuracy-value');

// Settings-Elemente
const settingsButton = document.getElementById('settingsButton');
const settingsMenu = document.getElementById('settingsMenu');
const toggleCompass = document.getElementById('toggleCompass');
const toggleGPS = document.getElementById('toggleGPS');
const toggleMap = document.getElementById('toggleMap');
const toggleRescuePoints = document.getElementById('toggleRescuePoints');
const rescuePointsInfo = document.getElementById('rescuePointsInfo');
const arrowColorPicker = document.getElementById('arrowColorPicker');
const colorPreview = document.getElementById('colorPreview');
const compassContainer = document.getElementById('compassContainer');
const gpsAccuracy = document.querySelector('.gps-accuracy');
const mapContainer = document.getElementById('mapContainer');

// Copyright Modal Elemente
const copyrightModal = document.getElementById('copyrightModal');
const copyrightModalClose = document.getElementById('copyrightModalClose');

// UI-Elemente für Pfad-Navigation
const btnLoadPaths = document.getElementById('btnLoadPaths');

// State
let sceneEl, renderer, cameraEl, threeCamera;
let locar, controls;
let compass, arrow;
let mapView;
let markers = [];
let targetCoords = [];
let indexActive = 0;
let distanceMode = 'distance'; // 'distance', 'minutes', 'both'
const currentCoords = { latitude: null, longitude: null };
let screenOrientation = { type: screen.orientation?.type, angle: screen.orientation?.angle };

// Pfad-Navigation State
let pathManager;
let arPaths = [];
let activePathIndex = -1;
let rescuePointsVisible = false;
let rescuePointMarkers = [];
const isIOS = navigator.userAgent.match(/iPhone|iPad|iPod/i);

/**
 * Prüft, ob bereits ein Marker an den gegebenen Koordinaten existiert
 * @param {number} lat - Breitengrad
 * @param {number} lon - Längengrad
 * @param {number} tolerance - Toleranz in Grad (Standard: 0.000001 ≈ 0.1m)
 * @returns {boolean} - true wenn ein Duplikat gefunden wurde
 */
function isDuplicateMarker(lat, lon, tolerance = 0.000001) {
  return targetCoords.some(marker => 
    Math.abs(marker.latitude - lat) < tolerance && 
    Math.abs(marker.longitude - lon) < tolerance
  );
}

/**
 * Schließt ein Popup, wenn auf den Schließen-Button des Popups geklickt wird.
 */
closeButton.addEventListener('click', () => {
  markerPopup.classList.remove('marker-popup--visible');
});

/**
 * Button zum Hinzufügen einzelner Zielpunkte über die Eingabefelder "latitude" und "longitude"
 * Die Werte werden validiert (für WGS84-Koordinaten: -90 <= lat <= 90 und -180 <= lon <= 180)
 * Nur wenn sie gültig sind, wird das Ziel dem Array targetCoords angehängt.
 */
btnAdd.addEventListener('click', () => {

  const lon = parseFloat(lonInput.value);
  const lat = parseFloat(latInput.value);

  // Validierung der Werte von lat und lon
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    showPopup('Ungültige Koordinaten!', 3000);
    return;
  }

  // Prüfung auf Duplikate
  if (isDuplicateMarker(lat, lon)) {
    showPopup('Marker an dieser Position existiert bereits!', 3000);
    return;
  }

  const newMarker = {
    longitude: lon,
    latitude:  lat,
    popupContent: 'Ziel aktualisiert!'
  };

  targetCoords.push(newMarker);

  // Zusätzlich zum AR Marker auch Kartenmarker hinzufügen, wenn Karte bereits existiert
  if (mapView) {
    const isActive = targetCoords.length === 1; // Erster Marker ist automatisch aktiv
    mapView.addTargetMarker(
      newMarker.latitude,
      newMarker.longitude,
      newMarker.popupContent,
      isActive
    );
  }

  console.log('Current targetCoords:', targetCoords);
  showPopup('Marker hinzugefügt!', 1500);
});

// Test-Button zum Hinzufügen von Testzielen, wird in der produktiven Version entfernt
/**
 * Fügt 5 Ziele in der Nähe der aktuellen Position hinzu, um die Funktionalität zu testen.
 * Die Werte werden ans Array targetCoords angehängt.
 */
btnTest.addEventListener('click', async () => {
  // Aktuelle Position abrufen um Koordinaten der Testziele zu berechnen
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

    // Testziele vordefinieren und in einem Batch erstellen
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

    // Duplikat-Prüfung für alle neuen Marker
    const uniqueMarkers = newMarkers.filter(newMarker => 
      !isDuplicateMarker(newMarker.latitude, newMarker.longitude)
    );

    if (uniqueMarkers.length === 0) {
      showPopup('Alle Testmarker existieren bereits an diesen Positionen!', 3000);
      return;
    }

    if (uniqueMarkers.length < newMarkers.length) {
      const skippedCount = newMarkers.length - uniqueMarkers.length;
      console.log(`${skippedCount} Marker übersprungen (Duplikate)`);
    }

    // Nur eindeutige Ziele hinzufügen
    targetCoords.push(...uniqueMarkers);
    
    // Kartenmarker auch hinzufügen, wenn Karte bereits existiert
    if (mapView) {
      uniqueMarkers.forEach((marker, index) => {
        const globalIndex = targetCoords.length - uniqueMarkers.length + index;
        const isActive = globalIndex === 0; // Erster Marker global ist aktiv
        mapView.addTargetMarker(
          marker.latitude,
          marker.longitude,
          marker.popupContent,
          isActive
        );
      });
    }
    
    // Feedback über hinzugefügte Marker
    const addedCount = uniqueMarkers.length;
    const skippedCount = newMarkers.length - uniqueMarkers.length;
    
    if (skippedCount > 0) {
      showPopup(`${addedCount} neue Marker hinzugefügt, ${skippedCount} Duplikate übersprungen!`, 2500);
    } else {
      showPopup(`${addedCount} Marker hinzugefügt!`, 1500);
    }
  } catch (err) {
    console.error('Fehler beim Abrufen der aktuellen Position:', err);
    handleGpsError(err);
  }
});

/**
 * Startet den AR-Modus. Prüft ob mindestens ein Ziel im Array targetCoords vorhanden ist und zeigt ansonsten ein Popup an.
 * Prüft weitere Berechtigungen und zeigt gegebenenfalls Fehlermeldungen an.
 */
btnStart.addEventListener('click', async() => {
  console.log('Start button clicked');
  
  try {
    // Prüfe, ob mindestens ein Ziel vorhanden ist
    if (!targetCoords || targetCoords.length === 0) {
      showPopup('Bitte mindestens ein Ziel hinzufügen!', 3000);
      return;
    }

    // Browser-Support prüfen
    if (!checkBrowserSupport()) {
      return;
    }

    // Initialisierung starten
    const initProcess = init();

    // Parallel dazu: Device Orientation Permissions anfordern (an dieser Stelle, da iOs dafür eine Nutzerinteraktion braucht)
    let permissionPromise = Promise.resolve();
    if (window.DeviceOrientationEvent?.requestPermission) {
      permissionPromise = DeviceOrientationEvent.requestPermission()
        .then(result => {
          if (result !== "granted") {
            throw { name: 'NotAllowedError', message: 'Ohne Zugriff auf Bewegungsdaten kann AR nicht starten.' };
          }
        })
        .catch(err => {
          handleSensorError(err);
          throw err;
        });
    }

    // Warte auf beide Prozesse
    await Promise.all([initProcess, permissionPromise]);

    // Pfadnavigation initialisieren
    await initPathNavigation();

    // AR-Container anzeigen
    overlayContainer.style.display = 'none';
    arContainer.style.display = 'block';

    console.log('AR-Modus erfolgreich gestartet');
  } catch (err) {
    console.error("Fehler beim Starten des AR-Modus:", err);
    if (err && err.name === 'NotAllowedError') {
      handleSensorError(err);
    } else {
      handleGenericError(err);
    }
  }
});

/**
 * Toggle für die Sichtbarkeit des Einstellungen-Menüs
 */
settingsButton.addEventListener('click', (e) => {
  e.stopPropagation(); // Verhindert das Schließen durch document-click
  settingsMenu.classList.toggle('settings-menu--visible');
});

/**
 * Sorgt dafür, dass das Einstellungen-Menü nicht geschlossen wird, wenn auf das Menü selbst geklickt wird.
 * Teil der Funktionalität, die das Menü schließt, wenn außerhalb geklickt wird.
 */
settingsMenu.addEventListener('click', (e) => {
  e.stopPropagation();
});

/**
 * Schließt das Einstellungen-Menü, wenn außerhalb des Menüs geklickt wird.
 */
document.addEventListener('click', (e) => {
  // Verhindere das Schließen des Settings-Menüs, wenn das Copyright-Modal aktiv ist
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

/**
 * Bindet einen Toggle-Checkbox an ein Element
 * @param {*} checkbox Checkbox-Element
 * @param {*} el Element, dessen Sichtbarkeit gesteuert werden soll
 */
function bindToggle(checkbox, el) {
  checkbox?.addEventListener('change', (e) => {
    el.style.display = e.target.checked ? '' : 'none';
  });
}
bindToggle(toggleCompass, compassContainer);
bindToggle(toggleGPS,    gpsAccuracy);
bindToggle(toggleMap,    mapContainer);

// Copyright Modal Event-Listener
rescuePointsInfo?.addEventListener('click', (e) => {
  e.stopPropagation(); // Verhindert das Schließen des Settings-Menüs
  copyrightModal.classList.add('copyright-modal--visible');
});

copyrightModalClose?.addEventListener('click', (e) => {
  e.stopPropagation(); // Verhindert das Schließen des Settings-Menüs
  copyrightModal.classList.remove('copyright-modal--visible');
});

// Modal schließen beim Klick auf Overlay
copyrightModal?.addEventListener('click', (e) => {
  if (e.target === copyrightModal || e.target.classList.contains('copyright-modal__overlay')) {
    e.stopPropagation(); // Verhindert das Schließen des Settings-Menüs
    copyrightModal.classList.remove('copyright-modal--visible');
  }
});

// Spezielle Behandlung für Rettungspunkte-Toggle
toggleRescuePoints?.addEventListener('change', async (e) => {
  const isEnabled = e.target.checked;
  
  if (isEnabled) {
    await loadAndShowRescuePoints();
  } else {
    hideRescuePoints();
  }
});

/**
 * Farbwähler für die Pfeilfarbe im Einstellungen-Menü.
 * Nutzt das HTML Element <input type="color">, das einen Standard-Browser-Farbwähler öffnet.
 * Mit Klick auf eine Farbe wird die Farbe des Navigationspfeils durch einen Aufruf von updateArrowColor() geändert.
 */
arrowColorPicker.addEventListener('change', (e) => {
  const selectedColor = e.target.value;
  
  // Farbvorschau aktualisieren
  colorPreview.style.background = selectedColor;
  
  // Pfeilfarbe ändern (wenn der Pfeil bereits existiert)
  if (window.arrow && window.arrow.arrowObject) {
    updateArrowColor(selectedColor);
  }
  
  // Farbe für zukünftige Initialisierung speichern
  window.selectedArrowColor = selectedColor;
});

/**
 * Aktualisiert die Farbe des Navigationspfeils.
 * @param {string} color - Die neue Farbe im Hex-Format.
 * @returns {void}
 */
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
 * Event-Listener für das Distanz-Overlay zum Umschalten zwischen den Anzeigemodi
 * Optionen: 'distance' (Standard), 'minutes', 'both'
 */
if (distanceOverlay) {
  distanceOverlay.style.cursor = 'pointer';
  distanceOverlay.title = 'Klicken zum Umschalten zwischen Meter/Gehminuten';
  
  distanceOverlay.addEventListener('click', () => {
    // Durch die Modi cyceln: distance → minutes → both → distance
    if (distanceMode === 'distance') {
      distanceMode = 'minutes';
    } else if (distanceMode === 'minutes') {
      distanceMode = 'both';
    } else {
      distanceMode = 'distance';
    }
    
    // Sofort die Anzeige aktualisieren
    if (targetCoords[indexActive]) {
      updateDistance(currentCoords, targetCoords[indexActive], distanceOverlay, { mode: distanceMode });
    }
    
    console.log('Distance mode changed to :', distanceMode);
  });
}

/**
 * Aktiviert den Vollbild-Modus
 * Auf iOs Geräten wird der Vollbild-Modus nicht immer unterstützt
 * @returns {Promise} Promise, das resolved wird, wenn Vollbild aktiviert wurde
 */
async function enterFullscreen() {
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      await document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      await document.documentElement.msRequestFullscreen();
    }
    console.log('Vollbild-Modus aktiviert');
  } catch (error) {
    console.warn('Vollbild-Modus konnte nicht aktiviert werden:', error);
    // Nicht kritisch, Anwendung kann trotzdem fortfahren
  }
}

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
      // Screen Orientation aktualisieren
      screenOrientation = { type: screen.orientation?.type, angle: screen.orientation?.angle };
      
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

    // Zusätzlich orientationchange Event für bessere Kompatibilität
    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        screenOrientation = { type: screen.orientation?.type, angle: screen.orientation?.angle };
        console.log('Orientation changed:', screenOrientation);
      }, 100);
    });

    // LocAR Setup
    const comp = cameraEl.components['locar-camera'];
    if (comp?.locar) {
      locar = comp.locar;
      controls = comp.deviceOrientationControls;
      console.log('LocAR Setup Debug:', {
        locarType: locar.constructor.name,
        locarMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(locar)),
        hasLonLatToWorldCoords: typeof locar.lonLatToWorldCoords === 'function'
      });
      try {
        locar.startGps();
      } catch (err) {
        handleGpsError(err);
      }
    } else {
      handleGenericError(new Error('locar-camera fehlt oder locar nicht initialisiert'));
      throw new Error('locar-camera fehlt oder locar nicht initialisiert');
    }
    // MapView initialisieren mit Callback für Marker-Klicks
    mapView = new MapView({
      onMarkerClick: (index, title) => {
        console.log('Map marker clicked:', index, title);
        if (index !== indexActive) {
          setActive(index);
          showPopup('Ziel aktualisiert!', 2000);
          updateDistance(currentCoords, targetCoords[indexActive], distanceOverlay, { mode: distanceMode });
        } else {
          showPopup(title, 3000);
        }
      },
      onMapInitialized: () => {
        // Wenn die Karte initialisiert wird, alle bestehenden Marker hinzufügen
        console.log('Map initialized, adding existing markers...');
        syncAllMarkersToMap();
        
        // Geladene Pfade zur Karte hinzufügen, falls vorhanden.
        if (pathManager && pathManager.paths && pathManager.paths.length > 0) {
          console.log('Map initialized, adding existing paths from pathManager...', {
            pathManager: !!pathManager,
            paths: pathManager.paths,
            pathsLength: pathManager.paths.length,
            activePathIndex: activePathIndex
          });
          mapView.addPaths(pathManager.paths, activePathIndex);
        } else if (window.pendingMapPaths && window.pendingMapPaths.length > 0) {
          console.log('Map initialized, adding pending paths...', {
            pendingPaths: window.pendingMapPaths,
            pathsLength: window.pendingMapPaths.length,
            activePathIndex: activePathIndex
          });
          mapView.addPaths(window.pendingMapPaths, activePathIndex);
          window.pendingMapPaths = null; // Aufräumen
        } else {
          console.log('Keine Pfade vorhanden beim Karten-Init:', {
            pathManager: !!pathManager,
            paths: pathManager?.paths,
            pathsLength: pathManager?.paths?.length,
            pendingMapPaths: window.pendingMapPaths
          });
        }
      }
    });
    
    // Event Listeners
    cameraEl.addEventListener('gpsupdate', onGpsUpdate);
    renderer.setAnimationLoop(animate);
    
    console.log('AR-Szene erfolgreich initialisiert');
  } catch (error) {
    console.error('Fehler bei der Initialisierung:', error);
    handleGenericError(error);
    throw error;
  }
}

/**
 * Initialisiert die Pfad-Navigation
 */
async function initPathNavigation() {
  // PathManager initialisieren
  pathManager = new PathManager({
    locar: locar,
    camera: threeCamera
  });
  
  console.log('Pfad-Navigation initialisiert');
}

/**
 * AR-Pfadobjekte erstellen (nur Tube-Geometrie)
 * @param {Array} paths - Array von Pfadobjekten
 */
function createARPaths(paths) {
  // Bestehende AR-Pfade entfernen
  removeARPaths();
  
  // Neue AR-Pfade erstellen (nur ARPathTube)
  arPaths = paths.map((path, index) => {
    const arPath = new ARPathTube({
      locar: locar,
      camera: threeCamera,
      path: path,
      color: 0x00ff00, // Hellgrün für bessere Sichtbarkeit
      radius: 0.3, // Rohr-Radius in Metern
      height: 3.0, // Höhe über dem Boden
      isActive: index === activePathIndex
    });
    
    // AR-Darstellung erstellen
    arPath.createPathObject();
    
    return arPath;
  });
  
  console.log(`${arPaths.length} AR-Pfadobjekte erstellt`);
}

/**
 * Alle AR-Pfadobjekte entfernen
 */
function removeARPaths() {
  arPaths.forEach(arPath => {
    arPath.removePath();
  });
  
  arPaths = [];
}

/**
 * Aktiven Pfad setzen
 * @param {number} index - Index des zu aktivierenden Pfads
 */
function setActivePath(index) {
  if (!pathManager || index < 0 || index >= pathManager.paths.length) {
    activePathIndex = -1;
    return;
  }
  
  activePathIndex = index;
  
  // PathManager aktualisieren
  pathManager.setActivePath(index);
  
  // Karte aktualisieren
  if (mapView) {
    mapView.setActivePath(index);
  }
  
  // AR-Pfade aktualisieren
  arPaths.forEach((arPath, i) => {
    arPath.setActive(i === index);
  });
  
  // Popup mit Pfadinfo anzeigen
  const path = pathManager.paths[index];
  const distance = path.distance ? `${(path.distance / 1000).toFixed(2)} km` : '';
  const name = path.properties.name || `Weg ${index + 1}`;
  
  showPopup(`${name} ${distance ? `(${distance})` : ''}`, 2000);
  
  console.log(`Aktiver Pfad auf Index ${index} gesetzt`);
}

/**
 * Lädt und zeigt Rettungspunkte im 10km Umkreis an
 */
async function loadAndShowRescuePoints() {
  try {
    if (!currentCoords.latitude || !currentCoords.longitude) {
      showPopup('GPS-Position noch nicht verfügbar. Warten Sie auf GPS-Signal...', 3000);
      return;
    }

    if (!pathManager) {
      pathManager = new PathManager({ locar, camera: threeCamera });
    }

    showPopup('Lade Rettungspunkte...', 0);

    const rescuePoints = await pathManager.loadRescuePointsFromGPX(
      './rescuepoints/NordrheinWestfalen.gpx',
      currentCoords,
      10000 // 10km Radius
    );

    showPopup('', 0, true); // Ladeindikator ausblenden

    if (rescuePoints.length === 0) {
      showPopup('Keine Rettungspunkte im 10km Umkreis gefunden', 3000);
      return;
    }

    // Rettungspunkte als AR-Marker hinzufügen
    rescuePoints.forEach((rescuePoint, index) => {
      const markerData = {
        latitude: rescuePoint.latitude,
        longitude: rescuePoint.longitude,
        popupContent: `🚑 ${rescuePoint.name}\nEntfernung: ${(rescuePoint.distance/1000).toFixed(1)}km`,
        markerType: 'rescue',
        rescuePointId: rescuePoint.id
      };

      // Prüfung auf Duplikate vor dem Hinzufügen
      const isDuplicate = targetCoords.some(coord => 
        Math.abs(coord.latitude - rescuePoint.latitude) < 0.0001 && 
        Math.abs(coord.longitude - rescuePoint.longitude) < 0.0001
      );

      if (!isDuplicate) {
        // Zur targetCoords Liste hinzufügen für 3D-Szene und Navigation
        targetCoords.push(markerData);
        console.log(`Rettungspunkt als Zielmarker hinzugefügt: ${rescuePoint.name}`);
        
        // Sofort den neuen Marker zur AR-Szene hinzufügen (falls AR aktiv ist)
        if (locar && threeCamera) {
          const newIndex = targetCoords.length - 1;
          addMarker(markerData, newIndex);
          console.log(`AR-Zielmarker für Rettungspunkt erstellt: Index ${newIndex}`);
        }
      }

      // Auch zur Karte hinzufügen, falls sie bereits existiert
      if (mapView && mapView.map) {
        // Als Rettungspunkt-Marker hinzufügen (rot)
        mapView.addRescuePointMarker(
          rescuePoint.latitude,
          rescuePoint.longitude,
          rescuePoint.name,
          rescuePoint.distance
        );
      }
    });

    rescuePointsVisible = true;
    const count = rescuePoints.length;
    const nearestDistance = (rescuePoints[0].distance / 1000).toFixed(1);
    
    // Kurze Copyright-Einblendung beim Laden
    showPopup(`${count} Rettungspunkte geladen (nächster: ${nearestDistance}km)\n© KWF-Rettungspunkte v2.18`, 4000);
    
    console.log(`Rettungspunkte Integration:`, {
      geladenePunkte: count,
      targetCoordsLength: targetCoords.length,
      markersLength: markers.length
    });

  } catch (error) {
    console.error('Fehler beim Laden der Rettungspunkte:', error);
    showPopup('Fehler beim Laden der Rettungspunkte', 3000);
  }
}

/**
 * Versteckt alle Rettungspunkte-Marker
 */
function hideRescuePoints() {
  // Rettungspunkte aus targetCoords entfernen
  const originalLength = targetCoords.length;
  const rescueIndices = [];
  
  // Sammle Indizes der zu entfernenden Rettungspunkte
  targetCoords.forEach((coord, index) => {
    if (coord.markerType === 'rescue') {
      rescueIndices.push(index);
    }
  });
  
  // Entferne Rettungspunkte aus targetCoords
  targetCoords = targetCoords.filter(coord => coord.markerType !== 'rescue');
  const removedCount = originalLength - targetCoords.length;
  
  // Entferne entsprechende Marker aus der markers Array (in umgekehrter Reihenfolge)
  rescueIndices.reverse().forEach(index => {
    if (markers[index]) {
      const marker = markers[index];
      if (marker.markerObject && marker.markerObject.parent) {
        marker.markerObject.parent.remove(marker.markerObject);
      }
      marker.dispose();
      markers.splice(index, 1);
      console.log(`Marker bei Index ${index} aus markers Array entfernt`);
    }
  });
  
  if (removedCount > 0) {
    console.log(`${removedCount} Rettungspunkte aus Zielmarkerliste entfernt`);
    
    // Aktiven Index anpassen, falls ein Rettungspunkt aktiv war
    if (rescueIndices.includes(indexActive)) {
      // Falls der aktive Marker ein Rettungspunkt war, setze auf den ersten verbleibenden Marker
      if (targetCoords.length > 0) {
        indexActive = 0;
        setActive(0); // Stelle sicher, dass der neue aktive Marker korrekt dargestellt wird
        console.log(`Aktiven Index auf ersten verbleibenden Marker (${indexActive}) gesetzt`);
      } else {
        indexActive = -1;
      }
    } else if (indexActive >= targetCoords.length && targetCoords.length > 0) {
      // Falls der aktive Index außerhalb des gültigen Bereichs liegt
      indexActive = targetCoords.length - 1;
      setActive(indexActive);
      console.log(`Aktiven Index auf ${indexActive} angepasst`);
    }
    
    // MapView Marker aktualisieren, falls vorhanden
    if (mapView) {
      mapView.removeAllTargetMarkers();
      // Verbleibende Zielmarker wieder hinzufügen
      targetCoords.forEach((coord, index) => {
        const isActive = index === indexActive;
        mapView.addTargetMarker(
          coord.latitude,
          coord.longitude,
          coord.popupContent,
          isActive,
          index
        );
      });
    }
  }

  // Karten-Marker entfernen
  if (mapView) {
    mapView.removeRescuePointMarkers();
  }

  rescuePointsVisible = false;
  console.log('Rettungspunkte ausgeblendet');
}

/**
 * GPS-Update-Handler
 * Bekommt die aktuelle GPS-Position und Genauigkeit und aktualisiert die GPS-Genauigkeitsanzeige, Kartenposition
 * und die AR Elemente.
 * Fügt AR und UI Elemente initial hinzu, wenn sie noch nicht existieren
 * 
 */
function onGpsUpdate(e) {
  //console.log('gpsupdate event:', e.detail.position);
  try {
    const pos = e.detail.position.coords;
    currentCoords.latitude  = pos.latitude;
    currentCoords.longitude = pos.longitude;
    
    // Make current GPS position globally accessible for distance calculations
    window.currentGPSPosition = {
      latitude: pos.latitude,
      longitude: pos.longitude
    };
    
    //console.log('currentCoords:', currentCoords);

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

    // Kartenposition aktualisieren
    if (mapView) {
      mapView.updateUserPosition(pos.latitude, pos.longitude);
    }

    // Alle UI-Elemente hinzufügen, wenn sie noch nicht existieren
    if (targetCoords.length && markers.length === 0) {
      addCompass();
      addArrow();
      addAllMarkers();
      setActive(0);
    }
    
    // Ausstehende Pfade erstellen, wenn AR jetzt bereit ist
    if (window.pendingPaths && locar && threeCamera && !arPaths.length) {
      console.log('Erstelle ausstehende AR-Pfade...');
      createARPaths(window.pendingPaths);
      window.pendingPaths = null;
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
    
    // Automatische Pfadsuche und Aktivierung, wenn Pfade geladen sind
    if (pathManager && pathManager.paths && pathManager.paths.length > 0) {
      const nearest = pathManager.findNearestPath({ latitude: pos.latitude, longitude: pos.longitude });
      if (nearest) {
        const distance = nearest.distance;
        
        // Aktiviere den Pfad automatisch, wenn der Nutzer innerhalb von 100m ist
        if (distance < 100 && nearestPathIndex !== activePathIndex) {
          console.log(`Auto-activating nearest path ${nearestPathIndex}, distance: ${distance.toFixed(1)}m`);
          setActivePath(nearestPathIndex);
        }
      }
    }
    
    //updateDistance(currentCoords, targetCoords[indexActive], distanceOverlay, { mode: distanceMode });
  } catch (err) {
    handleGpsError(err);
  }
}

/**
 * Haupt-Animationsschleife, die regelmäßig aufgerufen wird, aktualisiert die Eigenschaften der AR-Elemente.
 * Dreht die Karte mit, wenn mapView und controls existieren.
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

  // AR-Paths aktualisieren, wenn sie existieren
  if (arPaths && arPaths.length > 0) {
    arPaths.forEach(path => {
      if (path && typeof path.update === 'function') {
        path.update();
      }
    });
  }

  if (compass) compass.update();

  // Karte mitdrehen lassen, wenn mapView und controls existieren
  if (mapView && mapView.map && controls && typeof controls.getCorrectedHeading === 'function') {
    let heading = controls.getCorrectedHeading();
    
    if (isIOS) {
      mapView.rotateToHeading(-heading); // iOS: Vorzeichen invertieren
    } else {
      // Android: Landscape-Modus-Korrektur
      let orientationOffset = 0;
      
      if (screenOrientation.type?.includes('landscape') || Math.abs(screenOrientation.angle) === 90) {
        // Unterscheidung zwischen den beiden Landscape-Modi
        if (screenOrientation.type === 'landscape-primary' || screenOrientation.angle === 90) {
          orientationOffset = 90;  // Handy nach links gedreht (Home-Button rechts)
        } else if (screenOrientation.type === 'landscape-secondary' || screenOrientation.angle === 270 || screenOrientation.angle === -90) {
          orientationOffset = -90; // Handy nach rechts gedreht (Home-Button links)
        }
        console.log(`Android Landscape: type=${screenOrientation.type}, angle=${screenOrientation.angle}, offset=${orientationOffset}`);
      }
      
      mapView.rotateToHeading(heading + orientationOffset);
    }
  }
  updateDistance(currentCoords, targetCoords[indexActive], distanceOverlay, { mode: distanceMode });
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
 * Fügt den Navigationspfeil zur AR-Szene mit ensprechendem glb Modell hinzu.
 */
function addArrow() {
  console.log('addArrow()');
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
}

/**
 * Fügt automatisch einen Zielmarker am Ende eines geladenen Pfades hinzu
 * @param {Object} path - Der Pfad-Objekt mit wgs84Coords Array
 */
function addPathEndpointMarker(path) {
  console.log('addPathEndpointMarker', path);
  
  if (!path || !path.wgs84Coords || path.wgs84Coords.length === 0) {
    console.warn('Kein gültiger Pfad oder keine Koordinaten für Endpoint-Marker');
    return;
  }
  
  // Letzten Punkt des Pfades ermitteln
  const lastCoordinate = path.wgs84Coords[path.wgs84Coords.length - 1];
  const longitude = lastCoordinate[0];
  const latitude = lastCoordinate[1];
  
  // Prüfen ob bereits ein Marker an dieser Position existiert
  if (isDuplicateMarker(latitude, longitude)) {
    console.log('Marker am Pfad-Ende bereits vorhanden, überspringe...');
    return;
  }
  
  // Marker-Daten erstellen und NUR zu targetCoords hinzufügen (wie bei normalen Markern)
  const markerData = {
    latitude: latitude,
    longitude: longitude,
    popupContent: `Ziel: ${path.name || 'Pfad-Ende'}`
  };
  
  // Marker zu targetCoords hinzufügen (wird später mit addAllMarkers() erstellt)
  targetCoords.push(markerData);
  
  console.log(`Zielmarker-Daten am Ende des Pfades hinzugefügt: ${latitude}, ${longitude}`);
  console.log('Marker wird beim nächsten GPS-Update durch addAllMarkers() erstellt');
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
  marker.initMarker('./images/map-marker-orange.png');
  markers.push(marker);
  console.log('Markers array length:', markers.length);
    // Marker auch zur Karte hinzufügen, falls sie bereits initialisiert ist
  if (mapView && mapView.map) {
    const isActive = i === indexActive;
    console.log(`Adding single marker to map: ${data.popupContent || `Ziel ${i + 1}`}, active: ${isActive}`);
    mapView.addTargetMarker(
      data.latitude,
      data.longitude,
      data.popupContent || `Ziel ${i + 1}`,
      isActive,
      i  // Explizit den Index übergeben
    );
  }
}

/**
 * Ruft für alle Marker aus dem Array targetCoords die addMarker-Funktion auf.
 */
function addAllMarkers() {
  console.log('addAllMarkers, count:', targetCoords.length);
  
  // AR Marker hinzufügen
  targetCoords.forEach((d, i) => addMarker(d, i));
  
  // Zusätzliche Synchronisation mit der Karte, falls sie bereits existiert
  if (mapView && mapView.map) {
    console.log('Map exists, syncing all markers...');
    syncAllMarkersToMap();
  }
}

/**
 * Setzt den aktiven Marker und aktualisiert die Marker-Bildquellen.
 * @param {*} i der Index des zu aktiv werdenden Markers
 */
function setActive(i) {
  console.log('setActive marker:', i);
  indexActive = i;
  
  // AR-Marker aktualisieren
  markers.forEach((m, idx) => {
    m.updateMarkerImage(
      idx === i
        ? './images/map-marker-rot.png'
        : './images/map-marker-orange.png'
    );
  });
  
  // Karten-Marker aktualisieren
  if (mapView) {
    mapView.setActiveMarker(i);
  }
}

/**
 * Synchronisiert alle bestehenden AR-Marker mit der Karte
 */
function syncAllMarkersToMap() {
  if (!mapView || !mapView.map) {
    console.log('MapView or map not available for sync');
    return;
  }
  
  console.log(`Syncing ${targetCoords.length} markers to map...`);
  
  // Alle alten Karten-Marker entfernen
  mapView.removeAllTargetMarkers();
  
  // Alle AR-Marker zur Karte hinzufügen
  targetCoords.forEach((coords, index) => {
    const isActive = index === indexActive;
    console.log(`Syncing marker ${index}: ${coords.popupContent || `Ziel ${index + 1}`}, active: ${isActive}`);
    mapView.addTargetMarker(
      coords.latitude,
      coords.longitude,
      coords.popupContent || `Ziel ${index + 1}`,
      isActive,
      index  // Explizit den Index übergeben
    );
  });
  
  // Benutzendenposition zur Karte hinzufügen, falls verfügbar
  if (currentCoords.latitude && currentCoords.longitude) {
    mapView.updateUserPosition(currentCoords.latitude, currentCoords.longitude);
  }
}

// Event-Listener für Pfad-Laden-Button (direkt beim Laden der Seite)
if (btnLoadPaths) {
  btnLoadPaths.addEventListener('click', async () => {
    try {
      console.log('Pfad-Laden-Button wurde geklickt');
      
      // PathManager initialisieren, falls noch nicht vorhanden
      if (!pathManager) {
        pathManager = new PathManager();
      }
      
      // Ladeindikator anzeigen
      showPopup('Lade Wegedaten...', 0);
      
      // Pfade aus JSON laden
      const paths = await pathManager.loadPathsFromJson('./test-paths/new_route.json');
      console.log('Geladene Pfade:', paths);
      
      // Ladeindikator ausblenden
      showPopup('', 0, true);
      
      if (paths.length === 0) {
        showPopup('Keine Wege gefunden', 3000);
        return;
      }
      
      // Pfade auf Karte anzeigen (falls Karte bereits existiert)
      if (mapView) {
        console.log('MapView existiert, füge Pfade hinzu...');
        mapView.addPaths(paths);
      } else {
        console.log('MapView existiert noch nicht - Pfade werden später hinzugefügt');
        // Pfade für später speichern
        window.pendingMapPaths = paths;
      }
      
      // AR-Darstellungen erstellen (falls AR bereits läuft)
      if (sceneEl && locar && threeCamera) {
        createARPaths(paths);
        console.log('AR-Pfade sofort erstellt');
      } else {
        console.log('AR noch nicht bereit - Pfade werden später erstellt');
        // Pfade für später speichern
        window.pendingPaths = paths;
      }
      
      // Automatisch den ersten (und einzigen) Pfad aktivieren
      if (paths.length > 0) {
        setActivePath(0);
        
        // Zielmarker am Ende des Weges hinzufügen
        addPathEndpointMarker(paths[0]);
      }
      
      showPopup(`${paths.length} Wege geladen`, 2000);
    } catch (error) {
      console.error('Fehler beim Laden der Pfade:', error);
      showPopup('Fehler beim Laden der Pfade', 3000);
    }
  });
}