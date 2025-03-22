import { Nivellement, NivellementAuswertung, NivellementPunkt } from '../models/types';

// Hilfsfunktion, um den Punkttyp zu ermitteln
const getPunktTyp = (punktNr: string): 'MB' | 'W' | 'M' | 'unbekannt' => {
  if (punktNr.startsWith('MB')) return 'MB';
  if (punktNr.startsWith('W')) return 'W';
  if (punktNr.startsWith('M')) return 'M';
  return 'unbekannt';
};

// Berechnet Delta H für einen einzelnen Punkt, berücksichtigt verschiedene Punkttypen
// und optional die Korrekturen für Rückblickwerte
export const calculateDeltaH = (
  punkte: NivellementPunkt[],
  rowIndex: number,
  korrekturen: Record<number, number> = {}
): number | null => {
  const currentPunkt = punkte[rowIndex];
  
  if (!currentPunkt || !currentPunkt.punktNr) return null;
  const currentPunktTyp = getPunktTyp(currentPunkt.punktNr);

  // Finde den vorherigen Punkt, der ein W oder MB ist
  let prevPunkt: NivellementPunkt | null = null;
  let prevPunktIndex = -1;
  for (let i = rowIndex - 1; i >= 0; i--) {
    const punktTyp = getPunktTyp(punkte[i].punktNr);
    if (punktTyp === 'W' || punktTyp === 'MB') {
      prevPunkt = punkte[i];
      prevPunktIndex = i;
      break;
    }
  }

  // Wenn wir keinen vorherigen W oder MB Punkt finden und es kein MB1 ist, können wir kein Delta H berechnen
  if (!prevPunkt && currentPunktTyp !== 'MB') {
    return null;
  }

  // Hilfsfunktion, um Korrektur auf Rückblick anzuwenden (nur für deltaH-Berechnung)
  const applyRueckblickKorrektur = (rueckblick: number | null, index: number): number => {
    if (rueckblick === null) return 0;
    // Korrektur in mm zu m umrechnen und zum Rückblick addieren
    const korrektur = korrekturen[index] || 0;
    const korrekturInMeter = korrektur / 1000;
    return rueckblick + korrekturInMeter;
  };

  if (currentPunktTyp === 'MB') {
    // MB1 hat nur Rückblick, kein Delta H
    if (rowIndex === 0) {
      return null;
    }
    
    // MBn hat nur Vorblick, Delta H ist Rückblick des vorherigen Punkts - Vorblick des aktuellen
    const prevRow = punkte[rowIndex - 1];
    if (prevRow && currentPunkt.vorblick !== null) {
      const prevPunktTyp = getPunktTyp(prevRow.punktNr);
      if (prevPunktTyp === 'W' || prevPunktTyp === 'MB') {
        const korrigierterRueckblick = applyRueckblickKorrektur(prevRow.rueckblick, rowIndex - 1);
        return prevRow.rueckblick !== null ? korrigierterRueckblick - currentPunkt.vorblick : null;
      } else if (prevPunktTyp === 'M' && prevRow.mittelblick !== null) {
        return prevRow.mittelblick - currentPunkt.vorblick;
      }
    }
    return null;
  }

  if (currentPunktTyp === 'W') {
    // Wechselpunkt: Delta H ist Rückblick des vorherigen Punkts - Vorblick des aktuellen
    if (prevPunkt && prevPunkt.rueckblick !== null && currentPunkt.vorblick !== null) {
      const korrigierterRueckblick = applyRueckblickKorrektur(prevPunkt.rueckblick, prevPunktIndex);
      return korrigierterRueckblick - currentPunkt.vorblick;
    }
    return null;
  }

  if (currentPunktTyp === 'M') {
    // Mittelblick nach W/MB: Delta H ist Rückblick des vorherigen Punkts - Vorblick des aktuellen
    if (prevPunkt && prevPunkt.rueckblick !== null && currentPunkt.vorblick !== null) {
      const korrigierterRueckblick = applyRueckblickKorrektur(prevPunkt.rueckblick, prevPunktIndex);
      return korrigierterRueckblick - currentPunkt.vorblick;
    }
    
    // Mittelblick nach M: Delta H ist Mittelblick des vorherigen Punkts - Vorblick des aktuellen
    const prevRow = punkte[rowIndex - 1];
    if (prevRow && getPunktTyp(prevRow.punktNr) === 'M' && prevRow.mittelblick !== null && currentPunkt.vorblick !== null) {
      return prevRow.mittelblick - currentPunkt.vorblick;
    }
    return null;
  }

  return null;
};

