export class CompassGUI {
  constructor({ deviceOrientationControl, compassArrowId, compassTextId, getScreenOrientation}) {
    this.deviceOrientationControl = deviceOrientationControl;
    this.compassArrow = document.getElementById(compassArrowId);
    this.compassText = document.getElementById(compassTextId);
    this.getScreenOrientation = getScreenOrientation;
  }
  // Aktualisiert die GUI-Elemente (Pfeil und Zahl) des Kompasses
  update() {
    // Prüfen, ob deviceOrientation Property vorhanden ist
    if (!this.deviceOrientationControl.deviceOrientation) return;

    const { type, angle } = this.getScreenOrientation();
    
    let heading = this.deviceOrientationControl.getAlpha() * (180 / Math.PI);
    
    // für iOs: wenn webkitCompassHeading vorhanden ist, nutze diesen Wert statt Alpha
    if (this.deviceOrientationControl.deviceOrientation?.webkitCompassHeading !== undefined) {
      heading = this.deviceOrientationControl.deviceOrientation.webkitCompassHeading;
    }
    
    // Anpassung basierend auf der ScreenOrientation API
    // Smartphone nach links gekippt (+90°)
    if (type === 'landscape-primary') {
      heading = (heading + 90 + 360) % 360;
    }
    // Smartphone nach rechts gekippt (-90°)
    else if (type === 'landscape-secondary') {
      heading = (heading - 90 + 360) % 360;
    }
      
    // UI Elemente aktualisieren
    if (this.deviceOrientationControl.deviceOrientation?.webkitCompassHeading !== undefined) {
      this.compassArrow.style.transform = `rotate(${-heading}deg)`;
    }
    else {
    this.compassArrow.style.transform = `rotate(${heading}deg)`;
    }
    this.compassText.innerText = `${Math.round(heading)}°`;
  }
}
