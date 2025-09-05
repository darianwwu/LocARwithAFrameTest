/**
 * MapView - OpenLayers Integration für AR Navigation
 * Zeigt eine zusammenklappbare Karte in der unteren linken Ecke
 */
export const CANON_CONE_R = 100;

export class MapView {
  constructor(options = {}) {
    this.map = null;
    this.userMarker = null;
    this.targetMarkers = [];
    this.rescuePointMarkers = []; // Array für Rettungspunkt-Marker
    this.vectorSource = null;
    this.isVisible = false;
    this.isFullscreen = false; // Neues Flag für Fullscreen-Modus
    this.currentPosition = null;
    this.userInteractedWithMap = false; // Flag für Benutzerinteraktion
    this._coneIconCache = {};
    
    this.userConeCfg = {
      // Größe
      baseRadiusPx: 40,   // Radius (in px) bei refZoom
      minRadiusPx: 16,    // Untergrenze
      maxRadiusPx: 72,    // Obergrenze

      // Zoom-Mapping
      refZoom: 16,        // Referenz-Zoom (bei dem baseRadiusPx gilt)
      alpha: 0.25,        // 0 = fix; 1 = sehr stark zoom-abhängig

      // Optik
      apertureDeg: 60,
      fill: 'rgba(0,124,255,0.20)',
      outline: 'none',
      outlineWidth: 0
    };
    const CANON_CONE_R = 100;

    // Callback-Funktionen
    this.onMarkerClick = options.onMarkerClick || null;
    this.onMapInitialized = options.onMapInitialized || null;
    
    this.mapContainer = document.getElementById('mapView');
    this.mapToggle = document.getElementById('mapToggle');
    this.mapDisplay = document.getElementById('map');
    this.mapFullscreenToggle = document.getElementById('mapFullscreenToggle');
    this.expandIcon = this.mapFullscreenToggle?.querySelector('.expand-icon');
    this.closeIcon = this.mapFullscreenToggle?.querySelector('.close-icon');
    
    this.initializeEvents();
  }
  

  /**
   * Aktualisiert die Blickrichtung des Benutzers auf der Karte.
   * @param {number} heading - Heading in Grad (0 = Norden)
   */
  updateUserHeading(heading, accuracyDeg = null) {
    if (!this.userMarker) return;
    this.userMarker.set('heading', heading);
    if (accuracyDeg != null) this.userMarker.set('headingAccuracy', accuracyDeg);
    this.userMarker.changed(); // Style-Funktion neu ausführen
  }