// Berechnet die absolute Höhe basierend auf dem vorherigen Punkt und Delta H
export const calculateAbsoluteHoehe = (
  prevAbsoluteHoehe: number | null, 
  deltaH: number | null
): number | null => {
  if (prevAbsoluteHoehe === null || deltaH === null) return null;
  return prevAbsoluteHoehe + deltaH;
};

// Berechnet den zulässigen Fehler basierend auf der Streckenlänge (in km)
export const calculateZulaessigerFehler = (streckeLaenge: number): number => {
  // Formel: 15mm * √L (L in km) (basierend auf dem Beispiel)
  return 0.015 * Math.sqrt(streckeLaenge);
};

// Führt die komplette Nivellement-Auswertung durch
export const evaluateNivellement = (nivellement: Nivellement): NivellementAuswertung => {
  const { punkte, startHoehe, endHoehe, streckeLaenge } = nivellement;
  
  // Wechselpunkte und MB-Punkte filtern für Auswertung ohne Mittelblicke
  const wechselPunkte = punkte.filter(punkt => 
    getPunktTyp(punkt.punktNr) === 'W' || getPunktTyp(punkt.punktNr) === 'MB');
  
  // Summenwerte für Wechselpunkte berechnen (ohne Mittelblicke)
  const summeRueckblick = wechselPunkte.reduce((sum, punkt) => 
    sum + (punkt.rueckblick || 0), 0);
  
  const summeVorblick = wechselPunkte.reduce((sum, punkt) => 
    sum + (punkt.vorblick || 0), 0);
  
  // Delta H (Ist) = Summe Rückblick - Summe Vorblick (nur für Wechselpunkte)
  const deltaHIst = summeRueckblick - summeVorblick;
  
  // Delta H (Soll) = Endpunkt Höhe - Anfangspunkt Höhe
  const deltaHSoll = endHoehe - startHoehe;
  
  // Fehler v = Delta H (Soll) - Delta H (Ist) - basierend auf dem Beispiel
  const fehlerV = deltaHSoll - deltaHIst;
  
  // Zulässiger Fehler berechnen
  const zulaessigerFehlerV = calculateZulaessigerFehler(streckeLaenge);
  
  // Summe Delta H berechnen
  const summeDeltaH = punkte.reduce((sum, punkt) => 
    sum + (punkt.deltaH || 0), 0);
  
  // Prüfen, ob der Fehler zulässig ist
  const istFehlerZulaessig = Math.abs(fehlerV) <= zulaessigerFehlerV;
  
  // Prüfen, ob die Summe Delta H korrekt ist
  const istSummeDeltaHKorrekt = Math.abs(summeDeltaH - deltaHSoll) < 0.001;
  
  // Probe der Mittelblicke durch Prüfung der angrenzenden Höhen
  const probeMittelblicke = prüfeMittelblicke(punkte);
  
  return {
    summeRueckblick,
    summeVorblick,
    deltaHIst,
    deltaHSoll,
    fehlerV,
    zulaessigerFehlerV,
    istFehlerZulaessig,
    summeDeltaH,
    istSummeDeltaHKorrekt,
    probeMittelblicke
  };
};

