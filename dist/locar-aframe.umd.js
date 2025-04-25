(function(global, factory) {
  typeof exports === "object" && typeof module !== "undefined" ? factory(require("locar")) : typeof define === "function" && define.amd ? define(["locar"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.LocAR));
})(this, function(locar) {
  "use strict";
  AFRAME.registerComponent("locar-webcam", {
    schema: {
      idealWidth: {
        type: "number",
        default: 1024
      },
      idealHeight: {
        type: "number",
        default: 768
      },
      videoElement: {
        type: "string",
        default: ""
      }
    },
    init: function() {
      new locar.Webcam({
        idealWidth: this.data.idealWidth,
        idealHeight: this.data.idealHeight,
        onVideoStarted: (texture) => {
          this.el.object3D.background = texture;
        }
      }, this.data.videoElement || null);
    }
  });
  AFRAME.registerComponent("locar-camera", {
    schema: {
      simulateLatitude: {
        type: "number",
        default: 0
      },
      simulateLongitude: {
        type: "number",
        default: 0
      },
      simulateAltitude: {
        type: "number",
        default: -Number.MAX_VALUE
      },
      positionMinAccuracy: {
        type: "number",
        default: 100
      }
    },
    init: function() {
      this.locar = new locar.LocationBased(
        this.el.sceneEl.object3D,
        this.el.object3D
      );
      this.locar.on("gpsupdate", (position, distMoved) => {
        this.el.emit("gpsupdate", {
          position,
          distMoved
        });
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
        this.deviceOrientationControls = new locar.DeviceOrientationControls(this.el.object3D);
      }
    },
    update: function(oldData) {
      this.locar.setGpsOptions({
        gpsMinAccuracy: this.data.positionMinAccuracy,
        gpsMinDistance: this.data.gpsMinDistance
      });
      if (this.data.simulateLatitude != (oldData == null ? void 0 : oldData.simulateLatitude) || this.data.simulateLongitude != (oldData == null ? void 0 : oldData.simulateLongitude)) {
        this.locar.stopGps();
        this.locar.fakeGps(
          this.data.simulateLongitude,
          this.data.simulateLatitude
        );
        this.data.simulateLongitude = 0;
        this.data.simulateLatitude = 0;
      }
      if (this.data.simulateAltitude > -Number.MAX_VALUE) {
        this.locar.setElevation(this.data.simulateAltitude + 1.6);
      }
    },
    play: function() {
      this.locar.startGps();
    },
    pause: function() {
      this.locar.stopGps();
    },
    /**
     * Convert longitude and latitude to three.js/WebGL world coordinates.
     * Uses the specified projection, and negates the northing (in typical
     * projections, northings increase northwards, but in the WebGL coordinate
     * system, we face negative z if the camera is at the origin with default
     * rotation).
     * @param {number} lon - The longitude.
     * @param {number} lat - The latitude.
     * @return {Array} a two member array containing the WebGL x and z coordinates
     */
    lonLatToWorldCoords: function(lon, lat) {
      return this.locar.lonLatToWorldCoords(lon, lat);
    },
    tick: function() {
      var _a;
      (_a = this.deviceOrientationControls) == null ? void 0 : _a.update();
    },
    _isMobile: function() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints != null && navigator.maxTouchPoints > 1;
    }
  });
  AFRAME.registerComponent("locar-entity-place", {
    schema: {
      latitude: {
        type: "number",
        default: 0
      },
      longitude: {
        type: "number",
        default: 0
      }
    },
    init: function() {
      const locarEl = this.el.sceneEl.querySelector("[locar-camera]");
      this.locarCamera = locarEl.components["locar-camera"];
    },
    update: function(oldData) {
      if (!this.locarCamera) {
        console.error("Cannot update locar-entity-place without a locar-camera component on the scene camera.");
      }
      const projCoords = this.locarCamera.lonLatToWorldCoords(
        this.data.longitude,
        this.data.latitude
      );
      this.el.object3D.position.set(
        projCoords[0],
        this.el.object3D.position.y,
        projCoords[1]
      );
    }
  });
});
