import { NivellementPunkt } from '../models/types';

// Import der benötigten Typen aus den Modellen
export interface Punkt {
  punktNr: string;
  absoluteHoehe: number | null;
}

export interface NivellementTableProps {
  punkte: NivellementPunkt[];
  onChange: (punkte: NivellementPunkt[]) => void;
  streckeLaenge: number;
  onStreckeLaengeChange: (streckeLaenge: number) => void;
  korrekturen: Record<string | number, number>;
  onKorrekturenChange?: (korrekturen: Record<string | number, number>) => void;
} 