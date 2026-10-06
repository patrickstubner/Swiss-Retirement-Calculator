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

/** Ausländische Rente (z.B. Rente aus dem Ausland in EUR oder BRL). */
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
  /**
   * Davon BVG-Altersguthaben (Obligatorium) heute laut Vorsorgeausweis; 0 = unbekannt → Schätzung.
   * Wird nur für die Schätzung des Umwandlungssatzes verwendet (ohne eigenen Satz).
   */
  bvgGuthaben: number;
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

/** Zeitpunkt des Verkaufs einer Liegenschaft (Schema 7) */
export type VerkaufZeitpunkt = 'ruecktritt' | 'wegzug' | 'datum';

/** Verkauf der Liegenschaft als Ereignis (Schema 7, Standard: kein Verkauf) */
export interface WohnVerkauf {
  aktiv: boolean;
  zeitpunkt: VerkaufZeitpunkt;
  /** Verkaufsmonat bei `zeitpunkt` 'datum' */
  datum: Monat;
  /** Anlagekosten (Kaufpreis inkl. wertvermehrende Investitionen), nominal CHF */
  anlagekosten: number;
  /** Kauf (Beginn der Besitzdauer) */
  kauf: Monat;
  /** Verkaufskosten (Makler, Inserate usw.) in % des Verkaufspreises */
  verkaufskostenAnteil: number;
  /** Eigener effektiver Satz der Grundstückgewinnsteuer (null = Tarif des Kantons bzw. Näherung) */
  eigenerSatz: number | null;
}

/** Nutzung einer behaltenen Schweizer Liegenschaft nach dem Wegzug (Schema 7) */
export type NutzungNachWegzug = 'leer' | 'vermietet';

/**
 * Wohneigentum. Verkehrswert und Hypothek werden getrennt geführt: Die Wertänderung wirkt auf den
 * ganzen Verkehrswert (Hebel), die Hypothek bleibt stehen (Schema 7).
 */
export interface Wohneigentum {
  vorhanden: boolean;
  /** Verkehrswert heute */
  verkehrswert: number;
  /** Hypothek (Default 0) */
  hypothek: number;
  /** Hypothekarzins (nominal, Anteil pro Jahr); nur mit separaten Wohnkosten */
  hypothekarzins: number;
  /** Unterhalt als 'prozent' des Verkehrswerts oder fester Betrag 'chf' pro Jahr (heutige Franken) */
  unterhaltArt: 'prozent' | 'chf';
  unterhaltProzent: number;
  unterhaltChf: number;
  /** Eigenmietwert pro Jahr laut Steuererklärung (heutige Franken; 0 = nicht erfasst), bis Ende 2028 */
  eigenmietwert: number;
  /** Nach dem Wegzug: leer (zur Verfügung) oder vermietet */
  nachWegzug: NutzungNachWegzug;
  /** Mieteinnahmen brutto pro Monat (heutige Franken), falls vermietet */
  mieteinnahmenMonat: number;
  verkauf: WohnVerkauf;
}

/**
 * Separate Wohnkosten (Schema 7). Aus (Standard): Wohnkosten stecken in den Ausgaben, gerechnet wird
 * wie bisher. An: Hypothekarzins, Unterhalt und Miete werden separat gerechnet – dann gehören sie
 * nicht mehr in die Lebenshaltungskosten.
 */
export interface Wohnen {
  separat: boolean;
  /** Miete pro Monat in heutigen Franken (Mieter bzw. nach dem Verkauf, bis zum Wegzug) */
  mieteMonat: number;
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
  /** Jahre mit Betreuung pflegebedürftiger Verwandter (Betreuungsgutschriften, MB 1.03) */
  betreuungsJahre: number;
  /** Beitragsjahre im Ausland vorhanden? */
  ausland: boolean;
  auslandJahre: number;
}

/** Zeitpunkt als Alter (Jahre + Monate) oder als Kalendermonat. */
export type ZeitpunktModus = 'alter' | 'datum';

