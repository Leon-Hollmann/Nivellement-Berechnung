import { NivellementAuswertung } from '../models/types';

interface NivellementAuswertungViewProps {
  auswertung: NivellementAuswertung | null;
}

const NivellementAuswertungView: React.FC<NivellementAuswertungViewProps> = ({ auswertung }) => {
  if (!auswertung) {
    return <div className="no-data">Keine Auswertungsdaten verfügbar</div>;
  }

  return (
    <div className="auswertung-container">
      <h3>Auswertung des Nivellements</h3>
      
      <div className="wichtiger-hinweis">
        <h4>Wichtig:</h4>
        <p>Das Nivellement wird erst komplett ohne Mittelblicke ausgewertet!</p>
      </div>
      
      <div className="result-grid">
        <div className="result-item">
          <label>Summe Rückblick:</label>
          <span>{auswertung.summeRueckblick.toFixed(3)} m</span>
        </div>
        
        <div className="result-item">
          <label>Summe Vorblick:</label>
          <span>{auswertung.summeVorblick.toFixed(3)} m</span>
        </div>
        
        <div className="result-item">
          <label>Delta H (Ist):</label>
          <span>{auswertung.deltaHIst.toFixed(3)} m</span>
        </div>
        
        <div className="result-item">
          <label>Delta H (Soll):</label>
          <span>{auswertung.deltaHSoll.toFixed(3)} m</span>
        </div>
        
        <div className="result-item">
          <label>Fehler v:</label>
          <span>{auswertung.fehlerV.toFixed(3)} m</span>
        </div>
        
        <div className="result-item">
          <label>Zulässiger Fehler v_zul:</label>
          <span>{auswertung.zulaessigerFehlerV.toFixed(3)} m</span>
        </div>
        
        <div className="result-item">
          <label>Summe Delta H:</label>
          <span>{auswertung.summeDeltaH.toFixed(3)} m</span>
        </div>
      </div>
      
      <div className="check-results">
        <h4>Überprüfungen:</h4>
        
        <div className={`check-item ${auswertung.istFehlerZulaessig ? 'success' : 'error'}`}>
          <span className="check-label">Fehler zulässig (|v| ≤ v_zul):</span>
          <span className="check-result">
            {auswertung.istFehlerZulaessig ? 'Ja ✓' : 'Nein ✗'}
          </span>
        </div>
        
        <div className={`check-item ${auswertung.istSummeDeltaHKorrekt ? 'success' : 'error'}`}>
          <span className="check-label">Summe Delta H = Delta H (Soll):</span>
          <span className="check-result">
            {auswertung.istSummeDeltaHKorrekt ? 'Ja ✓' : 'Nein ✗'}
          </span>
        </div>
        
        <div className={`check-item ${auswertung.probeMittelblicke ? 'success' : 'error'}`}>
          <span className="check-label">Probe der Mittelblicke:</span>
          <span className="check-result">
            {auswertung.probeMittelblicke ? 'Korrekt ✓' : 'Fehler ✗'}
          </span>
        </div>
      </div>
      
      <div className="mittelblick-info">
        <h4>Mittelblick-Probe:</h4>
        <p>Für Mittelblicke gilt: Höhe(Mittelblick) + (m - v) = Höhe(nächster Wechselpunkt)</p>
      </div>
    </div>
  );
};

export default NivellementAuswertungView; 