/**
 * MapView - OpenLayers Integration für AR Navigation
 * Zeigt eine zusammenklappbare Karte in der unteren linken Ecke
 */

export class MapView {
  constructor(options = {}) {
    this.map = null;
    this.userMarker = null;
    this.targetMarkers = [];
    this.rescuePointMarkers = []; // Array für Rettungspunkt-Marker
    this.vectorSource = null;
    this.isVisible = false;
    this.currentPosition = null;
    this.userInteractedWithMap = false; // Flag für Benutzerinteraktion
    
    // Callback-Funktionen
    this.onMarkerClick = options.onMarkerClick || null;
    this.onMapInitialized = options.onMapInitialized || null;
    
    this.mapContainer = document.getElementById('mapView');
    this.mapToggle = document.getElementById('mapToggle');
    this.mapDisplay = document.getElementById('map');
    
    this.initializeEvents();
  }

  /**
   * Dreht die Karte so, dass oben immer die Blickrichtung des Nutzers ist.
   * @param {number} heading - Heading in Grad (0 = Norden)
   */
  rotateToHeading(heading) {
    if (!this.map) return;
    // OpenLayers: 0 = Norden oben, positive Werte gegen den Uhrzeigersinn (Radiant)
    // Heading: 0 = Norden, im Uhrzeigersinn steigend
    // Wir müssen also das Vorzeichen umdrehen und in Radiant umrechnen
    const rotation = -heading * Math.PI / 180;
    this.map.getView().setRotation(rotation);
  }

  initializeEvents() {
    // Toggle Button Event
    this.mapToggle.addEventListener('click', () => {
      this.toggleMap();
    });

    // Karte erst bei erstem Öffnen initialisieren
    this.mapToggle.addEventListener('click', this.initializeMapOnce.bind(this), { once: true });
  }

  initializeMapOnce() {
    // Kurze Verzögerung für CSS-Transition
    setTimeout(() => {
      this.initializeMap();
    }, 100);
  }

