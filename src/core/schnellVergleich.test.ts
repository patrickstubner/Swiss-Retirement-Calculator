/**
 * Vergleich «Schnell» vs. «Detailliert» für Musterhaushalte.
 *
 * «Detailliert» = alle Werte wie aus Vorsorgeausweis, IK-Auszug/Rentenvorausberechnung usw.
 * (illustrative Beispielwerte, keine realen Personen). «Schnell» = nur die Schnell-Eingaben,
 * alles andere aus schaetzwerte.ts. UWS = optionales Schnell-Feld «Umwandlungssatz laut Vorsorgeausweis». Gemessen: Abweichung des frühesten Rücktrittsalters (Monate)
 * und des Vermögens mit 85 (real, jüngere Person). Die Zahlen werden ausgegeben (für die
 * PR-Beschreibung); die Assertions sind bewusst locker und dokumentieren die Grössenordnung.
 */
import { describe, expect, it } from 'vitest';
import { neueAusgaben, neueAuslandRente, neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { effektiverHaushalt } from './schaetzwerte';
import { vermoegenImAlter } from './sensitivitaet';
import { simuliere } from './simulation';
import { fruehestesRuecktrittsalter } from './solver';
import type { Haushalt, Person } from './typen';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 9 };

/** Reduziert eine Detail-Person auf die Schnell-Eingaben. */
function nurSchnell(p: Person, mitPk: boolean, mitInChSeit = true, mitUws = false): Person {
  const q = neuePerson(regeln, {
    name: p.name,
    geburtsjahr: p.geburtsjahr,
    geburtsmonat: p.geburtsmonat,
    geschlecht: p.geschlecht,
    lohn: p.lohn,
    stoppAlter: p.stoppAlter,
    stoppModus: p.stoppModus,
    stoppDatum: p.stoppDatum,
    inChSeit: mitInChSeit ? p.inChSeit : 0,
    wertschriften: p.wertschriften + p.bargeld,
  });
  q.saeule3a = { ...q.saeule3a, guthaben: p.saeule3a.guthaben };
  q.wohneigentum = {
    ...q.wohneigentum,
    vorhanden: p.wohneigentum.vorhanden,
    verkehrswert: p.wohneigentum.verkehrswert,
  };
  if (mitPk) {
    q.pk = { ...q.pk, guthaben: p.pk.guthaben };
    q.manuell = { pkGuthaben: true };
  }
  if (mitUws) {
    // optionales Schnell-Feld «Umwandlungssatz laut Vorsorgeausweis»
    q.pk = { ...q.pk, umwandlungssatz: p.pk.umwandlungssatz };
    q.manuell = { ...q.manuell, pkUmwandlungssatz: true };
  }
  return q;
}

function nurSchnellHaushalt(h: Haushalt, mitPk: boolean, mitInChSeit = true, mitUws = false): Haushalt {
  const s = standardHaushalt(regeln);
  return {
    ...s,
    zivilstand: h.zivilstand,
    planungsalter: h.planungsalter,
    personen: h.personen.map((p) => nurSchnell(p, mitPk, mitInChSeit, mitUws)),
    ausgaben: { ...s.ausgaben, lebenshaltung: h.ausgaben.lebenshaltung },
    steuern: { ...s.steuern, kanton: h.steuern.kanton, gemeinde: h.steuern.gemeinde },
  };
}

function messe(h: Haushalt) {
  const eff = effektiverHaushalt(h, regeln, heute).haushalt;
  const s = fruehestesRuecktrittsalter(eff, regeln, { start: heute, modus: 'gemeinsam', person: 0, maxAlter: 70 });
  const e = simuliere(eff, regeln, { start: heute });
  return { alter: s.gefunden ? s.alterMonate : null, v85: vermoegenImAlter(eff, e, 85), heute: gesamt(h) };
}

/** Gesamtvermögen heute (inkl. PK, 3a, Wohneigentum netto) als stabile Bezugsgrösse. */
const gesamt = (h: Haushalt): number =>
  h.personen.reduce(
    (s, p) =>
      s +
      p.bargeld +
      p.wertschriften +
      p.sonstiges.wert +
      p.pk.guthaben +
      p.saeule3a.guthaben +
      p.freizuegigkeit.guthaben +
      (p.wohneigentum.vorhanden ? p.wohneigentum.verkehrswert - p.wohneigentum.hypothek : 0),
    0,
  );

