import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Nivellement, NivellementPunkt } from '../models/types';
import { evaluateNivellement, updateNivellementPunkte } from '../utils/calculations';
import { saveNivellement } from '../utils/storage';
import NivellementTable from './NivellementTable';
import NivellementAuswertungView from './NivellementAuswertungView';

interface NivellementFormProps {
  initialNivellement?: Nivellement;
  onSave: (id: string) => void;
}

const NivellementForm: React.FC<NivellementFormProps> = ({ initialNivellement, onSave }) => {
  const [name, setName] = useState<string>(initialNivellement?.name || '');
  const [datum, setDatum] = useState<string>(
    initialNivellement?.datum || new Date().toISOString().split('T')[0]
  );
  
  // Diese Werte werden direkt aus den Punkten abgeleitet
  const defaultStartHoehe = initialNivellement?.startHoehe || 100;
  const defaultEndHoehe = initialNivellement?.endHoehe || 100;
  const [streckeLaenge, setStreckeLaenge] = useState<number>(initialNivellement?.streckeLaenge || 1);
  
  // Initialisiere Punkte mit MB-Start und MB-Ende
  const [punkte, setPunkte] = useState<NivellementPunkt[]>(
    initialNivellement?.punkte || [
      {
        punktNr: initialNivellement?.punkte?.[0]?.punktNr || 'MB1',
        rueckblick: null,
        mittelblick: null,
        vorblick: null,
        deltaH: null,
        absoluteHoehe: defaultStartHoehe,
        bemerkung: 'Amtliche Höhe Start'
      },
      {
        punktNr: initialNivellement?.punkte?.[initialNivellement?.punkte.length - 1]?.punktNr || 'MB2',
        rueckblick: null,
        mittelblick: null,
        vorblick: null,
        deltaH: null,
        absoluteHoehe: defaultEndHoehe,
        bemerkung: 'Amtliche Höhe Ende'
      }
    ]
  );
  
  const [nivellementId] = useState<string>(initialNivellement?.id || uuidv4());
  const [auswertung, setAuswertung] = useState(initialNivellement?.auswertung || null);

  // Aktualisiere die Berechnungen, wenn sich relevante Daten ändern
  useEffect(() => {
    // Aktuelle Werte aus den Punkten extrahieren
    const currentStartHoehe = punkte.length > 0 ? punkte[0].absoluteHoehe || defaultStartHoehe : defaultStartHoehe;
    const currentEndHoehe = punkte.length > 1 ? punkte[punkte.length - 1].absoluteHoehe || defaultEndHoehe : defaultEndHoehe;
    
    // Vermeide Updates, wenn sich nichts geändert hat
    const updatedPunkte = updateNivellementPunkte([...punkte], currentStartHoehe);
    
    // Stelle sicher, dass der Endpunkt die korrekte Höhe hat
    if (updatedPunkte.length > 1) {
      const lastIndex = updatedPunkte.length - 1;
      if (updatedPunkte[lastIndex].punktNr.startsWith('MB')) {
        updatedPunkte[lastIndex] = {
          ...updatedPunkte[lastIndex],
          absoluteHoehe: currentEndHoehe
        };
      }
    }
    
    // Prüfe, ob sich tatsächlich etwas geändert hat
    const hasChanged = JSON.stringify(updatedPunkte) !== JSON.stringify(punkte);
    
    if (hasChanged) {
      setPunkte(updatedPunkte);
    }
    
    // Nivellement erstellen und auswerten
    const nivellement: Nivellement = {
      id: nivellementId,
      name,
      datum,
      startHoehe: currentStartHoehe,
      endHoehe: currentEndHoehe,
      streckeLaenge,
      punkte: updatedPunkte,
      auswertung: null
    };
    
    const newAuswertung = evaluateNivellement(nivellement);
    setAuswertung(newAuswertung);
  }, [punkte, nivellementId, name, datum, defaultStartHoehe, defaultEndHoehe, streckeLaenge]);
  
  const handlePunkteChange = (newPunkte: NivellementPunkt[]) => {
    setPunkte(newPunkte);
  };
  
  const handleStreckeLaengeChange = (newStreckeLaenge: number) => {
    setStreckeLaenge(newStreckeLaenge);
  };
  
  const handleSave = () => {
    // Aktuelle Werte aus den Punkten extrahieren
    const currentStartHoehe = punkte.length > 0 ? punkte[0].absoluteHoehe || defaultStartHoehe : defaultStartHoehe;
    const currentEndHoehe = punkte.length > 1 ? punkte[punkte.length - 1].absoluteHoehe || defaultEndHoehe : defaultEndHoehe;
    
    // Stelle sicher, dass die Endpunkthöhe korrekt ist
    const updatedPunkte = [...punkte];
    if (updatedPunkte.length > 1) {
      const lastIndex = updatedPunkte.length - 1;
      if (updatedPunkte[lastIndex].punktNr.startsWith('MB')) {
        updatedPunkte[lastIndex] = {
          ...updatedPunkte[lastIndex],
          absoluteHoehe: currentEndHoehe
        };
      }
    }
    
    const nivellement: Nivellement = {
      id: nivellementId,
      name,
      datum,
      startHoehe: currentStartHoehe,
      endHoehe: currentEndHoehe,
      streckeLaenge,
      punkte: updatedPunkte,
      auswertung
    };
    
    saveNivellement(nivellement);
    onSave(nivellementId);
  };
  
  return (
    <div className="nivellement-form">
      <div className="form-header">
        <h2>{initialNivellement ? 'Nivellement bearbeiten' : 'Neues Nivellement'}</h2>
      </div>
      
      <div className="form-group">
        <div className="input-group">
          <label htmlFor="name">Name:</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name des Nivellements"
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="datum">Datum:</label>
          <input
            type="date"
            id="datum"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
          />
        </div>
      </div>
      
      <div className="table-container">
        <h3>Messdaten</h3>
        <NivellementTable 
          punkte={punkte} 
          onChange={handlePunkteChange} 
          streckeLaenge={streckeLaenge}
          onStreckeLaengeChange={handleStreckeLaengeChange}
        />
      </div>
      
      <div className="form-actions">
        <button onClick={handleSave} className="save-button">Speichern</button>
      </div>
    </div>
  );
};

export default NivellementForm; 