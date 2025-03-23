import React, { useState, useEffect, useRef } from 'react';
import { DndContext, DragEndEvent, 
  KeyboardSensor, PointerSensor, closestCenter,
  useSensor, useSensors
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { 
  Box, 
  TextField, 
  Button, 
  IconButton, 
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Card,
  CardContent,
  Typography,
  styled,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TableFooter
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon
} from '@mui/icons-material';
import { NivellementPunkt } from '../models/types';
import { calculateDeltaH, calculateAbsoluteHoehe } from '../utils/calculations';

// CSS für die Entfernung der Pfeile aus Zahlenfeldern
const GlobalStyles = styled('style')({
  ['@global']: {
    'input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button': {
      WebkitAppearance: 'none',
      margin: 0
    },
    'input[type=number]': {
      MozAppearance: 'textfield'
    }
  }
});

// Hilfsfunktion zum Formatieren von Zahlen
const formatNumber = (value: number): string => {
  return value.toFixed(3);
};

const StyledTableRow = styled(TableRow, {
  shouldForwardProp: (prop) => prop !== 'punktType' && prop !== 'isDragging'
})<{ punktType?: string; isDragging?: boolean }>(({ theme, punktType, isDragging }) => ({
  ...(punktType === 'MB' && {
    '&:first-of-type td': {
      backgroundColor: '#f0f7ff',
      borderTop: `2px solid ${theme.palette.primary.main}`,
      borderBottom: `2px solid ${theme.palette.primary.main}`
    },
    '&:last-of-type td': {
      backgroundColor: '#f7f0ff',
      borderTop: `2px solid ${theme.palette.secondary.main}`,
      borderBottom: `2px solid ${theme.palette.secondary.main}`
    }
  }),
  ...(punktType === 'W' && {
    '& td': {
      backgroundColor: 'rgba(76, 175, 79, 0.07)' // Seichtes Grün für Wechselpunkte
    }
  }),
  ...(punktType === 'M' && {
    '& td': {
      backgroundColor: 'rgba(255, 235, 59, 0.07)' // Seichtes Gelb für Mittelblicke
    }
  }),
  opacity: isDragging ? 0.5 : 1
}));

const EmptyCell = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  color: theme.palette.text.secondary,
  height: '100%',
  padding: theme.spacing(1),
}));

const SetupCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(3)
}));

const MBInputGroup = styled(Box)({
  display: 'flex',
  flex: 1,
  alignItems: 'center'
});

const MBPrefix = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.grey[200],
  padding: '8px',
  border: `1px solid ${theme.palette.grey[400]}`,
  borderRight: 'none',
  borderRadius: '4px 0 0 4px',
  fontWeight: 'bold',
  color: theme.palette.text.secondary
}));

// Drag-Handle-Komponente
const DragHandle = () => (
  <div className="drag-handle">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 6H16M8 12H16M8 18H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
    <StyledTableRow 
      ref={setNodeRef}
      style={style}
      punktType={punktType}
      isDragging={isDragging}
    >
      {children(isStatic ? null : { ...attributes, ...listeners })}
    </StyledTableRow>
  );
}

// Hilfsfunktion zum Bestimmen des Punkttyps
const getPunktType = (punktNr: string) => {
  if (punktNr.startsWith('MB')) return 'MB';
  if (punktNr.startsWith('W')) return 'W';
  if (punktNr.startsWith('M')) return 'M';
  return '';
};

interface NivellementTableComponentProps {
  punkte: NivellementPunkt[];
  onChange: (punkte: NivellementPunkt[]) => void;
  streckeLaenge: number;
  onStreckeLaengeChange: (streckeLaenge: number) => void;
  korrekturen: Record<string | number, number>;
  onKorrekturenChange?: (korrekturen: Record<string | number, number>) => void;
}

