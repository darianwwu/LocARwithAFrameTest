/**
 * MapView - OpenLayers Integration für AR Navigation
 * Zeigt eine zusammenklappbare Karte in der unteren linken Ecke
 */

export class MapView {
  constructor(options = {}) {
    this.map = null;
    this.userMarker = null;
    this.targetMarkers = [];
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

      this.map.on('zoomstart', () => {
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
}

// Styles beim Import injizieren
MapView.injectStyles();
