export interface NivellementPunkt {
  punktNr: string;
  rueckblick: number | null;
  mittelblick: number | null;
  vorblick: number | null;
  deltaH: number | null;
  absoluteHoehe: number | null;
  bemerkung: string;
  korrektur: number | null;
}

export interface NivellementAuswertung {
  summeRueckblick: number;
  summeVorblick: number;
  deltaHIst: number;
  deltaHSoll: number;
  fehlerV: number;
  zulaessigerFehlerV: number;
  istFehlerZulaessig: boolean;
  summeDeltaH: number;
  istSummeDeltaHKorrekt: boolean;
  probeMittelblicke: boolean;
}

export interface Nivellement {
  id: string;
  name: string;
  datum: string;
  startHoehe: number;
  endHoehe: number;
  streckeLaenge: number; // in Kilometern
  punkte: NivellementPunkt[];
  auswertung: NivellementAuswertung | null;
  korrekturen: Record<string | number, number>;
} 