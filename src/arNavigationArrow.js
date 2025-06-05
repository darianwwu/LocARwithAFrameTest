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
  }

  // Initialisiert den AR-Navigationspfeil
  initArrow(modelPath, onLoadCallback = () => {}) {
    this.loader.load(modelPath, (gltf) => {
      this.arrowObject = gltf.scene;
      this.arrowObject.scale.set(0.2, 0.2, 0.2);
      // Frustum Culling deaktivieren, damit der Pfeil immer sichtbar ist
      this.arrowObject.traverse(child => child.frustumCulled = false);
      // Pfeil dem Kamera-Objekt hinzufügen
      this.camera.add(this.arrowObject);
      this.arrowObject.position.set(0, -0.7, -1.3);
      // Klick-Listener registrieren
      window.addEventListener("click", this.handleClick);
      onLoadCallback();
    });
  }

  // Methode zum Umschalten der Transparenz
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
  
  // Klick-Handler, der per Raycaster prüft, ob auf den Pfeil geklickt wurde
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

  // Aktualisiert die Position und Rotation des AR-Navigationspfeils
  update() {
    if (!this.arrowObject || this.currentCoords.longitude === null || this.currentCoords.latitude === null) {
      return;
    }

    const { type, angle } = this.getScreenOrientation();

    // Umrechnung der Zielkoordinaten in Weltkoordinaten
    const targetCoordsArray = this.getTargetCoords();
    const activeIndex = this.getIndexActiveMarker();

    const lonlatTarget = this.locar.lonLatToWorldCoords(targetCoordsArray[activeIndex].longitude, targetCoordsArray[activeIndex].latitude);
    const targetWorldPos = new THREE.Vector3(lonlatTarget[0], 1.5, lonlatTarget[1]);

    // Umrechnung der Nutzerkoordinaten in Weltkoordinaten
    const lonlatUser = this.locar.lonLatToWorldCoords(this.currentCoords.longitude, this.currentCoords.latitude);
    const userWorldPos = new THREE.Vector3(lonlatUser[0], 1.5, lonlatUser[1]);

    // Berechnung der Richtung vom Nutzer zum Ziel
    const direction = new THREE.Vector3().subVectors(targetWorldPos, userWorldPos);
    const targetAngle = Math.atan2(direction.x, direction.z);

    // Ermitteln des Nutzer-Headings inkl. eventueller Kompensation
    let userHeading = this.deviceOrientationControl.getAlpha();
    const compensation = angle * (Math.PI / 180);
    userHeading -= compensation;

    let relativeAngle = targetAngle - userHeading;
    relativeAngle += Math.PI;
    relativeAngle = ((relativeAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
    this.arrowObject.rotation.set(0, relativeAngle, 0);
    
    // iOS-spezifische Anpassungen, wenn im Landscape-Modus
    if (this.isIOS && (type.startsWith('landscape'))) {
      const tempQuat = new THREE.Quaternion();
      const alpha = this.deviceOrientationControl.getAlpha();
      const beta = this.deviceOrientationControl.getBeta();
      const gamma = this.deviceOrientationControl.getGamma();
      const orient = angle || 0;
      this.setObjectQuaternion(tempQuat, alpha, beta, gamma, orient);
    }
  }

  setObjectQuaternion(quaternion, alpha, beta, gamma, orient) {
    const zee = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler();
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    euler.set(beta, alpha, -gamma, 'YXZ'); // 'ZXY' für das Gerät, aber 'YXZ' für uns
    quaternion.setFromEuler(euler);
    quaternion.multiply(q1);
    quaternion.multiply(q0.setFromAxisAngle(zee, -orient));
    }

  // Entferne den Klick-Listener, falls der Pfeil entfernt wird
  dispose() {
    window.removeEventListener("click", this.handleClick);
  }
}
