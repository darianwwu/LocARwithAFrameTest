# LocAR Navigation – WebXR-basierte AR-Navigation

Ein standortbasiertes offline AR-Navigationssystem für den Wald. Entwickelt mit A-Frame, Three.js und der LoCAR-Bibliothek.

## Hauptfunktionen

- **Immersive AR-Navigation**: Zielmarker und Wegführung direkt in der realen Umgebung
- **Pfad-Navigation**: Laden und Visualisierung von GPS-Routen mit drei verschiedenen Darstellungsarten
- **Punkt-Navigation**: Laden und Visualisierung von GPS-Zielpunkten
- **Rettungspunkte**: Integration von  KWF-Rettungspunkten mit Umkreissuche
- **Synchrone Karte**: OpenLayers-basierte 2D-Karte bleibt mit AR-Ansicht synchronisiert
- **Kompass & Navigation**: Integrierter digitaler Kompass und andere UI Elemente
- **Cross-Platform**: Läuft auf iOS Safari/Chrome und Android Chrome

## Quick Start Guide

### Voraussetzungen

- **Browser**: iOS Safari 14+ oder Android Chrome 80+
- **Geräte-Features**: Mobilgerät mit Kamera, GPS und Bewegungssensoren
- **HTTPS**: Erforderlich für Kamera-/Sensor-Zugriff

### Installation

```bash
# Repository klonen
git clone https://conterra@dev.azure.com/conterra/mapapps_offline/_git/ar-navigation
cd ar-navigation

# Dependencies installieren
npm install

# Development-Server starten
npm run dev
```

**TODO: Hier Anleitung einfügen sobald klar ist, wo und wie die App gehosted wird**

### Erste Schritte

1. **Marker/ Pfade hinzufügen**: Koordinaten eingeben/ Testmarker laden/ Testpfade laden
2. **Navigation starten**: Kamera- und GPS-Berechtigung erteilen
3. **AR Ansicht**: Elemente erscheinen als 3D-Objekte in der realen Umgebung

## Bedienung

### Grundfunktionen
- **Interaktive Karte**
- **Integriertes Kompass und GPS Accuracy UI**
- **Zielwechsel**: Aktiven Marker durch Antippen in AR oder Karte wechseln
- **Distanzanzeige**: Klicken zum Umschalten zwischen Meter/Gehminuten
- **Customization**: In den Einstellungen UI Elemente ein- oder ausblenden
- **Rettungspunkte anzeigen**: in den Einstellungen im Umkreis von 10km alle Rettungspunkte hinzufügen
- **Navigationspfeil**: Blauer Pfeil wenn Punkt-Navigation aktiv, orangener Pfeil wenn Pfad-Navigation aktiv

### Pfad-Navigation

```javascript
// Pfade aus JSON laden
const paths = await pathManager.loadMultiplePathsFromJson([
  './test-paths/route_corrected.json',
  './test-paths/new_route_alt.json'
]);
```

**TODO: Hier Pfade verallgemeinern/ Import der Pfade erklären, wenn implementiert**

- **Wege laden**: Mehrere Routen gleichzeitig importieren
- **Pfadwechsel**: Mit ◀/▶-Buttons zwischen Wegen navigieren
- **AR-Visualisierung**: Wählbar zwischen Flowline, Chevrons oder Tube (im Code)
- **Automatische Ziele**: Endpunkt-Marker werden automatisch erstellt

### Rettungspunkte

- **10km Umkreis**: KWF-Rettungspunkte automatisch laden
- **Spezielle Icons**: Deutlich erkennbare Rettungszeichen
- **Kartenintegration**: Alle Punkte auch in 2D-Karte sichtbar

## Architektur

### Technologie-Stack

- **A-Frame**: WebXR-Framework für AR/VR
- **LoCAR**: GPS→Weltkoordinaten-Transformation
- **Three.js**: 3D-Rendering und Geometrie
- **OpenLayers**: 2D-Kartendarstellung
- **proj4**: Koordinatensystem-Transformationen

### Modulstruktur

```
src/
├── main.js                 # Orchestrierung & globaler State
├── targetMarker.js         # AR-Marker (3D-Objekte)
├── pathManager.js          # Route-Laden & GPS-Berechnungen
├── mapView.js              # OpenLayers-Karte
├── arNavigationArrow.js    # Navigationspfeil (Zielmarker)
├── pathNavigationArrow.js  # Pfad-Navigationspfeil
├── arPath*.js              # AR-Pfadvisualisierung (3 Styles)
├── compassGUI.js           # Digitaler Kompass
├── distanceOverlay.js      # Entfernungsanzeige
└── errorHandler.js         # Zentrale Fehlerbehandlung
```

### Datenfluss

```
GPS → LoCAR (lonLatToWorldCoords) → Three.js Objekte → A-Frame Szene
  ↓
2D-Karte (OpenLayers) ← Synchronisation → AR-Ansicht
```

## Konfiguration

### Pfad-Visualisierung

```javascript
// Verfügbare Styles
window.setPathStyle('flowline');   // Fließende Linie
window.setPathStyle('chevrons');   // Richtungspfeile
window.setPathStyle('tube');       // 3D-Rohr

// Farbschemata für Chevrons
window.setPathColorScheme('electricCyan');
window.setPathColorScheme('royalBlue');
window.setPathColorScheme('vividMagenta');
```