// Hilfsfunktion zum Anzuwenden von Korrekturen auf deltaH
const applyKorrekturenToDeltaH = (
  punkte: NivellementPunkt[], 
  korrekturen: Record<string, number>
): NivellementPunkt[] => {
  if (Object.keys(korrekturen).length === 0) return punkte;
  
  const updatedPunkte = [...punkte];
  
  // Berechne deltaH für alle Punkte mit Korrekturen
  for (let i = 1; i < updatedPunkte.length; i++) {
    // Für den Endpunkt (MB) müssen wir manuell den letzten Wechselpunkt finden
    if (i === updatedPunkte.length - 1 && updatedPunkte[i].punktNr.startsWith('MB')) {
      // Finde den letzten Wechselpunkt (W oder MB) vor dem Endpunkt
      let lastWPIndex = -1;
      for (let j = i - 1; j >= 0; j--) {
        if (updatedPunkte[j].punktNr.startsWith('W') || updatedPunkte[j].punktNr.startsWith('MB')) {
          lastWPIndex = j;
          break;
        }
      }
      
      // Wenn ein Wechselpunkt gefunden wurde, berechne deltaH manuell
      if (lastWPIndex !== -1) {
        const lastWP = updatedPunkte[lastWPIndex];
        const currentMB = updatedPunkte[i];
        
        // Prüfe, ob die benötigten Werte vorhanden sind
        if (lastWP.rueckblick !== null && currentMB.vorblick !== null) {
          // Anwendung der Korrektur auf den Rückblick des letzten Wechselpunkts
          let korrekturWert = 0;
          if (lastWP.punktNr && korrekturen[lastWP.punktNr] !== undefined) {
            korrekturWert = korrekturen[lastWP.punktNr] / 1000; // Umrechnung von mm in m
          }
          
          // Berechne deltaH manuell: korrigierter Rückblick - Vorblick
          const deltaH = (lastWP.rueckblick + korrekturWert) - currentMB.vorblick;
          
          updatedPunkte[i] = {
            ...updatedPunkte[i],
            deltaH
          };
        } else {
          // Falls benötigte Werte fehlen, setze deltaH auf null
          updatedPunkte[i] = {
            ...updatedPunkte[i],
            deltaH: null
          };
        }
      } else {
        // Falls kein Wechselpunkt gefunden wurde, verwende die normale Berechnung
        const deltaH = calculateDeltaH(updatedPunkte, i, korrekturen);
        updatedPunkte[i] = {
          ...updatedPunkte[i],
          deltaH
        };
      }
    } else {
      // Normal für alle anderen Punkte
      const deltaH = calculateDeltaH(updatedPunkte, i, korrekturen);
      updatedPunkte[i] = {
        ...updatedPunkte[i],
        deltaH
      };
    }
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

const NivellementTable: React.FC<NivellementTableComponentProps> = ({ 
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
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
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

  /**
   * Berechnet die unkorrigierte Summe aller Rückblicke auf W- und MB-Punkte
   * Diese Summe wird für die Fehlerverteilung verwendet.
   */
  const calculateSummeRueckblick = (): number => {
    return punkte
      .filter((p) => p.punktNr.startsWith('W') || p.punktNr.startsWith('MB'))
      .reduce((sum, p) => sum + (p.rueckblick || 0), 0);
  };

  /**
   * Berechnet die unkorrigierte Summe aller Vorblicke
   */
  const calculateSummeVorblick = (): number => {
    return punkte
      .filter((p) => p.punktNr.startsWith('W') || p.punktNr.startsWith('MB'))
      .reduce((sum, p) => sum + (p.vorblick || 0), 0);
  };

  /**
   * Berechnet die unkorrigierte Summe aller deltaH-Werte für W- und MB-Punkte
   */
  const calculateSummeDeltaH = (): number => {
    return displayPunkte
      .filter((p) => p.punktNr.startsWith('W') || p.punktNr.startsWith('MB'))
      .reduce((sum, p) => sum + (p.deltaH || 0), 0);
  };

  /**
   * Berechnet den Sollwert für deltaH (H_End - H_Start)
   */
  const calculateDeltaHSoll = (): number => {
    // Finde den Höhenunterschied zwischen Start- und Endpunkt
    const startPunktObj = punkte.find((p) => p.punktNr === startPunkt.punktNr);
    const endPunktObj = punkte.find((p) => p.punktNr === endPunkt.punktNr);
    
    if (!startPunktObj || !endPunktObj || startPunktObj.absoluteHoehe === undefined || endPunktObj.absoluteHoehe === undefined) {
      return 0;
    }
    
    return (endPunktObj.absoluteHoehe || 0) - (startPunktObj.absoluteHoehe || 0);
  };

  /**
   * Berechnet den Istwert für deltaH (Σr - Σv)
   * Wichtig: Verwendet die unkorrigierten Werte für die Fehlerberechnung
   */
  const calculateDeltaHIst = (): number => {
    // Für den Istwert nehmen wir die unkorrigierten Werte
    const summeRueckblick = calculateSummeRueckblick();
    const summeVorblick = calculateSummeVorblick();
    
    return summeRueckblick - summeVorblick;
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
  const [fehlerKorrekturen, setFehlerKorrekturen] = useState<Record<string, number>>(propKorrekturen || {});

  // Füge Korrektur zu einem einzelnen Wechselpunkt hinzu
  const addPunktKorrektur = (index: number, positiv: boolean) => {
    // Standardwert für Korrektur in mm (1 mm statt 0.1 mm)
    const korrekturWert = positiv ? 1 : -1;
    
    // Finde den Punkt anhand des Index
    const punkt = punkte[index];
    if (!punkt) return;
    
    const punktNr = punkt.punktNr;
    
    const updatedKorrekturen = {
      ...fehlerKorrekturen,
      [punktNr]: (fehlerKorrekturen[punktNr] || 0) + korrekturWert
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
    if (propKorrekturen) {
      // Konvertiere numerische Indizes zu punktNr, falls nötig
      const konvertierteKorrekturen: Record<string, number> = {};
      Object.entries(propKorrekturen).forEach(([key, value]) => {
        // Prüfe, ob der Key ein numerischer Index ist
        if (!isNaN(Number(key))) {
          const index = Number(key);
          if (index >= 0 && index < punkte.length) {
            konvertierteKorrekturen[punkte[index].punktNr] = value;
          }
        } else {
          // Falls bereits ein String-Key verwendet wird, übernehme ihn direkt
          konvertierteKorrekturen[key] = value;
        }
      });
      setFehlerKorrekturen(konvertierteKorrekturen);
      
      // Aktualisiere displayPunkte mit den konvertierten Korrekturen
      const updatedDisplayPunkte = applyKorrekturenToDeltaH(punkte, konvertierteKorrekturen);
      setDisplayPunkte(updatedDisplayPunkte);
    }
  }, [propKorrekturen, punkte]);

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
      <GlobalStyles />
      <Box component="div">
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <SetupCard>
              <CardContent>
                <Typography variant="h6" gutterBottom>Startpunkt</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel shrink>Punkt Nr.</InputLabel>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <MBInputGroup>
                          <MBPrefix>MB</MBPrefix>
                          <TextField
                            fullWidth
                            value={startPunkt.punktNr.replace('MB', '')}
                            onChange={(e) => handleStartPunktChange('punktNr', 'MB' + e.target.value)}
                            variant="outlined"
                            size="small"
                          />
                        </MBInputGroup>
                      </Box>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Absolute Höhe [m]"
                type="number" 
                      InputProps={{
                        inputProps: { step: 0.001 }
                      }}
                value={startPunkt.absoluteHoehe || ''} 
                onChange={(e) => handleStartPunktChange('absoluteHoehe', e.target.value)}
                      variant="outlined"
                      size="small"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </SetupCard>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <SetupCard>
              <CardContent>
                <Typography variant="h6" gutterBottom>Endpunkt</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel shrink>Punkt Nr.</InputLabel>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <MBInputGroup>
                          <MBPrefix>MB</MBPrefix>
                          <TextField
                            fullWidth
                            value={endPunkt.punktNr.replace('MB', '')}
                            onChange={(e) => handleEndPunktChange('punktNr', 'MB' + e.target.value)}
                            variant="outlined"
                            size="small"
                          />
                        </MBInputGroup>
                      </Box>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Absolute Höhe [m]"
                type="number" 
                      InputProps={{
                        inputProps: { step: 0.001 }
                      }}
                value={endPunkt.absoluteHoehe || ''} 
                onChange={(e) => handleEndPunktChange('absoluteHoehe', e.target.value)}
                      variant="outlined"
                      size="small"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </SetupCard>
          </Grid>
        </Grid>
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <SetupCard>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Streckenlänge [km]"
                type="number" 
                      InputProps={{
                        inputProps: { step: 0.001, min: 0.001 }
                      }}
                value={streckeLaenge !== null ? streckeLaenge : ''}
                onChange={(e) => handleStreckeLaengeChange(e.target.value === '' ? null : parseFloat(e.target.value))} 
                      variant="outlined"
                      size="small"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </SetupCard>
          </Grid>
        </Grid>

        <Box sx={{ mb: 4 }}>
          <TableContainer component={Paper}>
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={punkteIds} 
                strategy={rectSortingStrategy}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ 
                      backgroundColor: theme => theme.palette.primary.light,
                      '& th': { 
                        color: theme => theme.palette.primary.main,
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }
                    }}>
                      <TableCell style={{ width: '50px', padding: '4px' }}></TableCell>
                      <TableCell style={{ width: '50px', padding: '4px' }}>Nr.</TableCell>
                      <TableCell style={{ width: '180px', padding: '4px' }}>Rückblick r [m]</TableCell>
                      <TableCell style={{ width: '120px', padding: '4px' }}>Mittelblick m [m]</TableCell>
                      <TableCell style={{ width: '140px', padding: '4px' }}>Vorblick v [m]</TableCell>
                      <TableCell style={{ width: '140px', padding: '4px' }}>Δh [m]</TableCell>
                      <TableCell style={{ width: '140px', padding: '4px' }}>Höhe H [m]</TableCell>
                      <TableCell style={{ width: '180px', padding: '4px' }}>Bemerkung</TableCell>
                      <TableCell style={{ width: '50px', padding: '4px' }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Start-Punkt und mittlere Punkte anzeigen */}
                    {punkte.slice(0, -1).map((punkt, index) => {
                  // Sicherstellen, dass displayPunkte[index] existiert
                  const displayPunkt = displayPunkte[index] || punkt;
                      const isStatic = index === 0;
                  const isWechselpunkt = punkt.punktNr.startsWith('W');
                      // Die Variable korrekturWert nicht mehr verwenden
                      const punktType = getPunktType(punkt.punktNr);
                  
                  return (
                    <SortableTableRow 
                      key={`punkt-${index}`} 
                      punkt={punkt} 
                      index={index} 
                      isStatic={isStatic}
                    >
                          {(dragHandleProps) => (
                            <>
                              <TableCell>
                            {!isStatic && (
                                  <Box {...dragHandleProps}>
                                <DragHandle />
                                  </Box>
                                )}
                              </TableCell>
                              <TableCell
                                align={
                                  punktType === 'MB' || punktType === 'W' ? 'right' : 'left'
                                }
                              >
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {punkt.punktNr}
                                </Typography>
                              </TableCell>
                              <TableCell 
                                align={
                                  punktType === 'MB' || punktType === 'W' ? 'right' : 'left'
                                }
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  {isFieldEditable(punkt.punktNr, 'rueckblick', index, punkte.length - 1) ? (
                                    <TextField
                                      fullWidth
                                type="number"
                                      inputProps={{ 
                                        step: 0.001,
                                        style: { padding: '2px 4px', fontSize: '0.75rem', height: '22px' }
                                      }}
                                value={punkt.rueckblick !== null ? punkt.rueckblick : ''}
                                onChange={(e) => handleInputChange(index, 'rueckblick', e.target.value)}
                                      size="small"
                                      variant="outlined"
                                      sx={{ '.MuiOutlinedInput-root': { height: '28px' } }}
                                    />
                                  ) : (
                                    <EmptyCell>-</EmptyCell>
                                  )}
                                  
                                  {(isWechselpunkt || (index === 0 && punkt.punktNr.startsWith('MB'))) && 
                                   isFieldEditable(punkt.punktNr, 'rueckblick', index, punkte.length - 1) && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                                      {fehlerKorrekturen[punkt.punktNr] !== undefined && fehlerKorrekturen[punkt.punktNr] !== 0 && (
                                        <Typography variant="caption" color="error" sx={{ ml: 0.5, whiteSpace: 'nowrap' }}>
                                          {fehlerKorrekturen[punkt.punktNr] > 0 ? '+' : ''}{Math.round(fehlerKorrekturen[punkt.punktNr])}
                                        </Typography>
                                      )}
                                      <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.5 }}>
                                        <IconButton 
                                          size="small" 
                                      onClick={() => addPunktKorrektur(index, true)}
                                      title="Korrektur erhöhen (+1 mm)"
                                          sx={{ p: 0.2, height: 15, width: 15, marginTop: 0.5 }}
                                        >
                                          <Typography variant="caption">+</Typography>
                                        </IconButton>
                                        <IconButton 
                                          size="small" 
                                      onClick={() => addPunktKorrektur(index, false)}
                                      title="Korrektur verringern (-1 mm)"
                                          sx={{ p: 0.2, height: 15, width: 15, marginTop: 0.5 }}
                                        >
                                          <Typography variant="caption">-</Typography>
                                        </IconButton>
                                      </Box>
                                    </Box>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell 
                                align={
                                  punktType === 'MB' || punktType === 'W' ? 'right' : 'left'
                                }
                              >
                                {isFieldEditable(punkt.punktNr, 'mittelblick', index, punkte.length - 1) ? (
                                  <TextField
                                    fullWidth
                              type="number"
                                    inputProps={{ 
                                      step: 0.001,
                                      style: { padding: '2px 4px', fontSize: '0.75rem', height: '22px' }
                                    }}
                              value={punkt.mittelblick !== null ? punkt.mittelblick : ''}
                              onChange={(e) => handleInputChange(index, 'mittelblick', e.target.value)}
                                    size="small"
                                    variant="outlined"
                                    sx={{ '.MuiOutlinedInput-root': { height: '28px' } }}
                                  />
                                ) : (
                                  <EmptyCell>-</EmptyCell>
                                )}
                              </TableCell>
                              <TableCell 
                                align={
                                  punktType === 'MB' || punktType === 'W' ? 'right' : 'left'
                                }
                              >
                                {isFieldEditable(punkt.punktNr, 'vorblick', index, punkte.length - 1) ? (
                                  <TextField
                                    fullWidth
                              type="number"
                                    inputProps={{ 
                                      step: 0.001,
                                      style: { padding: '2px 4px', fontSize: '0.75rem', height: '22px' }
                                    }}
                              value={punkt.vorblick !== null ? punkt.vorblick : ''}
                              onChange={(e) => handleInputChange(index, 'vorblick', e.target.value)}
                                    size="small"
                                    variant="outlined"
                                    sx={{ '.MuiOutlinedInput-root': { height: '28px' } }}
                                  />
                                ) : (
                                  <EmptyCell>-</EmptyCell>
                                )}
                              </TableCell>
                              <TableCell 
                                align={
                                  punktType === 'MB' || punktType === 'W' ? 'right' : 'left'
                                }
                              >
                                {displayPunkt.deltaH !== null && displayPunkt.deltaH !== undefined ? (
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      fontFamily: 'monospace', 
                                      fontWeight: 500
                                    }}
                                  >
                                    {formatNumber(displayPunkt.deltaH)}
                                  </Typography>
                                ) : (
                                  <EmptyCell>-</EmptyCell>
                                )}
                              </TableCell>
                              <TableCell 
                                align={
                                  punktType === 'MB' || punktType === 'W' ? 'right' : 'left'
                                }
                              >
                                {displayPunkt.absoluteHoehe !== null && displayPunkt.absoluteHoehe !== undefined ? (
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      fontFamily: 'monospace', 
                                      fontWeight: 500 
                                    }}
                                  >
                                    {formatNumber(displayPunkt.absoluteHoehe)}
                                  </Typography>
                                ) : (
                                  <EmptyCell>-</EmptyCell>
                                )}
                              </TableCell>
                              <TableCell>
                                <TextField
                                  fullWidth
                              value={punkt.bemerkung || ''}
                              onChange={(e) => handleInputChange(index, 'bemerkung', e.target.value)}
                                  size="small"
                                  variant="outlined"
                                  inputProps={{ 
                                    style: { padding: '2px 4px', fontSize: '0.75rem', height: '22px' }
                                  }}
                                  sx={{ '.MuiOutlinedInput-root': { height: '28px' } }}
                                />
                              </TableCell>
                              <TableCell className="action-buttons">
                            {!isStatic ? (
                              <Button
                                onClick={() => removeRow(index)}
                                title="Löschen"
                                color="error"
                                variant="contained"
                                size="small"
                                sx={{ minWidth: 'auto', p: '4px' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </Button>
                            ) : null}
                              </TableCell>
                            </>
                          )}
                    </SortableTableRow>
                  );
                })}

                    {/* Neue Zeile zum Hinzufügen */}
                    <TableRow className="new-row">
                      <TableCell>
                        <Box className="static-handle">
                          <DragHandle />
                        </Box>
                      </TableCell>
                      <TableCell align={newRow.punktNr === 'W' || newRow.punktNr === 'MB' ? 'right' : 'left'}>
                        <Select
                          fullWidth
                  value={newRow.punktNr}
                          onChange={(e) => handleNewRowInputChange('punktNr', e.target.value as string)}
                          size="small"
                          variant="outlined"
                  onKeyDown={handleKeyDown}
                          sx={{ 
                            '.MuiOutlinedInput-root': { height: '28px' },
                            '.MuiInputBase-input': { padding: '2px 4px', fontSize: '0.75rem' }
                          }}
                        >
                          <MenuItem value="W">W</MenuItem>
                          <MenuItem value="M">M</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell align={newRow.punktNr === 'W' ? 'right' : 'left'}>
                        {isFieldEditable(newRow.punktNr || 'W', 'rueckblick', -1, -1) ? (
                          <TextField
                            fullWidth
                            inputRef={rueckblickRef}
                  type="number"
                            inputProps={{ 
                              step: 0.001,
                              style: { padding: '2px 4px', fontSize: '0.75rem', height: '22px' }
                            }}
                  value={newRow.rueckblick !== null ? newRow.rueckblick : ''}
                  onChange={(e) => handleNewRowInputChange('rueckblick', e.target.value)}
                  placeholder="Rückblick"
                  onKeyDown={handleKeyDown}
                            size="small"
                            variant="outlined"
                            sx={{ '.MuiOutlinedInput-root': { height: '28px' } }}
                          />
                        ) : (
                          <EmptyCell>-</EmptyCell>
                        )}
                      </TableCell>
                      <TableCell align={newRow.punktNr === 'M' ? 'left' : 'right'}>
                        {isFieldEditable(newRow.punktNr || 'M', 'mittelblick', -1, -1) ? (
                          <TextField
                            fullWidth
                            inputRef={mittelblickRef}
                  type="number"
                            inputProps={{ 
                              step: 0.001,
                              style: { padding: '2px 4px', fontSize: '0.75rem', height: '22px' }
                            }}
                  value={newRow.mittelblick !== null ? newRow.mittelblick : ''}
                  onChange={(e) => handleNewRowInputChange('mittelblick', e.target.value)}
                  placeholder="Mittelblick"
                  onKeyDown={handleKeyDown}
                            size="small"
                            variant="outlined"
                            sx={{ '.MuiOutlinedInput-root': { height: '28px' } }}
                          />
                        ) : (
                          <EmptyCell>-</EmptyCell>
                        )}
                      </TableCell>
                      <TableCell align={newRow.punktNr === 'W' ? 'right' : 'left'}>
                        {isFieldEditable(newRow.punktNr || 'W', 'vorblick', -1, -1) ? (
                          <TextField
                            fullWidth
                            inputRef={vorblickRef}
                  type="number"
                            inputProps={{ 
                              step: 0.001,
                              style: { padding: '2px 4px', fontSize: '0.75rem', height: '22px' }
                            }}
                  value={newRow.vorblick !== null ? newRow.vorblick : ''}
                  onChange={(e) => handleNewRowInputChange('vorblick', e.target.value)}
                  placeholder="Vorblick"
                  onKeyDown={handleKeyDown}
                            size="small"
                            variant="outlined"
                            sx={{ '.MuiOutlinedInput-root': { height: '28px' } }}
                          />
                        ) : (
                          <EmptyCell>-</EmptyCell>
                        )}
                      </TableCell>
                      <TableCell>
                        <EmptyCell>-</EmptyCell>
                      </TableCell>
                      <TableCell>
                        <EmptyCell>-</EmptyCell>
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                  value={newRow.bemerkung}
                  onChange={(e) => handleNewRowInputChange('bemerkung', e.target.value)}
                  placeholder="Bemerkung"
                  onKeyDown={handleKeyDown}
                          size="small"
                          variant="outlined"
                          inputProps={{ 
                            style: { padding: '2px 4px', fontSize: '0.75rem', height: '22px' }
                          }}
                          sx={{ '.MuiOutlinedInput-root': { height: '28px' } }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                  onClick={addNewRow} 
                  disabled={!newRow.punktNr || (!newRow.punktNr.startsWith('W') && !newRow.punktNr.startsWith('M'))}
                          title="Hinzufügen"
                          color="primary"
                          variant="contained"
                          size="small"
                          sx={{ minWidth: 'auto', p: '4px' }}
                        >
                          <AddIcon fontSize="small" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    {/* Endpunkt anzeigen */}
      {punkte.length > 0 && (
                      <SortableTableRow 
                        key={`punkt-${punkte.length - 1}`} 
                        punkt={punkte[punkte.length - 1]} 
                        index={punkte.length - 1} 
                        isStatic={true}
                      >
                        {() => {
                          const lastPunkt = punkte[punkte.length - 1];
                          const lastDisplayPunkt = displayPunkte[punkte.length - 1] || lastPunkt;
                          const punktType = getPunktType(lastPunkt.punktNr);
                          
                          return (<>
                            <TableCell></TableCell>
                            <TableCell
                              align={
                                punktType === 'MB' || punktType === 'W' ? 'right' : 'left'
                              }
                            >
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {lastPunkt.punktNr}
                              </Typography>
                            </TableCell>
                            <TableCell align={punktType === 'MB' ? 'right' : 'left'}>
                              {isFieldEditable(lastPunkt.punktNr, 'rueckblick', punkte.length - 1, punkte.length - 1) ? (
                                <TextField
                                  fullWidth
                                  type="number"
                                  inputProps={{ 
                                    step: 0.001,
                                    style: { padding: '2px 4px', fontSize: '0.75rem', height: '22px' }
                                  }}
                                  value={lastPunkt.rueckblick !== null ? lastPunkt.rueckblick : ''}
                                  onChange={(e) => handleInputChange(punkte.length - 1, 'rueckblick', e.target.value)}
                                  size="small"
                                  variant="outlined"
                                  sx={{ '.MuiOutlinedInput-root': { height: '28px' } }}
                                />
                              ) : (
                                <EmptyCell>-</EmptyCell>
                              )}
                            </TableCell>
                            <TableCell align={punktType === 'MB' ? 'right' : 'left'}>
                              {isFieldEditable(lastPunkt.punktNr, 'mittelblick', punkte.length - 1, punkte.length - 1) ? (
                                <TextField
                                  fullWidth
                                  type="number"
                                  inputProps={{ 
                                    step: 0.001,
                                    style: { padding: '2px 4px', fontSize: '0.75rem', height: '22px' }
                                  }}
                                  value={lastPunkt.mittelblick !== null ? lastPunkt.mittelblick : ''}
                                  onChange={(e) => handleInputChange(punkte.length - 1, 'mittelblick', e.target.value)}
                                  size="small"
                                  variant="outlined"
                                  sx={{ '.MuiOutlinedInput-root': { height: '28px' } }}
                                />
                              ) : (
                                <EmptyCell>-</EmptyCell>
                              )}
                            </TableCell>
                            <TableCell align={punktType === 'MB' ? 'right' : 'left'}>
                              {isFieldEditable(lastPunkt.punktNr, 'vorblick', punkte.length - 1, punkte.length - 1) ? (
                                <TextField
                                  fullWidth
                                  type="number"
                                  inputProps={{ 
                                    step: 0.001,
                                    style: { padding: '2px 4px', fontSize: '0.75rem', height: '22px' }
                                  }}
                                  value={lastPunkt.vorblick !== null ? lastPunkt.vorblick : ''}
                                  onChange={(e) => handleInputChange(punkte.length - 1, 'vorblick', e.target.value)}
                                  size="small"
                                  variant="outlined"
                                  sx={{ '.MuiOutlinedInput-root': { height: '28px' } }}
                                />
                              ) : (
                                <EmptyCell>-</EmptyCell>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {lastDisplayPunkt.deltaH !== null && lastDisplayPunkt.deltaH !== undefined ? (
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                  {formatNumber(lastDisplayPunkt.deltaH)}
                                </Typography>
                              ) : (
                                <EmptyCell>-</EmptyCell>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {endPunkt.absoluteHoehe !== null && endPunkt.absoluteHoehe !== undefined ? (
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                  {formatNumber(endPunkt.absoluteHoehe)}
                                </Typography>
                              ) : (
                                <EmptyCell>-</EmptyCell>
                              )}
                            </TableCell>
                            <TableCell>
                              <TextField
                                fullWidth
                                value={lastPunkt.bemerkung || ''}
                                onChange={(e) => handleInputChange(punkte.length - 1, 'bemerkung', e.target.value)}
                                size="small"
                                variant="outlined"
                                inputProps={{ 
                                  style: { padding: '2px 4px', fontSize: '0.75rem', height: '22px' }
                                }}
                                sx={{ '.MuiOutlinedInput-root': { height: '28px' } }}
                              />
                            </TableCell>
                            <TableCell></TableCell>
                          </>);
                        }}
                      </SortableTableRow>
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow sx={{ backgroundColor: theme => theme.palette.grey[100] }}>
                      <TableCell></TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          Summen:
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          Σr <wbr />= {calculateSummeRueckblick().toFixed(3)} m
                        </Typography>
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          Σv <wbr />= {calculateSummeVorblick().toFixed(3)} m
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          ΣΔh <wbr />= {calculateSummeDeltaH().toFixed(3)} m
                        </Typography>
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </SortableContext>
            </DndContext>
          </TableContainer>
        </Box>
        
        {/* Füge Auswertungszusammenfassung direkt unter Tabelle hinzu */}
        {punkte.length > 0 && (
          <Box className="table-summary" sx={{ mt: 2 }}>
            {/* Die separate Summentabelle ist jetzt überflüssig und wird entfernt */}
          
          {/* Kurze Zusammenfassung der wichtigsten Auswertungsinformationen */}
          <div className="auswertung-summary" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            flexWrap: 'wrap',
            marginTop: '15px'
          }}>
            <div className="auswertung-column" style={{ flex: '1', minWidth: '200px', padding: '0 10px' }}>
              <div className="auswertung-summary-item">
                <span>Δh<sub>ist</sub> = Σr - Σv<wbr /> = </span>
                <span>{calculateDeltaHIst().toFixed(3)} m</span>
              </div>
              <div className="auswertung-summary-item">
                <span>Δh<sub>soll</sub> = h<sub>Ende</sub> - h<sub>Start</sub><wbr /> = </span>
                <span>{calculateDeltaHSoll().toFixed(3)} m</span>
              </div>
            </div>
            
            <div className="auswertung-column" style={{ flex: '1', minWidth: '200px', padding: '0 10px' }}>
              <div className="auswertung-summary-item">
                <span>Fehler v = Δh<sub>soll</sub> - Δh<sub>ist</sub><wbr /> = </span>
                <span>{calculateFehlerV().toFixed(3)} m</span>
              </div>
              <div className="auswertung-summary-item">
                <span>Zulässiger Fehler<br />v<sub>zul</sub> = 15mm · √L<wbr /> = </span>
                <span>{calculateZulaessigerFehler().toFixed(3)} m</span>
              </div>
              <div className={`auswertung-summary-item ${isFehlerZulaessig() ? 'success' : 'error'}`}>
                <span>Fehler zulässig: |v| ≤ v<sub>zul</sub></span>
                <span>{isFehlerZulaessig() ? 'Ja ✓' : 'Nein ✗'}</span>
              </div>
            </div>
            
            <div className="auswertung-column" style={{ flex: '1', minWidth: '200px', padding: '0 10px' }}>
              <div className={`auswertung-summary-item ${isSummeDeltaHKorrekt() ? 'success' : 'error'}`}>
                  <span>Summe Δh = Δh<sub>soll</sub>:</span>
                <span>{isSummeDeltaHKorrekt() ? 'Ja ✓' : 'Nein ✗'}</span>
              </div>
              <div className={`auswertung-summary-item ${Math.abs(calculateFehlerV() * 1000 - calculateGesamtKorrektur()) < 0.5 ? 'success' : 'error'}`}>
                  <span>Alle Fehler verteilt:</span>
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
          </Box>
      )}
      </Box>
    </>
  );
};

export default NivellementTable;