import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export class ARPathFlowLine {
  constructor(options = {}) {
    this.locar = options.locar;
    this.camera = options.camera;
    this.path = options.path || null;
    this.color = options.color || 0x00ff00;
    this.isActive = options.isActive || false;
    this.height = options.height ?? 2.5;    // meters above ground
    this.width  = options.width  ?? 0.45;   // line width in meters (worldUnits)
    this.dashSize = options.dashSize ?? 3.0;
    this.gapSize  = options.gapSize  ?? 1.5;
    this.speed    = options.speed    ?? 2.0; // meters/second, visual flow speed
    this._anchorEntity = null;

    this.pathObject = null;
    this.material = null;
    this._lat0 = null;
    this._lon0 = null;
    this._points = null; // local meter coordinates relative to first GPS
  }

  // Convert lon/lat to local meters relative to the first point
  _toLocalMeters(coord, firstCoord) {
    const dLon = coord[0] - firstCoord[0];
    const dLat = coord[1] - firstCoord[1];
    const x = dLon * 111320 * Math.cos(firstCoord[1] * Math.PI / 180); // meters
    const z = -dLat * 110540; // meters (negative so increasing lat goes forward -Z like in arPathTube)
    return new THREE.Vector3(x, this.height, z);
  }

  createPathObject() {
    if (!this.path || !this.locar) return null;
    this.removePath();

    const coords = this.path.wgs84Coords;
    if (!coords || coords.length < 2) {
      console.warn('ARPathFlowLine: not enough coordinates');
      return null;
    }

    // cache first point and local points
    const first = coords[0];
    this._lon0 = first[0];
    this._lat0 = first[1];
    this._points = coords.map(c => this._toLocalMeters(c, first));

    // build LineGeometry positions
    const positions = [];
    for (let i = 0; i < this._points.length; i++) {
      positions.push(this._points[i].x, this._points[i].y, this._points[i].z);
    }

    const geometry = new LineGeometry();
    geometry.setPositions(positions);

    // optional: vertex colors (fade out far end slightly)
    const colors = [];
    for (let i = 0; i < this._points.length; i++) {
      const t = i / (this._points.length - 1);
      // fade from full to 70% towards the end for depth cue
      const c = 1.0 - t * 0.3;
      colors.push(c, c, c);
    }
    geometry.setColors(colors);

    this.material = new LineMaterial({
      color: this.isActive ? 0xff4444 : this.color,
      worldUnits: true,             // widths and dashes are in meters
      linewidth: this.isActive ? this.width * 1.2 : this.width,
      dashed: true,
      dashSize: this.dashSize,
      gapSize: this.gapSize,
      dashScale: 1.0,
      dashOffset: 0.0,
      vertexColors: true
    });
    // Ensure proper resolution (required by LineMaterial for some paths)
    this.material.resolution.set(window.innerWidth, window.innerHeight);

    const line = new Line2(geometry, this.material);
    line.computeLineDistances(); // required for dashed
    line.frustumCulled = false;

    this.pathObject = line;

    // anchor at the first GPS coordinate (LoCAR API)
    const anchor = document.createElement('a-entity');
    anchor.setAttribute('locar-entity-place', `latitude: ${this._lat0}; longitude: ${this._lon0}`);
    const sceneEl = (this.camera && this.camera.el && this.camera.el.sceneEl) || document.querySelector('a-scene');
    sceneEl.appendChild(anchor);

    anchor.object3D.add(this.pathObject);
    this._anchorEntity = anchor;

    return this.pathObject;
  }

  update() {
    if (!this.pathObject || !this.material) return;
    // animate dash offset to create forward motion along the vertex order
    const dt = (this._lastTime !== undefined) ? (performance.now() - this._lastTime) / 1000 : 0;
    this._lastTime = performance.now();
    const deltaOffset = (this.speed * dt) / (this.dashSize + this.gapSize);
    // negative sign makes dashes appear to move "forward"
    this.material.dashOffset -= deltaOffset;
    this.material.needsUpdate = true;
  }

  setActive(isActive) {
    this.isActive = isActive;
    if (this.material) {
      this.material.color.set(this.isActive ? 0xff4444 : this.color);
      this.material.linewidth = this.isActive ? this.width * 1.25 : this.width;
      this.material.needsUpdate = true;
    }
  }

  removePath() {
    if (this._anchorEntity && this._anchorEntity.parentNode) {
      this._anchorEntity.parentNode.removeChild(this._anchorEntity);
      this._anchorEntity = null;
    }
    if (this.pathObject) {
      if (this.pathObject.geometry) this.pathObject.geometry.dispose();
      if (this.pathObject.material) this.pathObject.material.dispose();
      this.pathObject = null;
    }
  }
}
