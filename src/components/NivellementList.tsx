import { Nivellement } from '../models/types';
import { deleteNivellement } from '../utils/storage';

interface NivellementListProps {
  nivellements: Nivellement[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewNivellement: () => void;
  onRefresh: () => void;
}

const NivellementList: React.FC<NivellementListProps> = ({
  nivellements,
  onSelect,
  onDelete,
  onNewNivellement,
  onRefresh
}) => {
  const handleDelete = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('Möchten Sie dieses Nivellement wirklich löschen?')) {
      deleteNivellement(id);
      onDelete(id);
    }
  };

  return (
    <div className="nivellement-list">
      <div className="list-header">
        <h2>Gespeicherte Nivellements</h2>
        <div className="list-actions">
          <button onClick={onNewNivellement} className="new-button">
            Neues Nivellement
          </button>
          <button onClick={onRefresh} className="refresh-button">
            Aktualisieren
          </button>
        </div>
      </div>

      {nivellements.length === 0 ? (
        <div className="no-data">Keine Nivellements gefunden</div>
      ) : (
        <div className="nivellement-items">
          {nivellements.map((nivellement) => (
            <div
              key={nivellement.id}
              className="nivellement-item"
              onClick={() => onSelect(nivellement.id)}
            >
              <div className="item-info">
                <h3>{nivellement.name}</h3>
                <div className="item-details">
                  <span className="date">{nivellement.datum}</span>
                  <span className="points">{nivellement.punkte.length} Punkte</span>
                </div>
                <div className="item-stats">
                  <span>Start: {nivellement.startHoehe.toFixed(3)} m</span>
                  <span>Ende: {nivellement.endHoehe.toFixed(3)} m</span>
                  <span>ΔH: {(nivellement.endHoehe - nivellement.startHoehe).toFixed(3)} m</span>
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(nivellement.id, e)}
                className="delete-button"
              >
                Löschen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NivellementList; 