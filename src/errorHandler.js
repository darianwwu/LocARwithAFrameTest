/**
 * Zeigt ein zentrales Popup für Fehler- und Statusmeldungen an.
 * @param {string} text - Anzuzeigender Text
 * @param {number} d - Dauer in ms (0 = bleibt offen)
 */
export function showPopup(text, d = 5000) {
  const markerPopup = document.getElementById('markerPopup');
  const markerPopupText = document.getElementById('markerPopupText');
  if (!markerPopup || !markerPopupText) {
    alert(text); // Fallback
    return;
  }
  markerPopupText.textContent = text;
  markerPopup.classList.add('marker-popup--visible');
  if (d > 0) {
    setTimeout(() => {
      markerPopup.classList.remove('marker-popup--visible');
    }, d);
  }
}

/**
 * Kamera-Fehlerbehandlung
 * @param {Error} err
 */
export function handleCameraError(err) {
  if (!err) return;
  if (err.name === 'NotAllowedError') {
    showPopup('Kamera-Zugriff verweigert. Bitte erlaube den Zugriff in den Browsereinstellungen.', 5000);
  } else if (err.name === 'NotReadableError') {
    showPopup('Kamera wird bereits von einer anderen Anwendung oder einem anderen Tab genutzt.', 5000);
  } else if (err.name === 'NotFoundError') {
    showPopup('Keine Kamera gefunden. Bitte schließe eine Kamera an.', 5000);
  } else if (err.name === 'NotSupportedError') {
    showPopup('Kamera wird von deinem Browser nicht unterstützt.', 5000);
  } else {
    showPopup('Unbekannter Kamerafehler: ' + (err.message || err), 5000);
  }
}

/**
 * GPS-Fehlerbehandlung
 * @param {PositionError|Error} err
 */
export function handleGpsError(err) {
  if (!err) return;
  if (err.code === 1) {
    showPopup('GPS-Zugriff verweigert. Bitte erlaube den Zugriff in den Browsereinstellungen.', 5000);
  } else if (err.code === 2) {
    showPopup('GPS-Signal nicht verfügbar. Prüfe, ob dein Gerät GPS unterstützt.', 5000);
  } else if (err.code === 3) {
    showPopup('GPS-Zeitüberschreitung. Versuche es erneut oder gehe ins Freie.', 5000);
  } else {
    showPopup('Unbekannter GPS-Fehler: ' + (err.message || err), 5000);
  }
}

/**
 * Sensor-Fehlerbehandlung (DeviceOrientation, Bewegungssensoren)
 * @param {Error} err
 */
export function handleSensorError(err) {
  if (!err) return;
  if (err.name === 'NotAllowedError') {
    showPopup('Zugriff auf Bewegungssensoren verweigert. Bitte erlaube den Zugriff in den Browsereinstellungen.', 5000);
  } else if (err.name === 'NotSupportedError') {
    showPopup('Bewegungssensoren werden von deinem Browser oder Gerät nicht unterstützt.', 5000);
  } else {
    showPopup('Unbekannter Sensorfehler: ' + (err.message || err), 5000);
  }
}

/**
 * Prüft, ob alle benötigten Browser-APIs unterstützt werden.
 * @returns {boolean}
 */
export function checkBrowserSupport() {
  if (!window.isSecureContext) {
    showPopup('Bitte öffne die Seite über HTTPS, damit Kamera und Sensoren funktionieren.', 7000);
    return false;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showPopup('Dein Browser unterstützt keine Kamera-Zugriffe.', 7000);
    return false;
  }
  if (!('geolocation' in navigator)) {
    showPopup('Dein Browser unterstützt keine GPS-Ortung.', 7000);
    return false;
  }
  if (typeof DeviceOrientationEvent === 'undefined') {
    showPopup('Dein Browser unterstützt keine Bewegungssensoren.', 7000);
    return false;
  }
  return true;
}

/**
 * Prüft, ob Sensoren vom OS/Browser blockiert werden (z.B. iOS Private Mode)
 */
export function checkSensorAvailability() {
  if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(result => {
        if (result !== 'granted') {
          showPopup('Bewegungssensoren sind im aktuellen Modus (z.B. Privatmodus) nicht verfügbar.', 7000);
        }
      })
      .catch(() => {
        showPopup('Bewegungssensoren sind im aktuellen Modus (z.B. Privatmodus) nicht verfügbar.', 7000);
      });
  }
}

/**
 * Allgemeiner Fehler-Handler für unerwartete Fehler
 * @param {Error|string} err
 */
export function handleGenericError(err) {
  showPopup('Ein unbekannter Fehler ist aufgetreten: ' + (err && err.message ? err.message : err), 5000);
}