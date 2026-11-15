/**
 * Referenzhaushalte für den Golden-Master pro Regelstand (ADR-003). Neutrale Beispiele ohne Personendaten.
 * Alle Eingaben sind explizit gesetzt, damit nur der Regelstand (src/rules/<jahr>.json + Daten) das Ergebnis bewegt.
 * Defaults aus `neuePerson` bleiben dort, wo sie Gesetzeswerte sind (z. B. PK-Zins = BVG-Mindestzins des Regeljahres).
 */

import type { Haushalt, Person } from '../core/typen';
import { neuePerson, standardHaushalt } from '../data/defaults';
import type { Regeln } from '../rules';

function person(regeln: Regeln, o: Partial<Person> & { mdje: number }): Person {
  const { mdje, ...rest } = o;
  const p = neuePerson(regeln, {
    geburtsjahr: 1966,
    geburtsmonat: 6,
    geschlecht: 'm',
    lohn: 110000,
    stoppAlter: 65,
    wertschriften: 250000,
    bargeld: 30000,
    ...rest,
  });
  p.ahv = { ...p.ahv, modus: 'skala44', mdje };
  if (!rest.pk) p.pk = { ...p.pk, guthaben: 450000, sparbeitragJahr: 14000, umwandlungssatz: 0.055 };
  if (!rest.saeule3a) p.saeule3a = { ...p.saeule3a, guthaben: 90000, beitragJahr: 0, rendite: 0.01 };
  return p;
}

function basis(regeln: Regeln, kanton: string, personen: Person[], o: Partial<Haushalt> = {}): Haushalt {
  const h = standardHaushalt(regeln);
  return {
    ...h,
    zivilstand: personen.length > 1 ? 'verheiratet' : 'alleinstehend',
    personen,
    planungsalter: 95,
    ausgaben: { ...h.ausgaben, lebenshaltung: 70000 },
    steuern: { ...h.steuern, kanton, gemeinde: '' },
    ...o,
  };
}

export interface Referenzhaushalt {
  id: string;
  beschreibung: string;
  haushalt: (regeln: Regeln) => Haushalt;
}

export const REFERENZHAUSHALTE: readonly Referenzhaushalt[] = [
  {
    id: 'zh-alleinstehend',
    beschreibung: 'Alleinstehend ZH, Jg. 1966, PK als Rente',
    haushalt: (r) => basis(r, 'ZH', [person(r, { mdje: 90000 })]),
  },
  {
    id: 'ag-ehepaar',
    beschreibung: 'Ehepaar AG, beide erwerbstätig, Plafonierung',
    haushalt: (r) =>
      basis(r, 'AG', [
        person(r, { mdje: 95000 }),
        person(r, { geschlecht: 'w', geburtsjahr: 1968, lohn: 70000, mdje: 60000, wertschriften: 50000 }),
      ]),
  },
  {
    id: 'lu-frau-1962',
    beschreibung: 'Frau Jg. 1962 LU (Übergangsgeneration AHV 21)',
    haushalt: (r) => basis(r, 'LU', [person(r, { geschlecht: 'w', geburtsjahr: 1962, lohn: 80000, mdje: 70000 })]),
  },
  {
    id: 'be-kapitalbezug',
    beschreibung: 'Alleinstehend BE, PK vollständig als Kapital',
    haushalt: (r) => {
      const p = person(r, { mdje: 90000 });
      p.pk = { ...p.pk, kapitalanteil: 1 };
      return basis(r, 'BE', [p]);
    },
  },
  {
    id: 'zh-vorbezug-63',
    beschreibung: 'ZH, Stopp mit 63, AHV-Vorbezug 24 Monate',
    haushalt: (r) => {
      const p = person(r, { mdje: 90000, stoppAlter: 63 });
      p.ahv = { ...p.ahv, bezugVerschiebungMonate: -24 };
      return basis(r, 'ZH', [p]);
    },
  },
  {
    id: 'zh-aufschub-70',
    beschreibung: 'ZH, Arbeit bis 70, AHV-Aufschub 60 Monate',
    haushalt: (r) => {
      const p = person(r, { mdje: 90000, stoppAlter: 70 });
      p.ahv = { ...p.ahv, bezugVerschiebungMonate: 60 };
      return basis(r, 'ZH', [p]);
    },
  },
  {
    id: 'sg-ohne-pk',
    beschreibung: 'SG, ohne Pensionskasse, Säule 3a',
    haushalt: (r) => {
      const p = person(r, { mdje: 80000, lohn: 90000 });
      p.pk = { ...p.pk, guthaben: 0, sparbeitragJahr: 0 };
      p.saeule3a = { ...p.saeule3a, guthaben: 300000, beitragJahr: 0 };
      return basis(r, 'SG', [p]);
    },
  },
  {
    id: 'zh-wegzug-pt',
    beschreibung: 'ZH, Wegzug nach Portugal ab 2032',
    haushalt: (r) => {
      const p = person(r, { mdje: 90000 });
      p.wohnsitzAusland = {
        ...p.wohnsitzAusland,
        aktiv: true,
        modus: 'datum',
        datum: { jahr: 2032, monat: 1 },
        land: 'PT',
      };
      return basis(r, 'ZH', [p]);
    },
  },
];
