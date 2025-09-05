/**
 * Factory-Funktion zum Hinzufügen des Pfad-Navigationspfeils zur AR-Szene.
 * Kapselt die Instanziierung und Initialisierung des ARPathNavigationArrow.
 * @param {Object} params - Parameterobjekt (siehe main.js)
 * @returns {ARPathNavigationArrow} Die erzeugte Path-Arrow-Instanz
 */
export function addPathArrowToScene(params) {
  const pathArrow = new ARPathNavigationArrow(params);
  pathArrow.initArrow('./glbmodell/Pfeil5.glb');
  return pathArrow;
}
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import 'three';

export class ARPathNavigationArrow {
  constructor({ locar, camera, deviceOrientationControl, getPathManager, currentCoords, isIOS, getScreenOrientation, getActivePathIndex }) {
    this.locar = locar;
    this.camera = camera;
    this.deviceOrientationControl = deviceOrientationControl;
    this.getPathManager = getPathManager; // Speichere Getter-Funktion
    this.currentCoords = currentCoords;
    this.isIOS = isIOS;
    this.getScreenOrientation = getScreenOrientation;
    this.getActivePathIndex = getActivePathIndex;
    this.loader = new GLTFLoader();
    this.arrowObject = null;
    this.isTransparent = false;
    this.handleClick = this.handleClick.bind(this);
    
    // Für Stabilisierung der Pfeilausrichtung
    this.lastUpdate = 0;
    this.lastAngle = 0;
    this.updateThreshold = 50; // Minimum ms zwischen Updates
    this.angleThreshold = 2; // Minimum Grad Änderung für Update
    
    // Für Distanz-basierte Sichtbarkeit (Performance-Optimierung)
    this.lastDistanceCheck = 0;
    this.distanceCheckThreshold = 500; // Distanz-Check alle 500ms
    this.hideDistance = 20; // Pfeil ausblenden wenn < 20m vom Pfad entfernt
    this.isHiddenByDistance = false;
    this.lastKnownDistance = Infinity;
  }

  /**
   * Initialisiert den AR-Pfad-Navigationspfeil mit dem angegebenen Modellpfad.
   * @param {string} modelPath Pfad zum GLTF-Modell des Pfeils
   * @param {Function} onLoadCallback Callback, der aufgerufen wird, wenn das Modell geladen ist
   */
  initArrow(modelPath, onLoadCallback = () => {}) {
    this.loader.load(modelPath, (gltf) => {
      this.arrowObject = gltf.scene;
      this.setupArrow();
      onLoadCallback();
      
      // Benachrichtige main.js, dass das Arrow-Object bereit ist
      if (this.onArrowReady) {
        this.onArrowReady();
      }
    });
  }

  setupArrow() {
    this.arrowObject.scale.set(0.2, 0.2, 0.2);
    // Frustum Culling deaktivieren, damit der Pfeil immer sichtbar ist
    this.arrowObject.traverse(child => {
      child.frustumCulled = false;
      // Setze orange Farbe
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.color.setHex(0xff8800); // Orange Farbe
        child.material.needsUpdate = true;
      }
    });
    // Pfeil dem Kamera-Objekt hinzufügen
    this.camera.add(this.arrowObject);
    this.arrowObject.position.set(0, -0.6, -1.3);
    
    // Initial sichtbar setzen - Sichtbarkeit wird durch updateArrowVisibility() gesteuert
    this.arrowObject.visible = true;
    
    // Klick-Listener registrieren
    window.addEventListener("click", this.handleClick);
    
