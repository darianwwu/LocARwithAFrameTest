var q = (r) => {
  throw TypeError(r);
};
var S = (r, t, i) => t.has(r) || q("Cannot " + i);
var n = (r, t, i) => (S(r, t, "read from private field"), i ? i.call(r) : t.get(r)), m = (r, t, i) => t.has(r) ? q("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(r) : t.set(r, i), l = (r, t, i, e) => (S(r, t, "write to private field"), e ? e.call(r, i) : t.set(r, i), i), p = (r, t, i) => (S(r, t, "access private method"), i);
var k = (r, t, i, e) => ({
  set _(c) {
    l(r, t, c, i);
  },
  get _() {
    return n(r, t, e);
  }
});
import * as b from "three";
import { Vector3 as B, Euler as U, Quaternion as F, EventDispatcher as K, MathUtils as C } from "three";
var E, G, X, Q, V;
class $ {
  /**
   * Create a SphMercProjection.
   */
  constructor() {
    m(this, E);
    this.EARTH = 4007501668e-2, this.HALF_EARTH = 2003750834e-2;
  }
  /**
   * Project a longitude and latitude into Spherical Mercator.
   * @param {number} lon - the longitude.
   * @param {number} lat - the latitude.
   * @return {Array} Two-member array containing easting and northing.
   */
  project(t, i) {
    return [p(this, E, G).call(this, t), p(this, E, X).call(this, i)];
  }
  /**
   * Unproject a Spherical Mercator easting and northing.
   * @param {Array} projected - Two-member array containing easting and northing
   * @return {Array} Two-member array containing longitude and latitude 
   */
  unproject(t) {
    return [p(this, E, Q).call(this, t[0]), p(this, E, V).call(this, t[1])];
  }
  /**
   * Return the projection's ID.
   * @return {string} The value "epsg:3857".
   */
  getID() {
    return "epsg:3857";
  }
}
E = new WeakSet(), G = function(t) {
  return t / 180 * this.HALF_EARTH;
}, X = function(t) {
  var i = Math.log(Math.tan((90 + t) * Math.PI / 360)) / (Math.PI / 180);
  return i * this.HALF_EARTH / 180;
}, Q = function(t) {
  return t / this.HALF_EARTH * 180;
}, V = function(t) {
  var i = t / this.HALF_EARTH * 180;
  return i = 180 / Math.PI * (2 * Math.atan(Math.exp(i * Math.PI / 180)) - Math.PI / 2), i;
};
var x, O, P, H, L, A, y, D, T, M, f, j, Y, W, Z;
class ot {
  /**
   * @param {THREE.Scene} scene - The Three.js scene to use.
   * @param {THREE.Camera} camera - The Three.js camera to use. Should usually 
   * be a THREE.PerspectiveCamera.
   * @param {Object} options - Initialisation options for the GPS; see
   * setGpsOptions() below.
   * @param {Object} serverLogger - an object which can optionally log GPS position to a server for debugging. null by default, so no logging will be done. This object should implement a sendData() method to send data (2nd arg) to a given endpoint (1st arg). Please see source code for details. Ensure you comply with privacy laws (GDPR or equivalent) if implementing this.
   */
  constructor(t, i, e = {}, c = null) {
    m(this, f);
    m(this, x);
    m(this, O);
    m(this, P);
    m(this, H);
    m(this, L);
    m(this, A);
    m(this, y);
    m(this, D);
    m(this, T);
    m(this, M);
    this.scene = t, this.camera = i, l(this, x, new $()), l(this, O, {}), l(this, P, null), l(this, H, 0), l(this, L, 100), l(this, A, null), this.setGpsOptions(e), l(this, y, null), l(this, D, 0), l(this, T, 0), l(this, M, c);
  }
  /**
   * Set the projection to use.
   * @param {Object} any object which includes a project() method 
   * taking longitude and latitude as arguments and returning an array 
   * containing easting and northing.
   */
  setProjection(t) {
    l(this, x, t);
  }
  /**
   * Set the GPS options.
   * @param {Object} object containing gpsMinDistance and/or gpsMinAccuracy
   * properties. The former specifies the number of metres which the device
   * must move to process a new GPS reading, and the latter specifies the 
   * minimum accuracy, in metres, for a GPS reading to be counted.
   */
  setGpsOptions(t = {}) {
    t.gpsMinDistance !== void 0 && l(this, H, t.gpsMinDistance), t.gpsMinAccuracy !== void 0 && l(this, L, t.gpsMinAccuracy);
  }
  /**
   * Start the GPS on a real device
   * @return {boolean} code indicating whether the GPS was started successfully.
   * GPS errors can be handled by handling the gpserror event.
   */
  async startGps() {
    if (n(this, M)) {
      const i = await (await n(this, M).sendData("/gps/start", {
        gpsMinDistance: n(this, H),
        gpsMinAccuracy: n(this, L)
      })).json();
      l(this, T, i.session);
    }
    return n(this, A) === null ? (l(this, A, navigator.geolocation.watchPosition(
      (t) => {
        p(this, f, W).call(this, t);
      },
      (t) => {
        n(this, O).gpserror ? n(this, O).gpserror(t.code) : alert(`GPS error: code ${t.code}`);
      },
      {
        enableHighAccuracy: !0
      }
    )), !0) : !1;
  }
  /**
   * Stop the GPS on a real device
   * @return {boolean} true if the GPS was stopped, false if it could not be
   * stopped (i.e. it was never started).
   */
  stopGps() {
    return n(this, A) !== null ? (navigator.geolocation.clearWatch(n(this, A)), l(this, A, null), !0) : !1;
  }
  /**
   * Send a fake GPS signal. Useful for testing on a desktop or laptop.
   * @param {number} lon - The longitude.
   * @param {number} lat - The latitude.
   * @param {number} elev - The elevation in metres. (optional, set to null
   * for no elevation).
   * @param {number} acc - The accuracy of the GPS reading in metres. May be
   * ignored if lower than the specified minimum accuracy.
   */
  fakeGps(t, i, e = null, c = 0) {
    e !== null && this.setElevation(e), p(this, f, W).call(this, {
      coords: {
        longitude: t,
        latitude: i,
        accuracy: c
      }
    });
  }
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
  lonLatToWorldCoords(t, i) {
    const e = n(this, x).project(t, i);
    if (n(this, y))
      e[0] -= n(this, y)[0], e[1] -= n(this, y)[1];
    else
      throw "No initial position determined";
    return [e[0], -e[1]];
  }
  /**
   * Add a new AR object at a given latitude, longitude and elevation.
   * @param {THREE.Mesh} object the object
   * @param {number} lon - the longitude.
   * @param {number} lat - the latitude.
   * @param {number} elev - the elevation in metres 
   * (if not specified, 0 is assigned)
   * @param {Object} properties - properties describing the object (for example,
   * the contents of the GeoJSON properties field).
   */
  add(t, i, e, c, d = {}) {
    var g;
    t.properties = d, p(this, f, j).call(this, t, i, e, c), this.scene.add(t), (g = n(this, M)) == null || g.sendData("/object/new", {
      position: t.position,
      x: t.position.x,
      z: t.position.z,
      session: n(this, T),
      properties: d
    });
  }
  /**
   * Set the elevation (y coordinate) of the camera.
   * @param {number} elev - the elevation in metres.
   */
  setElevation(t) {
    this.camera.position.y = t;
  }
  /**
   * Add an event handler.
   * Currently-understood events: "gpsupdate" and "gpserror".
   * The former fires when a GPS update is received, and is passed the
   * standard Geolocation API position object, along with the distance moved
   * since the last GPS update in metres.
   * The latter fires when a GPS error is generated, and is passed the
   * standard Geolocation API numerical error code.
   * @param {string} eventName - the event to handle.
   * @param {Function} eventHandler - the event handler function.
   * @listens LocationBased#gpsupdate
   * @listens LocationBased#gpserror
   */
  on(t, i) {
    n(this, O)[t] = i;
  }
}
x = new WeakMap(), O = new WeakMap(), P = new WeakMap(), H = new WeakMap(), L = new WeakMap(), A = new WeakMap(), y = new WeakMap(), D = new WeakMap(), T = new WeakMap(), M = new WeakMap(), f = new WeakSet(), j = function(t, i, e, c) {
  const d = this.lonLatToWorldCoords(i, e);
  c !== void 0 && (t.position.y = c), [t.position.x, t.position.z] = d;
}, Y = function(t, i) {
  l(this, y, n(this, x).project(t, i));
}, W = function(t) {
  var e, c, d;
  let i = Number.MAX_VALUE;
  k(this, D)._++, (e = n(this, M)) == null || e.sendData("/gps/new", {
    gpsCount: n(this, D),
    lat: t.coords.latitude,
    lon: t.coords.longitude,
    acc: t.coords.accuracy,
    session: n(this, T)
  }), t.coords.accuracy <= n(this, L) && (n(this, P) === null ? l(this, P, {
    latitude: t.coords.latitude,
    longitude: t.coords.longitude
  }) : i = p(this, f, Z).call(this, n(this, P), t.coords), i >= n(this, H) && (n(this, P).longitude = t.coords.longitude, n(this, P).latitude = t.coords.latitude, n(this, y) || (p(this, f, Y).call(this, t.coords.longitude, t.coords.latitude), (c = n(this, M)) == null || c.sendData("/worldorigin/new", {
    gpsCount: n(this, D),
    lat: t.coords.latitude,
    lon: t.coords.longitude,
    session: n(this, T),
    initialPosition: n(this, y)
  })), p(this, f, j).call(this, this.camera, t.coords.longitude, t.coords.latitude), (d = n(this, M)) == null || d.sendData("/gps/accepted", {
    gpsCount: n(this, D),
    cameraX: this.camera.position.x,
    cameraZ: this.camera.position.z,
    session: n(this, T),
    distMoved: i
  }), n(this, O).gpsupdate && n(this, O).gpsupdate(t, i)));
}, /**
 * Calculate haversine distance between two lat/lon pairs.
 *
 * Taken from original A-Frame AR.js location-based components
 */
Z = function(t, i) {
  const e = b.MathUtils.degToRad(i.longitude - t.longitude), c = b.MathUtils.degToRad(i.latitude - t.latitude), d = Math.sin(c / 2) * Math.sin(c / 2) + Math.cos(b.MathUtils.degToRad(t.latitude)) * Math.cos(b.MathUtils.degToRad(i.latitude)) * (Math.sin(e / 2) * Math.sin(e / 2));
  return 2 * Math.atan2(Math.sqrt(d), Math.sqrt(1 - d)) * 6371e3;
};
class at {
  /**
   * Create a Webcam.
   * @param options {Object} - options to use for initialising the camera. 
   * Currently idealWidth and idealHeight properties are understood as well as 
   * onVideoStarted(), a *required* callback which runs when the camera has
   * been initialised. 
   * This takes a THREE.VideoTexture as an argument which can be used to set 
   * the background of your three.js scene within a callback.
   * @param {string} videoElementSelector - selector to obtain the HTML video 
   * element to render the webcam feed. If a falsy value (e.g. null or 
   * undefined), a video element will be created.
   */
  constructor(t = {}, i) {
    this.sceneWebcam = new b.Scene();
    let e;
    if (i ? e = document.querySelector(i) : (e = document.createElement("video"), e.setAttribute("autoplay", !0), e.setAttribute("playsinline", !0), e.style.display = "none", document.body.appendChild(e)), this.texture = new b.VideoTexture(e), navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const c = {
        video: {
          width: { ideal: t.idealWidth || 1280 },
          height: { ideal: t.idealHeight || 720 },
          facingMode: "environment"
        }
      };
      navigator.mediaDevices.getUserMedia(c).then((d) => {
        e.addEventListener("loadedmetadata", () => {
          var g;
          e.setAttribute("width", e.videoWidth), e.setAttribute("height", e.videoHeight), e.play(), (g = t.onVideoStarted) == null || g.call(this, this.texture);
        }), e.srcObject = d;
      }).catch((d) => {
        setTimeout(() => {
          alert(
            `Webcam Error
Name: ` + d.name + `
Message: ` + d.message
          );
        }, 1e3);
      });
    } else
      setTimeout(() => {
        alert("sorry - media devices API not supported");
      }, 1e3);
  }
  /**
   * Free up the memory associated with the webcam.
   * Should be called when your application closes.
   */
  dispose() {
    this.texture.dispose();
  }
}
const z = navigator.userAgent.match(/iPhone|iPad|iPod/i) || /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints != null && navigator.maxTouchPoints > 1, J = new B(0, 0, 1), N = new U(), tt = new F(), et = new F(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), it = { type: "change" };
class rt extends K {
  /**
   * Create an instance of DeviceOrientationControls.
   * @param {Object} object - the object to attach the controls to
   * (usually your Three.js camera)
   * @param {Object} options - options for DeviceOrientationControls: currently accepts smoothingFactor, enablePermissionDialog
   */
  constructor(t, i = {}) {
    super(), window.isSecureContext === !1 && console.error(
      "THREE.DeviceOrientationControls: DeviceOrientationEvent is only available in secure contexts (https)"
    );
    const e = this, c = 1e-6, d = new F();
    this.object = t, this.object.rotation.reorder("YXZ"), this.enabled = !0, this.deviceOrientation = null, this.screenOrientation = 0, this.alphaOffset = 0, this.initialOffset = null, this.TWO_PI = 2 * Math.PI, this.HALF_PI = 0.5 * Math.PI, this.orientationChangeEventName = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation", this.smoothingFactor = i.smoothingFactor || 1, this.enablePermissionDialog = i.enablePermissionDialog !== false;
    const g = function({
      alpha: s,
      beta: o,
      gamma: a,
      webkitCompassHeading: u
    }) {
      if (z) {
        const h = 360 - u;
        e.alphaOffset = C.degToRad(h - s), e.deviceOrientation = { alpha: s, beta: o, gamma: a, webkitCompassHeading: u };
      } else
        s < 0 && (s += 360), e.deviceOrientation = { alpha: s, beta: o, gamma: a };
      window.dispatchEvent(
        new CustomEvent("camera-rotation-change", {
          detail: { cameraRotation: t.rotation }
        })
      );
    }, I = function() {
      e.screenOrientation = window.orientation || 0;
      if (z) {
        e.orientationOffset = e.screenOrientation === 90 ? -Math.PI/2 : 
                            e.screenOrientation === -90 ? Math.PI/2 : 0;
      }
    }, R = function(s, o, a, u, h) {
      N.set(a, o, -u, "YXZ"), s.setFromEuler(N), s.multiply(et), s.multiply(tt.setFromAxisAngle(J, -h));
    };
    this.connect = function() {
      I();
      if (
        window.DeviceOrientationEvent !== void 0 &&
        typeof window.DeviceOrientationEvent.requestPermission == "function"
      ) {
        if (e.enablePermissionDialog) {
          window.DeviceOrientationEvent.requestPermission().then((s) => {
            s === "granted" && (window.addEventListener(
              "orientationchange",
              I
            ), window.addEventListener(
              e.orientationChangeEventName,
              g
            ));
          }).catch(function(s) {
            console.error(
              "THREE.DeviceOrientationControls: Unable to use DeviceOrientation API:",
              s
            );
          });
        } else {
          window.addEventListener(
            "orientationchange",
            I
          ), window.addEventListener(
            e.orientationChangeEventName,
            g
          );
        }
      } else {
        window.addEventListener(
          "orientationchange",
          I
        ), window.addEventListener(
          e.orientationChangeEventName,
          g
        );
      }
      e.enabled = !0;
    }, this.disconnect = function() {
      window.removeEventListener(
        "orientationchange",
        I
      ), window.removeEventListener(
        e.orientationChangeEventName,
        g
      ), e.enabled = !1, e.initialOffset = !1, e.deviceOrientation = null;
    }, this.update = function({ theta: s = 0 } = { theta: 0 }) {
    if (e.enabled === !1) return;
    const o = e.deviceOrientation;
    if (o) {
      let a = o.alpha ? C.degToRad(o.alpha) + e.alphaOffset : 0, u = o.beta ? C.degToRad(o.beta) : 0, h = o.gamma ? C.degToRad(o.gamma) : 0;
      const _ = e.screenOrientation ? C.degToRad(e.screenOrientation) : 0;
      
      if (this.smoothingFactor < 1) {
        if (this.lastOrientation) {
          const v = this.smoothingFactor;
          a = this._getSmoothedAngle(a, this.lastOrientation.alpha, v), 
          u = this._getSmoothedAngle(u + Math.PI, this.lastOrientation.beta, v), 
          h = this._getSmoothedAngle(h + this.HALF_PI, this.lastOrientation.gamma, v, Math.PI);
        } else
          u += Math.PI, h += this.HALF_PI;
        this.lastOrientation = { alpha: a, beta: u, gamma: h };
      }
      
      if (z) {
        const v = new F();
        R(v, a, this.smoothingFactor < 1 ? u - Math.PI : u, this.smoothingFactor < 1 ? h - this.HALF_PI : h, _);
        const w = new U().setFromQuaternion(v, "YXZ");
        
        let compassY = C.degToRad(360 - o.webkitCompassHeading);
        if (this.smoothingFactor < 1 && this.lastCompassY !== void 0) {
          compassY = this._getSmoothedAngle(compassY, this.lastCompassY, this.smoothingFactor);
        }
        this.lastCompassY = compassY;
        
        // iOS Landscape-Korrektur
        w.y = compassY + (e.orientationOffset || 0);
        v.setFromEuler(w), e.object.quaternion.copy(v);
      } else {
        R(e.object.quaternion, a + s, this.smoothingFactor < 1 ? u - Math.PI : u, this.smoothingFactor < 1 ? h - this.HALF_PI : h, _);
      }
      8 * (1 - d.dot(e.object.quaternion)) > c && (d.copy(e.object.quaternion), e.dispatchEvent(it));
    }
  }, this.getCorrectedHeading = function() {
    const { deviceOrientation: o } = e;
    if (!o) return 0;
    
    let heading = 0;
    
    if (z) {
      // iOS: webkitCompassHeading verwenden
      heading = 360 - o.webkitCompassHeading;
      // Landscape-Korrektur hinzufügen
      if (e.orientationOffset) {
        heading += e.orientationOffset * (180 / Math.PI);
        heading = (heading + 360) % 360;
      }
    } else {
      // Android: Alpha verwenden
      heading = o.alpha ? o.alpha + e.alphaOffset * (180 / Math.PI) : 0;
      if (heading < 0) heading += 360;
    }
    
    return heading;
  },
   this._orderAngle = function(s, o, a = this.TWO_PI) {
      return o > s && Math.abs(o - s) < a / 2 || s > o && Math.abs(o - s) > a / 2 ? { left: s, right: o } : { left: o, right: s };
    }, this._getSmoothedAngle = function(s, o, a, u = this.TWO_PI) {
      const h = this._orderAngle(s, o, u), _ = h.left, v = h.right;
      h.left = 0, h.right -= _, h.right < 0 && (h.right += u);
      let w = v == o ? (1 - a) * h.right + a * h.left : a * h.right + (1 - a) * h.left;
      return w += _, w >= u && (w -= u), w;
    }, this.updateAlphaOffset = function() {
      e.initialOffset = !1;
    }, this.dispose = function() {
      e.disconnect();
    }, this.getAlpha = function() {
      const { deviceOrientation: s } = e;
      return s && s.alpha ? C.degToRad(s.alpha) + e.alphaOffset : 0;
    }, this.getBeta = function() {
      const { deviceOrientation: s } = e;
      return s && s.beta ? C.degToRad(s.beta) : 0;
    }, this.getGamma = function() {
      const { deviceOrientation: s } = e;
      return s && s.gamma ? C.degToRad(s.gamma) : 0;
    }
    const isiOSWithReq =
    window.DeviceOrientationEvent !== void 0 &&
    typeof window.DeviceOrientationEvent.requestPermission === "function";

    if (isiOSWithReq && this.enablePermissionDialog) {
    this.initPermissionDialog();
    } else if (!isiOSWithReq) {
    this.connect();
    }
  }
  // Provide gesture before initialising device orientation controls
  // From PR #659 on the main AR.js repo
  // Thanks to @ma2yama
  initPermissionDialog() {
    const t = document.createElement("div"), i = document.createElement("div"), e = document.createElement("div"), c = document.createElement("div");
    document.body.appendChild(t);
    const d = {
      display: "flex",
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      zIndex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center"
    }, g = {
      backgroundColor: "white",
      padding: "6px",
      borderRadius: "3px",
      width: "36rem",
      height: "24rem"
    }, I = {
      width: "100%",
      height: "70%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }, R = {
      display: "inline-flex",
      width: "100%",
      height: "30%",
      justifyContent: "center",
      alignItems: "center"
    };
    for (let a in d)
      t.style[a] = d[a];
    for (let a in g)
      i.style[a] = g[a];
    for (let a in I)
      e.style[a] = I[a];
    for (let a in R)
      c.style[a] = R[a];
    t.appendChild(i), i.appendChild(e), i.appendChild(c), e.innerHTML = '<div style="font-size: 24pt; margin: 1rem;">This immersive website requires access to your device motion sensors.</div>';
    const s = () => {
      this.connect(), t.style.display = "none";
    }, o = document.createElement("button");
    o.addEventListener("click", s), o.style.width = "50%", o.style.height = "80%", o.style.fontSize = "20pt", o.appendChild(document.createTextNode("OK")), c.appendChild(o), document.body.appendChild(t);
  }
}
class ct {
  /**
   * Create a ClickHandler.
   * @param {THREE.WebGLRenderer} - The Three.js renderer on which the click
   * events will be handled.
   */
  constructor(t) {
    this.raycaster = new b.Raycaster(), this.normalisedMousePosition = new b.Vector2(null, null), t.domElement.addEventListener("click", (i) => {
      this.normalisedMousePosition.set(
        i.clientX / t.domElement.clientWidth * 2 - 1,
        -(i.clientY / t.domElement.clientHeight * 2) + 1
      );
    });
  }
  /**
   * Cast a ray into the scene to detect objects.
   * @param {THREE.Camera} - The active Three.js camera, from which the ray
   * will be cast.
   * @param {THREE.Scene} - The active Three.js scene, which the ray will be
   * cast into.
   * @return {Array} - array of all intersected objects.
   */
  raycast(t, i) {
    if (this.normalisedMousePosition.x !== null && this.normalisedMousePosition.y !== null) {
      this.raycaster.setFromCamera(this.normalisedMousePosition, t);
      const e = this.raycaster.intersectObjects(i.children, !1);
      return this.normalisedMousePosition.set(null, null), e;
    }
    return [];
  }
}
const ht = "0.0.10-noaframe-1";
export {
  ct as ClickHandler,
  rt as DeviceOrientationControlsOptional,
  ot as LocationBased,
  $ as SphMercProjection,
  at as Webcam,
  ht as version
};
