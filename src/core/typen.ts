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
  /** Reale Auf- (+) bzw. Abwertung (−) der Fremdwährung gegenüber dem CHF pro Jahr (Szenario, Standard 0) */
  wechselkursAenderung: number;
  /** Steuer im Quellenstaat in % der Bruttorente (Standard 0) */
  quellensteuerSatz: number;
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

/** Freizügigkeitskonto/-police: Bezug frühestens 5 Jahre vor, spätestens im RA (Art. 16 FZV). */
export interface FreizuegigkeitEingabe {
  guthaben: number;
  /** Nominaler Zins */
  zins: number;
  /** Optional fixes Bezugsalter; null = bei Erwerbsaufgabe (innerhalb RA−5 … RA) */
  bezugsAlter: number | null;
}

/** Sonstiges Vermögen (z.B. Beteiligung, Darlehen, Kunst) mit eigener Renditeannahme. */
export interface SonstigesVermoegen {
  bezeichnung: string;
  wert: number;
  /** Nominale Rendite */
  rendite: number;
}

export interface Saeule3aEingabe {
  guthaben: number;
  beitragJahr: number;
  /** Nominale Rendite */
  rendite: number;
  /** Optional fixes Bezugsalter; null = bei Erwerbsaufgabe (innerhalb RA−5 … RA) */
  bezugsAlter: number | null;
}

/** Selbstbewohntes Wohneigentum (vereinfacht wie angelegtes Kapital behandelt). */
export interface Wohneigentum {
  vorhanden: boolean;
  /** Verkehrswert heute */
  verkehrswert: number;
  /** Hypothek (Default 0) */
  hypothek: number;
}

/** Eingaben der AHV-Schätzhilfe (Jahrgang/Geschlecht kommen aus der Person). */
export interface AhvSchaetzhilfeEingabe {
  /** 'luecken': fehlende Beitragsjahre angeben; 'jahreCh': Beitragsjahre in der Schweiz bis zum RA */
  beitragsModus: 'luecken' | 'jahreCh';
  /** Fehlende Beitragsjahre in der Schweiz (ohne Auslandsjahre) */
  luecken: number;
  /** Beitragsjahre in der Schweiz bis zum Referenzalter (inkl. künftige) */
  jahreCh: number;
  /** Durchschnittliches AHV-pflichtiges Jahreseinkommen in heutigen Franken */
  einkommen: number;
  /** Anzahl Kalenderjahre der Ehe vor dem Referenzalter (für das Splitting) */
  ehejahre: number;
  /** Durchschnittseinkommen des Ehepartners während der Ehe (0 = aus der anderen Person übernehmen) */
  einkommenEhepartner: number;
  /** Jahre mit mindestens einem Kind unter 16 (Erziehungsgutschriften) */
  erziehungsJahre: number;
  /** Beitragsjahre im Ausland vorhanden? */
  ausland: boolean;
  auslandJahre: number;
}

/** Zeitpunkt als Alter (Jahre + Monate) oder als Kalendermonat. */
export type ZeitpunktModus = 'alter' | 'datum';

/** Staatsangehörigkeit für die freiwillige AHV (Art. 2 Abs. 1 AHVG). */
export type Nationalitaet = 'CH' | 'EU' | 'andere';

/** Wohnsitz ausserhalb der Schweiz ab einem Zeitpunkt (pro Person). */
export interface WohnsitzAusland {
  /** Wegzug geplant */
  aktiv: boolean;
  modus: ZeitpunktModus;
  /** Alter beim Wegzug (Jahre, Dezimal = Monate/12), bei modus 'alter' */
  alter: number;
  /** Erster Monat mit Wohnsitz im Ausland, bei modus 'datum' */
  datum: Monat;
  /** ISO-Code aus data/laender-2026.json oder 'XE' (anderes EU/EFTA-Land) / 'XX' (anderes Land) */
  land: string;
  nationalitaet: Nationalitaet;
  /** Unmittelbar vor dem Wegzug mindestens 5 Jahre ununterbrochen in der AHV versichert */
  vorherVersichert5Jahre: boolean;
  /** Beitritt zur freiwilligen AHV/IV gewünscht */
  freiwilligeAhv: boolean;
}

/**
 * Felder, die ohne Eingabe geschätzt werden (siehe core/schaetzwerte.ts). Ist ein Feld in
 * `Person.manuell` markiert, gilt der eingegebene Wert, sonst die Schätzung.
 */
