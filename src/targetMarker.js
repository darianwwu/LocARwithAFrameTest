import 'three';

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

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.handleClick = this.handleClick.bind(this);
    window.addEventListener("click", this.handleClick);
  }

  initMarker(markerImageUrl) {
    const textureLoader = new THREE.TextureLoader();
    const markerTexture = textureLoader.load(markerImageUrl);
    const markerMaterial = new THREE.SpriteMaterial({ map: markerTexture });
    this.markerObject = new THREE.Sprite(markerMaterial);
    this.markerObject.scale.set(10, 10, 1);
    this.locar.add(
      this.markerObject,
      this.markerCoords.longitude,
      this.markerCoords.latitude
    );
    this.markerAdded = true;
    this.originalMarkerPosition.copy(this.markerObject.position);
  }

  updateMarkerImage(newImageUrl) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(newImageUrl, (newTexture) => {
      if (this.markerObject && this.markerObject.material) {
        this.markerObject.material.map = newTexture;
        this.markerObject.material.needsUpdate = true;
      }
    });
  }

  update() {
  if (!this.markerObject) return;

  const { type, angle } = this.getScreenOrientation();
  
  let lonlatTarget;
  try {
    lonlatTarget = this.locar.lonLatToWorldCoords(this.markerCoords.longitude, this.markerCoords.latitude);
  } catch (e) {
    if (e === "No initial position determined") {
      // Wenn noch keine Initialposition vorhanden ist, Update überspringen
      return;
    } else {
      throw e;
    }
  }
  
  const targetWorldPos = new THREE.Vector3(lonlatTarget[0], 1.5, lonlatTarget[1]);
  
  if (this.isIOS && (type.startsWith('landscape')) && this.deviceOrientationControl) {
    if (this.originalMarkerPosition.length() === 0) {
      this.originalMarkerPosition.copy(this.markerObject.position);
    }
    
    const tempQuat = new THREE.Quaternion();
    const alpha = this.deviceOrientationControl.getAlpha();
    const beta = this.deviceOrientationControl.getBeta();
    const gamma = this.deviceOrientationControl.getGamma();
    const orient = angle || 0;
    this.setObjectQuaternion(tempQuat, alpha, beta, gamma, orient);
    
    const tempEuler = new THREE.Euler().setFromQuaternion(tempQuat, 'YXZ');
    const sensorY = tempEuler.y;
    
    const compassHeading = this.deviceOrientationControl.deviceOrientation?.webkitCompassHeading;
    if (compassHeading !== undefined) {
      const compassY = THREE.MathUtils.degToRad(360 - compassHeading);
      const delta = compassY - sensorY;
      
      const markerPos = new THREE.Vector3(targetWorldPos.x, 1.5, targetWorldPos.z);
      markerPos.sub(this.camera.position);
      markerPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta);
      markerPos.add(this.camera.position);
      this.markerObject.position.copy(markerPos);
    }
  } else {
    this.markerObject.position.copy(this.originalMarkerPosition);
  }
  }

  handleClick(event) {
    if (!this.markerAdded || !this.markerObject) return;
    
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.markerObject, true);
    
    let markerClicked = false;
    if (intersects.length > 0) {
      markerClicked = true;
    } else {
      const markerPosWorld = this.markerObject.position.clone();
      const markerPosScreen = markerPosWorld.project(this.camera);
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

  setObjectQuaternion(quaternion, alpha, beta, gamma, orient) {
    const zee = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler();
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(
      -Math.sqrt(0.5),
      0,
      0,
      Math.sqrt(0.5)
    );
    euler.set(beta, alpha, -gamma, "YXZ");
    quaternion.setFromEuler(euler);
    quaternion.multiply(q1);
    quaternion.multiply(q0.setFromAxisAngle(zee, -orient));
  }

  dispose() {
    window.removeEventListener("click", this.handleClick);
  }
}
