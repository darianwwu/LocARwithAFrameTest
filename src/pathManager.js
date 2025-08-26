import proj4 from 'proj4';
import { computeDistance } from './distanceOverlay.js';

export class PathManager {
  constructor(options = {}) {
    this.paths = [];
    this.activePath = null;
    this.rescuePoints = []; // Neue Eigenschaft für Rettungspunkte
    this.locar = options.locar;
    this.camera = options.camera;
    
    // ETRS89 (UTM Zone 32N) Definition
    proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');
  }
  
  /**
   * Lädt Pfade aus einer JSON-Datei im ETRS89/UTM Zone 32N Format
   * @param {string} url - URL der JSON-Datei
   * @returns {Promise<Array>} - Die geladenen Pfade
   */
  async loadPathsFromJson(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Fehler beim Laden der Pfaddaten: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Alle Koordinaten aus allen Features sammeln
      let allCoordinates = [];
      
      data.features.forEach(feature => {
        if (feature.geometry.type !== 'LineString') {
          console.warn('Nicht unterstützter Geometrietyp:', feature.geometry.type);
          return;
        }
        
        // ETRS89/UTM Zone 32N zu WGS84 transformieren
        const wgs84Coords = feature.geometry.coordinates.map(coord => 
          proj4('EPSG:25832', 'EPSG:4326', coord)
        );
        
        allCoordinates.push(...wgs84Coords);
      });
      
      // Einen einzigen Pfad erstellen
      if (allCoordinates.length > 0) {
        this.paths = [{
          id: 'main-path',
          name: data.name || 'Route',
          distance: data.length || 0,
          duration: data.duration || 0,
          originalCoords: allCoordinates,
          wgs84Coords: allCoordinates,
          properties: {
            name: data.name || 'Route',
            description: data.description || 'Importierte Route',
            distance: data.length || 0,
            duration: data.duration || 0,
            segments: data.features.length
          }
        }];
      } else {
        this.paths = [];
      }
      
      console.log(`Route geladen: ${allCoordinates.length} Punkte, ${(data.length/1000).toFixed(1)}km, ${(data.duration/60).toFixed(1)} Min`);
      return this.paths;
    } catch (error) {
      console.error('Fehler beim Laden der Pfaddaten:', error);
      throw error;
    }
  }
  
  /**
   * Setzt den aktiven Pfad
   * @param {string|number} pathId - ID oder Index des zu aktivierenden Pfads
   */
  setActivePath(pathId) {
    if (typeof pathId === 'number') {
      this.activePath = this.paths[pathId] || null;
    } else {
      this.activePath = this.paths.find(path => path.id === pathId) || null;
    }
    
    return this.activePath;
  }
  
  /**
   * Findet den nächsten Pfad zu einer Position
   * @param {Object} position - Position {latitude, longitude}
   * @returns {Object|null} - Der nächste Pfad und Entfernung
   */
  findNearestPath(position) {
    if (!position || this.paths.length === 0) return null;
    
    let nearestPath = null;
    let minDistance = Infinity;
    
    this.paths.forEach(path => {
      const distance = this.getDistanceToPath(position, path);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPath = path;
      }
    });
    
    return nearestPath ? { path: nearestPath, distance: minDistance } : null;
  }
  
  /**
   * Berechnet die Entfernung von einer Position zu einem Pfad
   * @param {Object} position - Position {latitude, longitude}
   * @param {Object} path - Pfadobjekt
   * @returns {number} - Minimale Entfernung in Metern
   */
  getDistanceToPath(position, path) {
    const point = [position.longitude, position.latitude];
    let minDistance = Infinity;
    
    for (let i = 0; i < path.wgs84Coords.length - 1; i++) {
      const start = path.wgs84Coords[i];
      const end = path.wgs84Coords[i + 1];
      
      const distance = this.distanceToSegment(point, start, end);
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
  }
  
  /**
   * Berechnet die Entfernung eines Punktes zu einem Liniensegment
   * @param {Array} point - Punktkoordinaten [lon, lat]
   * @param {Array} lineStart - Startpunkt des Liniensegments [lon, lat]
   * @param {Array} lineEnd - Endpunkt des Liniensegments [lon, lat]
   * @returns {number} - Entfernung in Metern
   */
  distanceToSegment(point, lineStart, lineEnd) {
    // Haversine-Formel für genaue Entfernungsberechnung
    const R = 6371000; // Erdradius in Metern
    
    // Punkt zu Linie Projektion
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];
    
    const length2 = dx * dx + dy * dy;
    
    if (length2 === 0) {
      return this.haversineDistance(point, lineStart);
    }
    
    // Projektion des Punktes auf die Linie
    const t = Math.max(0, Math.min(1, 
      ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / length2
    ));
    
    // Nächster Punkt auf der Linie
    const projection = [
      lineStart[0] + t * dx,
      lineStart[1] + t * dy
    ];
    
    // Entfernung zum projizierten Punkt
    return this.haversineDistance(point, projection);
  }
  
  /**
   * Haversine-Formel für Entfernungen auf der Erdoberfläche
   */
  haversineDistance(point1, point2) {
    const R = 6371000; // Erdradius in Metern
    const lon1 = point1[0] * Math.PI / 180;
    const lat1 = point1[1] * Math.PI / 180;
    const lon2 = point2[0] * Math.PI / 180;
    const lat2 = point2[1] * Math.PI / 180;
    
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Entfernung in Metern
  }

  /**
   * Lädt Rettungspunkte aus einer GPX-Datei und filtert sie nach Entfernung
   * @param {string} url - URL der GPX-Datei
   * @param {Object} userPosition - Aktuelle Position des Nutzers {latitude, longitude}
   * @param {number} maxDistance - Maximale Entfernung in Metern (default: 10000m = 10km)
   * @returns {Promise<Array>} - Die gefilterten Rettungspunkte
   */
  async loadRescuePointsFromGPX(url, userPosition, maxDistance = 10000) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Fehler beim Laden der GPX-Datei: ${response.statusText}`);
      }
      
      const gpxText = await response.text();
      console.log('GPX-Datei geladen, Größe:', gpxText.length, 'Zeichen');
      
      // GPX zu DOM parsen
      const parser = new DOMParser();
      const gpxDoc = parser.parseFromString(gpxText, 'application/xml');
      
      // Prüfe auf Parser-Fehler
      const parseError = gpxDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error('Fehler beim Parsen der GPX-Datei: ' + parseError.textContent);
      }
      
      const waypoints = gpxDoc.querySelectorAll('wpt');
      console.log(`${waypoints.length} Wegpunkte in GPX gefunden`);
      
      const allRescuePoints = [];
      let filteredCount = 0;
      
      waypoints.forEach((wpt, index) => {
        const latitude = parseFloat(wpt.getAttribute('lat'));
        const longitude = parseFloat(wpt.getAttribute('lon'));
        
        if (isNaN(latitude) || isNaN(longitude)) {
          console.warn(`Ungültige Koordinaten bei Wegpunkt ${index}:`, latitude, longitude);
          return;
        }
        
        // Entfernung zum Nutzer berechnen
        const distance = computeDistance(
          userPosition.latitude,
          userPosition.longitude,
          latitude,
          longitude
        );
        
        // Nur Punkte innerhalb des gewünschten Radius
        if (distance <= maxDistance) {
          const nameElement = wpt.querySelector('name');
          const descElement = wpt.querySelector('desc');
          const eleElement = wpt.querySelector('ele');
          
          const rescuePoint = {
            id: nameElement?.textContent || `RP-${index}`,
            name: descElement?.textContent || nameElement?.textContent || 'Rettungspunkt',
            latitude: latitude,
            longitude: longitude,
            elevation: eleElement ? parseFloat(eleElement.textContent) : 0,
            distance: distance,
            type: 'rescue-point'
          };
          
          allRescuePoints.push(rescuePoint);
          filteredCount++;
        }
      });
      
      // Nach Entfernung sortieren (nächste zuerst)
      allRescuePoints.sort((a, b) => a.distance - b.distance);
      
      this.rescuePoints = allRescuePoints;
      
      console.log(`${filteredCount} Rettungspunkte im ${maxDistance/1000}km Umkreis gefunden`);
      console.log('Nächste 5 Rettungspunkte:', allRescuePoints.slice(0, 5).map(rp => `${rp.name} (${(rp.distance/1000).toFixed(1)}km)`));
      
      return allRescuePoints;
    } catch (error) {
      console.error('Fehler beim Laden der Rettungspunkte:', error);
      throw error;
    }
  }

  /**
   * Gibt alle geladenen Rettungspunkte zurück
   * @returns {Array} - Die Rettungspunkte
   */
  getRescuePoints() {
    return this.rescuePoints;
  }

  /**
   * Filtert Rettungspunkte nach neuer Position
   * @param {Object} userPosition - Aktuelle Position des Nutzers {latitude, longitude}
   * @param {number} maxDistance - Maximale Entfernung in Metern
   * @returns {Array} - Gefilterte Rettungspunkte
   */
  filterRescuePointsByDistance(userPosition, maxDistance = 10000) {
    return this.rescuePoints.filter(point => {
      const distance = computeDistance(
        userPosition.latitude,
        userPosition.longitude,
        point.latitude,
        point.longitude
      );
      point.distance = distance; // Aktualisiere die Entfernung
      return distance <= maxDistance;
    }).sort((a, b) => a.distance - b.distance);
  }
}
