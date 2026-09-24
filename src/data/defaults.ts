/**
 * Standardwerte für neue Eingaben: alle Beträge neutral (0) und frei editierbar.
 * Gesetzliche Werte kommen aus den Regeln; Annahmen (Rendite, Inflation usw.) sind
 * bewusst vorsichtig und gut sichtbar anpassbar.
 */
import type {
  AhvSchaetzhilfeEingabe,
  AuslandRente,
  Einmalereignis,
  Haushalt,
  Person,
  Posten,
  PostenArt,
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
    ausland: false,
    auslandJahre: 0,
  };
}

export function neuePerson(regeln: Regeln, overrides: Partial<Person> = {}): Person {
  return {
    name: '',
    geburtsjahr: 1970,
    geburtsmonat: 1,
    geschlecht: 'm',
    lohn: 0,
    lohnwachstumReal: 0,
    stoppAlter: 65,
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
    wohneigentum: { vorhanden: false, verkehrswert: 0, hypothek: 0 },
    ...overrides,
  };
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

export function standardHaushalt(regeln: Regeln): Haushalt {
  return {
    zivilstand: 'alleinstehend',
    personen: [neuePerson(regeln, { name: 'Person 1' })],
    planungsalter: STANDARD_PLANUNGSALTER,
    posten: [],
    ereignisse: [],
    ausgaben: { lebenshaltung: 0, faktorAb75: 1, faktorAb85: 1 },
    annahmen: {
      renditeNominal: 0.04,
      renditeBargeld: 0.005,
      inflation: 0.01,
      kosten: 0.005,
      ahvAnpassungReal: 0,
      steuerbarerErtrag: 0.015,
      neVerwaltungskosten: regeln.beitraege.nichterwerbstaetige.verwaltungskostenMax,
    },
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
  };
}

/** Gängige Währungen für ausländische Renten (Wechselkurs bleibt Nutzereingabe). */
export const WAEHRUNGEN = ['EUR', 'BRL', 'USD', 'GBP', 'CHF', 'THB', 'CAD', 'AUD', 'JPY'] as const;
