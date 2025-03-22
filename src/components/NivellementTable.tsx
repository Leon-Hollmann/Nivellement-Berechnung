import { useState, useEffect, useRef } from 'react';
import { NivellementPunkt } from '../models/types';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { calculateDeltaH, calculateAbsoluteHoehe } from '../utils/calculations';

// Drag-Handle-Komponente
const DragHandle = () => (
  <div className="drag-handle">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 6H16M8 12H16M8 18H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </div>
);

// Sortierbare Tabellenzeile
interface SortableTableRowProps {
  punkt: NivellementPunkt;
  index: number;
  children: (dragHandleProps: any | null) => React.ReactNode;
  isStatic: boolean;
}

function SortableTableRow({ punkt, index, children, isStatic }: SortableTableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: `punkt-${index}`,
    disabled: isStatic
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 1 : 0,
  };

  const punktType = getPunktType(punkt.punktNr);
  
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'dragging' : ''} row-type-${punktType}`}
      data-punkt-type={punktType}
    >
      {children(isStatic ? null : { ...attributes, ...listeners })}
    </tr>
  );
}

// Hilfsfunktion zum Bestimmen des Punkttyps
const getPunktType = (punktNr: string) => {
  if (punktNr.startsWith('MB')) return 'MB';
  if (punktNr.startsWith('W')) return 'W';
  if (punktNr.startsWith('M')) return 'M';
  return '';
};

interface NivellementTableProps {
  punkte: NivellementPunkt[];
  onChange: (punkte: NivellementPunkt[]) => void;
  streckeLaenge?: number;
  onStreckeLaengeChange?: (streckeLaenge: number) => void;
  korrekturen?: Record<number, number>;
  onKorrekturenChange?: (korrekturen: Record<number, number>) => void;
}

// Hilfsfunktion zum Anzuwenden von Korrekturen auf deltaH
const applyKorrekturenToDeltaH = (
  punkte: NivellementPunkt[], 
  korrekturen: Record<number, number>
): NivellementPunkt[] => {
  if (Object.keys(korrekturen).length === 0) return punkte;
  
  const updatedPunkte = [...punkte];
  
  // Berechne deltaH für alle Punkte mit Korrekturen
  for (let i = 1; i < updatedPunkte.length; i++) {
    const deltaH = calculateDeltaH(updatedPunkte, i, korrekturen);
    updatedPunkte[i] = {
      ...updatedPunkte[i],
      deltaH
    };
  }
  
  // Berechne absolute Höhen für Wechselpunkte und MB-Punkte
  let lastWMBIndex = 0; // Start mit dem ersten Punkt (MB)
  for (let i = 1; i < updatedPunkte.length; i++) {
    const punktTyp = getPunktType(updatedPunkte[i].punktNr);
    
    if (punktTyp === 'W' || punktTyp === 'MB') {
      // Berechne die Höhe des Wechselpunkts basierend auf dem letzten Wechselpunkt
      if (updatedPunkte[lastWMBIndex].absoluteHoehe !== null && 
          updatedPunkte[i].deltaH !== null) {
        
        const absoluteHoehe = calculateAbsoluteHoehe(
          updatedPunkte[lastWMBIndex].absoluteHoehe, 
          updatedPunkte[i].deltaH
        );
        
        // Aktualisiere den Wechselpunkt (nicht für den letzten MB Punkt)
        if (!(i === updatedPunkte.length - 1 && punktTyp === 'MB')) {
          updatedPunkte[i] = {
            ...updatedPunkte[i],
            absoluteHoehe
          };
        }
      }
      
      // Setze diesen als letzten W/MB-Punkt
      lastWMBIndex = i;
    }
  }
  
  // Speziell für den Endpunkt (letzter MB-Punkt)
  // Finde den letzten Wechselpunkt vor dem Endpunkt
  let lastWIndex = -1;
  for (let i = updatedPunkte.length - 2; i >= 0; i--) {
    if (updatedPunkte[i].punktNr.startsWith('W')) {
      lastWIndex = i;
      break;
    }
  }
  
  // Wenn ein Wechselpunkt gefunden wurde und der Endpunkt ein MB-Punkt ist
  if (lastWIndex !== -1 && updatedPunkte[updatedPunkte.length - 1].punktNr.startsWith('MB')) {
    const endIndex = updatedPunkte.length - 1;
    const lastWPunkt = updatedPunkte[lastWIndex];
    const endPunkt = updatedPunkte[endIndex];
    
    // Berechne deltaH für den Endpunkt basierend auf dem letzten Wechselpunkt
    if (lastWPunkt.rueckblick !== null && endPunkt.vorblick !== null) {
      // Hilfsfunktion, um Korrektur auf Rückblick anzuwenden
      const applyRueckblickKorrektur = (rueckblick: number | null, index: number): number => {
        if (rueckblick === null) return 0;
        // Korrektur in mm zu m umrechnen und zum Rückblick addieren
        const korrektur = korrekturen[index] || 0;
        const korrekturInMeter = korrektur / 1000;
        return rueckblick + korrekturInMeter;
      };
      
      const korrigierterRueckblick = applyRueckblickKorrektur(lastWPunkt.rueckblick, lastWIndex);
      const deltaH = korrigierterRueckblick - endPunkt.vorblick;
      
      // Aktualisiere den deltaH-Wert des Endpunkts
      updatedPunkte[endIndex] = {
        ...endPunkt,
        deltaH
      };
    }
  }
  
  // Berechne absolute Höhen für Mittelblicke
  for (let i = 1; i < updatedPunkte.length; i++) {
    const punktTyp = getPunktType(updatedPunkte[i].punktNr);
    
    if (punktTyp === 'M') {
      // Direkt vom vorherigen Punkt ausgehen, egal ob W, MB oder M
      if (updatedPunkte[i-1].absoluteHoehe !== null && updatedPunkte[i].deltaH !== null) {
        const absoluteHoehe = calculateAbsoluteHoehe(updatedPunkte[i-1].absoluteHoehe, updatedPunkte[i].deltaH);
        updatedPunkte[i] = {
          ...updatedPunkte[i],
          absoluteHoehe
        };
      }
    }
  }
  
  return updatedPunkte;
};

const NivellementTable: React.FC<NivellementTableProps> = ({ 
  punkte, 
  onChange, 
  streckeLaenge: propStreckeLaenge, 
  onStreckeLaengeChange,
  korrekturen: propKorrekturen,
  onKorrekturenChange
}) => {
  // Referenzen für Start- und Endpunkt
  const [startPunkt, setStartPunkt] = useState({
    punktNr: punkte.length > 0 ? punkte[0].punktNr : 'MB25',
    absoluteHoehe: punkte.length > 0 ? punkte[0].absoluteHoehe : 145.321
  });
  
  const [endPunkt, setEndPunkt] = useState({
    punktNr: punkte.length > 0 ? punkte[punkte.length - 1].punktNr : 'MB27',
    absoluteHoehe: punkte.length > 0 ? punkte[punkte.length - 1].absoluteHoehe : 148.786
  });
  
  // Streckenlänge in km
  const [streckeLaenge, setStreckeLaenge] = useState<number | null>(propStreckeLaenge || null);

  // Wenn die Streckenlänge von den Props geändert wird, aktualisiere den lokalen State
  useEffect(() => {
    if (propStreckeLaenge !== undefined) {
      setStreckeLaenge(propStreckeLaenge);
    }
  }, [propStreckeLaenge]);

  // Aktualisiere die Parent-Komponente bei Änderungen der Streckenlänge
  const handleStreckeLaengeChange = (value: number | null) => {
    setStreckeLaenge(value);
    if (onStreckeLaengeChange) {
      onStreckeLaengeChange(value || 0);
    }
  };

  // Leere Zeile, die am Ende angezeigt wird
  const [newRow, setNewRow] = useState<NivellementPunkt>({
    punktNr: '',
    rueckblick: null,
    mittelblick: null,
    vorblick: null,
    deltaH: null,
    absoluteHoehe: null,
    bemerkung: '',
    korrektur: null
  });

  // Sensoren für Drag-and-Drop
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    })
  );

  // Refs für die Eingabefelder
  const rueckblickRef = useRef<HTMLInputElement>(null);
  const mittelblickRef = useRef<HTMLInputElement>(null);
  const vorblickRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (index: number, field: keyof NivellementPunkt, value: string) => {
    let updatedPunkte = [...punkte];
    
    if (field === 'punktNr') {
      // Bei Änderung des Punkt-Typs (W oder M)
      updatedPunkte[index] = {
        ...updatedPunkte[index],
        [field]: value
      };
      
      // Nummeriere Punkte neu nach Änderung des Typs
      updatedPunkte = renumberPoints(updatedPunkte);
    } else if (field === 'bemerkung') {
      updatedPunkte[index] = {
        ...updatedPunkte[index],
        [field]: value
      };
    } else {
      // Numerische Felder
      const numValue = value === '' ? null : parseFloat(value);
      updatedPunkte[index] = {
        ...updatedPunkte[index],
        [field]: numValue
      };
    }
    
    onChange(updatedPunkte);
  };

  // Funktion zum Ändern der Eingaben in der neuen Zeile
  const handleNewRowInputChange = (field: keyof NivellementPunkt, value: string) => {
    if (field === 'punktNr') {
      const newState = {
        ...newRow,
        [field]: value
      };
      setNewRow(newState);
      
      // Fokus zum passenden Feld basierend auf dem gewählten Punkttyp setzen
      setTimeout(() => {
        if (value === 'W' && rueckblickRef.current) {
          rueckblickRef.current.focus();
        } else if (value === 'M' && mittelblickRef.current) {
          mittelblickRef.current.focus();
        }
      }, 10);
    } else if (field === 'bemerkung') {
      setNewRow({
        ...newRow,
        [field]: value
      });
    } else {
      // Numerische Felder
      const numValue = value === '' ? null : parseFloat(value);
      setNewRow({
        ...newRow,
        [field]: numValue
      });
    }
  };

  // Verarbeitungsfunktion für das Ende eines Drag-Vorgangs
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const activeIndex = parseInt(active.id.toString().split('-')[1]);
      const overIndex = parseInt(over.id.toString().split('-')[1]);
      
      // Start- und Endpunkt nicht beeinflussen
      if (
        activeIndex === 0 || 
        activeIndex === punkte.length - 1 ||
        overIndex === 0 || 
        overIndex === punkte.length - 1
      ) return;
      
      let updatedPunkte = [...punkte];
      const [draggedItem] = updatedPunkte.splice(activeIndex, 1);
      updatedPunkte.splice(overIndex, 0, draggedItem);
      
      // Nummeriere alle Punkte neu
      updatedPunkte = renumberPoints(updatedPunkte);
      
      // Aktualisiere displayPunkte sofort, um Fehler zu vermeiden
      setDisplayPunkte(applyKorrekturenToDeltaH(updatedPunkte, fehlerKorrekturen));
      
      onChange(updatedPunkte);
    }
  };

  const removeRow = (index: number) => {
    // Der erste Punkt (MB Start) und der letzte Punkt (MB Ende) dürfen nicht gelöscht werden
    if (index === 0 || index === punkte.length - 1) {
      return;
    }
    
    let updatedPunkte = punkte.filter((_, i) => i !== index);
    
    // Nummeriere alle Punkte neu
    updatedPunkte = renumberPoints(updatedPunkte);
    
    // Aktualisiere displayPunkte sofort, um Fehler zu vermeiden
    setDisplayPunkte(applyKorrekturenToDeltaH(updatedPunkte, fehlerKorrekturen));
    
    onChange(updatedPunkte);
  };
  
  // Hilfsfunktion, um zu prüfen, ob ein Feld editierbar sein soll
  const isFieldEditable = (punktNr: string, field: 'rueckblick' | 'mittelblick' | 'vorblick', index: number, lastIndex: number) => {
    if (punktNr.startsWith('MB')) {
      // MB am Anfang hat nur Rückblick
      if (index === 0) {
        return field === 'rueckblick';
      }
      // MB am Ende hat nur Vorblick
      if (index === lastIndex) {
        return field === 'vorblick';
      }
    } else if (punktNr.startsWith('W')) {
      // W-Punkte haben immer Rückblick und Vorblick, nie Mittelblick
      return field === 'rueckblick' || field === 'vorblick';
    } else if (punktNr.startsWith('M')) {
      // M-Punkte haben nur Mittelblick
      return field === 'mittelblick';
    }
    
    // Im Zweifelsfall erlauben wir das Editieren
    return true;
  };

  // Berechnungsfunktionen für die Zusammenfassung
  const calculateSummeRueckblick = (): number => {
    // Nur W-Punkte und MB-Punkte in die Berechnung einbeziehen
    return punkte
      .filter(punkt => punkt.punktNr.startsWith('W') || punkt.punktNr.startsWith('MB'))
      .reduce((sum, punkt) => sum + (punkt.rueckblick || 0), 0);
  };

  const calculateSummeVorblick = (): number => {
    // Nur W-Punkte und MB-Punkte in die Berechnung einbeziehen
    return punkte
      .filter(punkt => punkt.punktNr.startsWith('W') || punkt.punktNr.startsWith('MB'))
      .reduce((sum, punkt) => sum + (punkt.vorblick || 0), 0);
  };

  const calculateSummeDeltaH = (): number => {
    // Nur Wechselpunkte und MB-Punkte in die Berechnung einbeziehen
    return displayPunkte.filter(punkt => 
      punkt.punktNr.startsWith('W') || punkt.punktNr.startsWith('MB')
    ).reduce((sum, punkt) => sum + (punkt.deltaH || 0), 0);
  };

  const calculateDeltaHIst = (): number => {
    return calculateSummeRueckblick() - calculateSummeVorblick();
  };

  const calculateDeltaHSoll = (): number => {
    if (punkte.length < 2) return 0;
    const startHoehe = punkte[0].absoluteHoehe || 0;
    const endHoehe = punkte[punkte.length - 1].absoluteHoehe || 0;
    return endHoehe - startHoehe;
  };

  const calculateFehlerV = (): number => {
    return calculateDeltaHSoll() - calculateDeltaHIst();
  };

  const calculateZulaessigerFehler = (): number => {
    // Verwende die eingegebene Streckenlänge in km
    return streckeLaenge ? 0.015 * Math.sqrt(streckeLaenge) : 0;
  };

  const isFehlerZulaessig = (): boolean => {
    return Math.abs(calculateFehlerV()) <= calculateZulaessigerFehler();
  };

  const isSummeDeltaHKorrekt = (): boolean => {
    return Math.abs(calculateSummeDeltaH() - calculateDeltaHSoll()) < 0.001;
  };

  // Neue Funktion, um alle Mittelblick-Proben auszuführen und Details zurückzugeben
  const getMittelblickProben = () => {
    const proben: {
      mPunktNr: string;
      wPunktNr: string;
      mHoehe: number | null;
      wHoehe: number | null;
      mBlick: number | null;
      vBlick: number | null;
      hoehendifferenz: number | null;
      erwarteteHoehe: number | null;
      differenz: number | null;
      korrekt: boolean;
    }[] = [];
    
    for (let i = 0; i < punkte.length; i++) {
      const punkt = punkte[i];
      // Überspringe MB-Startpunkt und alle Punkte, die nicht mit M beginnen
      if (i === 0 || !punkt.punktNr.startsWith('M')) continue;
      
      // Finde den nächsten W-Punkt nach diesem M-Punkt
      let nextWIndex = -1;
      for (let j = i + 1; j < punkte.length; j++) {
        if (punkte[j].punktNr.startsWith('W') || punkte[j].punktNr.startsWith('MB')) {
          nextWIndex = j;
          break;
        }
      }
      
      if (nextWIndex > -1) {
        const mPunkt = punkt;
        const wPunkt = punkte[nextWIndex];
        
        // Verwende die korrigierten Höhen aus displayPunkte
        const mDisplayPunkt = displayPunkte[i];
        const wDisplayPunkt = displayPunkte[nextWIndex];
        
        let probe = {
          mPunktNr: mPunkt.punktNr,
          wPunktNr: wPunkt.punktNr,
          mHoehe: mDisplayPunkt.absoluteHoehe, // Korrigierte Höhe verwenden
          wHoehe: wDisplayPunkt.absoluteHoehe, // Korrigierte Höhe verwenden
          mBlick: mPunkt.mittelblick,
          vBlick: wPunkt.vorblick,
          hoehendifferenz: null as number | null,
          erwarteteHoehe: null as number | null,
          differenz: null as number | null,
          korrekt: false
        };
        
        if (mPunkt.mittelblick !== null && wPunkt.vorblick !== null && 
            mDisplayPunkt.absoluteHoehe !== null && wDisplayPunkt.absoluteHoehe !== null) {
          
          // Berechne den Höhenunterschied: m - v
          const hoehendifferenz = mPunkt.mittelblick - wPunkt.vorblick;
          
          // Berechne die erwartete absolute Höhe des W-Punkts
          const erwarteteHoehe = mDisplayPunkt.absoluteHoehe + hoehendifferenz;
          
          // Prüfe, ob die erwartete Höhe mit der tatsächlichen Höhe übereinstimmt
          const differenz = erwarteteHoehe - wDisplayPunkt.absoluteHoehe;
          const korrekt = Math.abs(differenz) <= 0.001; // Toleranz von 1mm
          
          probe = {
            ...probe,
            hoehendifferenz,
            erwarteteHoehe,
            differenz,
            korrekt
          };
        }
        
        proben.push(probe);
      }
    }
    
    return proben;
  };

  // Funktion zum Bestimmen des neuen Punkttyps basierend auf dem vorherigen Punkt
  const getNewPunktTyp = (prevPunkt: NivellementPunkt) => {
    if (prevPunkt.punktNr.startsWith('MB')) {
      return 'W';
    } else if (prevPunkt.punktNr.startsWith('W')) {
      return 'M';
    } else if (prevPunkt.punktNr.startsWith('M')) {
      return 'W';
    }
    
    return 'W';
  };

  // Nummeriere alle Punkte neu basierend auf ihrer Position
  const renumberPoints = (points: NivellementPunkt[]): NivellementPunkt[] => {
    let wCount = 0;
    let mCount = 0;
    
    return points.map(point => {
      // MB-Punkte nicht verändern
      if (point.punktNr.startsWith('MB')) {
        return point;
      }
      
      // Nur den Präfix (W oder M) extrahieren
      const prefix = point.punktNr.charAt(0);
      
      if (prefix === 'W') {
        wCount++;
        return {
          ...point,
          punktNr: `W${wCount}`
        };
      } else if (prefix === 'M') {
        mCount++;
        return {
          ...point,
          punktNr: `M${mCount}`
        };
      }
      
      return point;
    });
  };

  // Funktion zum Hinzufügen der Zeile mit anschließender Neunummerierung
  const addNewRow = () => {
    if (newRow.punktNr && (newRow.punktNr === 'W' || newRow.punktNr === 'M')) {
      // Speichere den aktuell gewählten Punkttyp
      const currentPunktTyp = newRow.punktNr;
      
      // Füge die neue Zeile vor dem letzten Punkt ein
      let updatedPunkte = [...punkte.slice(0, -1), newRow, punkte[punkte.length - 1]];
      
      // Nummeriere alle Punkte neu
      updatedPunkte = renumberPoints(updatedPunkte);
      
      // Aktualisiere auch displayPunkte sofort, um Fehler zu vermeiden
      setDisplayPunkte(applyKorrekturenToDeltaH(updatedPunkte, fehlerKorrekturen));
      
      // Informiere die übergeordnete Komponente über die Änderung
      onChange(updatedPunkte);
      
      // Setze die neue Zeile zurück, aber behalte den Punkttyp bei
      setNewRow({
        punktNr: currentPunktTyp, // Behalte den aktuellen Punkttyp bei
        rueckblick: null,
        mittelblick: null,
        vorblick: null,
        deltaH: null,
        absoluteHoehe: null,
        bemerkung: '',
        korrektur: null
      });
      
      // Setze den Fokus auf das passende Eingabefeld basierend auf dem Punkttyp
      setTimeout(() => {
        if (currentPunktTyp === 'W' && rueckblickRef.current) {
          rueckblickRef.current.focus();
        } else if (currentPunktTyp === 'M' && mittelblickRef.current) {
          mittelblickRef.current.focus();
        }
      }, 10);
    }
  };

  // Event-Handler für Tastenkombination Strg+Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prüfe, ob Strg+Enter gedrückt wurde
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault(); // Verhindere Standardverhalten
      addNewRow();
    }
    
    // Dropdown-Werte mit Strg+Pfeil hoch/runter wechseln
    if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault(); // Verhindere Standardverhalten
      
      // Wechsle zwischen W und M
      if (newRow.punktNr === 'W') {
        handleNewRowInputChange('punktNr', 'M');
      } else {
        handleNewRowInputChange('punktNr', 'W');
      }
    }
  };

  // Initialisiere die neue Zeile mit einem vorgeschlagenen Punkttyp, falls leer
  if (!newRow.punktNr && punkte.length > 0) {
    const lastPunktInTable = punkte[punkte.length - 2]; // Vorletzter Punkt (vor dem MB-Ende)
    if (lastPunktInTable) {
      const suggestedType = getNewPunktTyp(lastPunktInTable);
      setNewRow(prev => ({
        ...prev,
        punktNr: suggestedType
      }));
    }
  }

  // IDs für SortableContext
  const punkteIds = punkte.map((_, index) => `punkt-${index}`);

  const handleStartPunktChange = (field: 'punktNr' | 'absoluteHoehe', value: string) => {
    const newValue = field === 'absoluteHoehe' ? parseFloat(value) : value;
    setStartPunkt({
      ...startPunkt,
      [field]: newValue
    });
    
    // Aktualisiere den ersten Punkt in der Tabelle
    let updatedPunkte = [...punkte];
    updatedPunkte[0] = {
      ...updatedPunkte[0],
      punktNr: field === 'punktNr' ? value : updatedPunkte[0].punktNr,
      absoluteHoehe: field === 'absoluteHoehe' ? parseFloat(value) : updatedPunkte[0].absoluteHoehe
    };
    
    onChange(updatedPunkte);
  };
  
  const handleEndPunktChange = (field: 'punktNr' | 'absoluteHoehe', value: string) => {
    const newValue = field === 'absoluteHoehe' ? parseFloat(value) : value;
    setEndPunkt({
      ...endPunkt,
      [field]: newValue
    });
    
    // Aktualisiere den letzten Punkt in der Tabelle
    let updatedPunkte = [...punkte];
    const lastIndex = updatedPunkte.length - 1;
    updatedPunkte[lastIndex] = {
      ...updatedPunkte[lastIndex],
      punktNr: field === 'punktNr' ? value : updatedPunkte[lastIndex].punktNr,
      absoluteHoehe: field === 'absoluteHoehe' ? parseFloat(value) : updatedPunkte[lastIndex].absoluteHoehe
    };
    
    onChange(updatedPunkte);
  };

  // State für Fehlerverteilung
  const [fehlerKorrekturen, setFehlerKorrekturen] = useState<Record<number, number>>(propKorrekturen || {});

  // Füge Korrektur zu einem einzelnen Wechselpunkt hinzu
  const addPunktKorrektur = (index: number, positiv: boolean) => {
    // Standardwert für Korrektur in mm (1 mm statt 0.1 mm)
    const korrekturWert = positiv ? 1 : -1;
    
    const updatedKorrekturen = {
      ...fehlerKorrekturen,
      [index]: (fehlerKorrekturen[index] || 0) + korrekturWert
    };
    
    setFehlerKorrekturen(updatedKorrekturen);
    
    // Informiere die Elternkomponente über die Änderung der Korrekturen
    if (onKorrekturenChange) {
      onKorrekturenChange(updatedKorrekturen);
    }
  };

  // Zurücksetzen der Korrekturen
  const resetKorrekturen = () => {
    setFehlerKorrekturen({});
    
    // Informiere die Elternkomponente über die Änderung der Korrekturen
    if (onKorrekturenChange) {
      onKorrekturenChange({});
    }
  };

  // Berechne die Summe aller aktuellen Korrekturen in mm
  const calculateGesamtKorrektur = (): number => {
    if (Object.keys(fehlerKorrekturen).length === 0) return 0;
    
    return Object.values(fehlerKorrekturen).reduce((sum, korrektur) => sum + korrektur, 0);
  };

  // Anzeige-Punkte mit angewendeten Korrekturen für deltaH
  const [displayPunkte, setDisplayPunkte] = useState<NivellementPunkt[]>(punkte);
  
  // Aktualisiere displayPunkte, wenn sich punkte oder fehlerKorrekturen ändern
  useEffect(() => {
    const updatedDisplayPunkte = applyKorrekturenToDeltaH(punkte, fehlerKorrekturen);
    setDisplayPunkte(updatedDisplayPunkte);
  }, [punkte, fehlerKorrekturen]);

  // Aktualisiere den lokalen State, wenn sich die Props ändern
  useEffect(() => {
    if (propKorrekturen && JSON.stringify(propKorrekturen) !== JSON.stringify(fehlerKorrekturen)) {
      setFehlerKorrekturen(propKorrekturen);
    }
  }, [propKorrekturen]);

  // State für Mittelblick-Proben Sichtbarkeit
  const [mittelblickProbenVisible, setMittelblickProbenVisible] = useState<boolean>(false);

  // Prüft, ob alle Mittelblick-Proben korrekt sind
  const probenAlleKorrekt = (): boolean => {
    const proben = getMittelblickProben();
    return proben.length > 0 && proben.every(probe => probe.korrekt);
  };
  
  // Gibt die Anzahl fehlerhafter Proben zurück
  const getFehlerCount = (): number => {
    const proben = getMittelblickProben();
    return proben.filter(probe => !probe.korrekt).length;
  };

  return (
    <>
      <div className="nivellement-setup">
        <div className="setup-container">
          <div className="start-punkt-container">
            <h4>Startpunkt</h4>
            <div className="punkt-config">
              <div className="input-group">
                <label>Punkt Nr.:</label>
                <input 
                  type="text" 
                  value={startPunkt.punktNr} 
                  onChange={(e) => handleStartPunktChange('punktNr', e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Absolute Höhe [m]:</label>
                <input 
                  type="number" 
                  step="0.001" 
                  value={startPunkt.absoluteHoehe || ''} 
                  onChange={(e) => handleStartPunktChange('absoluteHoehe', e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="end-punkt-container">
            <h4>Endpunkt</h4>
            <div className="punkt-config">
              <div className="input-group">
                <label>Punkt Nr.:</label>
                <input 
                  type="text" 
                  value={endPunkt.punktNr} 
                  onChange={(e) => handleEndPunktChange('punktNr', e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Absolute Höhe [m]:</label>
                <input 
                  type="number" 
                  step="0.001" 
                  value={endPunkt.absoluteHoehe || ''} 
                  onChange={(e) => handleEndPunktChange('absoluteHoehe', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="setup-container strecke-wrapper">
          <div className="strecke-container">
            <div className="input-group">
              <label>Streckenlänge [km]:</label>
              <input 
                type="number" 
                step="0.001" 
                min="0.001"
                value={streckeLaenge !== null ? streckeLaenge : ''}
                onChange={(e) => handleStreckeLaengeChange(e.target.value === '' ? null : parseFloat(e.target.value))} 
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="nivellement-table">
        <style>
          {`
            /* Alignment Styles */
            .row-type-MB td:nth-child(2) input, .row-type-MB td:nth-child(2) span {
              text-align: center;
            }
            .row-type-W td:nth-child(2) input, .row-type-W td:nth-child(2) span, 
            .row-type-W td:nth-child(2) div {
              text-align: right;
            }
            .row-type-M td:nth-child(2) input, .row-type-M td:nth-child(2) span, 
            .row-type-M td:nth-child(2) div {
              text-align: left;
            }
            
            /* Alignment für Zahlenwerte */
            .row-type-MB td:nth-child(3) input, .row-type-MB td:nth-child(4) input, 
            .row-type-MB td:nth-child(5) input, .row-type-MB td:nth-child(6) span, 
            .row-type-MB td:nth-child(7) span,
            .row-type-W td:nth-child(3) input, .row-type-W td:nth-child(4) input, 
            .row-type-W td:nth-child(5) input, .row-type-W td:nth-child(6) span, 
            .row-type-W td:nth-child(7) span {
              text-align: right;
            }
            .row-type-M td:nth-child(3) input, .row-type-M td:nth-child(4) input, 
            .row-type-M td:nth-child(5) input, .row-type-M td:nth-child(6) span, 
            .row-type-M td:nth-child(7) span {
              text-align: left;
            }
            
            /* Alignment für Bemerkungen */
            .row-type-MB td:nth-child(8) input, .row-type-W td:nth-child(8) input, 
            .row-type-M td:nth-child(8) input {
              text-align: center;
            }
            
            /* Alignment für die neue Zeile */
            .new-row td:nth-child(8) input {
              text-align: center;
            }
            
            /* Styling für die Setup-Container */
            .nivellement-setup {
              margin-bottom: 20px;
            }
            
            .setup-container {
              display: flex;
              justify-content: space-between;
              gap: 20px;
            }
            
            .start-punkt-container, .end-punkt-container {
              flex: 1;
              padding: 15px;
              border: 1px solid #ccc;
              border-radius: 5px;
              background-color: #f9f9f9;
            }
            
            .punkt-config {
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            
            .input-group {
              display: flex;
              align-items: center;
            }
            
            .input-group label {
              width: 150px;
              font-weight: bold;
            }
            
            .input-group input {
              flex: 1;
              padding: 5px;
            }
            
            /* Hervorhebung der Start- und Endzeilen in der Tabelle */
            tr[data-punkt-type="MB"]:first-child td:not(:last-child) {
              background-color: #f0f7ff;
              border-top: 2px solid #4a90e2;
              border-bottom: 2px solid #4a90e2;
            }
            
            tr[data-punkt-type="MB"]:last-child td:not(:last-child) {
              background-color: #f7f0ff;
              border-top: 2px solid #9c4ae2;
              border-bottom: 2px solid #9c4ae2;
            }
            
            /* Spezifischer Style für die Aktionen-Spalte */
            tr[data-punkt-type="MB"] td:last-child {
              background-color: transparent;
              border-top: none;
              border-bottom: none;
            }
            
            /* Hervorhebung der Absolutwerte für Start und Ende */
            tr[data-punkt-type="MB"]:first-child td:nth-child(7) span {
              font-weight: bold;
              color: #4a90e2;
            }
            
            tr[data-punkt-type="MB"]:last-child td:nth-child(7) span {
              font-weight: bold;
              color: #9c4ae2;
            }
            
            /* CSS für das geteilte Tabellenlayout */
            .nivellement-table {
              overflow-x: auto;
            }
            
            .nivellement-table table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 0;
              table-layout: fixed;
            }
            
            .nivellement-table .data-table,
            .nivellement-table .new-row-table {
              border-top: none;
            }
            
            .nivellement-table table th {
              position: sticky;
              top: 0;
              background-color: #f2f2f2;
              z-index: 10;
              padding: 8px 10px;
              font-weight: bold;
              text-align: center;
            }
            
            .nivellement-table table td {
              padding: 6px 10px;
              vertical-align: middle;
            }
            
            /* Exakte Spaltenbreiten für alle drei Tabellen */
            .nivellement-table table colgroup {
              display: table-column-group;
            }
            
            .nivellement-table table col.col-handle { width: 40px; }
            .nivellement-table table col.col-punkt-nr { width: 110px; }
            .nivellement-table table col.col-rueckblick { width: 120px; }
            .nivellement-table table col.col-mittelblick { width: 120px; }
            .nivellement-table table col.col-vorblick { width: 120px; }
            .nivellement-table table col.col-delta-h { width: 105px; }
            .nivellement-table table col.col-abs-hoehe { width: 120px; }
            .nivellement-table table col.col-bemerkung { width: 160px; }
            .nivellement-table table col.col-aktionen { width: 90px; }
            
            /* Eingabefelder und Selects formatieren */
            .nivellement-table table input,
            .nivellement-table table select {
              width: 100%;
              box-sizing: border-box;
              padding: 4px 6px;
              border: 1px solid #ccc;
              border-radius: 3px;
            }
            
            /* Entferne Pfeile bei Zahlenfeldern */
            .nivellement-table table input[type="number"] {
              -moz-appearance: textfield;
            }
            
            .nivellement-table table input[type="number"]::-webkit-outer-spin-button,
            .nivellement-table table input[type="number"]::-webkit-inner-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            
            /* Verbessere die Darstellung für Zahleneingaben */
            .nivellement-table table input[type="number"] {
              text-overflow: ellipsis;
              font-family: monospace;
              font-size: 14px;
              text-align: right;
              letter-spacing: 0.5px;
            }
            
            /* Verbessere die Darstellung von berechneten Zahlenwerten */
            .nivellement-table td span:not(.korrektur-wert):not(.punkt-nummer) {
              font-family: monospace;
              font-size: 14px;
              letter-spacing: 0.5px;
              display: block;
              text-align: right;
            }
            
            /* Punkt-Typ Flex-Container */
            .punkt-type-container {
              display: flex;
              align-items: center;
              width: 100%;
            }
            
            .punkt-type-container select {
              width: auto;
              min-width: 45px;
              max-width: 55px;
            }
            
            .punkt-nummer {
              margin-left: 4px;
              white-space: nowrap;
            }
            
            /* Button-Styling verbessern */
            .delete-button, .add-button {
              width: 100%;
              padding: 4px 8px;
              cursor: pointer;
            }
            
            .delete-button {
              background-color: #e74c3c;
              color: white;
              border: none;
              border-radius: 4px;
            }
            
            .add-button {
              background-color: #27ae60;
              color: white;
              border: none;
              border-radius: 4px;
            }
            
            /* Spezifische Styling für disabled inputs */
            .disabled-input {
              background-color: #f9f9f9;
              color: #999;
              border-color: #ddd;
            }
            
            /* Drag-Handle Styling */
            .static-handle {
              opacity: 0.5;
              cursor: not-allowed;
            }
            
            .drag-handle {
              cursor: grab;
              display: flex;
              justify-content: center;
              align-items: center;
              color: #777;
            }
            
            /* Dropdown in der neuen Zeile */
            .new-row-dropdown {
              max-width: 150px;
            }
            
            .new-row select {
              max-width: 150px;
            }
            
            /* Styles für Fehlerkorrektur-Buttons */
            .korrektur-container {
              display: flex;
              align-items: center;
              margin-left: 8px;
            }
            
            .korrektur-buttons {
              display: flex;
              flex-direction: column;
              margin-left: 4px;
            }
            
            .korrektur-button {
              background-color: #f0f0f0;
              border: 1px solid #ccc;
              width: 20px;
              height: 20px;
              font-size: 14px;
              line-height: 1;
              padding: 0;
              margin: 1px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .korrektur-button:hover {
              background-color: #e0e0e0;
            }
            
            .korrektur-wert {
              color: red;
              font-size: 0.8em;
              margin-left: 4px;
              white-space: nowrap;
            }
            
            /* Zusätzliche Styles für die Korrektur-Aktions-Buttons */
            .korrektur-actions {
              display: flex;
              gap: 8px;
              margin-top: 10px;
            }
            
            .korrektur-apply-button, .korrektur-reset-button {
              padding: 5px 10px;
              border-radius: 4px;
              cursor: pointer;
            }
            
            .korrektur-apply-button {
              background-color: #4caf50;
              color: white;
              border: none;
            }
            
            .korrektur-reset-button {
              background-color: #f44336;
              color: white;
              border: none;
            }
            
            .fehlerverteilung-container {
              border: 1px solid #ddd;
              border-radius: 5px;
              padding: 10px;
              margin-top: 15px;
              background-color: #f9f9f9;
            }
            
            .fehlerverteilung-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            }
            
            .fehlerverteilung-header h4 {
              margin: 0;
            }
            
            .korrektur-status {
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
              margin-bottom: 10px;
            }
            
            .korrektur-status-item {
              display: flex;
              align-items: center;
            }
            
            .korrektur-status-label {
              font-weight: bold;
              margin-right: 5px;
            }
            
            .korrektur-status-value {
              font-family: monospace;
            }
            
            .korrektur-status-value.positiv {
              color: #2e7d32;
            }
            
            .korrektur-status-value.negativ {
              color: #c62828;
            }

            .manual-corrections-container {
              border: 1px solid #ddd;
              border-radius: 5px;
              padding: 10px;
              margin-top: 15px;
              background-color: #f9f9f9;
            }
            
            .korrektur-status {
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
              margin-bottom: 10px;
            }
            
            .korrektur-status-item {
              display: flex;
              align-items: center;
            }
            
            .korrektur-status-label {
              font-weight: bold;
              margin-right: 5px;
            }
            
            .korrektur-status-value {
              font-family: monospace;
            }
            
            .korrektur-status-value.positiv {
              color: #2e7d32;
            }
            
            .korrektur-status-value.negativ {
              color: #c62828;
            }
          `}
        </style>
        <table>
          <colgroup>
            <col className="col-handle" />
            <col className="col-punkt-nr" />
            <col className="col-rueckblick" />
            <col className="col-mittelblick" />
            <col className="col-vorblick" />
            <col className="col-delta-h" />
            <col className="col-abs-hoehe" />
            <col className="col-bemerkung" />
            <col className="col-aktionen" />
          </colgroup>
          <thead>
            <tr>
              <th></th>{/* Spalte für Drag-Handle */}
              <th>Punkt Nr.</th>
              <th>Rückblick [r]</th>
              <th>Mittelblick [m]</th>
              <th>Vorblick [v]</th>
              <th>Δh</th>
              <th>Absolute Höhe h</th>
              <th>Bemerkung</th>
              <th>Aktionen</th>
            </tr>
          </thead>
        </table>
        
        {/* DndContext außerhalb der Tabelle platzieren */}
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={punkteIds} 
            strategy={verticalListSortingStrategy}
          >
            <table className="data-table">
              <colgroup>
                <col className="col-handle" />
                <col className="col-punkt-nr" />
                <col className="col-rueckblick" />
                <col className="col-mittelblick" />
                <col className="col-vorblick" />
                <col className="col-delta-h" />
                <col className="col-abs-hoehe" />
                <col className="col-bemerkung" />
                <col className="col-aktionen" />
              </colgroup>
              <tbody>
                {punkte.map((punkt, index) => {
                  // Sicherstellen, dass displayPunkte[index] existiert
                  const displayPunkt = displayPunkte[index] || punkt;
                  const isStatic = index === 0 || index === punkte.length - 1;
                  const isWechselpunkt = punkt.punktNr.startsWith('W');
                  const korrekturWert = fehlerKorrekturen[index];
                  
                  return (
                    <SortableTableRow 
                      key={`punkt-${index}`} 
                      punkt={punkt} 
                      index={index} 
                      isStatic={isStatic}
                    >
                      {(dragHandleProps) => (<>
                          <td className="drag-handle-cell">
                            {!isStatic && (
                              <div {...dragHandleProps}>
                                <DragHandle />
                              </div>
                            )}
                          </td>
                          <td>
                            {punkt.punktNr.startsWith('MB') ? (
                              <input
                                type="text"
                                value={punkt.punktNr}
                                onChange={(e) => handleInputChange(index, 'punktNr', e.target.value)}
                                disabled={isStatic}
                              />
                            ) : (
                              <div className="punkt-type-container">
                                <select
                                  value={punkt.punktNr.charAt(0)}
                                  onChange={(e) => handleInputChange(index, 'punktNr', e.target.value)}
                                  disabled={isStatic}
                                >
                                  <option value="W">W</option>
                                  <option value="M">M</option>
                                </select>
                                <span className="punkt-nummer">{punkt.punktNr.substring(1)}</span>
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <input
                                type="number"
                                step="0.001"
                                value={punkt.rueckblick !== null ? punkt.rueckblick : ''}
                                onChange={(e) => handleInputChange(index, 'rueckblick', e.target.value)}
                                disabled={!isFieldEditable(punkt.punktNr, 'rueckblick', index, punkte.length - 1)}
                                className={!isFieldEditable(punkt.punktNr, 'rueckblick', index, punkte.length - 1) ? 'disabled-input' : ''}
                              />
                              
                              {(isWechselpunkt || (index === 0 && punkt.punktNr.startsWith('MB'))) && isFieldEditable(punkt.punktNr, 'rueckblick', index, punkte.length - 1) && (
                                <div className="korrektur-container">
                                  {korrekturWert !== undefined && korrekturWert !== 0 && (
                                    <span className="korrektur-wert">
                                      {korrekturWert > 0 ? '+' : ''}{Math.round(korrekturWert)}
                                    </span>
                                  )}
                                  <div className="korrektur-buttons">
                                    <button 
                                      className="korrektur-button" 
                                      onClick={() => addPunktKorrektur(index, true)}
                                      title="Korrektur erhöhen (+1 mm)"
                                    >
                                      +
                                    </button>
                                    <button 
                                      className="korrektur-button" 
                                      onClick={() => addPunktKorrektur(index, false)}
                                      title="Korrektur verringern (-1 mm)"
                                    >
                                      -
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.001"
                              value={punkt.mittelblick !== null ? punkt.mittelblick : ''}
                              onChange={(e) => handleInputChange(index, 'mittelblick', e.target.value)}
                              disabled={!isFieldEditable(punkt.punktNr, 'mittelblick', index, punkte.length - 1)}
                              className={!isFieldEditable(punkt.punktNr, 'mittelblick', index, punkte.length - 1) ? 'disabled-input' : ''}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.001"
                              value={punkt.vorblick !== null ? punkt.vorblick : ''}
                              onChange={(e) => handleInputChange(index, 'vorblick', e.target.value)}
                              disabled={!isFieldEditable(punkt.punktNr, 'vorblick', index, punkte.length - 1)}
                              className={!isFieldEditable(punkt.punktNr, 'vorblick', index, punkte.length - 1) ? 'disabled-input' : ''}
                            />
                          </td>
                          <td>
                            <span>{displayPunkt.deltaH !== null ? displayPunkt.deltaH.toFixed(3) : '-'}</span>
                          </td>
                          <td>
                            {(index === 0) ? (
                              <span>{startPunkt.absoluteHoehe !== null ? startPunkt.absoluteHoehe.toFixed(3) : '-'}</span>
                            ) : (index === punkte.length - 1) ? (
                              <span>{endPunkt.absoluteHoehe !== null ? endPunkt.absoluteHoehe.toFixed(3) : '-'}</span>
                            ) : (
                              <span>{displayPunkt.absoluteHoehe !== null ? displayPunkt.absoluteHoehe.toFixed(3) : '-'}</span>
                            )}
                          </td>
                          <td>
                            <input
                              type="text"
                              value={punkt.bemerkung || ''}
                              onChange={(e) => handleInputChange(index, 'bemerkung', e.target.value)}
                            />
                          </td>
                          <td className="action-buttons">
                            {!isStatic ? (
                              <button
                                onClick={() => removeRow(index)}
                                className="delete-button"
                              >
                                Löschen
                              </button>
                            ) : null}
                          </td>
                        </>)}
                    </SortableTableRow>
                  );
                })}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
        
        <table className="new-row-table">
          <colgroup>
            <col className="col-handle" />
            <col className="col-punkt-nr" />
            <col className="col-rueckblick" />
            <col className="col-mittelblick" />
            <col className="col-vorblick" />
            <col className="col-delta-h" />
            <col className="col-abs-hoehe" />
            <col className="col-bemerkung" />
            <col className="col-aktionen" />
          </colgroup>
          <tbody>
            <tr className="new-row">
              <td className="drag-handle-cell"><div className="static-handle"><DragHandle /></div></td>
              <td>
                <select
                  value={newRow.punktNr}
                  onChange={(e) => handleNewRowInputChange('punktNr', e.target.value)}
                  className="new-row-dropdown"
                  onKeyDown={handleKeyDown}
                >
                  <option value="W">Wechselpunkt (W)</option>
                  <option value="M">Mittelblick (M)</option>
                </select>
              </td>
              <td>
                <input
                  ref={rueckblickRef}
                  type="number"
                  step="0.001"
                  value={newRow.rueckblick !== null ? newRow.rueckblick : ''}
                  onChange={(e) => handleNewRowInputChange('rueckblick', e.target.value)}
                  disabled={!isFieldEditable(newRow.punktNr || 'W', 'rueckblick', -1, -1)}
                  className={!isFieldEditable(newRow.punktNr || 'W', 'rueckblick', -1, -1) ? 'disabled-input' : ''}
                  placeholder="Rückblick"
                  onKeyDown={handleKeyDown}
                />
              </td>
              <td>
                <input
                  ref={mittelblickRef}
                  type="number"
                  step="0.001"
                  value={newRow.mittelblick !== null ? newRow.mittelblick : ''}
                  onChange={(e) => handleNewRowInputChange('mittelblick', e.target.value)}
                  disabled={!isFieldEditable(newRow.punktNr || 'M', 'mittelblick', -1, -1)}
                  className={!isFieldEditable(newRow.punktNr || 'M', 'mittelblick', -1, -1) ? 'disabled-input' : ''}
                  placeholder="Mittelblick"
                  onKeyDown={handleKeyDown}
                />
              </td>
              <td>
                <input
                  ref={vorblickRef}
                  type="number"
                  step="0.001"
                  value={newRow.vorblick !== null ? newRow.vorblick : ''}
                  onChange={(e) => handleNewRowInputChange('vorblick', e.target.value)}
                  disabled={!isFieldEditable(newRow.punktNr || 'W', 'vorblick', -1, -1)}
                  className={!isFieldEditable(newRow.punktNr || 'W', 'vorblick', -1, -1) ? 'disabled-input' : ''}
                  placeholder="Vorblick"
                  onKeyDown={handleKeyDown}
                />
              </td>
              <td>
                <span>-</span>
              </td>
              <td>
                <span>-</span>
              </td>
              <td>
                <input
                  type="text"
                  value={newRow.bemerkung}
                  onChange={(e) => handleNewRowInputChange('bemerkung', e.target.value)}
                  placeholder="Bemerkung"
                  onKeyDown={handleKeyDown}
                />
              </td>
              <td className="action-buttons">
                <button 
                  onClick={addNewRow} 
                  disabled={!newRow.punktNr || (!newRow.punktNr.startsWith('W') && !newRow.punktNr.startsWith('M'))}
                  className="add-button"
                >
                  Hinzufügen
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Füge Auswertungszusammenfassung direkt unter Tabelle hinzu */}
      {punkte.length > 0 && (
        <div className="table-summary">
          <table className="summary-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col className="col-handle" style={{ width: '40px' }} />
              <col className="col-punkt-nr" style={{ width: '110px' }} />
              <col className="col-rueckblick" style={{ width: '120px' }} />
              <col className="col-mittelblick" style={{ width: '120px' }} />
              <col className="col-vorblick" style={{ width: '120px' }} />
              <col className="col-delta-h" style={{ width: '105px' }} />
              <col className="col-abs-hoehe" style={{ width: '120px' }} />
              <col className="col-bemerkung" style={{ width: '160px' }} />
              <col className="col-aktionen" style={{ width: '90px' }} />
            </colgroup>
            <tbody>
              <tr className="summary-row">
                <td></td>
                <td></td>
                <td className="summary-value" style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                  Σr = {calculateSummeRueckblick().toFixed(3)}
                </td>
                <td></td>
                <td className="summary-value" style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                  Σv = {calculateSummeVorblick().toFixed(3)}
                </td>
                <td className="summary-value" style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                  ΣΔh = {calculateSummeDeltaH().toFixed(3)}
                </td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
          
          {/* Kurze Zusammenfassung der wichtigsten Auswertungsinformationen */}
          <div className="auswertung-summary" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            flexWrap: 'wrap',
            marginTop: '15px'
          }}>
            <div className="auswertung-column" style={{ flex: '1', minWidth: '200px', padding: '0 10px' }}>
              <div className="auswertung-summary-item">
                <span>Δh<sub>ist</sub> = Σr - Σv = </span>
                <span>{calculateDeltaHIst().toFixed(3)} m</span>
              </div>
              <div className="auswertung-summary-item">
                <span>Δh<sub>soll</sub> = h<sub>Ende</sub> - h<sub>Start</sub> = </span>
                <span>{calculateDeltaHSoll().toFixed(3)} m</span>
              </div>
            </div>
            
            <div className="auswertung-column" style={{ flex: '1', minWidth: '200px', padding: '0 10px' }}>
              <div className="auswertung-summary-item">
                <span>Fehler v = Δh<sub>soll</sub> - Δh<sub>ist</sub> = </span>
                <span>{calculateFehlerV().toFixed(3)} m</span>
              </div>
              <div className="auswertung-summary-item">
                <span>Zulässiger Fehler <br /> v<sub>zul</sub> = 15mm · √L = </span>
                <span>{calculateZulaessigerFehler().toFixed(3)} m</span>
              </div>
              <div className={`auswertung-summary-item ${isFehlerZulaessig() ? 'success' : 'error'}`}>
                <span>Fehler zulässig: |v| ≤ v<sub>zul</sub></span>
                <span>{isFehlerZulaessig() ? 'Ja ✓' : 'Nein ✗'}</span>
              </div>
            </div>
            
            <div className="auswertung-column" style={{ flex: '1', minWidth: '200px', padding: '0 10px' }}>
              <div className={`auswertung-summary-item ${isSummeDeltaHKorrekt() ? 'success' : 'error'}`}>
                <span>Summe Δh = Δh<sub>soll</sub>: </span>
                <span>{isSummeDeltaHKorrekt() ? 'Ja ✓' : 'Nein ✗'}</span>
              </div>
              <div className={`auswertung-summary-item ${Math.abs(calculateFehlerV() * 1000 - calculateGesamtKorrektur()) < 0.5 ? 'success' : 'error'}`}>
                <span>Alle Fehler verteilt: </span>
                <span>{Math.abs(calculateFehlerV() * 1000 - calculateGesamtKorrektur()) < 0.5 ? 'Ja ✓' : 'Nein ✗'}</span>
              </div>
            </div>
          </div>
          
          {/* Mittelblick-Proben detailliert anzeigen */}
          {getMittelblickProben().length > 0 && (
            <div className="mittelblick-proben-container">
              <div 
                className="mittelblick-proben-header" 
                onClick={() => setMittelblickProbenVisible(!mittelblickProbenVisible)}
                style={{ 
                  cursor: 'pointer', 
                  padding: '8px 10px', 
                  backgroundColor: '#f2f2f2', 
                  borderRadius: '5px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '15px',
                  marginBottom: '10px'
                }}
              >
                <h4 style={{ margin: 0 }}>Mittelblick-Proben</h4>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {!mittelblickProbenVisible && (
                    <span style={{ 
                      marginRight: '10px', 
                      color: !probenAlleKorrekt() ? 'red' : 'green',
                      fontSize: '0.9em',
                      fontWeight: 'bold'
                    }}>
                      {!probenAlleKorrekt() 
                        ? `${getFehlerCount()} Proben fehlerhaft` 
                        : 'Alle Proben korrekt'}
                    </span>
                  )}
                  <span style={{ 
                    transform: mittelblickProbenVisible ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease'
                  }}>
                    ▼
                  </span>
                </div>
              </div>
              {mittelblickProbenVisible && (
                <div className="mittelblick-proben-list" style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '10px',
                  marginBottom: '10px'
                }}>
                  {getMittelblickProben().map((probe, index) => (
                    <div 
                      key={index} 
                      className={`mittelblick-probe ${probe.korrekt ? 'korrekt' : 'fehler'}`} 
                      style={{ 
                        border: '1px solid #ddd', 
                        padding: '10px', 
                        borderRadius: '5px',
                        backgroundColor: probe.korrekt ? '#f0fff0' : '#fff0f0',
                        flex: '1 1 300px',
                        maxWidth: 'calc(50% - 10px)',
                        fontSize: '0.9em'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                        Probe: {probe.mPunktNr} → {probe.wPunktNr}
                        <span style={{ 
                          marginLeft: '10px', 
                          color: probe.korrekt ? 'green' : 'red',
                          float: 'right'
                        }}>
                          {probe.korrekt ? '✓' : '✗'}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
                        <div>Höhe {probe.mPunktNr}: {probe.mHoehe?.toFixed(3)} m</div>
                        <div>Mittelblick: {probe.mBlick?.toFixed(3)} m</div>
                        <div>Vorblick {probe.wPunktNr}: {probe.vBlick?.toFixed(3)} m</div>
                        <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px dashed #ccc' }}>
                          Δh (m-v): {probe.hoehendifferenz?.toFixed(3)} m
                        </div>
                        <div>Erw. {probe.wPunktNr}: {probe.erwarteteHoehe?.toFixed(3)} m</div>
                        <div>Ist {probe.wPunktNr}: {probe.wHoehe?.toFixed(3)} m</div>
                        <div style={{ fontWeight: 'bold' }}>
                          Diff: {probe.differenz !== null ? Math.abs(probe.differenz).toFixed(3) : '-'} m
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Statusanzeige für manuelle Korrekturen wenn vorhanden */}
          {Object.keys(fehlerKorrekturen).length > 0 && (
            <div className="manual-corrections-container">
              <div className="korrektur-status">
                <div className="korrektur-status-item">
                  <span className="korrektur-status-label">Fehler v:</span>
                  <span className={`korrektur-status-value ${calculateFehlerV() >= 0 ? 'positiv' : 'negativ'}`}>
                    {Math.round(calculateFehlerV() * 1000)} mm
                  </span>
                </div>
                <div className="korrektur-status-item">
                  <span className="korrektur-status-label">Summe Korrekturen:</span>
                  <span className={`korrektur-status-value ${calculateGesamtKorrektur() > 0 ? 'positiv' : 'negativ'}`}>
                    {Math.round(calculateGesamtKorrektur())} mm
                  </span>
                </div>
              </div>
              <div className="korrektur-hinweis">
                <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#333', fontStyle: 'italic' }}>
                  <span style={{ fontWeight: 'bold' }}>Hinweis:</span> Die Korrekturwerte werden in der Berechnung von Δh berücksichtigt und beim Speichern des Nivellements gesichert.
                </p>
              </div>
              <div className="korrektur-actions">
                <button
                  className="korrektur-reset-button"
                  onClick={resetKorrekturen}
                  title="Korrekturen zurücksetzen"
                >
                  Korrekturen zurücksetzen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default NivellementTable;