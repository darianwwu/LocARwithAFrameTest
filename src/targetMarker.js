import * as THREE from 'three';
import { computeDistance } from './distanceOverlay.js';

export class TargetMarker {
  constructor({locar, camera, markerCoords, isIOS, getScreenOrientation, onClick, deviceOrientationControl}) {
    this.locar = locar;
    this.camera = camera;
    this.markerCoords = markerCoords;
    this.isIOS = isIOS;
    this.getScreenOrientation = getScreenOrientation;
    this.onClick = onClick;
    this.deviceOrientationControl = deviceOrientationControl;
    this.markerObject = null;
    this.markerAdded = false;
    this.originalMarkerPosition = new THREE.Vector3();
    this.clickBuffer = 20;

    this.baseScale = 12;
    this.referenceDistance = 50;
    this.maxScale = 600;
    this.minScale = 5; 

    this.lastScaleUpdateTime = 0;
    this.scaleUpdateInterval = 3000; // Skalierung nur alle 3 Sekunden
    this.lastKnownDistance = null;
    this.cachedScale = this.baseScale;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.handleClick = this.handleClick.bind(this);
    window.addEventListener("click", this.handleClick);
  }

  /**
   * Initialisiert den Marker mit dem angegebenen Bild.
   * @param {*} markerImageUrl Bild-URL
   */
  initMarker(markerImageUrl) {
    const textureLoader = new THREE.TextureLoader();
    const markerTexture = textureLoader.load(markerImageUrl);
    const markerMaterial = new THREE.SpriteMaterial({ map: markerTexture });
    this.markerObject = new THREE.Sprite(markerMaterial);
    
    // Initial scale - will be updated dynamically based on distance
    this.markerObject.scale.set(this.baseScale, this.baseScale, 1);
    
    this.locar.add(
      this.markerObject,
      this.markerCoords.longitude,
      this.markerCoords.latitude
    );
    this.markerAdded = true;
    this.originalMarkerPosition.copy(this.markerObject.position);
  }
  
