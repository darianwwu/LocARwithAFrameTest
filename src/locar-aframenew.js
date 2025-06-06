import {
  Webcam,
  LocationBased,
  DeviceOrientationControlsOptional as DeviceOrientationControls
} from "./locarnew.js";

AFRAME.registerComponent("locar-webcam", {
  schema: {
    idealWidth: { type: "number", default: 1024 },
    idealHeight: { type: "number", default: 768 },
    videoElement: { type: "string", default: "" }
  },
  init: function () {
    new Webcam(
      {
        idealWidth: this.data.idealWidth,
        idealHeight: this.data.idealHeight,
        onVideoStarted: (texture) => {
          this.el.object3D.background = texture;
        }
      },
      this.data.videoElement || null
    );
  }
});

AFRAME.registerComponent("locar-camera", {
  schema: {
    simulateLatitude: { type: "number", default: 0 },
    simulateLongitude: { type: "number", default: 0 },
    simulateAltitude: { type: "number", default: -Number.MAX_VALUE },
    positionMinAccuracy: { type: "number", default: 100 },
    smoothingFactor: { type: "number", default: 1 }
  },
  init: function () {
    this.locar = new LocationBased(this.el.sceneEl.object3D, this.el.object3D);
    this.locar.on("gpsupdate", (position, distMoved) => {
      this.el.emit("gpsupdate", { position, distMoved });
    });
    this.locar.on("gpserror", (code) => {
      const msg = [
        "User denied access to GPS.",
        "GPS satellites not available.",
        "Timeout communicating with GPS satellites - try moving to a more open area."
      ];
      if (code >= 1 && code <= 3) {
        alert(msg[code - 1]);
      } else {
        alert(`Unknown geolocation error code ${code}.`);
      }
    });
    if (this._isMobile()) {
      this.deviceOrientationControls = new DeviceOrientationControls(
        this.el.object3D,
        { smoothingFactor: this.data.smoothingFactor, enablePermissionDialog: false }
      );
    }
  },
  update: function (oldData) {
    this.locar.setGpsOptions({
      gpsMinAccuracy: this.data.positionMinAccuracy,
      gpsMinDistance: this.data.gpsMinDistance
    });
    if (
      this.data.simulateLatitude !== (oldData == null ? undefined : oldData.simulateLatitude) ||
      this.data.simulateLongitude !== (oldData == null ? undefined : oldData.simulateLongitude)
    ) {
      this.locar.stopGps();
      this.locar.fakeGps(this.data.simulateLongitude, this.data.simulateLatitude);
      this.data.simulateLongitude = 0;
      this.data.simulateLatitude = 0;
    }
    if (this.data.simulateAltitude > -Number.MAX_VALUE) {
      this.locar.setElevation(this.data.simulateAltitude + 1.6);
    }
  },
  play: function () {
    this.locar.startGps();
  },
  pause: function () {
    this.locar.stopGps();
  },
  /**
   * Convert longitude and latitude to three.js/WebGL world coordinates.
   */
  lonLatToWorldCoords: function (lon, lat) {
    return this.locar.lonLatToWorldCoords(lon, lat);
  },
  tick: function () {
    if (this.deviceOrientationControls) {
      this.deviceOrientationControls.update();
    }
  },
  _isMobile: function () {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints != null && navigator.maxTouchPoints > 1)
    );
  }
});

AFRAME.registerComponent("locar-entity-place", {
  schema: {
    latitude: { type: "number", default: 0 },
    longitude: { type: "number", default: 0 }
  },
  init: function () {
    const locarEl = this.el.sceneEl.querySelector("[locar-camera]");
    this.locarCamera = locarEl.components["locar-camera"];
  },
  update: function (oldData) {
    if (!this.locarCamera) {
      console.error("Cannot update locar-entity-place without a locar-camera component on the scene camera.");
      return;
    }
    const projCoords = this.locarCamera.lonLatToWorldCoords(
      this.data.longitude,
      this.data.latitude
    );
    this.el.object3D.position.set(projCoords[0], this.el.object3D.position.y, projCoords[1]);
  }
});
