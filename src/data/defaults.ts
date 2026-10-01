/**
 * Standardwerte für neue Eingaben: alle Beträge neutral (0) und frei editierbar.
 * Gesetzliche Werte kommen aus den Regeln; Annahmen (Rendite, Inflation usw.) sind
 * bewusst vorsichtig und gut sichtbar anpassbar.
 */
import type {
  AhvSchaetzhilfeEingabe,
  Ausgaben,
  AusgabenEinzeljahr,
  AusgabenPhase,
  AuslandRente,
  Einmalereignis,
  Haushalt,
  KrisenAuswahl,
  KrisenEinstellungen,
  KrisenReihe,
  Person,
  Posten,
  PostenArt,
  Staffelung,
  Todesfall,
  Wohneigentum,
  Wohnen,
  WohnsitzAusland,
} from '../core/typen';
import type { Regeln } from '../rules';

export const STANDARD_PLANUNGSALTER = 120;
export const MAX_PLANUNGSALTER = 999;

export function neueAhvSchaetzhilfe(): AhvSchaetzhilfeEingabe {
  return {
    beitragsModus: 'luecken',
    luecken: 0,
    jahreCh: 0,
    einkommen: 0,
    ehejahre: 0,
    einkommenEhepartner: 0,
    erziehungsJahre: 0,
    betreuungsJahre: 0,
    ausland: false,
    auslandJahre: 0,
  };
}

export function neuerWohnsitzAusland(): WohnsitzAusland {
  return {
    aktiv: false,
    modus: 'alter',
    alter: 65,
    datum: { jahr: 2032, monat: 7 },
    land: '',
    nationalitaet: 'CH',
    vorherVersichert5Jahre: true,
    freiwilligeAhv: false,
    barauszahlung: true,
    nichtObligatorischVersichert: false,
    sitzkantonVorsorge: '',
    sitzkantonFz: '',
    sitzkanton3a: '',
    steuerSatzZielland: null,
    steuerOption: '',
    qstKapitalRueckforderung: false,
    steuerSatzKapitalZielland: null,
  };
}

export function neuePerson(regeln: Regeln, overrides: Partial<Person> = {}): Person {
  return {
    name: '',
    geburtsjahr: 1970,
    geburtsmonat: 1,
    geschlecht: 'm',
    erwerbsstatus: 'erwerbstaetig',
    frueherErwerb: { jahre: 0, lohn: 0 },
    lohn: 0,
    lohnwachstumReal: 0,
    stoppAlter: 65,
    stoppModus: 'alter',
    stoppDatum: { jahr: 2034, monat: 12 },
    wohnsitzAusland: neuerWohnsitzAusland(),
    inChSeit: 0,
    manuell: {},
    ahv: {
      modus: 'eingabe',
      renteMonat: 0,
      mdje: 0,
      beitragsjahre: regeln.ahv.vollrenteBeitragsjahre,
      bezugVerschiebungMonate: 0,
    },
    ahvSchaetzhilfe: neueAhvSchaetzhilfe(),
    pk: {
      guthaben: 0,
      bvgGuthaben: 0,
      beitragModus: 'eingabe',
      sparbeitragJahr: 0,
      anteilArbeitnehmer: 0.5,
      zins: regeln.bvg.mindestzins2026,
      umwandlungssatz: regeln.bvg.mindestumwandlungssatz,
      kapitalanteil: 0,
      fruehestesAlter: regeln.bvg.bezugsalter.gesetzlichAb,
      bezugsAlter: null,
    },
    saeule3a: { guthaben: 0, beitragJahr: 0, rendite: 0.01, bezugsAlter: null },
    auslandRenten: [],
    bargeld: 0,
    wertschriften: 0,
    freizuegigkeit: { guthaben: 0, zins: 0.005, bezugsAlter: null },
    sonstiges: { bezeichnung: '', wert: 0, rendite: 0 },
    wohneigentum: neuesWohneigentum(regeln),
    ...overrides,
  };
}