function detailPerson(o: Partial<Person>, manuell = true): Person {
  const p = neuePerson(regeln, o);
  if (manuell) p.manuell = { ahvRente: true, pkGuthaben: true, pkSparbeitrag: true, pkUmwandlungssatz: true };
  return p;
}

function haushalt(personen: Person[], o: Partial<Haushalt>): Haushalt {
  const s = standardHaushalt(regeln);
  return { ...s, personen, planungsalter: 95, zivilstand: personen.length > 1 ? 'verheiratet' : 'alleinstehend', ...o };
}

// 1) Angestellter, BVG-nahe Kasse, keine Lücken
const bvgNah = (() => {
  const p = detailPerson({ name: 'A', geburtsjahr: 1975, geburtsmonat: 4, geschlecht: 'm', lohn: 85000 });
  p.ahv = { ...p.ahv, renteMonat: 2380 }; // Vorausberechnung: tiefere Einkommen in jungen Jahren
  p.pk = { ...p.pk, guthaben: 260000, beitragModus: 'eingabe', sparbeitragJahr: 10500, umwandlungssatz: 0.064 };
  p.saeule3a = { ...p.saeule3a, guthaben: 60000 };
  p.wertschriften = 150000;
  p.bargeld = 30000;
  return haushalt([p], {
    ausgaben: { ...neueAusgaben(), lebenshaltung: 62000, faktorAb75: 1, faktorAb85: 1 },
    steuern: { ...standardHaushalt(regeln).steuern, kanton: 'ZH', gemeinde: 'Winterthur' },
  });
})();

// 2) Kader, umhüllende Kasse (hohe Beiträge, tiefer Umwandlungssatz, 3a-Einzahlungen)
const umhuellend = (() => {
  const p = detailPerson({ name: 'B', geburtsjahr: 1972, geburtsmonat: 9, geschlecht: 'm', lohn: 160000 });
  p.ahv = { ...p.ahv, renteMonat: 2520 };
  p.pk = { ...p.pk, guthaben: 720000, beitragModus: 'eingabe', sparbeitragJahr: 32000, umwandlungssatz: 0.052 };
  p.saeule3a = { ...p.saeule3a, guthaben: 140000, beitragJahr: 7258 };
  p.wertschriften = 120000;
  p.wohneigentum = { vorhanden: true, verkehrswert: 1_200_000, hypothek: 0 };
  return haushalt([p], {
    ausgaben: { ...neueAusgaben(), lebenshaltung: 110000, faktorAb75: 1, faktorAb85: 1 },
    steuern: { ...standardHaushalt(regeln).steuern, kanton: 'AG', gemeinde: 'Baden' },
  });
})();

// 3) Ehepaar, Ehefrau 2008 mit 30 aus Brasilien zugezogen (AHV-Lücken, INSS-Rente)
const paarBrasilien = (() => {
  const m = detailPerson({ name: 'Marco', geburtsjahr: 1968, geburtsmonat: 2, geschlecht: 'm', lohn: 80000 });
  m.ahv = { ...m.ahv, renteMonat: 2000 };
  m.pk = { ...m.pk, guthaben: 380000, beitragModus: 'eingabe', sparbeitragJahr: 12000, umwandlungssatz: 0.06 };
  m.saeule3a = { ...m.saeule3a, guthaben: 90000 };
  m.wertschriften = 200000;
  const f = detailPerson({
    name: 'Ana',
    geburtsjahr: 1978,
    geburtsmonat: 7,
    geschlecht: 'w',
    lohn: 30000,
    inChSeit: 2008,
  });
  f.ahv = { ...f.ahv, renteMonat: 1550 }; // Vorausberechnung inkl. Splitting, 36 Beitragsjahre
  f.pk = { ...f.pk, guthaben: 60000, beitragModus: 'eingabe', sparbeitragJahr: 2500, umwandlungssatz: 0.065 };
  f.saeule3a = { ...f.saeule3a, guthaben: 25000 };
  const inss = neueAuslandRente();
  f.auslandRenten = [
    { ...inss, bezeichnung: 'INSS', land: 'BR', waehrung: 'BRL', betrag: 1500, wechselkursChf: 0.15, startAlter: 65 },
  ];
  return haushalt([m, f], {
    ausgaben: { ...neueAusgaben(), lebenshaltung: 72000, faktorAb75: 1, faktorAb85: 1 },
    steuern: { ...standardHaushalt(regeln).steuern, kanton: 'ZH', gemeinde: 'Zürich' },
  });
})();