  initializeEvents() {
    // Toggle Button Event
    this.mapToggle.addEventListener('click', () => {
      this.toggleMap();
    });

    // Fullscreen Toggle Button Event
    this.mapFullscreenToggle?.addEventListener('click', (e) => {
      e.stopPropagation(); // Verhindert Bubble-up zum mapToggle
      this.toggleFullscreen();
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
      
      // Bei normaler Kartenansicht (nicht Vollbild): immer auf Benutzerposition zentrieren
      if (!this.isFullscreen && this.currentPosition) {
        setTimeout(() => {
          if (this.map) {
            this.map.getView().setCenter(ol.proj.fromLonLat(this.currentPosition));
            this.map.getView().setZoom(15);
            this.map.getView().setRotation(0); // Karte nach Norden ausrichten
          }
        }, 100);
      }
      
      // Map resize nach Animation
      setTimeout(() => {
        if (this.map) {
          this.map.updateSize();
        }
      }, 300);
    } else {
      this.mapContainer.classList.remove('map-view--visible');
      
      // Vollbildmodus beim Schließen der Karte deaktivieren
      if (this.isFullscreen) {
        this.isFullscreen = false;
        this.mapContainer.classList.remove('map-view--fullscreen');
        // Icons zurücksetzen
        if (this.expandIcon) this.expandIcon.style.display = 'block';
        if (this.closeIcon) this.closeIcon.style.display = 'none';
      }
      
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

  /**
   * Schaltet den Vollbildmodus der Karte um
   */
  toggleFullscreen() {
    if (this.isFullscreen) {
      // Vollbildmodus deaktivieren und Karte komplett schließen
      this.isFullscreen = false;
      this.isVisible = false;
      this.mapContainer.classList.remove('map-view--fullscreen');
      this.mapContainer.classList.remove('map-view--visible');
      
      // Icons zurücksetzen
      if (this.expandIcon) this.expandIcon.style.display = 'block';
      if (this.closeIcon) this.closeIcon.style.display = 'none';
      
      // Map-Interaktions-Flag zurücksetzen
      this.userInteractedWithMap = false;
      
      // Karte auf Standard-Ausschnitt zurücksetzen
      if (this.map) {
        if (this.targetMarkers.length > 0 || this.userMarker) {
          this.fitMapToMarkers();
        } else {
          this.map.getView().setCenter(ol.proj.fromLonLat([7.6, 51.9]));
          this.map.getView().setZoom(15);
        }
      }
    } else {
      // Vollbildmodus aktivieren
      this.isFullscreen = true;
      this.mapContainer.classList.add('map-view--fullscreen');
      
      // Sicherstellen, dass die Karte sichtbar ist
      if (!this.isVisible) {
        this.isVisible = true;
        this.mapContainer.classList.add('map-view--visible');
      }
      
      // Icons umschalten
      if (this.expandIcon) this.expandIcon.style.display = 'none';
      if (this.closeIcon) this.closeIcon.style.display = 'block';
      
      // Map resize nach Animation
      setTimeout(() => {
        if (this.map) {
          this.map.updateSize();
        }
      }, 300);
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

    // Style-Funktion statt fixer Style:
    this.userMarker.setStyle(this.getUserMarkerStyleFunction());
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
  }
  
  /**
   * Erstellt den Style für den Benutzermarker.
   * @param {number} heading - Heading in Grad (optional, wird ignoriert)
   * @returns {ol.style.Style}
   */
  getUserMarkerStyleFunction() {
    return (feature, resolution) => {
      // Zoom holen (robust, falls beim ersten Render noch undefined)
      const view = this.map.getView();
      const zoom = view.getZoom() ?? view.getConstrainedZoom(view.getZoomForResolution(resolution));

      // Heading / Apertur
      const headingDeg = feature.get('heading');
      const headingAcc = feature.get('headingAccuracy');
      const aperture = Number.isFinite(headingAcc)
        ? Math.max(20, Math.min(90, headingAcc))
        : this.userConeCfg.apertureDeg;

      // Icon + dynamische Größe
      const icon = this._getConeIcon(aperture);
      const radiusPx = this._computeConeRadiusPx(zoom);
      const scale = radiusPx / CANON_CONE_R;   // von „kanonisch“ auf Zielgröße
      icon.setScale(scale);

      // Rotation (Norden=0° → Kartenmathe Osten=0°)
      icon.setRotation((( (headingDeg ?? 0) - 90) * Math.PI) / 180);

      const coneStyle = new ol.style.Style({ image: icon, zIndex: 999 });
      const dotStyle  = new ol.style.Style({
        image: new ol.style.Circle({
          radius: 6,
          fill: new ol.style.Fill({ color: '#007cff' }),
          stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
        }),
        zIndex: 1000
      });

      return Number.isFinite(headingDeg) ? [coneStyle, dotStyle] : [dotStyle];
    };
  }


  addTargetMarker(lat, lon, title = 'Ziel', isActive = false, index = null) {
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
              color: isActive ? '#ff0000' : '#787c78ff', // Rot/Grau aktiv/inaktiv
              width: isActive ? 6 : 3, // Breiter für bessere Sichtbarkeit
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

  _buildConeSVG(apertureDeg, { fill, outline, outlineWidth }) {
    const r  = CANON_CONE_R;
    const a  = (apertureDeg * Math.PI) / 180;
    const cx = r, cy = r;
    const x1 = cx + r * Math.cos(-a / 2);
    const y1 = cy + r * Math.sin(-a / 2);
    const x2 = cx + r * Math.cos( a / 2);
    const y2 = cy + r * Math.sin( a / 2);

    const strokeAttr = (outline === 'none') ? '' : `stroke="${outline}" stroke-width="${outlineWidth}"`;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${2*r}" height="${2*r}" viewBox="0 0 ${2*r} ${2*r}">
        <path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z"
              fill="${fill}" ${strokeAttr}/>
      </svg>
    `;
  }

  _getConeIcon(apertureDeg = this.userConeCfg.apertureDeg) {
    const key = `${apertureDeg}|${this.userConeCfg.fill}|${this.userConeCfg.outline}|${this.userConeCfg.outlineWidth}`;
    this._coneIconCache ||= {};
    if (this._coneIconCache[key]) return this._coneIconCache[key];

    const svg = this._buildConeSVG(apertureDeg, {
      fill: this.userConeCfg.fill,
      outline: this.userConeCfg.outline,
      outlineWidth: this.userConeCfg.outlineWidth
    });

    const icon = new ol.style.Icon({
      src: "data:image/svg+xml;utf8," + encodeURIComponent(svg),
      imgSize: [CANON_CONE_R * 2, CANON_CONE_R * 2],
      anchor: [0.5, 0.5],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
      rotateWithView: true
    });

    this._coneIconCache[key] = icon;
    return icon;
  }

  _computeConeRadiusPx(zoom) {
    const cfg = this.userConeCfg;
    const factor = Math.pow(2, cfg.alpha * (zoom - cfg.refZoom));
    const r = cfg.baseRadiusPx * factor;
    return Math.max(cfg.minRadiusPx, Math.min(cfg.maxRadiusPx, r));
  }

}

// Styles beim Import injizieren
MapView.injectStyles();