  /**
   * Ändert das (Erscheinungs-)Bild des Markers.
   * @param {*} newImageUrl Bild-URL
   */
  updateMarkerImage(newImageUrl) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(newImageUrl, (newTexture) => {
      if (this.markerObject && this.markerObject.material) {
        this.markerObject.material.map = newTexture;
        this.markerObject.material.needsUpdate = true;
      }
    });
  }

  /**
   * Calculates the appropriate scale based on GPS distance to the marker
   * @returns {number} The scale factor to apply
   */
  calculateDistanceBasedScale() {
    try {
      // Use stored GPS coordinates from main.js GPS updates
      const currentGPS = window.currentGPSPosition;
      if (!currentGPS) return this.baseScale;

      // Calculate GPS distance using Haversine formula
      const distance = computeDistance(
        currentGPS.latitude,
        currentGPS.longitude,
        this.markerCoords.latitude,
        this.markerCoords.longitude
      );

      //console.log(`Marker distance: ${distance.toFixed(1)}m`);

      // Progressive scaling for long distances - using maxScale dynamically
      let calculatedScale;
      
      if (distance <= 100) {
        // Close range: minimal scaling
        calculatedScale = this.baseScale;
      } else if (distance <= 500) {
        // Short-medium range: gradual scaling
        const factor = (distance - 100) / 400; // 0 to 1
        const scaleRange = (this.maxScale - this.baseScale) * 0.1; // 10% of total range
        calculatedScale = this.baseScale + (factor * scaleRange);
      } else if (distance <= 2000) {
        // Medium range: more noticeable scaling
        const factor = (distance - 500) / 1500; // 0 to 1
        const startScale = this.baseScale + (this.maxScale - this.baseScale) * 0.1;
        const scaleRange = (this.maxScale - this.baseScale) * 0.3; // 30% of total range
        calculatedScale = startScale + (factor * scaleRange);
      } else if (distance <= 5000) {
        // Long range: aggressive scaling
        const factor = (distance - 2000) / 3000; // 0 to 1
        const startScale = this.baseScale + (this.maxScale - this.baseScale) * 0.4;
        const scaleRange = (this.maxScale - this.baseScale) * 0.4; // 40% of total range
        calculatedScale = startScale + (factor * scaleRange);
      } else {
        // Very long range (5km+): maximum scaling for visibility up to 20km
        const factor = Math.min((distance - 5000) / 15000, 1); // Cap at 20km
        const startScale = this.baseScale + (this.maxScale - this.baseScale) * 0.8;
        const scaleRange = (this.maxScale - this.baseScale) * 0.2; // Final 20% of range
        calculatedScale = startScale + (factor * scaleRange);
      }

      // Clamp scale between min and max values
      const finalScale = Math.max(this.minScale, Math.min(this.maxScale, calculatedScale));
      
      // Cache the distance for movement detection
      this.lastKnownDistance = distance;
      
      //console.log(`Distance: ${distance.toFixed(1)}m, Scale: ${finalScale.toFixed(1)} (${distance > 5000 ? 'VERY LONG' : distance > 2000 ? 'LONG' : distance > 500 ? 'MEDIUM' : distance > 100 ? 'SHORT-MED' : 'CLOSE'})`);
      
      return finalScale;
    } catch (error) {
      console.warn('Error calculating distance-based scale:', error);
      return this.baseScale;
    }
  }

  /**
   * Prüft ob signifikante Bewegung stattgefunden hat
   * @returns {boolean} True wenn sich die Distanz signifikant geändert hat
   */
  hasSignificantMovement() {
    const currentGPS = window.currentGPSPosition;
    if (!currentGPS || !this.lastKnownDistance) return false;

    const currentDistance = computeDistance(
      currentGPS.latitude, currentGPS.longitude,
      this.markerCoords.latitude, this.markerCoords.longitude
    );

    const distanceChange = Math.abs(currentDistance - this.lastKnownDistance);
    const threshold = currentDistance > 1000 ? 50 : 10; // 50m bei >1km, 10m bei <1km
    
    if (distanceChange > threshold) {
      this.lastKnownDistance = currentDistance;
      return true;
    }
    return false;
  }

  /**
   * Schnelles Position-Update (bei jedem GPS-Update)
   * @returns {void}
   */
  updatePosition() {
    if (!this.markerObject) return;

    let lonlatTarget;
    try {
      lonlatTarget = this.locar.lonLatToWorldCoords(this.markerCoords.longitude, this.markerCoords.latitude);
    } catch (e) {
      if (e === "No initial position determined") {
        return;
      } else {
        throw e;
      }
    }
    
    const targetWorldPos = new THREE.Vector3(lonlatTarget[0], 1.5, lonlatTarget[1]);
    this.markerObject.position.copy(targetWorldPos);
  }

  /**
   * Skalierung nur bei Bedarf aktualisieren (Performance-Optimierung)
   * @returns {void}
   */
  updateScaleIfNeeded() {
    if (!this.markerObject) return;

    const now = Date.now();
    const shouldUpdateScale = (
      // Erste Aktualisierung
      this.lastScaleUpdateTime === 0 ||
      // Zeitintervall erreicht
      (now - this.lastScaleUpdateTime) > this.scaleUpdateInterval ||
      // Signifikante Bewegung
      this.hasSignificantMovement()
    );

    if (shouldUpdateScale) {
      const scale = this.calculateDistanceBasedScale();
      this.markerObject.scale.set(scale, scale, 1);
      this.cachedScale = scale;
      const timeSinceLastUpdate = this.lastScaleUpdateTime === 0 ? 0 : (now - this.lastScaleUpdateTime) / 1000;
      this.lastScaleUpdateTime = now;
      //console.log(`Scale updated for marker: ${scale.toFixed(1)} (${timeSinceLastUpdate.toFixed(1)}s since last update)`);
    }
  }

  /**
   * Hauptupdate-Methode (wird bei jedem GPS-Update aufgerufen)
   * Optimiert: Position immer, Skalierung nur bei Bedarf
   * @returns {void}
   */
  update() {  
  if (!this.markerObject) return;

  this.updatePosition();        // Immer ausführen (schnell)
  this.updateScaleIfNeeded();   // Nur bei Bedarf (langsam)
  }

  /**
   * Nutzt die Raycaster-Logik von Three.js, um zu prüfen, ob der Marker angeklickt wurde.
   * @param {*} event Das Click-Event
   * @returns {void}
   */
  handleClick(event) {
  if (!this.markerAdded || !this.markerObject) return;

  this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  this.raycaster.setFromCamera(this.mouse, this.camera);
  const intersects = this.raycaster.intersectObject(this.markerObject, true);

  let markerClicked = false;

  if (intersects.length > 0 && this.isInFrontOfCamera(this.markerObject, this.camera)) {
    markerClicked = true;
  } else {
    // Fallback: Bildschirmnähe prüfen (Sprite/Point) – mit Weltposition arbeiten
    const markerPosWorld = new THREE.Vector3();
    this.markerObject.getWorldPosition(markerPosWorld);

    // In Normalized Device Coordinates projizieren
    const markerPosScreen = markerPosWorld.clone().project(this.camera);

    // hinter der Kamera? -> Abbrechen
    if (markerPosScreen.z >= 1) return;

    // NDC -> Pixel
    const markerScreenX = (markerPosScreen.x + 1) / 2 * window.innerWidth;
    const markerScreenY = (-markerPosScreen.y + 1) / 2 * window.innerHeight;

    const dx = event.clientX - markerScreenX;
    const dy = event.clientY - markerScreenY;
    const distancePx = Math.sqrt(dx * dx + dy * dy);

    if (distancePx < this.clickBuffer) {
      markerClicked = true;
    }
  }

  if (markerClicked && typeof this.onClick === "function") {
    this.onClick();
  }
  }

  /**
   * Prüft, ob das Objekt vor der Kamera (im Sichtfeld des Users) ist.
   * @param {THREE.Object3D} object Das zu prüfende Objekt
   * @param {THREE.Camera} camera Die Kamera
   * @returns {boolean} Ob das Objekt vor der Kamera ist
   */
  isInFrontOfCamera(object, camera) {
    // Weltpositionen ermitteln
    const objectWorldPos = new THREE.Vector3();
    object.getWorldPosition(objectWorldPos);

    const cameraWorldPos = new THREE.Vector3();
    camera.getWorldPosition(cameraWorldPos);

    // Blickrichtung der Kamera aus Welt-Quaternion
    const worldQuat = new THREE.Quaternion();
    camera.getWorldQuaternion(worldQuat);
    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat).normalize();

    // Vektor von Kamera -> Objekt
    const cameraToObject = new THREE.Vector3()
      .subVectors(objectWorldPos, cameraWorldPos)
      .normalize();

    // Objekt liegt "vor" der Kamera, wenn der Skalarprodukt > 0 ist
    return cameraForward.dot(cameraToObject) > 0;
  }

  /**
   * Entfernt den Marker aus der Szene.
   */
  dispose() {
    window.removeEventListener("click", this.handleClick);
  }
}