export type SchaetzFeld = 'ahvRente' | 'pkGuthaben' | 'pkSparbeitrag' | 'pkUmwandlungssatz';

/** Eingabemodus der Oberfläche: wenige Felder mit Schätzwerten oder alle Felder. */
export type EingabeModus = 'schnell' | 'detailliert';

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
  /** Gewünschtes Alter der Erwerbsaufgabe (Jahre, Dezimal = Monate/12), bei stoppModus 'alter' */
  stoppAlter: number;
  /** Erwerbsaufgabe als Alter oder als Datum (letzter Arbeitsmonat) */
  stoppModus: ZeitpunktModus;
  /** Letzter Monat mit Erwerbseinkommen, bei stoppModus 'datum' */
  stoppDatum: Monat;
  /** Wohnsitz ausserhalb der Schweiz (Wegzug) */
  wohnsitzAusland: WohnsitzAusland;
  /** In der Schweiz wohnhaft seit (Kalenderjahr); 0 = keine Angabe (seit Geburt bzw. vor Beitragsbeginn) */
  inChSeit: number;
  /** Selbst eingegebene Werte, die sonst geschätzt würden */
  manuell: Partial<Record<SchaetzFeld, true>>;
  ahv: AhvEingabe;
  /** Eingaben der AHV-Schätzhilfe (nur Hilfsmittel; massgebend ist `ahv.renteMonat`) */
  ahvSchaetzhilfe: AhvSchaetzhilfeEingabe;
  pk: PkEingabe;
  saeule3a: Saeule3aEingabe;
  auslandRenten: AuslandRente[];
  /** Bargeld / Konten (verfügbar, Rendite `annahmen.renditeBargeld`) */
  bargeld: number;
  /** Wertschriften an der Börse (verfügbar, Rendite `annahmen.renditeNominal`) */
  wertschriften: number;
  freizuegigkeit: FreizuegigkeitEingabe;
  sonstiges: SonstigesVermoegen;
  wohneigentum: Wohneigentum;
}

export type PostenArt = 'einnahme' | 'ausgabe';
export type PostenKategorie = 'mieteinnahmen' | 'sonstigeEinnahme' | 'wohnen' | 'gesundheit' | 'sonstigeAusgabe';

/** Wiederkehrender Posten (Einnahme oder Ausgabe) mit Start-/Endalter einer Person. */
export interface Posten {
  id: string;
  bezeichnung: string;
  art: PostenArt;
  kategorie: PostenKategorie;
  /** Betrag pro Jahr in heutigen Franken */
  betragJahr: number;
  /** Index der Person, deren Alter massgebend ist */
  person: number;
  startAlter: number;
  /** null = bis zum Planungshorizont */
  endAlter: number | null;
  indexierung: Indexierung;
  /** Nur Einnahmen: in der Schweiz als Einkommen steuerbar */
  steuerbar: boolean;
}

/** Einmaliges Ereignis: positiver Betrag = Zufluss (z.B. Erbschaft), negativ = Abfluss (z.B. Auto). */
export interface Einmalereignis {
  id: string;
  bezeichnung: string;
  /** In heutigen Franken; + Zufluss, − Abfluss */
  betrag: number;
  person: number;
  /** Alter der Person beim Ereignis (Jahre, Dezimal = Monate/12) */
  alter: number;
}

export interface Ausgaben {
  /** Lebenshaltung pro Jahr, heute, ohne Steuern */
  lebenshaltung: number;
  /** Faktor ab Alter 75 bzw. 85 (Referenz: jüngere Person) */
  faktorAb75: number;
  faktorAb85: number;
}

