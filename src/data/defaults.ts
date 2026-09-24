/**
 * Standardwerte für neue Eingaben. Gesetzliche Werte kommen aus den Regeln,
 * Annahmen (Rendite, Inflation usw.) sind bewusst konservativ und gut sichtbar anpassbar.
 */

import type { AuslandRente, Haushalt, Person } from '../core/typen';
import type { Regeln } from '../rules';

export const STANDARD_PLANUNGSALTER = 120;
export const MAX_PLANUNGSALTER = 999;

export function neuePerson(regeln: Regeln, overrides: Partial<Person> = {}): Person {
  return {
    name: '',
    geburtsjahr: 1970,
    geburtsmonat: 6,
    geschlecht: 'm',
    lohn: 100000,
    lohnwachstumReal: 0,
    stoppAlter: 65,
    ahv: {
      modus: 'eingabe',
      renteMonat: regeln.ahv.maximalrenteMonat,
      mdje: regeln.ahv.rentenformel.mdjeMaximum,
      beitragsjahre: regeln.ahv.vollrenteBeitragsjahre,
      bezugVerschiebungMonate: 0,
    },
    pk: {
      guthaben: 400000,
      beitragModus: 'eingabe',
      sparbeitragJahr: 15000,
      anteilArbeitnehmer: 0.5,
      zins: regeln.bvg.mindestzins2026,
      umwandlungssatz: 0.055,
      kapitalanteil: 0,
      fruehestesAlter: regeln.bvg.bezugsalter.reglementFruehestens,
      bezugsAlter: null,
    },
    saeule3a: {
      guthaben: 80000,
      beitragJahr: regeln.saeule3a.maxMitPk,
      rendite: 0.02,
      bezugsAlter: null,
    },
    auslandRenten: [],
    ...overrides,
  };
}

let zaehler = 0;
export function neueAuslandRente(): AuslandRente {
  zaehler++;
  return {
    id: `ar-${Date.now().toString(36)}-${zaehler}`,
    bezeichnung: 'Ausländische Rente',
    land: 'BR',
    waehrung: 'BRL',
    betrag: 3000,
    zahlungenProJahr: 13,
    wechselkursChf: 0.15,
    startAlter: 62,
    indexierung: { art: 'teuerung' },
    steuerbarInCh: true,
  };
}

export function standardHaushalt(regeln: Regeln): Haushalt {
  return {
    zivilstand: 'alleinstehend',
    personen: [neuePerson(regeln, { name: 'Person 1' })],
    planungsalter: STANDARD_PLANUNGSALTER,
    freiesVermoegen: 300000,
    ausgaben: { lebenshaltung: 70000, faktorAb75: 0.9, faktorAb85: 1.1 },
    annahmen: {
      renditeNominal: 0.035,
      inflation: 0.01,
      kosten: 0.005,
      ahvAnpassungReal: 0,
      steuerbarerErtrag: 0.01,
      neVerwaltungskosten: regeln.beitraege.nichterwerbstaetige.verwaltungskostenMax,
    },
    steuern: { kanton: '', einkommenSatz: 0.08, vermoegenPromille: 2, kapitalSatz: 0.04 },
    wohnsitz: { land: 'CH', wegzug: null },
  };
}

/** Gängige Währungen für ausländische Renten (Wechselkurs bleibt Nutzereingabe). */
export const WAEHRUNGEN = ['BRL', 'EUR', 'USD', 'GBP', 'CHF', 'THB', 'CAD', 'AUD', 'JPY'] as const;
