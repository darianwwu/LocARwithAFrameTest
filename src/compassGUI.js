/**
 * Factory-Funktion zum Hinzufügen des Kompass-UI zur AR-Szene.
 * Kapselt die Instanziierung von CompassGUI.
 * @param {Object} params - Parameterobjekt (siehe main.js)
 * @returns {CompassGUI} Die erzeugte Kompass-Instanz
 */
export function addCompassToScene(params) {
  return new CompassGUI(params);
}

export class CompassGUI {
  constructor({ deviceOrientationControl, compassArrowId, compassTextId, compassDirectionsId, isIOS, getScreenOrientation }) {
    this.deviceOrientationControl = deviceOrientationControl;
    this.compassArrow = document.getElementById(compassArrowId);
    this.compassText = document.getElementById(compassTextId);
    this.compassDirections = document.getElementById(compassDirectionsId);
    this.isIOS = isIOS;
    this.getScreenOrientation = getScreenOrientation;
  }
  
  /**
   * Aktualisiert die GUI-Elemente (Pfeil und Zahl) des Kompasses
   * @returns {void}
   */
  update() {
  if (!this.deviceOrientationControl.deviceOrientation) return;
  
  const heading = this.deviceOrientationControl.getCorrectedHeading();
  
  // UI Elemente aktualisieren
  if(this.isIOS){
    this.compassDirections.style.transform = `rotate(${heading}deg)`;
  }
  else {
    this.compassDirections.style.transform = `rotate(${-heading}deg)`;
  }

  this.compassText.innerText = `${Math.round(heading)}°`;
  
  }
}