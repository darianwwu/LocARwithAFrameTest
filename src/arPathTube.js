import * as THREE from 'three';

export class ARPathTube {
  constructor(options = {}) {
    this.locar = options.locar;
    this.camera = options.camera;
    this.path = options.path || null;
    this.color = options.color || 0x3388ff;
    this.pathObject = null;
    this.radius = options.radius || 1; // Rohr-Radius in Metern
    this.height = 0.2; // Höhe über dem Boden
    this.isActive = options.isActive || false;
    this.material = null;
  }
  
  /**
   * Erstellt ein Pfad-Objekt als Rohr in der AR-Szene
   * @returns {Object} - Das erstellte Pfad-Objekt
   */
  createPathObject() {
    if (!this.path || !this.locar) return null;
    
    // Bestehenden Pfad entfernen
    this.removePath();
    
    try {
      // Material für den Pfad - MeshBasicMaterial für beste Performance
      this.material = new THREE.MeshBasicMaterial({
        color: this.isActive ? 0xff0000 : this.color, // Rot wenn aktiv
        transparent: false, // Keine Transparenz für maximale Sichtbarkeit
        side: THREE.DoubleSide
      });
      
      // Pfadkoordinaten in 3D-Punkte umwandeln
      console.log(`AR-Pfad-Rohr erstelle mit ${this.path.wgs84Coords.length} Koordinaten:`);
      console.log('Erste 3 Koordinaten:', this.path.wgs84Coords.slice(0, 3));
      
      if (this.path.wgs84Coords.length < 2) {
        console.warn('Nicht genügend Koordinaten für Pfad-Rohr');
        return null;
      }
      
      // Erstes Segment erstellen - LoCAR erwartet direkte GPS-Koordinaten
      const firstCoord = this.path.wgs84Coords[0];
      const points = [];
      
      // Alle Koordinaten relativ zum ersten Punkt berechnen
      this.path.wgs84Coords.forEach(coord => {
        // Entfernung und Winkel zum ersten Punkt berechnen
        const deltaLat = coord[1] - firstCoord[1];
        const deltaLon = coord[0] - firstCoord[0];
        
        // Ungefähre Umrechnung in Meter (für kleine Distanzen ausreichend)
        const x = deltaLon * 111320 * Math.cos(firstCoord[1] * Math.PI / 180);
        const z = -deltaLat * 110540; // Minus weil Z nach "hinten" zeigt
        
        points.push(new THREE.Vector3(x, this.height, z));
      });
      
      console.log('Erste 3 berechnete Punkte:', points.slice(0, 3));
      
      if (points.length < 2) {
        console.warn('Nicht genügend Punkte für Pfad-Rohr');
        return null;
      }
      
      // Kurve aus Punkten erstellen
      const curve = new THREE.CatmullRomCurve3(points);
      
      // Rohr-Geometrie erstellen
      const geometry = new THREE.TubeGeometry(
        curve,           // Kurve
        points.length,   // Anzahl der Segmente
        this.radius,     // Radius des Rohrs
        8,               // Radiale Segmente
        false            // Nicht geschlossen
      );
      
      // Mesh-Objekt erstellen
      this.pathObject = new THREE.Mesh(geometry, this.material);
      
      // Zur Szene hinzufügen am ersten GPS-Punkt
      this.locar.add(
        this.pathObject,
        firstCoord[0], // longitude
        firstCoord[1]  // latitude
      );
      
      console.log('AR-Pfad-Rohr erstellt:', {
        punkteAnzahl: points.length,
        radius: this.radius,
        höhe: this.height,
        visible: this.pathObject.visible,
        material: this.pathObject.material.color.getHexString()
      });
      
      return this.pathObject;
      
    } catch (error) {
      console.error('Fehler beim Erstellen des AR-Pfad-Rohrs:', error);
      return null;
    }
  }
  
  /**
   * Aktualisiert das Pfad-Objekt
   */
  update() {
    if (!this.pathObject || !this.path || !this.locar) return;
    
    // Farbe basierend auf Aktivzustand aktualisieren
    if (this.material) {
      this.material.color.set(this.isActive ? 0xff4444 : this.color);
    }
  }
  
  /**
   * Setzt den Aktivzustand
   * @param {boolean} isActive - Ob dieser Pfad aktiv ist
   */
  setActive(isActive) {
    this.isActive = isActive;
    this.update();
  }
  
  /**
   * Entfernt den Pfad aus der Szene
   */
  removePath() {
    if (this.pathObject && this.locar) {
      this.locar.remove(this.pathObject);
      
      // Geometrie und Material freigeben
      if (this.pathObject.geometry) {
        this.pathObject.geometry.dispose();
      }
      if (this.pathObject.material) {
        this.pathObject.material.dispose();
      }
      
      this.pathObject = null;
      console.log('AR-Pfad-Rohr entfernt');
    }
  }
}
