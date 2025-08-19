# AR Navigation System - Copilot Instructions

## Architecture Overview

This is a **location-based AR navigation system** built with A-Frame, Three.js, and LoCAR for forest/outdoor contexts. The system provides GPS-based waypoint navigation with AR visualization and other features like compass guidance, a distance display and integrated rescue point data.
Currently, the system is in active development to support both point and path navigation.

### Core Components & Data Flow

**Main Entry Point**: `src/main.js` orchestrates the entire application lifecycle
- **State Management**: Global state in main.js (`targetCoords[]`, `markers[]`, `currentCoords`, etc.)
- **AR Scene**: A-Frame scene with LoCAR GPS positioning
- **Navigation Pipeline**: GPS → LoCAR coordinate transformation → THREE.js positioning → AR visualization

**Key Dependencies**: 
- `locar` library for GPS-to-world coordinate transformation (EPSG:25832 → WGS84)
- `three` (Three.js) for 3D rendering
- `ol` (OpenLayers) for 2D map integration
- `proj4` for coordinate system transformations

## Critical Development Patterns

### 1. GPS-Driven Architecture
```javascript
// GPS updates trigger everything - core event handler in main.js
function onGpsUpdate(e) {
  // Updates: currentCoords, markers, arrows, map, accuracy display
  // Only creates UI elements when targetCoords exist and markers.length === 0
}
```

### 2. Coordinate System Handling
- **Input**: WGS84 lat/lon (user input, GPX data)
- **Processing**: ETRS89/UTM Zone 32N (via proj4 in PathManager)
- **Rendering**: LoCAR world coordinates for THREE.js positioning
- **Critical**: Always use `locar.lonLatToWorldCoords()` for AR positioning

### 3. State Synchronization Pattern
The app maintains 3 synchronized views:
- `targetCoords[]` array (source of truth)
- `markers[]` array (AR THREE.js objects)
- MapView markers (OpenLayers features)

**Adding new markers requires updating ALL THREE**:
```javascript
// 1. Add to source data
targetCoords.push(markerData);
// 2. Create AR marker 
addMarker(markerData, index);
// 3. Add to map
mapView.addTargetMarker(...);
```

### 4. iOS vs Android Handling
Critical platform differences throughout codebase:
- Device orientation calculations (`device-orientation-controls.js`)
- Map rotation offsets (`animate()` function)
- Permission handling (DeviceOrientationEvent.requestPermission)

## Development Workflow

### Build & Deploy
A development server is not necessary, the website is tested using a production build on GitHub Pages.
```bash
npm run build      # Production build
npm run deploy     # Deploy to GitHub Pages
```

**SSL Required**: GPS and camera APIs require HTTPS - Vite config includes basicSsl plugin

### Key Files to Understand

- **`src/main.js`** - Application orchestrator, state management, GPS event handling
- **`src/targetMarker.js`** - AR marker creation with distance-based scaling (up to 20km)
- **`src/pathManager.js`** - GeoJSON/GPX data loading, coordinate transformations  
- **`src/mapView.js`** - OpenLayers integration, dual marker system
- **`src/arNavigationArrow.js`** - Navigation Arrow that points to the selected target point
- **`src/distanceOverlay.js`** - Displays the distance to the selected target point
- **`src/arPathTube.js`** - AR Path Tube visualization for path navigation (not finished)
- **`src/compassGUI.js`** - AR Compass GUI that uses the users heading to display the direction
- **`lib/aframe/locar-camera.js`** - A-Frame component for GPS-based camera positioning
- **`index.html`** - A-Frame scene definition, UI structure

### Performance Optimizations
- **Marker scaling**: Updates throttled to every 3s or significant movement
- **Arrow updates**: Throttled to 50ms minimum, 2° angle threshold
- **Map rendering**: Only renders when necessary in animate() loop

## Project-Specific Conventions

### Error Handling
Centralized through `errorHandler.js` with `showPopup()` function
- Different handlers for GPS, camera, sensor, generic errors
- User-friendly German messages with specific troubleshooting

### Asset Management
```
public/
├── glbmodell/Pfeil5.glb     # 3D arrow model
├── images/map-marker-*.png   # Marker icons (rot=active, orange=inactive) ([blaugrau, grau, schwarz] are currently not used, but exist)
├── NordrheinWestfalen.gpx   # Rescue points data (CC-BY-ND 4.0 licensed)
└── test-paths.json          # Sample path data
```

### State Machine Pattern
App flow: `Splash → Input Form → Permission Request → AR Mode`
- AR elements only created after GPS lock and target existence


### Settings Integration
Toggle system for compass, GPS display, map, rescue points - all settings affect both AR and map views simultaneously.

When implementing new features, follow the established pattern: data in targetCoords → AR visualization → map synchronization → error handling → iOS/Android platform differences.