/**
 * Wohneigentum (Schema 7): ohne Verkauf, Hypothekarzins-Vorschlag = BWO-Durchschnittszinssatz
 * (rules: wohneigentum.hypothekarzinsDurchschnitt); Unterhalt, Eigenmietwert und Mieteinnahmen 0.
 * Wirkt nur mit separaten Wohnkosten (`Haushalt.wohnen.separat`).
 */
export function neuesWohneigentum(regeln: Regeln, overrides: Partial<Wohneigentum> = {}): Wohneigentum {
  return {
    vorhanden: false,
    verkehrswert: 0,
    hypothek: 0,
    hypothekarzins: regeln.wohneigentum.hypothekarzinsDurchschnitt,
    unterhaltArt: 'prozent',
    unterhaltProzent: 0,
    unterhaltChf: 0,
    eigenmietwert: 0,
    nachWegzug: 'leer',
    mieteinnahmenMonat: 0,
    verkauf: {
      aktiv: false,
      zeitpunkt: 'wegzug',
      datum: { jahr: 2035, monat: 1 },
      anlagekosten: 0,
      kauf: { jahr: 2010, monat: 1 },
      verkaufskostenAnteil: 0,
      eigenerSatz: null,
    },
    ...overrides,
  };
}

/**
 * Todesfall-Szenario (Schema 9): Standard aus. Ausgabenfaktor 0,67 = Einpersonen- statt Zweipersonenhaushalt
 * (modifizierte OECD-Skala 1,0 / 1,5, BFS; OFFEN, Näherung). Ehejahre 20 sind ein Platzhalter (bitte anpassen).
 */
export function neuesTodesfall(jahr = 2040): Todesfall {
  return {
    aktiv: false,
    person: 0,
    modus: 'alter',
    alter: 80,
    jahr,
    ausgabenFaktor: 0.67,
    ehejahre: 20,
    kinder: false,
    splitting: false,
  };
}

/** Staffelung der Kapitalbezüge (Schema 11): Standard aus; PK-Kapital nur auf ausdrücklichen Wunsch (Teilpensionierung). */
export function neueStaffelung(): Staffelung {
  return { aktiv: false, jahre: 3, pk: false, fz: true, s3a: true };
}

/** Separate Wohnkosten: Standard aus (Wohnkosten stecken in den Ausgaben) */
export function neuesWohnen(): Wohnen {
  return { separat: false, mieteMonat: 0 };
}

let zaehler = 0;
const neueId = (prefix: string): string => {
  zaehler++;
  return `${prefix}-${Date.now().toString(36)}-${zaehler}`;
};

export function neueAuslandRente(): AuslandRente {
  return {
    id: neueId('ar'),
    bezeichnung: 'Ausländische Rente',
    land: '',
    waehrung: 'EUR',
    betrag: 0,
    zahlungenProJahr: 12,
    wechselkursChf: 1,
    startAlter: 65,
    indexierung: { art: 'teuerung' },
    wechselkursAenderung: 0,
    quellensteuerSatz: 0,
    steuerbarInCh: true,
  };
}

export function neuerPosten(art: PostenArt): Posten {
  return {
    id: neueId('po'),
    bezeichnung: art === 'einnahme' ? 'Mieteinnahmen' : 'Krankenkasse',
    art,
    kategorie: art === 'einnahme' ? 'mieteinnahmen' : 'gesundheit',
    betragJahr: 0,
    person: 0,
    startAlter: 0,
    endAlter: null,
    indexierung: { art: 'teuerung' },
    steuerbar: art === 'einnahme',
  };
}

export function neuesEreignis(): Einmalereignis {
  return { id: neueId('ev'), bezeichnung: 'Erbschaft', betrag: 0, person: 0, alter: 70 };
}