/**
 * Staatsangehörigkeit für die freiwillige AHV (Art. 2 Abs. 1 AHVG). «andere» umfasst Staatsangehörige von
 * Abkommensstaaten (z.B. Brasilien) und von Staaten ohne Abkommen; die Rechnung unterscheidet nicht (K-10, OFFEN:
 * Landesliste mit Abkommensstatus und das Wahlrecht Rente/Rückvergütung für AU, BR, TN, UY, PH sind nicht modelliert).
 * Quellen: ZAS https://www.zas.admin.ch/de/staatsangehoerigkeit-eines-staates-mit-sozialversicherungsabkommen-ahv
 * (Stand 17.3.2025), Abkommen CH–BR SR 0.831.109.198.1 Art. 5 und 33 (https://www.fedlex.admin.ch/eli/cc/2019/523/de).
 */
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
  /**
   * Barauszahlung von PK-, Freizügigkeits- und 3a-Guthaben beim Wegzug (Art. 5 Abs. 1 lit. a FZG,
   * Art. 3 Abs. 2 lit. d BVV 3). Nur wirksam, wenn der Wegzug vor dem PK-Bezugsalter liegt.
   */
  barauszahlung: boolean;
  /** EU/EFTA: im neuen Land nicht obligatorisch für Alter/Tod/Invalidität versichert → Art. 25f FZG greift nicht */
  nichtObligatorischVersichert: boolean;
  /** Sitzkanton der Vorsorge-/Freizügigkeitseinrichtung (Quellensteuer); '' = wie Wohnkanton */
  sitzkantonVorsorge: string;
  /** Sitzkanton der Freizügigkeitseinrichtung; '' = wie `sitzkantonVorsorge` (Schema 10) */
  sitzkantonFz: string;
  /** Sitzkanton des 3a-Anbieters; '' = wie `sitzkantonVorsorge` (Schema 10) */
  sitzkanton3a: string;
  /**
   * Eigener effektiver Steuersatz im Zielland auf alle Einkünfte (Anteil, z.B. 0.15); null = Modell
   * des Landes aus data/laender-2026.json (core/zielland.ts)
   */
  steuerSatzZielland: number | null;
  /** Länderspezifische Option, z.B. 'it7' (Italien 7 %) oder 'azoren' (Portugal); '' = keine */
  steuerOption: string;
  /** Schweizer Quellensteuer auf Vorsorgekapital gemäss DBA zurückfordern (nur wo ESTV 2-217 «ja») */
  qstKapitalRueckforderung: boolean;
  /** Eigener Steuersatz im Zielland auf zurückgefordertes Vorsorgekapital; null = Satz des Landes, falls bekannt */
  steuerSatzKapitalZielland: number | null;
}

/**
 * Felder, die ohne Eingabe geschätzt werden (siehe core/schaetzwerte.ts). Ist ein Feld in
 * `Person.manuell` markiert, gilt der eingegebene Wert, sonst die Schätzung.
 */
export type SchaetzFeld = 'ahvRente' | 'pkGuthaben' | 'pkSparbeitrag' | 'pkUmwandlungssatz';

/** Eingabemodus der Oberfläche: wenige Felder mit Schätzwerten oder alle Felder. */
export type EingabeModus = 'schnell' | 'detailliert';

/** Erwerbsstatus: 'nichtErwerbstaetig' = z.B. Familienarbeit (kein Lohn, keine PK-/3a-Einzahlungen). */
export type Erwerbsstatus = 'erwerbstaetig' | 'nichtErwerbstaetig';

/** Frühere Erwerbstätigkeit in der Schweiz (nur bei 'nichtErwerbstaetig', für die AHV-Schätzung). */
export interface FruehererErwerb {
  /** Anzahl Jahre mit Erwerbseinkommen in der Schweiz */
  jahre: number;
  /** Durchschnittliches AHV-pflichtiges Einkommen in diesen Jahren (heutige Franken) */
  lohn: number;
}