export interface Annahmen {
  /** Nominale Rendite Wertschriften (Börse); gilt vereinfacht auch für Wohneigentum */
  renditeNominal: number;
  /** Nominaler Zins auf Bargeld/Konten */
  renditeBargeld: number;
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
export type Konfession = 'keine' | 'reformiert' | 'katholisch' | 'christkatholisch';

export interface KantonSteuerEingabe {
  /** Kantonskürzel ('' = nicht gewählt → effektive Sätze) */
  kanton: string;
  /** Gemeinde (nur ZH/AG mit exakten Steuerfüssen; '' = Hauptort) */
  gemeinde: string;
  /** Kirchensteuer (nur ZH/AG) */
  kirche: Konfession;
  /** Eigene effektive Sätze statt Kantonsdaten verwenden */
  eigeneSaetze: boolean;
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
  /** Weitere wiederkehrende Einnahmen und Ausgaben */
  posten: Posten[];
  ereignisse: Einmalereignis[];
  ausgaben: Ausgaben;
  annahmen: Annahmen;
  steuern: KantonSteuerEingabe;
  wohnsitz: Wohnsitz;
}

/** Vermögens-Töpfe (nie vermischt). */
export interface Toepfe {
  bargeld: number;
  wertschriften: number;
  sonstiges: number;
  wohneigentum: number;
  pk: number;
  freizuegigkeit: number;
  saeule3a: number;
}

export const VERFUEGBARE_TOEPFE = ['bargeld', 'wertschriften', 'sonstiges', 'wohneigentum'] as const;
export const GEBUNDENE_TOEPFE = ['pk', 'freizuegigkeit', 'saeule3a'] as const;

export interface JahresZeile {
  jahr: number;
  /** Alter (vollendet am Jahresende) pro Person */
  alter: number[];
  lohn: number;
  ahv: number;
  pkRente: number;
  auslandRenten: number;
  /** Weitere wiederkehrende Einnahmen (Miete usw.) */
  weitereEinnahmen: number;
  /** Einmalige Zu- (+) und Abflüsse (−) */
  einmalig: number;
  /** Kapitalbezüge PK/FZ/3a (fliessen in die Wertschriften der Person) */
  kapitalBezuege: number;
  sozialabgaben: number;
  /** AHV/IV/EO-Beiträge als Nichterwerbstätige (obligatorisch, Wohnsitz CH) */
  neBeitraege: number;
  /** Beiträge an die freiwillige AHV/IV (Wohnsitz ausserhalb EU/EFTA) inkl. Verwaltungskosten */
  freiwilligeAhv: number;
  steuernEinkommen: number;
  steuernKapital: number;
  steuernVermoegen: number;
  /** Lebenshaltung + weitere Ausgaben */
  ausgaben: number;
  sparbeitraegeVorsorge: number;
  saldo: number;
  /** Töpfe am Jahresende, Summe aller Personen */
  toepfe: Toepfe;
  /** Töpfe am Jahresende pro Person */
  toepfeProPerson: Toepfe[];
  verfuegbar: number;
  gebunden: number;
  /** Nicht gedeckter Fehlbetrag (kumuliert) */
  fehlbetrag: number;
  /** Verfügbares Vermögen abzüglich Fehlbetrag (kompatibel: «vermoegen») */
  vermoegen: number;
  total: number;
  /** Fehlbetrag, obwohl noch gebundenes Vorsorgevermögen vorhanden ist */
  liquiditaetsluecke: boolean;
  /** Wohneigentum musste angetastet werden */
  wohneigentumAngetastet: boolean;
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
  freizuegigkeitStart: Monat;
  freizuegigkeitKapital: number;
  /** Erster Monat mit Wohnsitz im Ausland (null = kein Wegzug) */
  wegzug: Monat | null;
  /** Freiwillige AHV wird gerechnet (Wunsch und Voraussetzungen erfüllt) */
  freiwilligeAhvAktiv: boolean;
  /** Beitragsjahre, die wegen Auslandswohnsitz ohne freiwillige AHV fehlen (gerundet) */
  ahvLueckenAusland: number;
  /** Faktor auf die AHV-Rente wegen dieser Lücken (1 = keine Kürzung) */
  ahvLueckenFaktor: number;
  /** Beiträge an die freiwillige AHV pro Kalenderjahr (heutige CHF) */
  freiwilligeAhvJahre: { jahr: number; betrag: number }[];
  /** Obligatorische NE-Beiträge pro Kalenderjahr (heutige CHF) */
  neBeitraegeJahre: { jahr: number; betrag: number }[];
  hinweise: string[];
}

export interface SimulationsErgebnis {
  zeilen: JahresZeile[];
  erfolg: boolean;
  ruinJahr: number | null;
  /** Alter der Referenzperson (jüngere) im Ruinjahr */
  ruinAlter: number | null;
  endVermoegen: number;
  /** Jahre mit Liquiditätslücke (Fehlbetrag bei noch gesperrtem Vorsorgevermögen) */
  liquiditaetsluecken: number[];
  /** Erstes Jahr, in dem Wohneigentum für Ausgaben angetastet wird */
  wohneigentumAngetastetJahr: number | null;
  personen: PersonInfo[];
}