// 4) Frühpensionierung mit 60 geplant, hohes Vermögen
const frueh = (() => {
  const p = detailPerson({
    name: 'C',
    geburtsjahr: 1970,
    geburtsmonat: 11,
    geschlecht: 'w',
    lohn: 140000,
    stoppAlter: 60,
  });
  p.ahv = { ...p.ahv, renteMonat: 2470 };
  p.pk = { ...p.pk, guthaben: 850000, beitragModus: 'eingabe', sparbeitragJahr: 26000, umwandlungssatz: 0.05 };
  p.pk.fruehestesAlter = 58;
  p.saeule3a = { ...p.saeule3a, guthaben: 180000 };
  p.wertschriften = 400000;
  return haushalt([p], {
    ausgaben: { ...neueAusgaben(), lebenshaltung: 90000, faktorAb75: 1, faktorAb85: 1 },
    steuern: { ...standardHaushalt(regeln).steuern, kanton: 'ZH', gemeinde: 'Zürich' },
  });
})();

interface Zeile {
  name: string;
  variante: string;
  dAlter: number | null;
  dV85Prozent: number;
  dV85: number;
  dV85Gesamt: number;
  detailAlter: number | null;
}

const zeilen: Zeile[] = [];

function vergleiche(name: string, h: Haushalt, variante: string, s: Haushalt): Zeile {
  const d = messe(h);
  const q = messe(s);
  const z: Zeile = {
    name,
    variante,
    detailAlter: d.alter,
    dAlter: d.alter !== null && q.alter !== null ? q.alter - d.alter : null,
    dV85: q.v85 - d.v85,
    dV85Gesamt: ((q.v85 - d.v85) / d.heute) * 100,
    dV85Prozent: d.v85 !== 0 ? ((q.v85 - d.v85) / Math.abs(d.v85)) * 100 : 0,
  };
  zeilen.push(z);
  return z;
}