export interface Person {
  name: string;
  geburtsjahr: number;
  /** 1–12 */
  geburtsmonat: number;
  geschlecht: Geschlecht;
  /** Erwerbstätig oder nicht erwerbstätig (Familienarbeit) */
  erwerbsstatus: Erwerbsstatus;
  /** Frühere Erwerbstätigkeit in der Schweiz (nur bei nicht Erwerbstätigen verwendet) */
  frueherErwerb: FruehererErwerb;
  /** Bruttolohn heute pro Jahr (bei nicht Erwerbstätigen ignoriert, bleibt gespeichert) */
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

/** Bezug der Ausgabenphasen: Kalenderjahr oder Alter einer Person (Alter, das im Jahr erreicht wird). */
export type AusgabenBezug = 'jahr' | 'alter';
export type BetragEinheit = 'jahr' | 'monat';

/**
 * Ausgabenphase (Detailmodus): Lebenshaltung von … bis … (beide inklusive), in heutigen Franken.
 * Bei `bezug: 'alter'` sind `von`/`bis` Alter der Person `Ausgaben.phasenPerson`, sonst Kalenderjahre.
 */
export interface AusgabenPhase {
  id: string;
  von: number;
  /** null = bis zum Planungshorizont */
  bis: number | null;
  betrag: number;
  einheit: BetragEinheit;
}

/** Abweichung für ein einzelnes Kalenderjahr: ersetzt die Lebenshaltung dieses Jahres (heutige Franken). */
export interface AusgabenEinzeljahr {
  id: string;
  jahr: number;
  betrag: number;
  einheit: BetragEinheit;
}

export interface Ausgaben {
  /** Lebenshaltung pro Jahr, heute, ohne Steuern (Grundbetrag: gilt in Jahren ohne Phase) */
  lebenshaltung: number;
  /** Faktor ab Alter 75 bzw. 85 (Referenz: jüngere Person); nur auf den Grundbetrag */
  faktorAb75: number;
  faktorAb85: number;
  phasenBezug: AusgabenBezug;
  /** Person, deren Alter bei `phasenBezug: 'alter'` massgebend ist */
  phasenPerson: number;
  phasen: AusgabenPhase[];
  einzeljahre: AusgabenEinzeljahr[];
}

export interface Annahmen {
  /** Nominale Rendite Wertschriften (Börse); gilt vereinfacht auch für Wohneigentum */
  renditeNominal: number;
  /**
   * Aktienanteil der Wertschriften (Rest Obligationen). Nur für Krisenszenarien und Monte Carlo:
   * historische Portfoliorendite = Anteil × Aktien + (1 − Anteil) × Obligationen. Annahme des Nutzers.
   */
  aktienanteil: number;
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

/**
 * Stufe der Strategie «Dynamisch gestaffelt»: ab diesem realen Vorjahreswachstum gilt `satz`
 * (die höchste passende Untergrenze gewinnt; exakt auf der Grenze zählt zur höheren Stufe).
 */
export interface EntnahmeStufe {
  /** Stabile Kennung für die Oberfläche */
  id: string;
  /** Untergrenze des realen Vorjahreswachstums (Dezimal, z.B. 0.14 oder −0.04) */
  abWachstum: number;
  /** Entnahmesatz vom aktuellen freien Finanzvermögen */
  satz: number;
}

/** Rolle eines Topfes in der Mehr-Töpfe-Strategie. */
export type EntnahmeTopfRolle = 'aktien' | 'mittel' | 'cash';

/** Ein Topf der Mehr-Töpfe-Strategie (Anlage oder Puffer). */
export interface EntnahmeTopfVorlage {
  rolle: EntnahmeTopfRolle;
  /** Anzeigename, editierbar */
  label: string;
  /**
   * Anteil am Betrag, der nach dem Cash-Puffer übrig bleibt (Aktien und Mittel).
   * Beim Cash-Topf unbenutzt: dessen Grösse setzt die Pufferregel.
   */
  anteil: number;
  /** Erwartete reale Rendite pro Jahr */
  renditeReal: number;
}

/**
 * Entnahme aus dem freien Finanzvermögen (Bargeld, Wertschriften, Sonstiges; ohne Wohneigentum
 * und ohne noch gebundene Vorsorge). AHV, Pensionskasse und weitere Einnahmen bleiben daneben
 * bestehen. Siehe `src/core/entnahme.ts`.
 */
export type Entnahme =
  | { art: 'gestaffelt'; stufen: EntnahmeStufe[] }
  | { art: 'statisch'; quelle: 'ausgaben' | 'satz' /** Anfangssatz, nur bei quelle «satz» */; satz: number }
  | { art: 'dynamisch' /** Fester Satz vom jeweils aktuellen freien Vermögen */; satz: number }
  | {
      art: 'annuitaet';
      /** «gewichtet»: Aktienanteil × Aktienrendite + Rest × Obligationenrendite; «satz»: ein Satz */
      renditeModus: 'gewichtet' | 'satz';
      aktienReal: number;
      obligationenReal: number;
      satz: number;
    }
  | {
      art: 'toepfe';
      anzahl: 2 | 3;
      /** Puffer zu Beginn der Entnahmephase, in Monaten des Nettobedarfs */
      pufferMonateStart: number;
      /** Zielpuffer in Monaten */
      pufferMonateZiel: number;
      /** Jahre, über die der Puffer vom Start zum Ziel wächst */
      aufbauJahre: number;
      /**
       * Keine Umschichtung aus einem Risikotopf in den Puffer, wenn dessen reale Jahresrendite
       * darunter liegt. Ausgaben werden trotzdem bezahlt.
       */
      keinVerkaufUnter: number;
      toepfe: EntnahmeTopfVorlage[];
    };

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
  /** Krisenszenarien und Monte Carlo (Schema 5) */
  krisen: KrisenEinstellungen;
  /** Separate Wohnkosten (Schema 7) */
  wohnen: Wohnen;
  /**
   * Anzeige der Ergebnisse (Schema 8): 'real' = heutige Kaufkraft (Standard), 'nominal' = Franken des
   * jeweiligen Jahres. Beeinflusst die Rechnung nicht.
   */
  darstellung?: 'real' | 'nominal';
  /** Todesfall-Szenario (Schema 9); fehlt bei älteren Ständen = kein Todesfall */
  todesfall?: Todesfall;
  /** Staffelung der Kapitalbezüge (Schema 11); fehlt bei älteren Ständen = keine Staffelung */
  staffelung?: Staffelung;
  /**
   * Entnahmestrategie für das freie Finanzvermögen (Schema 12). Fehlt sie, gilt der Standard
   * «Dynamisch gestaffelt» (`standardEntnahme` in core/entnahme.ts).
   */
  entnahme?: Entnahme;
}

/**
 * Staffelung der Kapitalbezüge (Schema 11): Freizügigkeit und 3a (und optional das PK-Kapital) werden in bis zu
 * `jahre` gleich grossen Schritten im Abstand von einem Jahr bezogen, damit jede Kapitalleistung einzeln (mit
 * tieferer Progression) besteuert wird. Nicht für Personen mit erfasstem Wegzug (Quellensteuer, Barauszahlung).
 */
export interface Staffelung {
  aktiv: boolean;
  /** Anzahl Bezugsjahre (1 = ein Bezug, keine Staffelung) */
  jahre: number;
  /** PK-Kapital in Teilschritten (Teilpensionierung, Art. 13a/13b BVG; höchstens 3 Schritte) */
  pk: boolean;
  /** Freizügigkeit (höchstens zwei Einrichtungen, Art. 12 FZV) */
  fz: boolean;
  /** Säule 3a (mehrere Konten nötig, jedes wird ganz bezogen) */
  s3a: boolean;
}

/**
 * Todesfall-Szenario (Schema 9): Eine Person eines Ehepaars stirbt zu einem Zeitpunkt. Die überlebende Person
 * erhält AHV-Witwen-/Witwerrente bzw. Altersrente, PK-Ehegattenrente (60 %), Freizügigkeit und 3a als Kapital
 * und wird ab dem Folgejahr als alleinstehend besteuert. Die Ausgaben sinken um den Faktor `ausgabenFaktor`.
 */
export interface Todesfall {
  aktiv: boolean;
  /** Verstorbene Person (Index in `personen`) */
  person: number;
  /** Zeitpunkt: Alter der verstorbenen Person oder Kalenderjahr (Jahresmitte) */
  modus: 'alter' | 'jahr';
  alter: number;
  jahr: number;
  /** Faktor auf die geplante Lebenshaltung nach dem Tod (Einpersonenhaushalt, Näherung, editierbar) */
  ausgabenFaktor: number;
  /** Ehejahre heute (für Art. 19 BVG und AHV-Witwenrente: mindestens 5 Jahre verheiratet) */
  ehejahre: number;
  /** Die überlebende Person hat beim Tod Kinder mit Anspruch auf Waisenrente (Unterhaltspflicht) */
  kinder: boolean;
  /**
   * AHV-Splitting: Die überlebende Person erhält die Altersrente aus dem Durchschnitt der Renten beider
   * Personen (Näherung für eine Ehe über das ganze Erwerbsleben). Aus = nur die eigene Rente (vorsichtig).
   */
  splitting: boolean;
}

/** Ergebnis des Todesfall-Szenarios (Beträge in heutigen CHF, soweit nicht anders vermerkt). */
export interface TodesfallInfo {
  verstorben: number;
  ueberlebend: number;
  /** Erster Monat, in dem die verstorbene Person nicht mehr lebt */
  ab: Monat;
  jahr: number;
  /** Alter der verstorbenen bzw. überlebenden Person beim Tod (Jahre) */
  alterVerstorben: number;
  alterUeberlebend: number;
  /** AHV-Witwen-/Witwerrente (Monat, heutige CHF, ohne Teuerungsanpassung) und Anspruch */
  ahvAnspruch: boolean;
  ahvWitwenrenteMonat: number;
  /** Altersrente der überlebenden Person nach dem Tod inkl. Verwitwetenzuschlag (Monat, ohne 13.) */
  ahvAltersrenteMonat: number;
  /** Vor dem Tod: Summe beider AHV-Renten (nach Plafonierung, Monat) im Referenzjahr des Todes, sonst 0 */
  pkAnspruch: boolean;
  /** PK-Ehegattenrente pro Jahr (real zum Todeszeitpunkt) bzw. Abfindung (3 Jahresrenten, einmalig) */
  pkEhegattenrenteJahr: number;
  pkAbfindung: number;
  /** Kapital aus Freizügigkeit und 3a der verstorbenen Person, das der überlebenden Person zufliesst */
  kapitalFzUnd3a: number;
  hinweise: string[];
}

export type KrisenReihe = 'CHE' | 'USA' | 'JPN';

/**
 * Eigene Krise (Stresstest, Schema 13). Keine historischen Daten: der reale Rückgang
 * des Wertschriftenportfolios wird über `dauer` Jahre gleichmässig verteilt, danach
 * über `erholung` Jahre real wieder aufgeholt. Teuerung, Bargeld und Hauspreise
 * bleiben die Annahmen des Haushalts.
 */
export interface EigeneKrise {
  /** Anzeigename, höchstens 40 Zeichen, ohne Steuerzeichen */
  name: string;
  /** Realer Rückgang, negativ, z.B. −0.30 */
  rueckgang: number;
  /** Jahre des Rückgangs (1–8) */
  dauer: number;
  /** Jahre der realen Erholung danach (0–15; 0 = der Stand bleibt unten) */
  erholung: number;
}

/** Eine geplante Krise: Katalogeintrag oder eigene Krise (`id` = `eigen`) */
export interface KrisenAuswahl {
  /** Eindeutige Kennung des Eintrags (für die Anzeige) */
  uid: string;
  /** Id im Krisenkatalog (src/data/krisen.ts) oder `eigen` */
  id: string;
  /** Abgespielte Datenreihe; bei einer eigenen Krise unbenutzt */
  land: KrisenReihe;
  startArt: 'jahr' | 'alter' | 'nachRuecktritt';
  /** Kalenderjahr des Krisenbeginns (bei 'jahr') */
  jahr: number;
  /** Alter der Person `person` im Jahr des Krisenbeginns (bei 'alter', Schema 6) */
  alter: number;
  person: number;
  /** Jahre nach dem Rücktritt (bei 'nachRuecktritt'; 0 = im Rücktrittsjahr) */
  jahreNach: number;
  /** Gesetzt bei `id` = `eigen`, sonst null. Fehlt in älteren Speicherständen. */
  eigen?: EigeneKrise | null;
}

/** Krisenmodus (Schema 6): keine Krise, automatische Abfolge oder eigene Liste */
export type KrisenModus = 'keine' | 'automatisch' | 'individuell';

export interface KrisenEinstellungen {
  modus: KrisenModus;
  /** Eigene Liste (Modus «Individuell») */
  auswahl: KrisenAuswahl[];
  /** Automatisch: Krisen pro Dekade; null = Standard aus den historischen Daten (Schweiz) */
  autoProDekade: number | null;
  /** Automatisch: erste Krise in einem Kalenderjahr oder X Jahre nach dem Rücktritt */
  autoStartArt: 'jahr' | 'nachRuecktritt';
  /** Kalenderjahr der ersten Krise; null = Standard (letzte Krise 2022 + mittlerer Abstand) */
  autoStartJahr: number | null;
  autoJahreNach: number;
  /**
   * Modus «Individuell» (Schema 14): normale Jahre wie «Automatisch» über den Planungshorizont
   * ausgleichen. true nach «Automatische Krisen übernehmen». Fehlt oder false = Stresstest
   * (übrige Jahre bleiben die Annahme).
   */
  ausgleich?: boolean;
  /** Monte Carlo (wiederkehrende Krisen bzw. Block-Bootstrap) anzeigen */
  mcAktiv: boolean;
  mcArt: 'wiederkehrend' | 'bootstrap';
  /** Krisen pro Dekade; null = Standard aus den historischen Daten */
  mcKrisenProDekade: number | null;
  mcLaeufe: number;
  mcBlockLaenge: number;
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
  /** Davon geplante Lebenshaltung (Grundbetrag, Phase bzw. Ausgabenkurve oder Einzeljahr) */
  lebenshaltung: number;
  /**
   * Reale Vermögenserträge auf Bargeld, Wertschriften und Sonstigem (Zinsen, Dividenden, Kursänderungen nach
   * Kosten und Teuerung; in Krisenjahren negativ möglich). Ohne Wohneigentum und Vorsorgeguthaben.
   */
  ertraege: number;
  /** Anfangsbestand dieser Töpfe (real), für die nominale Umrechnung der Erträge */
  ertragsBasis: number;
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
  /** Separate Wohnkosten (Hypothekarzins, Unterhalt, Miete), in `ausgaben` enthalten (Schema 7) */
  wohnkosten: number;
  /** Mieteinnahmen einer vermieteten Liegenschaft (in den Einnahmen des Saldos enthalten) */
  mieteinnahmen: number;
  /** Grundstückgewinnsteuer beim Verkauf (vom Erlös abgezogen, nicht im Saldo) */
  grundstueckgewinnsteuer: number;
  /** Nettoerlös aus dem Verkauf (nach Hypothek, Kosten und Steuer), fliesst in die Wertschriften */
  verkaufserloes: number;
  /** Verkaufskosten (Makler usw.) beim Verkauf der Liegenschaft, vom Erlös abgezogen, nicht im Saldo */
  verkaufskosten: number;
  /** Wertänderung des Nettowerts Wohneigentum im Jahr (Preisänderung auf dem Verkehrswert, Hebel der Hypothek) */
  wohnwertaenderung: number;
  /** Kapitalzuflüsse des Jahres je Quelle (Summe = `kapitalBezuege`): PK, Freizügigkeit, 3a, Todesfall */
  kapitalPk: number;
  kapitalFz: number;
  kapital3a: number;
  kapitalTod: number;
  /** Davon Posten der Kategorie «Gesundheit» (Krankenkasse u.a.) bzw. «Wohnen» in den Ausgaben */
  ausgabenGesundheit: number;
  ausgabenWohnenPosten: number;
  /**
   * Kumulierte Teuerung seit Rechnungsbeginn (Π(1 + Teuerung), Schema 8), gemäss dem gerechneten Pfad:
   * Teuerungsannahme bzw. historische Teuerung der Krisenjahre und Monte-Carlo-Läufe.
   * `indexBeginn`: zu Jahresbeginn (für Flüsse des Jahres, wie die Simulation sie umrechnet);
   * `indexEnde`: am Jahresende (für Bestände am 31.12.). Nominal = real × Index.
   */
  indexBeginn: number;
  indexEnde: number;
  /** Jahr, in dem die Person des Todesfall-Szenarios stirbt (nur dann gesetzt) */
  todesjahr?: boolean;
  /**
   * Entnahme aus dem freien Finanzvermögen in diesem Jahr (Bargeld, Wertschriften, Sonstiges;
   * ohne Wohneigentum). 0, solange Erwerbseinkommen fliesst oder ein Überschuss angelegt wird.
   */
  entnahmeFrei: number;
  /** Freies Finanzvermögen unmittelbar vor dieser Entnahme (für den Satz Entnahme/Bestand) */
  entnahmeBasis: number;
  /** Von der Strategie gesetzter Satz; null, wenn die Ausgaben die Entnahme bestimmen */
  entnahmeSatz: number | null;
  /**
   * Reales Wachstum des freien Finanzvermögens im Vorjahr (annualisiert). Null im ersten
   * Simulationsjahr. Die gestaffelte Strategie behandelt null als 0 %.
   */
  entnahmeWachstum: number | null;
  /** Bestände der Mehr-Töpfe am Jahresende; null bei jeder anderen Strategie */
  entnahmeToepfe: { label: string; wert: number }[] | null;
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
  /** Jahre mit NE-Beitragspflicht, in denen die Beiträge dank des Ehegatten als bezahlt gelten (Art. 3 Abs. 3 AHVG) */
  neBefreitJahre: number[];
  /** Barauszahlung beim Wegzug (null = keine) */
  barauszahlung: BarauszahlungInfo | null;
  /** PK beim Wegzug: welcher Fall eintritt (Grundlage für die Statuszeile beim Reglementsalter) */
  pkWegzug: PkWegzugStatus;
  /** Quellensteuer auf Kapitalleistungen nach dem Wegzug (heutige CHF, Summe, nach allfälliger Rückforderung) */
  quellensteuerKapital: number;
  /** Zurückgeforderte Quellensteuer auf Kapital (Summe) und stattdessen im Zielland bezahlte Steuer */
  quellensteuerKapitalRueckforderung: number;
  kapitalSteuerZielland: number;
  /** Schweizer Quellensteuer auf PK-Renten nach dem Wegzug (heutige CHF, Summe) */
  quellensteuerRente: number;
  /** Steuern nach dem Wegzug im ersten vollen Kalenderjahr im Ausland (null = kein solches Jahr) */
  zielland: ZiellandJahrInfo | null;
  /** Verkauf der Liegenschaft (null = kein Verkauf im Planungszeitraum) */
  verkauf: VerkaufInfo | null;
  /** Staffelung (Schema 11): Anzahl jährlicher Kapitalbezüge je Quelle; nur gesetzt, wenn mindestens eine > 1 ist */
  schritte?: { pk: number; fz: number; s3a: number };
  hinweise: string[];
}

/**
 * Pensionskasse und Wegzug (Art. 2 Abs. 1bis FZG): Barauszahlung nur, wenn die PK vor dem PK-Bezugsalter
 * verlassen wird; ab dann gilt es als Pensionierung (Altersleistung nach Reglement).
 * - ohneWegzug: kein Wegzug erfasst
 * - ohneBarauszahlung: Wegzug ohne die Option «Barauszahlung»
 * - landFehlt: Barauszahlung gewünscht, aber kein Land gewählt (nicht gerechnet)
 * - barauszahlung: Wegzug vor dem PK-Bezugsalter → Austrittsleistung bar (EU/EFTA evtl. nur Überobligatorium)
 * - pensionierung: Wegzug am/nach dem PK-Bezugsalter → Altersleistung, keine Barauszahlung
 */
export interface PkWegzugStatus {
  fall: 'ohneWegzug' | 'ohneBarauszahlung' | 'landFehlt' | 'barauszahlung' | 'pensionierung';
  /** Alter bei Erwerbsaufgabe (Monate) */
  stoppMonate: number;
  /** Frühestes Bezugsalter laut Reglement, auf den erlaubten Bereich begrenzt (Monate) */
  fruehestesMonate: number;
  /** PK-Bezugsalter für den ordentlichen Bezug (Monate) */
  bezugMonate: number;
  /** Alter beim Wegzug, frühestens heute (Monate; null ohne Wegzug) */
  wegzugMonate: number | null;
  /** Ganzes Guthaben bar (sonst nur der überobligatorische Teil; nur bei «barauszahlung» relevant) */
  barVoll: boolean;
  /** Zielland in der EU/EFTA */
  euEfta: boolean;
  /**
   * Das Reglementsalter hat nachweislich keinen Einfluss auf das Ergebnis: Die Barauszahlung erfolgt bei jedem
   * möglichen Reglementsalter (58–70), weil Wegzug und Erwerbsaufgabe davor liegen.
   */
  feldOhneWirkung: boolean;
  /** Ab diesem Reglementsalter (ganze Jahre) wäre es eine Barauszahlung statt einer Pensionierung und umgekehrt */
  grenzeReglementsalter: number;
}

/** Verkauf einer Liegenschaft: Beträge nominal im Verkaufsjahr und in heutigen Franken */
export interface VerkaufInfo {
  monat: Monat;
  /** Volle Besitzjahre (anrechenbare Besitzdauer) */
  besitzjahre: number;
  preisNominal: number;
  verkaufskostenNominal: number;
  gewinnNominal: number;
  steuerNominal: number;
  /** Effektiver Steuersatz auf dem Gewinn */
  steuerSatz: number;
  /** Herkunft der Steuer: exakter Tarif, eigener Satz oder Näherung */
  steuerArt: 'ZH' | 'AG' | 'eigenerSatz' | 'naeherungZH';
  /** Heutige Franken */
  preis: number;
  hypothek: number;
  steuer: number;
  erloes: number;
}

/** Steuern im ersten vollen Kalenderjahr mit Wohnsitz im Ausland (heutige CHF). */
export interface ZiellandJahrInfo {
  jahr: number;
  /** Steuer im Wohnsitzstaat (Anteil dieser Person) */
  steuer: number;
  /** Schweizer Quellensteuer auf die PK-Rente */
  quellensteuerRente: number;
  /** Einkünfte, auf die sich die Steuer bezieht (Renten, Lohn, übrige, Vermögensertrag) */
  einkommen: number;
  /** Ohne Steuermodell und ohne eigenen Satz: weiter Schweizer Steuern (Näherung) */
  chSteuernWeiter: boolean;
  eigenerSatz: boolean;
}

/** Barauszahlung von Vorsorgeguthaben beim Wegzug (Beträge in heutigen CHF). */
export interface BarauszahlungInfo {
  monat: Monat;
  /** Bar ausbezahlter PK-Teil */
  pk: number;
  /** Obligatorischer PK-Teil, der wegen Art. 25f FZG als Freizügigkeitsguthaben gesperrt bleibt */
  pkGesperrt: number;
  /** Anteil des Obligatoriums am PK-Guthaben beim Wegzug (Näherung) */
  anteilObligatorium: number;
  freizuegigkeit: number;
  saeule3a: number;
  /** Wohnsitz in der EU/EFTA (Art. 25f FZG) */
  euEfta: boolean;
  /** Ganzes Guthaben frei (nicht EU/EFTA oder dort nicht obligatorisch versichert) */
  voll: boolean;
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
  /** Kalenderjahre mit abgespielten historischen Werten (Krisenszenario) */
  krisenJahre: { jahr: number; land: string; histJahr: number; krise: string; name?: string; kurz?: string }[];
  /** Nominale Renditen der normalen Jahre nach dem Krisenausgleich (null = kein Ausgleich) */
  krisenNormal: { wertschriften: number; wohneigentum: number } | null;
  personen: PersonInfo[];
  /** Todesfall-Szenario (null = keines aktiv) */
  todesfall?: TodesfallInfo | null;
}