**TODO: Anpassen wenn Farben/ Styles aktualisiert**

### Performance-Einstellungen

- **Pixel-Ratio**: Automatisch auf 1.0-1.25 begrenzt
- **Update-Rate**: Marker/Pfeil-Updates mit 10 Hz statt 60 FPS
- **Batch-Operations**: Marker-Synchronisation in kleinen Paketen
- **Geometrie-Optimierung**: Unbeleuchtete Materialien, kein Frustum Culling

## Dateiformate

### JSON-Pfade (ETRS89/UTM Zone 32N)
Die Pfade bestehen aus mehreren LineStrings.
Es muss darauf geachtet werden, dass sie in sich die korrekte Reihenfolge haben und korrekt ausgerichtet sind (Das Ende von Pfad n ist der Anfang von Pfad n+1).

```json
{
  "name": "Wanderweg Beispiel",
  "length": 5420.5,
  "duration": 3600,
  "features": [
    {
      "geometry": {
        "type": "LineString",
        "coordinates": [[401234.5, 5678901.2], ...]
      }
    }
  ]
}
```

### GPX-Rettungspunkte

```xml
<wpt lat="51.460598" lon="8.861806">
  <name>HSK 3348</name>
  <desc>Bilsteinturm; Marsberg, OT Niedermarsberg</desc>
</wpt>
```

## Entwicklung

### Commands

```bash
npm run dev     # Development-Server (Vite)
npm run build   # Production-Build
npm run preview # Build-Vorschau
```

### Debugging

```javascript
// Globale Referenzen verfügbar
window.pathManager  // PathManager-Instanz
window.arrow        // Hauptnavigationspfeil
window.pathArrow    // Pfad-Navigationspfeil
window.currentGPSPosition // Aktuelle GPS-Position
```

### Browser-Entwicklertools

- **Konsole**: Detaillierte Logging-Ausgaben für GPS, Pfade, AR
- **Geolocation**: Device-Simulation für Desktop-Testing
- **WebXR**: Chrome DevTools XR-Emulation

## Browser-Kompatibilität

| Browser | AR-Support | GPS | Sensoren | Status |
|---------|------------|-----|----------|--------|
| iOS Safari 14+ | ✅ | ✅ | ✅ | Vollständig |
| Android Chrome 80+ | ✅ | ✅ | ✅ | Vollständig |
| Desktop | ❌ | 🔧 | ❌ | Testen (begrenzt) |

## Koordinatensysteme

- **Eingabe**: WGS84 (EPSG:4326) – Standard GPS
- **Pfade**: ETRS89/UTM Zone 32N (EPSG:25832)
- **Karte**: Web Mercator (EPSG:3857)
- **AR**: LoCAR-Weltkoordinaten (lokales kartesisches System)

## Performance-Tipps

### Mobile Optimierung

- Pixel-Ratio automatisch angepasst (1.0-1.25x)
- Marker-Updates gedrosselt (Performance > Precision)
- Batch-Operationen für große Marker-Mengen
- Geometrie-Pooling für Pfadvisualisierung

### Speicherverbrauch

```javascript
// Marker-Cleanup beim Entfernen
marker.dispose(); // Entfernt Event-Listener und 3D-Objekte

// Pfad-Cleanup
arPath.removePath(); // Geometrie/Material-Disposal
```

## Fehlerbehebung

### Häufige Probleme

**GPS-Ungenauigkeit**
- Outdoor-Nutzung bevorzugen
- UI ELement zur GPS-Genauigkeit beachten (grün < 5m optimal)
- Kompass neu kalibrieren (z.B. in Google Maps)

**AR-Szene nicht sichtbar**
- Kamera-Berechtigung prüfen
- Andere Browser-Tabs, die die Kamera nutzen, schließen

**AR-Elemente laden nicht**
- Kurz warten (Bei vielen Elementen kann die Initialisierung etwas dauern)
- Hinzugefügte Elemente zu weit weg?
- Browser-Konsole prüfen

**Performance-Probleme**
- Weniger Marker gleichzeitig
- Browser-Tab exklusiv nutzen
- Performance ist stark abhängig vom Endgerät und dessen Sensorqualität
- Im Code die Bildschirmauflösung manuell niedriger machen

### Debug-Konsole

```javascript
// GPS-Status prüfen
console.log(window.currentGPSPosition);

// Aktiver Pfad-Index
console.log(window.pathManager?.paths[activePathIndex]);

// Marker-Status
console.log(markers.map(m => ({ visible: m.markerObject?.visible })));
```

## Lizenz & Datenquellen

### Rettungspunkte
- **Quelle**: [KWF-Rettungspunkte v2.18](https://www.rettungspunkte-forst.de)
- **Lizenz**: [CC-BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/legalcode.de)
- **Umfang**: Deutschland, ~10.000 Punkte

### Software
- **A-Frame**: MIT License
- **Three.js**: MIT License
- **LoCAR**: MIT License
- **OpenLayers**: BSD 2-Clause License

---

**Ansprechpartner: Darian Weiß**