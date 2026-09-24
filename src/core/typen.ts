/**
 * Domänentypen des Rechenkerns. Alle Beträge in CHF, Sätze als Dezimalzahl.
 * Beträge «heute» sind in heutiger Kaufkraft (real) zu verstehen.
 */

export type Geschlecht = 'm' | 'w';
export type Zivilstand = 'alleinstehend' | 'verheiratet';

export interface Monat {
  jahr: number;
  /** 1–12 */
  monat: number;
}

export type Indexierung =
  | { art: 'keine' } // nominal fix
  | { art: 'teuerung' } // folgt der (CH-)Teuerung → real konstant
  | { art: 'satz'; satz: number }; // fester nominaler Satz p.a.

/** Ausländische Rente (z.B. brasilianische INSS-Rente). */
export interface AuslandRente {
  id: string;
  bezeichnung: string;
  /** ISO-3166-Code des Zahlerstaates, optional (Länderdaten folgen) */
  land: string;
  /** ISO-4217-Währungscode, z.B. BRL, EUR */
  waehrung: string;
  /** Betrag pro Zahlung in Fremdwährung (heutiger Stand) */
  betrag: number;
  /** Anzahl Zahlungen pro Jahr (Brasilien INSS: 13 inkl. «13º salário») */
  zahlungenProJahr: number;
  /** Wechselkurs: CHF pro 1 Einheit Fremdwährung (Annahme, real konstant) */
  wechselkursChf: number;
  /** Beginn der Rente (Alter in Jahren, Dezimal erlaubt) */
  startAlter: number;
  indexierung: Indexierung;
  /** In der Schweiz als Einkommen steuerbar (DBA prüfen) */
  steuerbarInCh: boolean;
}

export interface AhvEingabe {
  /**
   * 'eingabe': Rente gemäss Rentenvorausberechnung (CHF/Monat, heutiger Wert, im RA, ungekürzt);
   * 'skala44': Schätzung mit Rentenformel aus mdJE und Beitragsjahren.
   */
  modus: 'eingabe' | 'skala44';
  renteMonat: number;
  /** massgebendes durchschnittliches Jahreseinkommen (heute) */
  mdje: number;
  /** Beitragsjahre bis RA (max. 44) */
  beitragsjahre: number;
  /** Negativ = Vorbezug (Monate), positiv = Aufschub (Monate), 0 = ordentlich */
  bezugVerschiebungMonate: number;
}

export interface PkEingabe {
  /** Altersguthaben heute */
  guthaben: number;
  /** 'eingabe': jährlicher Sparbeitrag AN+AG; 'bvgMinimum': Altersgutschrift auf koordiniertem Lohn */
  beitragModus: 'eingabe' | 'bvgMinimum';
  sparbeitragJahr: number;
  /** Anteil des Sparbeitrags, den die Arbeitnehmerin/der Arbeitnehmer trägt */
  anteilArbeitnehmer: number;
  /** Nominaler Projektionszins */
  zins: number;
  /** Umwandlungssatz im Bezugsalter */
  umwandlungssatz: number;
  /** Kapitalanteil 0–1 */
  kapitalanteil: number;
  /** Frühestes Bezugsalter gemäss Reglement (≥ 58) */
  fruehestesAlter: number;
  /** Optional fixes Bezugsalter; null = bei Erwerbsaufgabe (frühestens gemäss Reglement) */
  bezugsAlter: number | null;
}

export interface Saeule3aEingabe {
  guthaben: number;
  beitragJahr: number;
  /** Nominale Rendite */
  rendite: number;
  /** Optional fixes Bezugsalter; null = bei Erwerbsaufgabe (innerhalb RA−5 … RA) */
  bezugsAlter: number | null;
}

export interface Person {
  name: string;
  geburtsjahr: number;
  /** 1–12 */
  geburtsmonat: number;
  geschlecht: Geschlecht;
  /** Bruttolohn heute pro Jahr */
  lohn: number;
  /** Erwartete reale Lohnentwicklung p.a. */
  lohnwachstumReal: number;
  /** Gewünschtes Alter der Erwerbsaufgabe (Jahre, Dezimal = Monate/12) */
  stoppAlter: number;
  ahv: AhvEingabe;
  pk: PkEingabe;
  saeule3a: Saeule3aEingabe;
  auslandRenten: AuslandRente[];
}

export interface Ausgaben {
  /** Lebenshaltung pro Jahr, heute, ohne Steuern */
  lebenshaltung: number;
  /** Faktor ab Alter 75 bzw. 85 (Referenz: jüngere Person) */
  faktorAb75: number;
  faktorAb85: number;
}

export interface Annahmen {
  renditeNominal: number;
  inflation: number;
  /** Anlagekosten (TER) p.a. */
  kosten: number;
  /** Reale Rentenanpassung AHV p.a. (0 = Mischindex ≈ Teuerung) */
  ahvAnpassungReal: number;
  /** Steuerbarer Vermögensertrag in % des freien Vermögens (Zinsen/Dividenden, real) */
  steuerbarerErtrag: number;
  /** Verwaltungskostenzuschlag auf NE-Beiträgen */
  neVerwaltungskosten: number;
}

/** Kantons-/Gemeindesteuer im MVP als effektive Sätze (Nutzereingabe). */
export interface KantonSteuerEingabe {
  /** Kantonskürzel (Daten folgen), optional */
  kanton: string;
  einkommenSatz: number;
  vermoegenPromille: number;
  kapitalSatz: number;
}

/** Wohnsitz/Wegzug – Architektur vorbereitet, noch nicht gerechnet. */
export interface Wohnsitz {
  land: string; // 'CH'
  wegzug: { abJahr: number; land: string } | null;
}

export interface Haushalt {
  zivilstand: Zivilstand;
  /** 1 oder 2 Personen; bei 'verheiratet' genau 2 */
  personen: Person[];
  /** Planungshorizont: Alter der jüngeren Person (bis 999) */
  planungsalter: number;
  freiesVermoegen: number;
  ausgaben: Ausgaben;
  annahmen: Annahmen;
  steuern: KantonSteuerEingabe;
  wohnsitz: Wohnsitz;
}

export interface JahresZeile {
  jahr: number;
  /** Alter (vollendet am Jahresende) pro Person */
  alter: number[];
  lohn: number;
  ahv: number;
  pkRente: number;
  auslandRenten: number;
  kapitalBezuege: number;
  sozialabgaben: number;
  neBeitraege: number;
  steuernEinkommen: number;
  steuernKapital: number;
  steuernVermoegen: number;
  ausgaben: number;
  sparbeitraegeVorsorge: number;
  saldo: number;
  vermoegen: number;
  pkGuthaben: number;
  saeule3aGuthaben: number;
}

export interface PersonInfo {
  referenzalterMonate: number;
  ahvStart: Monat;
  ahvFaktor: number;
  ahvRenteMonatStart: number;
  pkStart: Monat;
  pkRenteJahr: number;
  pkKapital: number;
  saeule3aStart: Monat;
  saeule3aKapital: number;
  hinweise: string[];
}

export interface SimulationsErgebnis {
  zeilen: JahresZeile[];
  erfolg: boolean;
  ruinJahr: number | null;
  /** Alter der Referenzperson (jüngere) im Ruinjahr */
  ruinAlter: number | null;
  endVermoegen: number;
  personen: PersonInfo[];
}
