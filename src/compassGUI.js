export class CompassGUI {
  constructor({ deviceOrientationControl, compassArrowId, compassTextId, getScreenOrientation}) {
    this.deviceOrientationControl = deviceOrientationControl;
    this.compassArrow = document.getElementById(compassArrowId);
    this.compassText = document.getElementById(compassTextId);
    this.getScreenOrientation = getScreenOrientation;
  }
  // Aktualisiert die GUI-Elemente (Pfeil und Zahl) des Kompasses
  update() {
  if (!this.deviceOrientationControl.deviceOrientation) return;
  
  // Verwende die korrigierte Heading-Methode
  const heading = this.deviceOrientationControl.getCorrectedHeading();
  
  // UI Elemente aktualisieren (ohne weitere Korrekturen)
  this.compassArrow.style.transform = `rotate(${heading}deg)`;
  this.compassText.innerText = `${Math.round(heading)}°`;
  
}
}
