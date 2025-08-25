/**
 * Factory-Funktion zum Hinzufügen des Navigationspfeils zur AR-Szene.
 * Kapselt die Instanziierung und Initialisierung des ARNavigationArrow.
 * @param {Object} params - Parameterobjekt (siehe main.js)
 * @returns {ARNavigationArrow} Die erzeugte Arrow-Instanz
 */
export function addArrowToScene(params) {
  const arrow = new ARNavigationArrow(params);
  arrow.initArrow('./glbmodell/Pfeil5.glb');
  return arrow;
}
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import 'three';

export class ARNavigationArrow {
  constructor({ locar, camera, deviceOrientationControl, getTargetCoords, currentCoords, isIOS, getScreenOrientation, getIndexActiveMarker }) {
    this.getIndexActiveMarker = getIndexActiveMarker;
    this.locar = locar;
    this.camera = camera;
    this.deviceOrientationControl = deviceOrientationControl;
    this.getTargetCoords = getTargetCoords;
    this.currentCoords = currentCoords;
    this.isIOS = isIOS;
    this.getScreenOrientation = getScreenOrientation;
    this.loader = new GLTFLoader();
    this.arrowObject = null;
    this.isTransparent = false;
    this.handleClick = this.handleClick.bind(this);
    
    // Für Stabilisierung der Pfeilausrichtung
    this.lastUpdate = 0;
    this.lastAngle = 0;
    this.updateThreshold = 50; // Minimum ms zwischen Updates
    this.angleThreshold = 2; // Minimum Grad Änderung für Update
  }

  /**
   * Initialisiert den AR-Navigationspfeil mit dem angegebenen Modellpfad.
   * @param {*} modelPath Pfad zum GLTF-Modell des Pfeils
   * @param {*} onLoadCallback Callback, der aufgerufen wird, wenn das Modell geladen ist
   */
  initArrow(modelPath, onLoadCallback = () => {}) {
    this.loader.load(modelPath, (gltf) => {
      this.arrowObject = gltf.scene;
      this.setupArrow();
      onLoadCallback();
    });
  }

  setupArrow() {
    this.arrowObject.scale.set(0.2, 0.2, 0.2);
    // Frustum Culling deaktivieren, damit der Pfeil immer sichtbar ist
    this.arrowObject.traverse(child => {
      child.frustumCulled = false;
      // Setze initiale Farbe wenn verfügbar
      if (child.isMesh && child.material && window.selectedArrowColor) {
        child.material = child.material.clone();
        child.material.color.setHex(window.selectedArrowColor.replace('#', '0x'));
        child.material.needsUpdate = true;
      }
    });
    // Pfeil dem Kamera-Objekt hinzufügen
    this.camera.add(this.arrowObject);
    this.arrowObject.position.set(0, -0.6, -1.3);
    // Klick-Listener registrieren
    window.addEventListener("click", this.handleClick);
    
    // Arrow-Referenz global verfügbar machen für Farbänderungen
    window.arrow = this;
  }

  /**
   * Schaltet die Transparenz des Pfeils ein oder aus.
   * @returns {void}
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
   * @param {*} event Klick-Event
   * @returns {void}
   */
  handleClick(event) {
    if (!this.arrowObject) return;
    
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
   * Aktualisiert die Position und Rotation des Pfeils basierend auf den aktuellen Koordinaten und der Ausrichtung des Geräts.
   * @returns {void}
   */
  update() {
    if (
      !this.arrowObject ||
      this.currentCoords.longitude === null ||
      this.currentCoords.latitude === null
    ) {
      return;
    }

    const now = Date.now();
    // Updates drosseln (Stabilität)
    if (now - this.lastUpdate < this.updateThreshold) return;

    // aktives Ziel holen
    const targets = this.getTargetCoords();
    const activeIndex = this.getIndexActiveMarker();
    if (!targets || targets.length === 0 || activeIndex < 0 || activeIndex >= targets.length) return;

    // Weltpositionen von Ziel und Nutzer aus LoCAR (x,z aus lon/lat)
    const [tx, tz] = this.locar.lonLatToWorldCoords(
      targets[activeIndex].longitude,
      targets[activeIndex].latitude
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

    // >>> WICHTIG: Kamera-Blickrichtung aus *Welt*-Quaternion, nicht local
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
   * Entfernt den AR-Navigationspfeil und alle zugehörigen Event-Listener.
   */
  dispose() {
    window.removeEventListener("click", this.handleClick);
  }
}
