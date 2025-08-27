import * as THREE from 'three';

/**
 * Instanced chevrons (cones) that "flow" along the path to make direction unambiguous.
 */
export class ARPathChevrons {
  constructor(options = {}) {
    this.locar = options.locar;
    this.camera = options.camera;
    this.path = options.path || null;
    this.color = options.color || 0x00ff00;
    this.isActive = options.isActive || false;

    this.height   = options.height   ?? 2.8;  // meters above ground
    this.spacing  = options.spacing  ?? 3.0;  // meters between chevrons
    this.scale    = options.scale    ?? 0.8;  // base size
    this.speed    = options.speed    ?? 1.5;  // meters per second

    this.pathObject = null;     // InstancedMesh
    this.material = null;
    this._lat0 = null;
    this._lon0 = null;

    // Precomputed path data
    this._points = [];          // local Vector3 points (meters)
    this._segments = [];        // per-segment {from:Vector3,to:Vector3,length:number,yaw:number}
    this._cumLengths = [];      // cumulative lengths for fast sampling
    this._totalLength = 0;
    this._count = 0;            // number of instances
    this._phase = 0;            // current offset in meters
    this._lastTime = undefined;
  }

  _toLocalMeters(coord, firstCoord) {
    const dLon = coord[0] - firstCoord[0];
    const dLat = coord[1] - firstCoord[1];
    const x = dLon * 111320 * Math.cos(firstCoord[1] * Math.PI / 180);
    const z = -dLat * 110540;
    return new THREE.Vector3(x, this.height, z);
  }

  _buildSegments() {
    this._segments.length = 0;
    this._cumLengths.length = 0;
    this._totalLength = 0;

    for (let i = 0; i < this._points.length - 1; i++) {
      const a = this._points[i];
      const b = this._points[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const yaw = Math.atan2(dx, dz); // rotation around Y so the cone points forward
      this._segments.push({ from: a.clone(), to: b.clone(), length: len, yaw });
      this._totalLength += len;
      this._cumLengths.push(this._totalLength);
    }
  }

  _sampleAtS(s) {
    // Wrap s within total length
    if (this._totalLength <= 0) return { pos: this._points[0].clone(), yaw: 0 };
    let dist = ((s % this._totalLength) + this._totalLength) % this._totalLength;

    // Find segment index (linear scan is fine; path not huge). Could be binary search.
    let idx = 0;
    while (idx < this._segments.length && dist > this._cumLengths[idx]) idx++;
    const prevCum = idx === 0 ? 0 : this._cumLengths[idx - 1];
    const seg = this._segments[idx] || this._segments[this._segments.length - 1];
    const t = seg.length > 0 ? (dist - prevCum) / seg.length : 0;

    const x = THREE.MathUtils.lerp(seg.from.x, seg.to.x, t);
    const z = THREE.MathUtils.lerp(seg.from.z, seg.to.z, t);
    // keep constant height
    const y = this.height;
    return { pos: new THREE.Vector3(x, y, z), yaw: seg.yaw };
  }

  createPathObject() {
    if (!this.path || !this.locar) return null;
    this.removePath();

    const coords = this.path.wgs84Coords;
    if (!coords || coords.length < 2) {
      console.warn('ARPathChevrons: not enough coordinates');
      return null;
    }
    const first = coords[0];
    this._lon0 = first[0];
    this._lat0 = first[1];
    this._points = coords.map(c => this._toLocalMeters(c, first));

    this._buildSegments();
    if (this._totalLength <= 0) return null;

    // Create base geometry: a small cone that points along +Y by default; we rotate later
    const geo = new THREE.ConeGeometry(0.25 * this.scale, 0.8 * this.scale, 8, 1, false);
    geo.rotateX(Math.PI / 2); // make it point along +Z so yaw around Y works

    this.material = new THREE.MeshBasicMaterial({
      color: this.isActive ? 0xff4444 : this.color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });

    // number of instances along the path (extra to cover gaps during animation)
    this._count = Math.max(2, Math.floor(this._totalLength / this.spacing) + 2);
    const inst = new THREE.InstancedMesh(geo, this.material, this._count);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.frustumCulled = false;
    this.pathObject = inst;

    // initial placement
    for (let i = 0; i < this._count; i++) {
      const s = i * this.spacing;
      const { pos, yaw } = this._sampleAtS(s);
      const m = new THREE.Matrix4()
        .makeRotationY(yaw)
        .premultiply(new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z));
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;

    // anchor at the first GPS coordinate
    this.locar.add(this.pathObject, this._lon0, this._lat0);

    return this.pathObject;
  }

  update() {
    if (!this.pathObject) return;
    const now = performance.now();
    const dt = (this._lastTime !== undefined) ? (now - this._lastTime) / 1000 : 0;
    this._lastTime = now;

    this._phase = (this._phase + this.speed * dt) % (this._totalLength || 1);

    // Move instances forward along the path
    const m = new THREE.Matrix4();
    for (let i = 0; i < this._count; i++) {
      const s = (i * this.spacing + this._phase);
      const { pos, yaw } = this._sampleAtS(s);
      m.identity()
        .makeRotationY(yaw)
        .premultiply(new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z));
      this.pathObject.setMatrixAt(i, m);
    }
    this.pathObject.instanceMatrix.needsUpdate = true;
  }

  setActive(isActive) {
    this.isActive = isActive;
    if (this.material) {
      this.material.color.set(this.isActive ? 0xff4444 : this.color);
      this.material.needsUpdate = true;
    }
  }

  removePath() {
    if (this.pathObject && this.locar) {
      this.locar.remove(this.pathObject);
      if (this.pathObject.geometry) this.pathObject.geometry.dispose();
      if (this.pathObject.material) this.pathObject.material.dispose();
      this.pathObject = null;
    }
  }
}