export function neueAusgaben(): Ausgaben {
  return {
    lebenshaltung: 0,
    faktorAb75: 1,
    faktorAb85: 1,
    phasenBezug: 'jahr',
    phasenPerson: 0,
    phasen: [],
    einzeljahre: [],
  };
}

export function neueAusgabenPhase(von: number, bis: number | null, betrag = 0): AusgabenPhase {
  return { id: neueId('ph'), von, bis, betrag, einheit: 'jahr' };
}

export function neuesAusgabenEinzeljahr(jahr: number, betrag = 0): AusgabenEinzeljahr {
  return { id: neueId('ej'), jahr, betrag, einheit: 'jahr' };
}

/**
 * Standard der Rendite- und Teuerungsannahme für NEUE Nutzer (seit 30.9.2026: 7 % nominal, 2 % Teuerung; vorher
 * 4 % und 1 %). Gilt für «Schnell» und «Detailliert» gleich (gemeinsame `annahmen`). Gespeicherte Stände behalten
 * ihre Werte (`mische` in ui/state.ts übernimmt vorhandene Zahlen). Eine Annahme, keine Prognose oder Garantie.
 */
export const ANNAHMEN_STANDARD = { renditeNominal: 0.07, inflation: 0.02 } as const;

export function standardHaushalt(regeln: Regeln): Haushalt {
  return {
    zivilstand: 'alleinstehend',
    personen: [neuePerson(regeln, { name: 'Person 1' })],
    planungsalter: STANDARD_PLANUNGSALTER,
    posten: [],
    ereignisse: [],
    ausgaben: neueAusgaben(),
    annahmen: {
      renditeNominal: ANNAHMEN_STANDARD.renditeNominal,
      aktienanteil: 0.5,
      renditeBargeld: 0.005,
      inflation: ANNAHMEN_STANDARD.inflation,
      kosten: 0.005,
      ahvAnpassungReal: 0,
      steuerbarerErtrag: 0.015,
      neVerwaltungskosten: regeln.beitraege.nichterwerbstaetige.verwaltungskostenMax,
    },
    krisen: neueKrisenEinstellungen(),
    steuern: {
      kanton: '',
      gemeinde: '',
      kirche: 'keine',
      eigeneSaetze: false,
      einkommenSatz: 0,
      vermoegenPromille: 0,
      kapitalSatz: 0,
    },
    wohnsitz: { land: 'CH', wegzug: null },
    wohnen: neuesWohnen(),
    darstellung: 'real',
    todesfall: neuesTodesfall(),
    staffelung: neueStaffelung(),
  };
}

/** Gängige Währungen für ausländische Renten (Wechselkurs bleibt Nutzereingabe). */
export const WAEHRUNGEN = ['EUR', 'BRL', 'USD', 'GBP', 'CHF', 'THB', 'CAD', 'AUD', 'JPY'] as const;

/**
 * Standard beim ersten Start (und «Zurücksetzen»): Krisenmodus «Automatisch», Monte Carlo aus.
 * Gespeicherte Stände und Share-Links ohne `krisen.modus` (Schema ≤ 5) werden in `normalisiere` nicht mit
 * diesem Standard aufgefüllt, sondern behalten «Keine Krise» (bzw. «Individuell» bei eingeschalteter Krise).
 */
export function neueKrisenEinstellungen(): KrisenEinstellungen {
  return {
    modus: 'automatisch',
    auswahl: [],
    autoProDekade: null,
    autoStartArt: 'jahr',
    autoStartJahr: null,
    autoJahreNach: 0,
    mcAktiv: false,
    mcArt: 'wiederkehrend',
    mcKrisenProDekade: null,
    mcLaeufe: 300,
    mcBlockLaenge: 5,
  };
}

export function neueKrisenAuswahl(id: string, land: KrisenReihe, jahr: number): KrisenAuswahl {
  return { uid: neueId('kr'), id, land, startArt: 'nachRuecktritt', jahr, alter: 70, person: 0, jahreNach: 0 };
}