    // PathArrow-Referenz global verfügbar machen
    window.pathArrow = this;
  }

  /**
   * Schaltet die Transparenz des Pfeils ein oder aus.
   */
  toggleTransparency() {
    if (!this.arrowObject) return;
    const newOpacity = this.isTransparent ? 1 : 0.2;
    
    this.arrowObject.traverse(child => {
      if (child.material) {
        child.material.transparent = true;
        child.material.opacity = newOpacity;
        child.material.needsUpdate = true;
      }
    });
    this.isTransparent = !this.isTransparent;
  }
  
  /**
   * Prüft, ob der Pfeil angeklickt wurde und ruft die toggleTransparency-Funktion auf.
   * @param {Event} event Klick-Event
   */
  handleClick(event) {
    if (!this.arrowObject || !this.arrowObject.visible) return;
    
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    const intersects = raycaster.intersectObject(this.arrowObject, true);
    
    if (intersects.length > 0) {
      // Pfeil wurde angeklickt – Transparenz umschalten
      this.toggleTransparency();
    }
  }

  /**
   * Findet den nächstgelegenen Punkt auf einem Pfad
   * @param {Object} userPosition - Aktuelle Position {latitude, longitude}
   * @param {Object} path - Pfadobjekt mit wgs84Coords
   * @returns {Object|null} - {latitude, longitude, index} des nächsten Punktes oder null
   */
  findClosestPointOnPath(userPosition, path) {
    if (!userPosition || !path || !path.wgs84Coords || path.wgs84Coords.length === 0) {
      return null;
    }

    let minDistance = Infinity;
    let closestPoint = null;
    let closestIndex = -1;

    // Iteriere durch alle Pfadsegmente
    for (let i = 0; i < path.wgs84Coords.length - 1; i++) {
      const start = path.wgs84Coords[i];
      const end = path.wgs84Coords[i + 1];
      
      // Finde den nächsten Punkt auf diesem Segment
      const closest = this.closestPointOnSegment(userPosition, start, end);
      const distance = this.haversineDistance(
        [userPosition.longitude, userPosition.latitude],
        [closest.longitude, closest.latitude]
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = closest;
        closestIndex = i;
      }
    }

    return closestPoint ? { ...closestPoint, index: closestIndex, distance: minDistance } : null;
  }

  /**
   * Findet den nächsten Punkt auf einem Liniensegment
   * @param {Object} point - Punkt {latitude, longitude}
   * @param {Array} lineStart - Startpunkt des Segments [longitude, latitude]
   * @param {Array} lineEnd - Endpunkt des Segments [longitude, latitude]
   * @returns {Object} - {latitude, longitude} des nächsten Punktes auf dem Segment
   */
  closestPointOnSegment(point, lineStart, lineEnd) {
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];
    
    const length2 = dx * dx + dy * dy;
    
    if (length2 === 0) {
      // Segment ist ein Punkt
      return { longitude: lineStart[0], latitude: lineStart[1] };
    }
    
    // Projektion des Punktes auf die Linie (Parameter t zwischen 0 und 1)
    const t = Math.max(0, Math.min(1, 
      ((point.longitude - lineStart[0]) * dx + (point.latitude - lineStart[1]) * dy) / length2
    ));
    
    // Nächster Punkt auf der Linie
    return {
      longitude: lineStart[0] + t * dx,
      latitude: lineStart[1] + t * dy
    };
  }

  /**
   * Haversine-Formel für Entfernungen auf der Erdoberfläche
   * @param {Array} point1 - [longitude, latitude]
   * @param {Array} point2 - [longitude, latitude]
   * @returns {number} - Entfernung in Metern
   */
  haversineDistance(point1, point2) {
    const R = 6371000; // Erdradius in Metern
    const lon1 = point1[0] * Math.PI / 180;
    const lat1 = point1[1] * Math.PI / 180;
    const lon2 = point2[0] * Math.PI / 180;
    const lat2 = point2[1] * Math.PI / 180;
    
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Entfernung in Metern
  }

  /**
   * Prüft die Entfernung zum aktiven Pfad und passt die Sichtbarkeit entsprechend an.
   * Optimiert für Performance durch gedrosselten Distanz-Check.
   * @returns {boolean} true wenn Pfeil sichtbar sein soll, false wenn ausgeblendet
   */
  checkDistanceVisibility() {
    const now = Date.now();
    
    // Distanz-Check nur alle 500ms durchführen (Performance)
    if (now - this.lastDistanceCheck < this.distanceCheckThreshold) {
      return !this.isHiddenByDistance;
    }
    
    this.lastDistanceCheck = now;
    
    // Aktiven Pfad holen
    const activeIndex = this.getActivePathIndex();
    const pathManager = this.getPathManager();
    const actualPathManager = (pathManager?.paths?.length > 0) ? pathManager : window.pathManager;
    const activePath = actualPathManager?.paths?.[activeIndex];
    
    if (!activePath) {
      this.isHiddenByDistance = false;
      return true;
    }
    
    // Nächsten Punkt auf dem Pfad finden
    const closestPoint = this.findClosestPointOnPath(this.currentCoords, activePath);
    if (!closestPoint) {
      this.isHiddenByDistance = false;
      return true;
    }
    
    const distance = closestPoint.distance;
    this.lastKnownDistance = distance;
    
    // Hysterese implementieren: verschiedene Schwellenwerte für Ein-/Ausblenden
    // um "Flackern" zu vermeiden
    const hideThreshold = this.hideDistance; // 20m
    const showThreshold = this.hideDistance + 5; // 25m (Hysterese)
    
    if (this.isHiddenByDistance) {
      // Aktuell ausgeblendet -> einblenden wenn > 25m
      if (distance > showThreshold) {
        this.isHiddenByDistance = false;
      }
    } else {
      // Aktuell sichtbar -> ausblenden wenn < 20m
      if (distance < hideThreshold) {
        this.isHiddenByDistance = true;
      }
    }
    
    return !this.isHiddenByDistance;
  }

  /**
   * Gibt Distanz-Informationen für das Distance-Overlay zurück
   * @returns {Object|null} - {path, distanceToPath, isOnPath} oder null
   */
  getPathDistanceInfo() {
    const activeIndex = this.getActivePathIndex();
    const pathManager = this.getPathManager();
    const actualPathManager = (pathManager?.paths?.length > 0) ? pathManager : window.pathManager;
    const activePath = actualPathManager?.paths?.[activeIndex];
    
    if (!activePath || !this.currentCoords.latitude || !this.currentCoords.longitude) {
      return null;
    }
    
    // Nächsten Punkt auf dem Pfad finden
    const closestPoint = this.findClosestPointOnPath(this.currentCoords, activePath);
    const distanceToPath = closestPoint ? closestPoint.distance : null;
    const isOnPath = distanceToPath !== null && distanceToPath < this.hideDistance;
    
    return {
      path: activePath,
      distanceToPath: distanceToPath,
      isOnPath: isOnPath
    };
  }

  /**
   * Setzt die Sichtbarkeit des Pfad-Pfeils
   * @param {boolean} visible - Sichtbarkeit
   */
  setVisible(visible) {
    if (this.arrowObject) {
      this.arrowObject.visible = visible;
    }
  }

  /**
   * Prüft, ob ein Pfad aktiv ist
   * @returns {boolean} - true wenn ein Pfad aktiv ist
   */
  isPathActive() {
    const activeIndex = this.getActivePathIndex();
    const pathManager = this.getPathManager(); // Hole aktuellen PathManager
    
    // WORKAROUND: Verwende globale Variable falls lokale leer ist
    const actualPathManager = (pathManager?.paths?.length > 0) ? pathManager : window.pathManager;
    
    return activeIndex >= 0 && actualPathManager && actualPathManager.paths && actualPathManager.paths.length > activeIndex;
  }

  /**
   * Aktualisiert die Position und Rotation des Pfeils basierend auf dem nächsten Punkt auf dem aktiven Pfad.
   * Optimiert: Updates werden ausgesetzt wenn Pfeil durch Distanz ausgeblendet ist.
   */
  update() {
    if (
      !this.arrowObject ||
      this.currentCoords.longitude === null ||
      this.currentCoords.latitude === null
    ) {
      return;
    }

    // Prüfe, ob ein Pfad aktiv ist
    if (!this.isPathActive()) {
      return;
    }

    // Performance-Optimierung: Distanz-basierte Sichtbarkeit prüfen
    const shouldBeVisible = this.checkDistanceVisibility();
    
    // Pfeil-Sichtbarkeit aktualisieren (aber nur wenn sich etwas geändert hat)
    if (this.arrowObject.visible !== shouldBeVisible) {
      this.arrowObject.visible = shouldBeVisible;
    }
    
    // Performance-Optimierung: Updates aussetzen wenn Pfeil nicht sichtbar ist
    if (!shouldBeVisible) {
      return;
    }

    // Aktiven Pfad holen
    // Aktiven Pfad holen
    const now = Date.now();
    // Updates drosseln (Stabilität)
    if (now - this.lastUpdate < this.updateThreshold) return;

    const activeIndex = this.getActivePathIndex();
    const pathManager = this.getPathManager(); // Hole aktuellen PathManager
    
    // WORKAROUND: Verwende globale Variable falls lokale leer ist
    const actualPathManager = (pathManager?.paths?.length > 0) ? pathManager : window.pathManager;
    const activePath = actualPathManager.paths[activeIndex];
    
    // Nächsten Punkt auf dem Pfad finden
    const closestPoint = this.findClosestPointOnPath(this.currentCoords, activePath);
    if (!closestPoint) {
      return;
    }

    // Weltpositionen von Zielpunkt und Nutzer aus LoCAR
    const [tx, tz] = this.locar.lonLatToWorldCoords(
      closestPoint.longitude,
      closestPoint.latitude
    );
    const [ux, uz] = this.locar.lonLatToWorldCoords(
      this.currentCoords.longitude,
      this.currentCoords.latitude
    );
    const targetWorldPos = new THREE.Vector3(tx, 1.5, tz);
    const userWorldPos   = new THREE.Vector3(ux, 1.5, uz);

    // Zielwinkel relativ zur Welt
    const toTarget = new THREE.Vector3().subVectors(targetWorldPos, userWorldPos);
    const targetAngle = Math.atan2(toTarget.x, toTarget.z);

    // Kamera-Blickrichtung aus Welt-Quaternion
    const worldQuat = new THREE.Quaternion();
    this.camera.getWorldQuaternion(worldQuat);
    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
    const userHeading   = Math.atan2(cameraForward.x, cameraForward.z);

    // Relativwinkel (normalisiert auf [-PI, PI])
    let relativeAngle = targetAngle - userHeading;
    relativeAngle = ((relativeAngle + Math.PI) % (2 * Math.PI)) - Math.PI;

    const relativeAngleDeg = relativeAngle * (180 / Math.PI);
    if (Math.abs(relativeAngleDeg - this.lastAngle) > this.angleThreshold) {
      this.arrowObject.rotation.set(0, relativeAngle, 0);
      this.lastAngle = relativeAngleDeg;
      this.lastUpdate = now;
    }
  }
  
  /**
   * Entfernt den AR-Pfad-Navigationspfeil und alle zugehörigen Event-Listener.
   */
  dispose() {
    window.removeEventListener("click", this.handleClick);
    if (this.arrowObject && this.camera) {
      this.camera.remove(this.arrowObject);
    }
  }
}