// Prüft die Mittelblicke durch Vergleich der berechneten Höhen
const prüfeMittelblicke = (punkte: NivellementPunkt[]): boolean => {
  // Suche nach M-Punkten, die von W-Punkten umgeben sind
  for (let i = 0; i < punkte.length; i++) {
    const punkt = punkte[i];
    if (getPunktTyp(punkt.punktNr) !== 'M') continue;
    
    // Finde den nächsten W-Punkt nach diesem M-Punkt
    let nextWIndex = -1;
    for (let j = i + 1; j < punkte.length; j++) {
      if (getPunktTyp(punkte[j].punktNr) === 'W' || getPunktTyp(punkte[j].punktNr) === 'MB') {
        nextWIndex = j;
        break;
      }
    }
    
    if (nextWIndex > -1) {
      // Prüfe, ob die Höhe des W-Punkts durch direkte Berechnung vom M-Punkt erreichbar ist
      const mPunkt = punkt;
      const wPunkt = punkte[nextWIndex];
      
      if (mPunkt.mittelblick !== null && wPunkt.vorblick !== null && 
          mPunkt.absoluteHoehe !== null && wPunkt.absoluteHoehe !== null) {
        
        // Berechne den Höhenunterschied direkt: m - v
        const direkterHöhenunterschied = mPunkt.mittelblick - wPunkt.vorblick;
        
        // Berechne die erwartete absolute Höhe des W-Punkts
        const erwarteteHöhe = mPunkt.absoluteHoehe + direkterHöhenunterschied;
        
        // Prüfe, ob die erwartete Höhe mit der tatsächlichen Höhe übereinstimmt
        const höhenDifferenz = Math.abs(erwarteteHöhe - wPunkt.absoluteHoehe);
        if (höhenDifferenz > 0.001) { // Toleranz von 1mm
          return false;
        }
      }
    }
  }
  
  return true;
};

// Aktualisiert die Delta H und absolute Höhe Werte für alle Punkte
export const updateNivellementPunkte = (
  punkte: NivellementPunkt[],
  startHoehe: number,
  korrekturen: Record<number, number> = {}
): NivellementPunkt[] => {
  const updatedPunkte = [...punkte];
  
  // Erster Punkt erhält die Starthöhe
  if (updatedPunkte.length > 0) {
    updatedPunkte[0] = {
      ...updatedPunkte[0],
      absoluteHoehe: startHoehe
    };
  }
  
  // Berechne Delta H und absolute Höhe für alle Punkte
  for (let i = 0; i < updatedPunkte.length; i++) {
    // Delta H berechnen
    const deltaH = calculateDeltaH(updatedPunkte, i, korrekturen);
    updatedPunkte[i] = {
      ...updatedPunkte[i],
      deltaH
    };
    
    // Absolute Höhe berechnen (für alle Punkte außer dem ersten)
    if (i > 0 && deltaH !== null) {
      const prevPunkt = updatedPunkte[i - 1];
      if (prevPunkt.absoluteHoehe !== null) {
        // Für jeden Punkt außer dem letzten
        if (i < updatedPunkte.length - 1) {
          const absoluteHoehe = calculateAbsoluteHoehe(prevPunkt.absoluteHoehe, deltaH);
          updatedPunkte[i] = {
            ...updatedPunkte[i],
            absoluteHoehe
          };
        }
      }
    }
  }
  
  // Stelle sicher, dass der letzte Punkt seine ursprüngliche absolute Höhe behält
  // (wenn vorhanden, sonst berechnen wir sie)
  const lastIndex = updatedPunkte.length - 1;
  if (lastIndex > 0) {
    const lastPunkt = updatedPunkte[lastIndex];
    // Wenn der letzte Punkt eine MB-Markierung ist, behalten wir seine vorhandene Höhe bei
    if (lastPunkt.punktNr.startsWith('MB') && lastPunkt.absoluteHoehe !== null) {
      // absoluteHoehe bleibt unverändert
    } else {
      // Berechne die Höhe basierend auf dem vorherigen Punkt und Delta H
      const prevPunkt = updatedPunkte[lastIndex - 1];
      if (prevPunkt.absoluteHoehe !== null && lastPunkt.deltaH !== null) {
        const absoluteHoehe = calculateAbsoluteHoehe(prevPunkt.absoluteHoehe, lastPunkt.deltaH);
        updatedPunkte[lastIndex] = {
          ...updatedPunkte[lastIndex],
          absoluteHoehe
        };
      }
    }
  }
  
  return updatedPunkte;
}; 