describe('Schnell vs. Detailliert (Musterhaushalte)', () => {
  it('BVG-nahe Kasse ohne Lücken: mit PK-Guthaben nahe am Detailergebnis', () => {
    const a = vergleiche('BVG-nah', bvgNah, 'Schnell mit PK-Guthaben, ohne UWS', nurSchnellHaushalt(bvgNah, true));
    expect(a.dAlter).not.toBeNull();
    expect(Math.abs(a.dAlter ?? 99)).toBeLessThanOrEqual(12);
    vergleiche('BVG-nah', bvgNah, 'Schnell ohne PK-Guthaben/UWS', nurSchnellHaushalt(bvgNah, false));
    const u = vergleiche(
      'BVG-nah',
      bvgNah,
      'Schnell mit PK-Guthaben + UWS',
      nurSchnellHaushalt(bvgNah, true, true, true),
    );
    expect(Math.abs(u.dAlter ?? 99)).toBeLessThanOrEqual(12);
  });

  it('umhüllende Kasse: ohne UWS leicht optimistisch (aufgeteilte Schätzung), ohne Guthaben zu pessimistisch', () => {
    const mit = vergleiche(
      'Umhüllend',
      umhuellend,
      'Schnell mit PK-Guthaben, ohne UWS',
      nurSchnellHaushalt(umhuellend, true),
    );
    const ohne = vergleiche(
      'Umhüllend',
      umhuellend,
      'Schnell ohne PK-Guthaben/UWS',
      nurSchnellHaushalt(umhuellend, false),
    );
    expect(mit.dAlter).not.toBeNull();
    expect(ohne.dAlter === null || (ohne.dAlter ?? 0) >= (mit.dAlter ?? 0)).toBe(true);
    const u = vergleiche(
      'Umhüllend',
      umhuellend,
      'Schnell mit PK-Guthaben + UWS',
      nurSchnellHaushalt(umhuellend, true, true, true),
    );
    expect(Math.abs(u.dAlter ?? 99)).toBeLessThan(Math.abs(mit.dAlter ?? 0) + 1);
  });

  it('Paar mit Zuzug aus Brasilien: «in der Schweiz seit» verbessert die Schätzung', () => {
    const mit = vergleiche(
      'Paar BR',
      paarBrasilien,
      'Schnell mit PK-Guthaben, ohne UWS, mit CH seit',
      nurSchnellHaushalt(paarBrasilien, true),
    );
    const ohne = vergleiche(
      'Paar BR',
      paarBrasilien,
      'Schnell mit PK-Guthaben, ohne UWS, ohne CH seit',
      nurSchnellHaushalt(paarBrasilien, true, false),
    );
    vergleiche(
      'Paar BR',
      paarBrasilien,
      'Schnell ohne PK-Guthaben/UWS, mit CH seit',
      nurSchnellHaushalt(paarBrasilien, false),
    );
    vergleiche(
      'Paar BR',
      paarBrasilien,
      'Schnell mit PK-Guthaben + UWS + CH seit',
      nurSchnellHaushalt(paarBrasilien, true, true, true),
    );
    // Ohne Zuzugsjahr wird die AHV der Ehefrau überschätzt → Vermögen zu hoch
    expect(ohne.dV85Prozent).toBeGreaterThan(mit.dV85Prozent);
  });

  it('Frühpensionierung: aufgeteilte UWS-Schätzung statt 6,8% (früher −22 Monate)', () => {
    const a = vergleiche('Frühpension', frueh, 'Schnell mit PK-Guthaben, ohne UWS', nurSchnellHaushalt(frueh, true));
    expect(a.dAlter).not.toBeNull();
    expect(Math.abs(a.dAlter ?? 99)).toBeLessThanOrEqual(12);
    vergleiche('Frühpension', frueh, 'Schnell ohne PK-Guthaben/UWS', nurSchnellHaushalt(frueh, false));
    const u = vergleiche(
      'Frühpension',
      frueh,
      'Schnell mit PK-Guthaben + UWS',
      nurSchnellHaushalt(frueh, true, true, true),
    );
    expect(Math.abs(u.dAlter ?? 99)).toBeLessThanOrEqual(12);
  });

  it('Tabelle ausgeben', () => {
    const f = (m: number | null) => (m === null ? '–' : `${Math.floor(m / 12)} J. ${m % 12} Mt.`);
    const t = zeilen
      .map(
        (z) =>
          `| ${z.name} | ${z.variante} | ${f(z.detailAlter)} | ${z.dAlter === null ? 'n/a' : `${z.dAlter > 0 ? '+' : ''}${z.dAlter} Mt.`} | ${z.dV85 > 0 ? '+' : ''}${Math.round(z.dV85 / 1000)}k | ${z.dV85Prozent > 0 ? '+' : ''}${z.dV85Prozent.toFixed(1)}% | ${z.dV85Gesamt > 0 ? '+' : ''}${z.dV85Gesamt.toFixed(1)}% |`,
      )
      .join('\n');
    console.log(
      `| Haushalt | Variante | Frühestes Alter (Detail) | Δ Alter | Δ Vermögen mit 85 (CHF) | in % Vermögen 85 (Detail) | in % Gesamtvermögen heute |\n|---|---|---|---|---|---|---|\n${t}`,
    );
    expect(zeilen.length).toBe(13);
    // Geschätzter Umwandlungssatz («Schnell» mit PK-Guthaben, ohne UWS) vs. Satz laut Vorsorgeausweis
    const uws = (
      [
        ['BVG-nah', bvgNah],
        ['Umhüllend', umhuellend],
        ['Paar BR', paarBrasilien],
        ['Frühpension', frueh],
      ] as const
    ).flatMap(([name, h]) => {
      const e = effektiverHaushalt(nurSchnellHaushalt(h, true), regeln, heute);
      return h.personen.map((p, i) => {
        const u = e.umwandlungssatz[i];
        const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
        return `| ${name} (${p.name}) | ${Math.round((u?.anteilObligatorium ?? 0) * 100)}% | ${pct(u?.satz ?? 0)} | ${pct(p.pk.umwandlungssatz)} |`;
      });
    });
    console.log(
      `| Person | Anteil Obligatorium (geschätzt, im RA) | UWS geschätzt | UWS laut Vorsorgeausweis (Detail) |\n|---|---|---|---|\n${uws.join('\n')}`,
    );
    expect(uws.length).toBe(5);
  });
});
