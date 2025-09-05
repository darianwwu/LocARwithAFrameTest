import * as THREE from 'three';

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
 * Zeigt pfadbezogene Distanzinformationen an
 * @param {Object} pathInfo - Pfadinformationen
 * @param {Object} pathInfo.path - Der aktive Pfad
 * @param {number} pathInfo.distanceToPath - Entfernung zum nächsten Punkt auf dem Pfad (in Metern)
 * @param {boolean} pathInfo.isOnPath - Ob sich der Nutzer auf dem Pfad befindet (<20m)
 * @param {HTMLElement} distanceOverlay - UI-Element für die Anzeige
 * @param {Object} options - Anzeigeoptionen
 */
export function updatePathDistance(pathInfo, distanceOverlay, options = {}) {
  const { path, distanceToPath, isOnPath } = pathInfo;
  const mode = options.mode || 'distance';
  
  if (!path) {
    distanceOverlay.innerHTML = '';
    return;
  }
  
  // Gesamtlänge des Pfades
  const totalDistance = path.distance || 0;
  let totalDistanceText = '';
  
  if (totalDistance >= 1000) {
    const km = totalDistance / 1000;
    totalDistanceText = `${km.toFixed(1).replace('.', ',')} km`;
  } else {
    totalDistanceText = `${Math.round(totalDistance)} m`;
  }
  
  // Gehzeit für den gesamten Pfad
  const totalWalkingTime = calculateWalkingTime(totalDistance);
  
  let displayText = '';
  
  // Wenn Nutzer nicht auf dem Pfad ist, zeige zuerst die Distanz zum Pfad
  if (!isOnPath && distanceToPath !== null && distanceToPath !== undefined) {
    let toPathText = '';
    
    if (distanceToPath >= 1000) {
      const km = distanceToPath / 1000;
      toPathText = `${km.toFixed(1).replace('.', ',')} km`;
    } else {
      toPathText = `${Math.round(distanceToPath)} m`;
    }
    
    // Erste Zeile: Distanz zum Pfad
    if (mode === 'minutes') {
      const walkTime = calculateWalkingTime(distanceToPath);
      displayText = `➤ ${walkTime}`;
    } else if (mode === 'both') {
      const walkTime = calculateWalkingTime(distanceToPath);
      displayText = `➤ ${toPathText} / ${walkTime}`;
    } else {
      displayText = `➤ ${toPathText}`;
    }
    
    // Zweite Zeile: Gesamtlänge des Pfades
    if (mode === 'minutes') {
      displayText += `<br>${totalWalkingTime}`;
    } else if (mode === 'both') {
      displayText += `<br>${totalDistanceText} / ${totalWalkingTime}`;
    } else {
      displayText += `<br>${totalDistanceText}`;
    }
  } else {
    // Nutzer ist auf dem Pfad: nur Gesamtlänge anzeigen
    if (mode === 'minutes') {
      displayText = `${totalWalkingTime}`;
    } else if (mode === 'both') {
      displayText = `${totalDistanceText} / ${totalWalkingTime}`;
    } else {
      displayText = `${totalDistanceText}`;
    }
  }
  
  distanceOverlay.innerHTML = displayText;
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
