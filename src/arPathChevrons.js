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
    this._anchorEntity = null;

    this.height   = options.height   ?? 0.5;  // meters above ground
    this.spacing  = options.spacing  ?? 12.0;  // meters between chevrons (weiter vergrößert)
    this.scale    = options.scale    ?? 1.5;  // base size (noch größer für längere Pfeile)
    this.speed    = options.speed    ?? 1.5;  // meters per second

    // Farbschemas für verschiedene Navigationsstile
    this.colorSchemes = {
      electricCyan: {
        pathColor: 0x00B8FF,     // Electric Cyan
        arrowColor: 0xFFFFFF,    // Weiß
        borderColor: 0x001A33,   // Dunkelblau Border
        shadowColor: 'rgba(0,26,51,0.6)'
      },
      royalBlue: {
        pathColor: 0x2A6CF5,     // Royal Blue
        arrowColor: 0xFFFFFF,    // Weiß
        borderColor: 0x001A33,   // Dunkelblau Border
        shadowColor: 'rgba(0,26,51,0.55)'
      },
      vividMagenta: {
        pathColor: 0xD100FF,     // Vivid Magenta
        arrowColor: 0xFFFFFF,    // Weiß
        borderColor: 0x220033,   // Dunkelviolett Border
        shadowColor: 'rgba(34,0,51,0.55)'
      }
    };

    this.currentColorScheme = options.colorScheme || 'electricCyan';
    this.color = this.colorSchemes[this.currentColorScheme].pathColor;

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

    // Create base geometry: a longer, more prominent arrow that points along +Y by default
    const geo = new THREE.ConeGeometry(0.5 * this.scale, 2.0 * this.scale, 8, 1, false);
    geo.rotateX(Math.PI / 2); // make it point along +Z so yaw around Y works

    const scheme = this.colorSchemes[this.currentColorScheme];
    
    // Create materials for multi-material chevron (arrow + border)
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: scheme.pathColor, // Verwende Electric Cyan für aktive Pfade
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });

    // Verwende das Pfeil-Material als Haupt-Material
    this.material = arrowMaterial;

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
    const anchor = document.createElement('a-entity');
    anchor.setAttribute('locar-entity-place', `latitude: ${this._lat0}; longitude: ${this._lon0}`);
    const sceneEl = (this.camera && this.camera.el && this.camera.el.sceneEl) || document.querySelector('a-scene');
    sceneEl.appendChild(anchor);

    anchor.object3D.add(this.pathObject);
    this._anchorEntity = anchor;

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
      const scheme = this.colorSchemes[this.currentColorScheme];
      // Aktive Pfade in Electric Cyan, inaktive gedämpft
      this.material.color.set(this.isActive ? scheme.pathColor : scheme.pathColor);
      this.material.opacity = this.isActive ? 0.95 : 0.4;
      this.material.needsUpdate = true;
    }
  }

  /**
   * Wechselt das Farbschema für die Chevrons
   * @param {string} schemeName - 'electricCyan', 'royalBlue', oder 'vividMagenta'
   */
  setColorScheme(schemeName) {
    if (this.colorSchemes[schemeName]) {
      this.currentColorScheme = schemeName;
      this.color = this.colorSchemes[schemeName].pathColor;
      if (this.material) {
        const scheme = this.colorSchemes[schemeName];
        // Verwende die Pfadfarbe (Electric Cyan) für aktive Pfade
        this.material.color.set(scheme.pathColor);
        this.material.needsUpdate = true;
      }
    }
  }

  removePath() {
    if (this.pathObject && this.locar) {
      if (this._anchorEntity && this._anchorEntity.parentNode) {
        this._anchorEntity.parentNode.removeChild(this._anchorEntity);
        this._anchorEntity = null;
      }
      if (this.pathObject.geometry) this.pathObject.geometry.dispose();
      if (this.pathObject.material) this.pathObject.material.dispose();
      this.pathObject = null;
    }
  }
}
