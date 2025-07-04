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
 * @param {*} options Optionen für die Anzeige (mode: 'distance', 'minutes', 'both')
 * @returns 
 */
export function updateDistance(currentCoords, targetCoords, distanceOverlay, options = {}) {
  if (currentCoords.longitude === null || currentCoords.latitude === null) return;
  const distance = computeDistance(
    currentCoords.latitude,
    currentCoords.longitude,
    targetCoords.latitude,
    targetCoords.longitude
  );

  // Optionale Anzeigeart: 'distance', 'minutes', 'both'
  const mode = options.mode || 'distance';
  
  if (mode === 'minutes') {
    const walkingTime = calculateWalkingTime(distance);
    distanceOverlay.innerText = walkingTime;
  } else if (mode === 'both') {
    let distString;
    if (distance >= 1000) {
      const km = distance / 1000;
      distString = `${km.toFixed(1).replace('.', ',')} km`;
    } else {
      distString = `${Math.round(distance)} m`;
    }
    const walkingTime = calculateWalkingTime(distance);
    distanceOverlay.innerText = `${distString} / ${walkingTime}`;
  } else {
    // Standard: nur Distanz
    if (distance >= 1000) {
      const km = distance / 1000;
      const kmString = km.toFixed(1).replace('.', ',');
      distanceOverlay.innerText = `${kmString} km`;
    } else {
      distanceOverlay.innerText = `${Math.round(distance)} m`;
    }
  }
}

/**
 * Berechnet die Gehzeit in Minuten für eine gegebene Distanz
 * @param {number} distance - Distanz in Metern
 * @returns {string} Formatierte Gehzeit (z.B. "5 Gehminuten" oder "1 Gehminute")
 */
export function calculateWalkingTime(distance) {
  // Durchschnittliche Gehgeschwindigkeit in m/s (ca. 1,4 m/s)
  // Etwas verringert, da Fortbewegung im Wald und ohne direkte Strecke langsamer ist.
  const averageWalkingSpeed = 1;
  const timeInMinutes = Math.round(distance / averageWalkingSpeed / 60);

  if (timeInMinutes <= 1) {
    return '1 min';
  } else {
    return `${timeInMinutes} min`;
  }
}
