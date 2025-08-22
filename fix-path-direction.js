#!/usr/bin/env node

/**
 * Skript zur Korrektur der Richtung von LineString-Features in GeoJSON-Pfaden
 * 
 * Das Skript analysiert aufeinanderfolgende LineString-Features und dreht
 * die Koordinatenreihenfolge um, wenn sie nicht nahtlos aneinander anschließen.
 */

import fs from 'fs';
import path from 'path';

/**
 * Berechnet die Distanz zwischen zwei Koordinatenpaaren (Haversine-Formel)
 * @param {number[]} coord1 - [lon, lat]
 * @param {number[]} coord2 - [lon, lat]
 * @returns {number} Distanz in Metern
 */
function calculateDistance(coord1, coord2) {
  const R = 6371000; // Erdradius in Metern
  const lat1Rad = coord1[1] * Math.PI / 180;
  const lat2Rad = coord2[1] * Math.PI / 180;
  const deltaLatRad = (coord2[1] - coord1[1]) * Math.PI / 180;
  const deltaLonRad = (coord2[0] - coord1[0]) * Math.PI / 180;

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Prüft, ob zwei Koordinaten innerhalb der Toleranz übereinstimmen
 * @param {number[]} coord1 - [lon, lat]
 * @param {number[]} coord2 - [lon, lat] 
 * @param {number} tolerance - Toleranz in Metern (Standard: 5m)
 * @returns {boolean}
 */
function coordinatesMatch(coord1, coord2, tolerance = 5) {
  return calculateDistance(coord1, coord2) <= tolerance;
}

/**
 * Evaluiert beide möglichen Orientierungen für den ersten Feature und wählt die beste
 * @param {Object[]} features - Array aller LineString-Features
 * @param {number} tolerance - Toleranz in Metern
 * @returns {Object} Ergebnis mit bestScore, shouldFlipFirst, und Details
 */
function evaluateStartOrientation(features, tolerance = 5) {
  if (features.length < 2) {
    return { bestScore: 0, shouldFlipFirst: false, details: 'Nicht genügend Features für Evaluation' };
  }

  console.log(`🧠 Evaluiere optimale Startrichtung...`);
  
  // Teste beide Orientierungen des ersten Features
  const scenarios = [
    { name: 'Original', firstFlipped: false },
    { name: 'Umgekehrt', firstFlipped: true }
  ];
  
  const results = scenarios.map(scenario => {
    let score = 0;
    let connections = 0;
    let totalGap = 0;
    
    // Kopiere das erste Feature und drehe es ggf. um
    const firstFeature = { ...features[0] };
    if (scenario.firstFlipped) {
      firstFeature.geometry = { 
        ...firstFeature.geometry, 
        coordinates: [...firstFeature.geometry.coordinates].reverse() 
      };
    }
    
    let lastEndPoint = firstFeature.geometry.coordinates[firstFeature.geometry.coordinates.length - 1];
    
    // Prüfe Verbindungen mit den nächsten Features (maximal 10)
    const maxCheck = Math.min(features.length - 1, 10);
    
    for (let i = 1; i <= maxCheck; i++) {
      const currentFeature = features[i];
      const coords = currentFeature.geometry.coordinates;
      const startPoint = coords[0];
      const endPoint = coords[coords.length - 1];
      
      const distanceToStart = calculateDistance(lastEndPoint, startPoint);
      const distanceToEnd = calculateDistance(lastEndPoint, endPoint);
      const minDistance = Math.min(distanceToStart, distanceToEnd);
      
      if (minDistance <= tolerance) {
        score += 10; // Gute Verbindung
      } else {
        score -= Math.floor(minDistance / 10); // Abzug für Lücken
      }
      
      totalGap += minDistance;
      connections++;
      
      // Aktualisiere lastEndPoint für nächste Iteration
      if (distanceToStart <= distanceToEnd) {
        lastEndPoint = endPoint;
      } else {
        lastEndPoint = startPoint;
      }
    }
    
    return {
      scenario: scenario.name,
      firstFlipped: scenario.firstFlipped,
      score,
      connections,
      averageGap: totalGap / connections,
      totalGap
    };
  });
  
  // Beste Option wählen
  const bestResult = results.reduce((best, current) => 
    current.score > best.score ? current : best
  );
  
  console.log(`   📊 Szenario "Original":   Score: ${results[0].score}, Ø Gap: ${results[0].averageGap.toFixed(2)}m`);
  console.log(`   📊 Szenario "Umgekehrt":  Score: ${results[1].score}, Ø Gap: ${results[1].averageGap.toFixed(2)}m`);
  console.log(`   🎯 Beste Option: ${bestResult.scenario} (Score: ${bestResult.score})`);
  
  return {
    bestScore: bestResult.score,
    shouldFlipFirst: bestResult.firstFlipped,
    details: `${bestResult.scenario} - Score: ${bestResult.score}, Ø Gap: ${bestResult.averageGap.toFixed(2)}m`
  };
}

/**
 * Analysiert und korrigiert die Richtung der LineString-Features
 * @param {Object} geojson - GeoJSON FeatureCollection
 * @param {number} tolerance - Toleranz in Metern
 * @returns {Object} Korrigierte GeoJSON und Statistiken
 */
function fixPathDirections(geojson, tolerance = 5) {
  const features = geojson.features.filter(f => f.geometry.type === 'LineString');
  
  if (features.length === 0) {
    throw new Error('Keine LineString-Features gefunden');
  }

  const result = {
    ...geojson,
    features: []
  };

  const stats = {
    totalFeatures: features.length,
    reversed: 0,
    gaps: [],
    warnings: []
  };

  console.log(`🔍 Analysiere ${features.length} LineString-Features...`);

  // Schritt 1: Optimale Startrichtung evaluieren
  const startEvaluation = evaluateStartOrientation(features, tolerance);
  
  // Erstes Feature entsprechend der Evaluation hinzufügen
  const firstFeature = { ...features[0] };
  if (startEvaluation.shouldFlipFirst) {
    console.log(`🔄 Erstes Feature wird umgekehrt (bessere Gesamtkohärenz)`);
    firstFeature.geometry.coordinates = firstFeature.geometry.coordinates.reverse();
    stats.reversed++;
  } else {
    console.log(`✅ Erstes Feature behält ursprüngliche Richtung`);
  }
  
  result.features.push(firstFeature);
  let lastEndPoint = firstFeature.geometry.coordinates[firstFeature.geometry.coordinates.length - 1];
  
  console.log(`📍 Startpunkt: [${lastEndPoint[0].toFixed(6)}, ${lastEndPoint[1].toFixed(6)}]`);

  // Alle weiteren Features analysieren
  for (let i = 1; i < features.length; i++) {
    const currentFeature = { ...features[i] };
    const coords = currentFeature.geometry.coordinates;
    const startPoint = coords[0];
    const endPoint = coords[coords.length - 1];
    
    const distanceToStart = calculateDistance(lastEndPoint, startPoint);
    const distanceToEnd = calculateDistance(lastEndPoint, endPoint);
    
    console.log(`\n🔗 Feature ${i + 1} (edge_id: ${currentFeature.properties.edge_id}):`);
    console.log(`   Distanz zu Start: ${distanceToStart.toFixed(2)}m`);
    console.log(`   Distanz zu Ende:  ${distanceToEnd.toFixed(2)}m`);

    if (coordinatesMatch(lastEndPoint, startPoint, tolerance)) {
      // Feature ist korrekt orientiert
      console.log(`   ✅ Korrekte Richtung`);
      result.features.push(currentFeature);
      lastEndPoint = endPoint;
      
    } else if (coordinatesMatch(lastEndPoint, endPoint, tolerance)) {
      // Feature muss umgedreht werden
      console.log(`   🔄 Richtung wird umgekehrt`);
      currentFeature.geometry.coordinates = coords.reverse();
      result.features.push(currentFeature);
      lastEndPoint = coords[coords.length - 1]; // Neuer Endpunkt nach Umkehrung
      stats.reversed++;
      
    } else {
      // Lücke im Pfad - prüfe auch kleinere Abstände genauer
      const minDistance = Math.min(distanceToStart, distanceToEnd);
      
      // Spezielle Behandlung für Features mit kleinen Abständen (aber außerhalb Toleranz)
      if (minDistance <= tolerance * 2) {
        console.log(`   🔍 Kleine Lücke erkannt (${minDistance.toFixed(2)}m) - prüfe Orientierung`);
        
        if (distanceToEnd < distanceToStart) {
          console.log(`   🔄 Richtung wird umgekehrt (kleinerer Abstand)`);
          currentFeature.geometry.coordinates = coords.reverse();
          lastEndPoint = coords[coords.length - 1];
          stats.reversed++;
        } else {
          console.log(`   ➡️  Richtung beibehalten (kleinerer Abstand)`);
          lastEndPoint = endPoint;
        }
      } else {
        console.log(`   ⚠️  Größere Lücke erkannt! Minimale Distanz: ${minDistance.toFixed(2)}m`);
        
        // Trotzdem die beste Orientierung wählen
        if (distanceToEnd < distanceToStart) {
          console.log(`   🔄 Richtung wird umgekehrt (beste Annäherung)`);
          currentFeature.geometry.coordinates = coords.reverse();
          lastEndPoint = coords[coords.length - 1];
          stats.reversed++;
        } else {
          console.log(`   ➡️  Richtung beibehalten (beste Annäherung)`);
          lastEndPoint = endPoint;
        }
      }
      
      stats.gaps.push({
        featureIndex: i,
        edgeId: currentFeature.properties.edge_id,
        distanceToStart,
        distanceToEnd,
        minDistance
      });
      
      result.features.push(currentFeature);
      
      stats.warnings.push(`Feature ${i + 1} (edge_id: ${currentFeature.properties.edge_id}) hat eine Lücke von ${minDistance.toFixed(2)}m`);
    }
  }

  // Zusätzliche Qualitätsprüfung
  console.log(`\n🔍 Zusätzliche Analyse:`);
  console.log(`   Startrichtung-Evaluation: ${startEvaluation.details}`);

  return { geojson: result, stats };
}

/**
 * Hauptfunktion
 */
function main() {
  const inputFile = process.argv[2] || 'public/test-paths.json';
  const outputFile = process.argv[3] || inputFile.replace('.json', '-fixed.json');
  const tolerance = parseFloat(process.argv[4]) || 10; // Standard: 10m Toleranz

  console.log(`📂 Eingabedatei: ${inputFile}`);
  console.log(`📂 Ausgabedatei: ${outputFile}`);
  console.log(`📏 Toleranz: ${tolerance}m\n`);

  try {
    // Datei einlesen
    const inputData = fs.readFileSync(inputFile, 'utf8');
    const geojson = JSON.parse(inputData);

    // Pfadrichtungen korrigieren
    const { geojson: fixedGeojson, stats } = fixPathDirections(geojson, tolerance);

    // Ergebnis speichern
    fs.writeFileSync(outputFile, JSON.stringify(fixedGeojson, null, 2));

    // Statistiken ausgeben
    console.log(`\n📊 Zusammenfassung:`);
    console.log(`   Gesamte Features: ${stats.totalFeatures}`);
    console.log(`   Umgedrehte Features: ${stats.reversed}`);
    console.log(`   Lücken im Pfad: ${stats.gaps.length}`);
    
    if (stats.gaps.length > 0) {
      console.log(`\n⚠️  Gefundene Lücken:`);
      stats.gaps.forEach(gap => {
        console.log(`   - Feature ${gap.featureIndex + 1} (edge_id: ${gap.edgeId}): ${gap.minDistance.toFixed(2)}m`);
      });
    }

    if (stats.warnings.length > 0) {
      console.log(`\n⚠️  Warnungen:`);
      stats.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    console.log(`\n✅ Korrigierte Datei gespeichert: ${outputFile}`);

  } catch (error) {
    console.error(`❌ Fehler: ${error.message}`);
    process.exit(1);
  }
}

// Hilfetext
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🛠️  Pfadrichtungs-Korrektur-Skript

Verwendung:
  node fix-path-direction.js [eingabe.json] [ausgabe.json] [toleranz]

Parameter:
  eingabe.json  - GeoJSON-Datei mit LineString-Features (Standard: public/test-paths.json)
  ausgabe.json  - Ausgabedatei (Standard: eingabe-fixed.json)
  toleranz      - Toleranz in Metern für Verbindungen (Standard: 10)

Beispiele:
  node fix-path-direction.js
  node fix-path-direction.js public/test-paths.json public/test-paths-fixed.json
  node fix-path-direction.js public/test-paths.json public/test-paths-fixed.json 5

Das Skript analysiert aufeinanderfolgende LineString-Features und korrigiert
ihre Richtung, so dass sie nahtlos aneinander anschließen.
  `);
  process.exit(0);
}

main();
