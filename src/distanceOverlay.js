import 'three';

/**
 * Berechnet die Distanz zwischen zwei GPS-Koordinaten (Haversine-Formel)
 * @param {*} lat1 Latitude des ersten Punktes
 * @param {*} lon1 Longitude des ersten Punktes
 * @param {*} lat2 Latitude des zweiten Punktes
 * @param {*} lon2 Longitude des zweiten Punktes
 * @returns Berechnete Distanz in Metern
 */
export function computeDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Erdradius in Metern
  const φ1 = THREE.MathUtils.degToRad(lat1);
  const φ2 = THREE.MathUtils.degToRad(lat2);
  const Δφ = THREE.MathUtils.degToRad(lat2 - lat1);
  const Δλ = THREE.MathUtils.degToRad(lon2 - lon1);
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Zeigt die Distanz zwischen zwei GPS-Koordinaten in einem Overlay an
 * @param {*} currentCoords Aktuelle GPS-Koordinaten des Users
 * @param {*} targetCoords Ziel-GPS-Koordinaten
 * @param {*} distanceOverlay UI-Element, in dem die Distanz angezeigt wird
 * @returns 
 */
export function updateDistance(currentCoords, targetCoords, distanceOverlay) {
  if (currentCoords.longitude === null || currentCoords.latitude === null) return;
  const distance = computeDistance(
    currentCoords.latitude,
    currentCoords.longitude,
    targetCoords.latitude,
    targetCoords.longitude
  );

  // Wenn Entfernung größer als 1000 m, in km anzeigen
  if (distance >= 1000) {
    const km = distance / 1000;
    // Formatieren auf eine Nachkommastelle
    const kmString = km.toFixed(1).replace('.', ',');
    distanceOverlay.innerText = `${kmString} km`;
  } else {
    distanceOverlay.innerText = `${Math.round(distance)} m`;
  }
}
