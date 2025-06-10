export class CompassGUI {
  constructor({ deviceOrientationControl, compassArrowId, compassTextId, getScreenOrientation}) {
    this.deviceOrientationControl = deviceOrientationControl;
    this.compassArrow = document.getElementById(compassArrowId);
    this.compassText = document.getElementById(compassTextId);
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
  this.compassArrow.style.transform = `rotate(${heading}deg)`;
  this.compassText.innerText = `${Math.round(heading)}°`;
  
  }
}
