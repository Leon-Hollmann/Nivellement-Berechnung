import { useState } from 'react';
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
}

const NivellementTable: React.FC<NivellementTableProps> = ({ punkte, onChange }) => {
  // Referenzen für Start- und Endpunkt
  const [startPunkt, setStartPunkt] = useState({
    punktNr: punkte.length > 0 ? punkte[0].punktNr : 'MB25',
    absoluteHoehe: punkte.length > 0 ? punkte[0].absoluteHoehe : 145.321
  });
  
  const [endPunkt, setEndPunkt] = useState({
    punktNr: punkte.length > 0 ? punkte[punkte.length - 1].punktNr : 'MB27',
    absoluteHoehe: punkte.length > 0 ? punkte[punkte.length - 1].absoluteHoehe : 148.786
  });
  
  // Leere Zeile, die am Ende angezeigt wird
  const [newRow, setNewRow] = useState<NivellementPunkt>({
    punktNr: '',
    rueckblick: null,
    mittelblick: null,
    vorblick: null,
    deltaH: null,
    absoluteHoehe: null,
    bemerkung: ''
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
    if (field === 'punktNr' || field === 'bemerkung') {
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

  // Bestimmt die nächste Punktnummer basierend auf der aktuellen
  const getNextPunktNr = (currentPunktNr: string) => {
    if (currentPunktNr.startsWith('W')) {
      return 'M';
    } else if (currentPunktNr.startsWith('M')) {
      return 'W';
    } else {
      return 'W';
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
      // Füge die neue Zeile vor dem letzten Punkt ein
      let updatedPunkte = [...punkte.slice(0, -1), newRow, punkte[punkte.length - 1]];
      
      // Nummeriere alle Punkte neu
      updatedPunkte = renumberPoints(updatedPunkte);
      
      onChange(updatedPunkte);
      
      // Setze die neue Zeile zurück
      setNewRow({
        punktNr: getNextPunktNr(newRow.punktNr),
        rueckblick: null,
        mittelblick: null,
        vorblick: null,
        deltaH: null,
        absoluteHoehe: null,
        bemerkung: ''
      });
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
            .nivellement-table table col.col-rueckblick { width: 110px; }
            .nivellement-table table col.col-mittelblick { width: 110px; }
            .nivellement-table table col.col-vorblick { width: 110px; }
            .nivellement-table table col.col-delta-h { width: 80px; }
            .nivellement-table table col.col-abs-hoehe { width: 110px; }
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
              <th>Delta h</th>
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
                  const isStatic = index === 0 || index === punkte.length - 1;
                  
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
                            <input
                              type="number"
                              step="0.001"
                              value={punkt.rueckblick !== null ? punkt.rueckblick : ''}
                              onChange={(e) => handleInputChange(index, 'rueckblick', e.target.value)}
                              disabled={!isFieldEditable(punkt.punktNr, 'rueckblick', index, punkte.length - 1)}
                              className={!isFieldEditable(punkt.punktNr, 'rueckblick', index, punkte.length - 1) ? 'disabled-input' : ''}
                            />
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
                            <span>{punkt.deltaH !== null ? punkt.deltaH.toFixed(3) : '-'}</span>
                          </td>
                          <td>
                            {(index === 0) ? (
                              <span>{startPunkt.absoluteHoehe !== null ? startPunkt.absoluteHoehe.toFixed(3) : '-'}</span>
                            ) : (index === punkte.length - 1) ? (
                              <span>{endPunkt.absoluteHoehe !== null ? endPunkt.absoluteHoehe.toFixed(3) : '-'}</span>
                            ) : (
                              <span>{punkt.absoluteHoehe !== null ? punkt.absoluteHoehe.toFixed(3) : '-'}</span>
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
                >
                  <option value="W">Wechselpunkt (W)</option>
                  <option value="M">Mittelblick (M)</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  step="0.001"
                  value={newRow.rueckblick !== null ? newRow.rueckblick : ''}
                  onChange={(e) => handleNewRowInputChange('rueckblick', e.target.value)}
                  disabled={!isFieldEditable(newRow.punktNr || 'W', 'rueckblick', -1, -1)}
                  className={!isFieldEditable(newRow.punktNr || 'W', 'rueckblick', -1, -1) ? 'disabled-input' : ''}
                  placeholder="Rückblick"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.001"
                  value={newRow.mittelblick !== null ? newRow.mittelblick : ''}
                  onChange={(e) => handleNewRowInputChange('mittelblick', e.target.value)}
                  disabled={!isFieldEditable(newRow.punktNr || 'M', 'mittelblick', -1, -1)}
                  className={!isFieldEditable(newRow.punktNr || 'M', 'mittelblick', -1, -1) ? 'disabled-input' : ''}
                  placeholder="Mittelblick"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.001"
                  value={newRow.vorblick !== null ? newRow.vorblick : ''}
                  onChange={(e) => handleNewRowInputChange('vorblick', e.target.value)}
                  disabled={!isFieldEditable(newRow.punktNr || 'W', 'vorblick', -1, -1)}
                  className={!isFieldEditable(newRow.punktNr || 'W', 'vorblick', -1, -1) ? 'disabled-input' : ''}
                  placeholder="Vorblick"
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
      
      <div className="punkt-info">
        <h4 className="punkt-info-title">Hinweise zur Bedienung:</h4>
        <ul className="punkt-info-list">
          <li className="punkt-info-item">
            <strong>Neue Zeile:</strong> Wählen Sie den Punkttyp in der untersten Zeile aus und klicken Sie auf "Hinzufügen".
          </li>
          <li className="punkt-info-item">
            <strong>Umordnen:</strong> Zeilen können mit dem Ziehgriff links verschoben werden (Start- und Endpunkt bleiben fixiert).
          </li>
        </ul>

        <h4 className="punkt-info-title">Punktbezeichnungen und Messregeln:</h4>
        <ul className="punkt-info-list">
          <li className="punkt-info-item">
            <strong>MB[Nummer]</strong>: Amtliche Höhen (Messpunkte) am Anfang und Ende des Nivellements.
            <ul>
              <li>Der erste MB-Punkt hat nur Rückblick.</li>
              <li>Der letzte MB-Punkt hat nur Vorblick.</li>
            </ul>
          </li>
          <li className="punkt-info-item">
            <strong>W[Nummer]</strong>: Wechselpunkte mit Rückblick und Vorblick.
            <ul>
              <li>Für W-Punkte gilt: Δh = r<sub>vorheriger Punkt</sub> - v<sub>aktueller Punkt</sub></li>
              <li>Die Absolute Höhe berechnet sich aus: H<sub>vorheriger Punkt</sub> + Δh</li>
            </ul>
          </li>
          <li className="punkt-info-item">
            <strong>M[Nummer]</strong>: Mittelblick-Punkte mit Mittelblick und Vorblick.
            <ul>
              <li>Für den ersten Mittelblick nach W/MB: Δh = r<sub>vorheriger Punkt</sub> - v<sub>aktueller Punkt</sub></li>
              <li>Für weitere Mittelblicke nach einem Mittelblick: Δh = m<sub>vorheriger Punkt</sub> - v<sub>aktueller Punkt</sub></li>
              <li>Die Probe: Δh<sub>W bis W</sub> = Σ Δh<sub>Mittelblicke</sub></li>
            </ul>
          </li>
        </ul>
        <div className="wichtiger-hinweis punkt-info-wichtig">
          <h4>Wichtig:</h4>
          <p>Das Nivellement wird erst komplett ohne Mittelblicke ausgewertet!</p>
        </div>
      </div>
    </>
  );
};

export default NivellementTable; 