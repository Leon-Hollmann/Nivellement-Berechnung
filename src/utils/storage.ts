import { Nivellement } from '../models/types';

const STORAGE_KEY = 'nivellements';

// Alle Nivellements aus dem localStorage laden
export const loadNivellements = (): Nivellement[] => {
  const storedData = localStorage.getItem(STORAGE_KEY);
  if (!storedData) return [];
  
  try {
    return JSON.parse(storedData);
  } catch (error) {
    console.error('Fehler beim Laden der Nivellements:', error);
    return [];
  }
};

// Ein einzelnes Nivellement laden
export const loadNivellement = (id: string): Nivellement | null => {
  const nivellements = loadNivellements();
  return nivellements.find(n => n.id === id) || null;
};

// Ein Nivellement speichern (neu hinzufügen oder aktualisieren)
export const saveNivellement = (nivellement: Nivellement): void => {
  const nivellements = loadNivellements();
  const index = nivellements.findIndex(n => n.id === nivellement.id);
  
  if (index >= 0) {
    // Existierendes Nivellement aktualisieren
    nivellements[index] = nivellement;
  } else {
    // Neues Nivellement hinzufügen
    nivellements.push(nivellement);
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nivellements));
  } catch (error) {
    console.error('Fehler beim Speichern des Nivellements:', error);
  }
};

// Ein Nivellement löschen
export const deleteNivellement = (id: string): void => {
  const nivellements = loadNivellements();
  const updatedNivellements = nivellements.filter(n => n.id !== id);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNivellements));
  } catch (error) {
    console.error('Fehler beim Löschen des Nivellements:', error);
  }
}; 