  initializeMap() {
    if (this.map) return;    try {
      // Prüfen ob OpenLayers verfügbar ist
      if (typeof ol === 'undefined') {
        console.error('OpenLayers is not loaded');
        return;
      }

      // Vector Source für Marker
      this.vectorSource = new ol.source.Vector();
      
      const vectorLayer = new ol.layer.Vector({
        source: this.vectorSource,
        zIndex: 10
      });

      // OpenLayers Karte initialisieren
      this.map = new ol.Map({
        target: 'map',
        layers: [
          new ol.layer.Tile({
            source: new ol.source.OSM({
              url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              crossOrigin: 'anonymous'
            })
          }),
          vectorLayer
        ],
        view: new ol.View({
          center: ol.proj.fromLonLat([7.6, 51.9]),
          zoom: 15,
          projection: 'EPSG:3857'
        }),
        controls: []
      });

      // Map-Interaktions-Events überwachen
      this.map.on('movestart', () => {
        this.userInteractedWithMap = true;
      });

      // Warten bis Karte geladen ist
      this.map.once('postrender', () => {
        console.log('OpenLayers Map loaded successfully');
        // Aktuelle Position anfordern
        this.updateUserPosition();
      });      // Map Click Events für Marker-Interaktion
      this.map.on('click', (event) => {
        const feature = this.map.forEachFeatureAtPixel(event.pixel, (feature) => {
          return feature;
        });

        if (feature && feature.get('type') === 'target') {
          const index = feature.get('index');
          if (typeof this.onMarkerClick === 'function') {
            this.onMarkerClick(index, feature.get('title'));
          }
        }
      });

      // Hover-Effekt für Marker
      this.map.on('pointermove', (event) => {
        const pixel = this.map.getEventPixel(event.originalEvent);
        const hit = this.map.hasFeatureAtPixel(pixel);
        this.mapDisplay.style.cursor = hit ? 'pointer' : '';
      });

      console.log('Map initialized successfully');
      
      // Callback aufrufen, wenn die Karte initialisiert wurde
      if (this.onMapInitialized) {
        setTimeout(() => {
          this.onMapInitialized();
        }, 100);
      }

    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  toggleMap() {
    this.isVisible = !this.isVisible;
    
    if (this.isVisible) {
      this.mapContainer.classList.add('map-view--visible');
      // Map resize nach Animation
      setTimeout(() => {
        if (this.map) {
          this.map.updateSize();
        }
      }, 300);
    } else {
      this.mapContainer.classList.remove('map-view--visible');
      // Beim Schließen: Flag zurücksetzen und Karte auf Standard-Ausschnitt zurücksetzen
      this.userInteractedWithMap = false;
      
      // Karte auf Standard-Ausschnitt zurücksetzen
      if (this.map) {
        // Zurück zu allen Markern fitteren oder auf Benutzerposition zentrieren
        if (this.targetMarkers.length > 0 || this.userMarker) {
          this.fitMapToMarkers();
        } else {
          // Fallback auf Standard-Position
          this.map.getView().setCenter(ol.proj.fromLonLat([7.6, 51.9]));
          this.map.getView().setZoom(15);
        }
      }
    }
  }

  updateUserPosition(lat = null, lon = null) {
    if (!this.map) return;

    if (lat !== null && lon !== null) {
      this.currentPosition = [lon, lat]; // OpenLayers verwendet [lon, lat]
      
      // User Marker aktualisieren oder erstellen
      if (this.userMarker) {
        this.vectorSource.removeFeature(this.userMarker);
      }
      
      this.userMarker = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(this.currentPosition)),
        type: 'user'
      });

      this.userMarker.setStyle(new ol.style.Style({
        image: new ol.style.Circle({
          radius: 8,
          fill: new ol.style.Fill({ color: '#007cff' }),
          stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
        })
      }));

      this.vectorSource.addFeature(this.userMarker);

      // Nur beim ersten Laden oder wenn Benutzer nicht interagiert hat, Karte zentrieren
      if (!this.userInteractedWithMap) {
        this.map.getView().setCenter(ol.proj.fromLonLat(this.currentPosition));
      }
    } else {
      // GPS Position anfordern
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            this.updateUserPosition(
              position.coords.latitude,
              position.coords.longitude
            );
          },
          (error) => {
            console.warn('Geolocation error:', error);
            // Fallback auf Standard-Position
            this.updateUserPosition(51.9, 7.6);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      }
    }
  }  addTargetMarker(lat, lon, title = 'Ziel', isActive = false, index = null) {
    if (!this.map) return;

    // Verwende den übergebenen Index oder den nächsten verfügbaren Index
    const markerIndex = index !== null ? index : this.targetMarkers.length;
    const marker = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
      type: 'target',
      title: title,
      index: markerIndex,
      isActive: isActive
    });

    // Marker-Style basierend auf aktivem Status
    const markerStyle = this.getMarkerStyle(isActive);
    marker.setStyle(markerStyle);

    this.vectorSource.addFeature(marker);
    this.targetMarkers.push(marker);
    
    // Nur beim ersten Marker oder wenn Benutzer nicht interagiert hat, auf Marker zoomen
    if (!this.userInteractedWithMap && (this.targetMarkers.length === 1 || index === 0)) {
      this.fitMapToMarkers();
    }
    
    console.log(`Map marker added: ${title} at index ${markerIndex}, active: ${isActive}`);
    return marker;
  }
  getMarkerStyle(isActive = false) {
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: isActive ? 10 : 7,
        fill: new ol.style.Fill({ 
          color: isActive ? '#ff4444' : '#ff7777' 
        }),
        stroke: new ol.style.Stroke({ 
          color: '#ffffff', 
          width: isActive ? 3 : 2 
        })
      }),
      zIndex: isActive ? 1000 : 100
    });
  }
  setActiveMarker(index) {
    console.log(`Setting active marker to index: ${index}`);
    this.targetMarkers.forEach((marker, idx) => {
      const isActive = idx === index;
      marker.set('isActive', isActive);
      marker.setStyle(this.getMarkerStyle(isActive));
    });
  }

  removeAllTargetMarkers() {
    this.targetMarkers.forEach(marker => {
      this.vectorSource.removeFeature(marker);
    });
    this.targetMarkers = [];
  }

  fitMapToMarkers() {
    if (!this.map || this.targetMarkers.length === 0) return;

    const features = [...this.targetMarkers];
    if (this.userMarker) {
      features.push(this.userMarker);
    }

    if (features.length > 0) {
      const extent = new ol.source.Vector({ features }).getExtent();
      this.map.getView().fit(extent, {
        padding: [10, 10, 10, 10],
        maxZoom: 16
      });
    }
  }

  /**
   * Pfade zur Karte hinzufügen
   * @param {Array} paths - Array von Pfadobjekten
   * @param {number} activePathIndex - Index des aktiven Pfads (optional)
   */
  addPaths(paths, activePathIndex = -1) {
    console.log('addPaths aufgerufen:', {
      mapExists: !!this.map,
      pathsCount: paths ? paths.length : 0,
      activePathIndex,
      paths: paths
    });
    
    if (!this.map) {
      console.warn('Karte nicht verfügbar - Pfade können nicht hinzugefügt werden');
      return;
    }
    
    console.log('Karte verfügbar, füge Pfade hinzu...');
    
    // Pfadquelle erstellen, falls sie nicht existiert
    if (!this.pathSource) {
      console.log('Erstelle neue Pfadquelle und Layer...');
      this.pathSource = new ol.source.Vector();
      
      // Pfad-Layer erstellen
      const pathLayer = new ol.layer.Vector({
        source: this.pathSource,
        style: (feature) => {
          const isActive = feature.get('active') === true;
          console.log('Style-Funktion aufgerufen für Feature:', {
            id: feature.get('id'),
            active: isActive
          });
          return new ol.style.Style({
            stroke: new ol.style.Stroke({
              color: isActive ? '#ff0000' : '#00ff00', // Rot/Grün wie AR-Pfade
              width: isActive ? 6 : 4, // Breiter für bessere Sichtbarkeit
              lineCap: 'round',
              lineJoin: 'round'
            })
          });
        },
        zIndex: 100 // Hohe Priorität für Sichtbarkeit
      });
      
      // Pfad-Layer zur Karte hinzufügen
      this.map.addLayer(pathLayer);
      this.pathLayer = pathLayer;
      console.log('Pfad-Layer zur Karte hinzugefügt');
    } else {
      console.log('Bestehende Pfadquelle löschen...');
      // Bestehende Pfade löschen
      this.pathSource.clear();
    }
    
    // Pfade zur Quelle hinzufügen
    paths.forEach((path, index) => {
      console.log(`Pfad ${index} zur Karte hinzufügen:`, {
        id: path.id,
        koordinatenAnzahl: path.wgs84Coords.length,
        ersteKoordinate: path.wgs84Coords[0],
        letzteKoordinate: path.wgs84Coords[path.wgs84Coords.length - 1]
      });
      
      // Koordinaten in Kartenprojektion umwandeln
      const mapCoords = path.wgs84Coords.map(coord => 
        ol.proj.transform(coord, 'EPSG:4326', 'EPSG:3857')
      );
      
      console.log(`Transformierte Koordinaten für Pfad ${index}:`, {
        original: path.wgs84Coords.slice(0, 2),
        transformed: mapCoords.slice(0, 2)
      });
      
      // Feature erstellen
      const feature = new ol.Feature({
        geometry: new ol.geom.LineString(mapCoords),
        id: path.id,
        active: index === activePathIndex
      });
      
      console.log('Feature erstellt:', {
        geometry: feature.getGeometry(),
        coordinates: feature.getGeometry().getCoordinates().slice(0, 2),
        active: feature.get('active')
      });
      
      // Zur Quelle hinzufügen
      this.pathSource.addFeature(feature);
      console.log('Feature zur Quelle hinzugefügt');
    });
    
    console.log(`${paths.length} Pfade zur Karte hinzugefügt`);
    console.log('Pfadquelle Features:', this.pathSource.getFeatures().length);
    console.log('Pfadquelle Extent:', this.pathSource.getExtent());
    
    // Karte auf alle Pfade einpassen, wenn keine Benutzerinteraktion
    if (!this.userInteractedWithMap && paths.length > 0) {
      const extent = this.pathSource.getExtent();
      console.log('Karte auf Extent einpassen:', extent);
      this.map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        maxZoom: 18
      });
    } else {
      console.log('Karte nicht eingepasst:', {
        userInteracted: this.userInteractedWithMap,
        pathsLength: paths.length
      });
    }
  }

  /**
   * Aktiven Pfad auf der Karte setzen
   * @param {string|number} pathId - ID oder Index des zu aktivierenden Pfads
   */
  setActivePath(pathId) {
    if (!this.pathSource) return;
    
    const features = this.pathSource.getFeatures();
    
    features.forEach(feature => {
      if (typeof pathId === 'number') {
        feature.set('active', feature === features[pathId]);
      } else {
        feature.set('active', feature.get('id') === pathId);
      }
    });
    
    // Neuzeichnen auslösen
    this.pathLayer.changed();
  }

  /**
   * Alle Pfade von der Karte entfernen
   */
  removeAllPaths() {
    if (this.pathSource) {
      this.pathSource.clear();
    }
  }

  // CSS für Custom Marker hinzufügen
  static injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .ol-popup {
        position: absolute;
        background-color: rgba(0, 0, 0, 0.9);
        color: white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        padding: 8px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        bottom: 12px;
        left: -50px;
        min-width: 100px;
        font-size: 12px;
        line-height: 1.4;
      }
      
      .ol-popup:after, .ol-popup:before {
        top: 100%;
        border: solid transparent;
        content: " ";
        height: 0;
        width: 0;
        position: absolute;
        pointer-events: none;
      }
      
      .ol-popup:after {
        border-color: rgba(0, 0, 0, 0);
        border-top-color: rgba(0, 0, 0, 0.9);
        border-width: 10px;
        left: 48px;
        margin-left: -10px;
      }
      
      .ol-popup:before {
        border-color: rgba(255, 255, 255, 0);
        border-top-color: rgba(255, 255, 255, 0.2);
        border-width: 11px;
        left: 48px;
        margin-left: -11px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Fügt einen Rettungspunkt-Marker zur Karte hinzu
   * @param {number} lat - Breitengrad
   * @param {number} lon - Längengrad  
   * @param {string} name - Name des Rettungspunkts
   * @param {number} distance - Entfernung in Metern
   */
  addRescuePointMarker(lat, lon, name, distance) {
    if (!this.map) return;

    const marker = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
      type: 'rescue',
      title: name,
      distance: distance
    });

    // Rettungspunkt-Style (rotes Kreuz)
    const rescueStyle = new ol.style.Style({
      image: new ol.style.Circle({
        radius: 8,
        fill: new ol.style.Fill({ color: '#ff0000' }),
        stroke: new ol.style.Stroke({ 
          color: '#ffffff', 
          width: 2 
        })
      }),
      text: new ol.style.Text({
        text: '🚑',
        font: '12px sans-serif',
        fill: new ol.style.Fill({ color: '#ffffff' })
      }),
      zIndex: 500
    });

    marker.setStyle(rescueStyle);
    this.vectorSource.addFeature(marker);
    this.rescuePointMarkers.push(marker);
    
    console.log(`Rettungspunkt zur Karte hinzugefügt: ${name} (${(distance/1000).toFixed(1)}km)`);
    return marker;
  }

  /**
   * Entfernt alle Rettungspunkt-Marker von der Karte
   */
  removeRescuePointMarkers() {
    this.rescuePointMarkers.forEach(marker => {
      this.vectorSource.removeFeature(marker);
    });
    this.rescuePointMarkers = [];
    console.log('Alle Rettungspunkt-Marker entfernt');
  }
}

// Styles beim Import injizieren
MapView.injectStyles();
