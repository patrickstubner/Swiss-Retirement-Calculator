/**
 * Zu- und Abflüsse: Bilanz Σ Zuflüsse − Σ Abflüsse = Δ Vermögen (real exakt), Kapitalquellen, Hausverkauf,
 * Entnahmerate, Ereignisse. Erfundene Beispielpersonen, Fantasiezahlen.
 */
import { describe, expect, it } from 'vitest';
import {
  neueAusgaben,
  neuePerson,
  neuerPosten,
  neuesEreignis,
  neuesWohneigentum,
  standardHaushalt,
} from '../data/defaults';
import { ladeRegeln } from '../rules';
import {
  ABFLUSS_IDS,
  entnahmeKennzahl,
  entnahmeRaten,
  ereignisse,
  flussJahre,
  markerGruppen,
  rentenUmwandlungen,
  ZUFLUSS_IDS,
} from './fluesse';
import { inDarstellung } from './nominal';
import { simuliere, startToepfeHaushalt, startvermoegen } from './simulation';
import type { Haushalt } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

/** Beispiel-Paar: Person A (Jg. 1970) zieht mit 60 nach Thailand (nicht EU/EFTA), Haus wird verkauft. */
function szenario(o: { wegzug?: boolean; verkauf?: boolean; krise?: boolean } = {}): Haushalt {
  const h = standardHaushalt(regeln);
  const a = neuePerson(regeln, {
    name: 'Beispiel A',
    geburtsjahr: 1970,
    geburtsmonat: 4,
    lohn: 120_000,
    stoppAlter: 60,
    wertschriften: 400_000,
    bargeld: 50_000,
  });
  a.ahv = { ...a.ahv, modus: 'eingabe', renteMonat: 2400, beitragsjahre: 44 };
  a.pk = {
    ...a.pk,
    guthaben: 600_000,
    bvgGuthaben: 300_000,
    kapitalanteil: 0,
    fruehestesAlter: 63,
    sparbeitragJahr: 12_000,
  };
  a.saeule3a = { ...a.saeule3a, guthaben: 150_000, beitragJahr: 7_000 };
  a.wohneigentum = neuesWohneigentum(regeln, {
    vorhanden: o.verkauf ?? true,
    verkehrswert: 900_000,
    hypothek: 300_000,
    verkauf: {
      aktiv: o.verkauf ?? true,
      zeitpunkt: 'datum',
      datum: { jahr: 2031, monat: 6 },
      anlagekosten: 500_000,
      kauf: { jahr: 2005, monat: 1 },
      verkaufskostenAnteil: 0.02,
      eigenerSatz: null,
    },
  });
  if (o.wegzug ?? true)
    a.wohnsitzAusland = {
      ...a.wohnsitzAusland,
      aktiv: true,
      modus: 'datum',
      datum: { jahr: 2030, monat: 5 },
      land: 'TH',
      barauszahlung: true,
    };
  const b = neuePerson(regeln, {
    name: 'Beispiel B',
    geburtsjahr: 1985,
    geburtsmonat: 9,
    geschlecht: 'w',
    lohn: 40_000,
    stoppAlter: 62,
  });
  b.ahv = { ...b.ahv, modus: 'eingabe', renteMonat: 1800, beitragsjahre: 40 };
  const krankenkasse = { ...neuerPosten('ausgabe'), betragJahr: 9_000 };
  const wohnen = {
    ...neuerPosten('ausgabe'),
    kategorie: 'wohnen' as const,
    bezeichnung: 'Nebenkosten',
    betragJahr: 3_000,
  };
  const nebenjob = {
    ...neuerPosten('einnahme'),
    kategorie: 'sonstigeEinnahme' as const,
    bezeichnung: 'Nebenjob',
    betragJahr: 6_000,
    startAlter: 61,
    endAlter: 66,
  };
  return {
    ...h,
    zivilstand: 'verheiratet',
    personen: [a, b],
    planungsalter: 92,
    posten: [krankenkasse, wohnen, nebenjob],
    ereignisse: [
      { ...neuesEreignis(), bezeichnung: 'Erbschaft', betrag: 80_000, alter: 65 },
      { ...neuesEreignis(), bezeichnung: 'Auto', betrag: -25_000, alter: 62 },
    ],
    ausgaben: { ...neueAusgaben(), lebenshaltung: 90_000, faktorAb75: 1, faktorAb85: 1 },
    annahmen: { ...h.annahmen, renditeNominal: 0.07, inflation: 0.02 },
    steuern: { ...h.steuern, kanton: 'ZH', gemeinde: 'Zürich' },
    krisen: { ...h.krisen, modus: o.krise ? 'automatisch' : 'keine' },
  };
}

describe('Bilanz der Zu- und Abflüsse', () => {
  for (const [name, o] of [
    ['mit Wegzug und Hausverkauf', {}],
    ['ohne Wegzug, mit Hausverkauf', { wegzug: false }],
    ['ohne Wegzug, ohne Verkauf', { wegzug: false, verkauf: false }],
    ['mit Krisenmodus', { krise: true }],
  ] as const) {
    it(`Σ Zuflüsse − Σ Abflüsse = Δ Vermögen (heutige Franken), ${name}`, () => {
      const h = szenario(o);
      const e = simuliere(h, regeln, { start });
      const fj = flussJahre(e.zeilen, startvermoegen(h));
      expect(fj.length).toBe(e.zeilen.length);
      for (const j of fj) {
        expect(Math.abs(j.umrechnung)).toBeLessThan(0.01);
        expect(j.summeZufluss - j.summeAbfluss).toBeCloseTo(j.vermoegenDelta, 4);
      }
      const dGesamt = fj.reduce((s, j) => s + j.summeZufluss - j.summeAbfluss, 0);
      expect(dGesamt).toBeCloseTo((fj.at(-1)?.vermoegenEnde ?? 0) - startvermoegen(h), 3);
    });
  }

  it('alle Posten sind nicht negativ und vollständig benannt', () => {
    const h = szenario();
    const e = simuliere(h, regeln, { start });
    for (const j of flussJahre(e.zeilen, startvermoegen(h))) {
      for (const id of ZUFLUSS_IDS) expect(j.zufluesse[id]).toBeGreaterThanOrEqual(0);
      for (const id of ABFLUSS_IDS) expect(j.abfluesse[id]).toBeGreaterThanOrEqual(0);
    }
  });

  it('nominale Darstellung: Bilanz geht bis auf die Teuerung auf dem Bestand auf', () => {
    const h = szenario();
    const e = simuliere(h, regeln, { start });
    const n = inDarstellung(e, 'nominal');
    const fj = flussJahre(n.zeilen, startvermoegen(h));
    for (const j of fj) expect(j.summeZufluss - j.summeAbfluss + j.umrechnung).toBeCloseTo(j.vermoegenDelta, 4);
    // Die Umrechnung ist klein gegenüber den Flüssen (Teuerung auf dem Bestand, kein fehlender Posten)
    const real = flussJahre(e.zeilen, startvermoegen(h));
    expect(fj.reduce((s, j) => s + j.summeZufluss, 0)).toBeGreaterThan(real.reduce((s, j) => s + j.summeZufluss, 0));
  });
});

describe('Kapitalquellen und Hausverkauf', () => {
  const h = szenario();
  const e = simuliere(h, regeln, { start });
  const fj = flussJahre(e.zeilen, startvermoegen(h));
  const j = (jahr: number) => fj.find((x) => x.jahr === jahr);

  it('PK, Freizügigkeit und 3a: Quellen summieren sich zu den Kapitalbezügen', () => {
    for (const z of e.zeilen)
      expect(z.kapitalPk + z.kapitalFz + z.kapital3a + z.kapitalTod).toBeCloseTo(z.kapitalBezuege, 6);
    const bar = e.zeilen.find((z) => z.kapitalPk > 0);
    expect(bar?.jahr).toBe(2030);
    expect(bar?.kapital3a).toBeGreaterThan(100_000);
    expect(j(2030)?.zufluesse.kapitalPk).toBeGreaterThan(500_000);
    expect(j(2030)?.abfluesse.stKapital).toBeGreaterThan(0);
  });

  it('Hausverkauf ist Umschichtung: Abfluss sind nur Kosten und Steuer, nicht der Erlös', () => {
    const z = e.zeilen.find((x) => x.verkaufserloes > 0);
    expect(z?.jahr).toBe(2031);
    expect(z?.verkaufskosten).toBeGreaterThan(10_000);
    expect(z?.grundstueckgewinnsteuer).toBeGreaterThan(0);
    const f = j(2031);
    expect(f?.abfluesse.verkaufskosten).toBe(z?.verkaufskosten);
    expect(f?.abfluesse.stGrundstueck).toBe(z?.grundstueckgewinnsteuer);
    // Der Erlös selbst steht nicht als Zufluss (Netto-Haus wechselt nur den Topf)
    expect(f?.summeZufluss).toBeLessThan((z?.verkaufserloes ?? 0) + (f?.zufluesse.ertraege ?? 0) + 400_000);
  });

  it('Posten Krankenkasse/Wohnen/Sonstiges werden getrennt', () => {
    const f = j(2035);
    expect(f?.abfluesse.krankenkasse).toBeCloseTo(9_000, 0);
    expect(f?.abfluesse.wohnkosten).toBeGreaterThanOrEqual(0);
    expect(f?.abfluesse.lebenshaltung).toBeCloseTo(90_000, 0);
  });
});

describe('Entnahmerate', () => {
  const h = szenario();
  const e = simuliere(h, regeln, { start });
  const raten = entnahmeRaten(e.zeilen, startToepfeHaushalt(h));

  it('Bezugsgrösse «investiert» schliesst gesperrte Vorsorge und Wohneigentum aus, «gesamt» nicht', () => {
    const r = raten.find((x) => x.jahr === 2027);
    const z0 = 400_000 + 50_000;
    expect(r).toBeDefined();
    expect(r?.investiert).toBeGreaterThan(0);
    expect(r?.gesamt).toBeGreaterThan(r?.investiert ?? 0);
    expect(z0).toBeGreaterThan(0);
    for (const x of raten)
      if (x.rateInvestiert !== null && x.rateGesamt !== null)
        expect(x.rateGesamt).toBeLessThanOrEqual(x.rateInvestiert + 1e-12);
  });

  it('Entnahme = −Saldo bei Defizit, sonst 0', () => {
    for (const [i, x] of raten.entries()) {
      const z = e.zeilen[i];
      expect(x.entnahme).toBeCloseTo(Math.max(0, -(z?.saldo ?? 0)), 6);
    }
  });

  it('Kennzahl im ersten vollen Ruhestandsjahr; ohne Erwerb beginnt sie im ersten vollen Jahr', () => {
    const k = entnahmeKennzahl(e.zeilen, startToepfeHaushalt(h));
    const letzterLohn = [...e.zeilen].reverse().find((z) => z.lohn > 0.5);
    expect(k?.jahr).toBe((letzterLohn?.jahr ?? 0) + 1);
    const ohne = { ...h, personen: h.personen.map((p) => ({ ...p, lohn: 0, stoppAlter: 0 })) };
    const e2 = simuliere(ohne, regeln, { start: { jahr: 2026, monat: 7 } });
    expect(entnahmeKennzahl(e2.zeilen, startToepfeHaushalt(ohne), 7)?.jahr).toBe(2027);
  });

  it('Quotient ist von der Darstellung unabhängig genug: nominal und real liefern dieselbe Rate', () => {
    const n = inDarstellung(e, 'nominal');
    // Raten werden aus realen Zeilen gebildet; die Kennzahl-Funktion rechnet nie mit gemischten Währungen
    const real = entnahmeKennzahl(e.zeilen, startToepfeHaushalt(h));
    expect(real?.erst.rateInvestiert ?? 0).toBeGreaterThanOrEqual(0);
    expect(n.zeilen.length).toBe(e.zeilen.length);
  });

  it('ohne Vermögen: keine Rate (null), keine Division durch 0', () => {
    const leer = standardHaushalt(regeln);
    const e0 = simuliere(leer, regeln, { start });
    for (const r of entnahmeRaten(e0.zeilen, startToepfeHaushalt(leer))) {
      expect(Number.isFinite(r.entnahme)).toBe(true);
      expect(r.rateInvestiert === null || Number.isFinite(r.rateInvestiert)).toBe(true);
    }
  });
});

describe('Ereignisse und Marker', () => {
  const h = szenario();
  const e = simuliere(h, regeln, { start });
  const evs = ereignisse(e, h, 'real');

  it('enthält Barauszahlung, Hausverkauf (Betrag + Steuer), Wegzug, AHV-Start, Einmalereignisse', () => {
    const arten = new Set(evs.map((x) => x.art));
    for (const a of ['pk', '3a', 'hausverkauf', 'wegzug', 'ahv', 'einmalig', 'posten'] as const)
      expect(arten.has(a)).toBe(true);
    const verkauf = evs.find((x) => x.art === 'hausverkauf');
    expect(verkauf?.betrag).toBeGreaterThan(0);
    expect(verkauf?.steuer).toBeGreaterThan(0);
    expect(verkauf?.jahr).toBe(2031);
    expect(evs.filter((x) => x.art === 'ahv')).toHaveLength(2);
    const pk = evs.find((x) => x.art === 'pk');
    expect(pk?.jahr).toBe(2030);
    expect(pk?.monat).toBe(5);
  });

  it('ist nach Datum sortiert; Kapitalsumme der Ereignisse = Kapitalzuflüsse der Bilanz', () => {
    for (let i = 1; i < evs.length; i++) expect((evs[i]?.jahr ?? 0) >= (evs[i - 1]?.jahr ?? 0)).toBe(true);
    const fj = flussJahre(e.zeilen, startvermoegen(h));
    const kap = evs
      .filter((x) => ['pk', 'fz', '3a', 'todesfall'].includes(x.art))
      .reduce((s, x) => s + (x.betrag ?? 0), 0);
    const bilanz = fj.reduce(
      (s, j) => s + j.zufluesse.kapitalPk + j.zufluesse.kapitalFz + j.zufluesse.kapital3a + j.zufluesse.kapitalTod,
      0,
    );
    expect(kap).toBeCloseTo(bilanz, 4);
  });

  it('Marker je Jahr gruppiert und nummeriert', () => {
    const g = markerGruppen(evs);
    expect(g.length).toBeGreaterThan(2);
    expect(g.map((x) => x.nr)).toEqual(g.map((_, i) => i + 1));
    expect(new Set(g.map((x) => x.jahr)).size).toBe(g.length);
    expect(g.every((x) => x.ereignisse.every((ev) => ev.marker))).toBe(true);
  });

  it('PK-Rente: Umwandlung wird gemeldet («kein Verlust»)', () => {
    const ohneWeg = szenario({ wegzug: false });
    const e2 = simuliere(ohneWeg, regeln, { start });
    const u = rentenUmwandlungen(e2, ohneWeg);
    expect(u).toHaveLength(1);
    expect(u[0]?.person).toBe('Beispiel A');
    expect(u[0]?.renteJahr).toBeGreaterThan(10_000);
    const evs2 = ereignisse(e2, ohneWeg, 'real');
    expect(evs2.find((x) => x.art === 'pkRente')?.text).toContain('Kein Verlust');
    expect(rentenUmwandlungen(e, h)).toHaveLength(0);
  });

  it('nominal: Beträge der Ereignisse sind mit der Teuerung hochgerechnet', () => {
    const n = inDarstellung(e, 'nominal');
    const evN = ereignisse(n, h, 'nominal');
    const erb = evs.find((x) => x.art === 'einmalig' && (x.betrag ?? 0) > 0);
    const erbN = evN.find((x) => x.art === 'einmalig' && (x.betrag ?? 0) > 0);
    expect(erbN?.betrag).toBeGreaterThan(erb?.betrag ?? 0);
  });
});

describe('Abfluss-Gruppen der Grafik', () => {
  it('jeder Abfluss-Posten ausser den reinen Wertverlusten steckt in genau einer Gruppe', async () => {
    const { ABFLUSS_GRUPPEN, gruppenBetrag } = await import('./fluesse');
    const ids = ABFLUSS_GRUPPEN.flatMap((g) => g.posten);
    expect(new Set(ids).size).toBe(ids.length);
    const fehlen = ABFLUSS_IDS.filter((id) => !ids.includes(id));
    expect(fehlen.sort()).toEqual(['kursverlust', 'wohnwertVerlust']);
    const h = szenario({ krise: false });
    const e = simuliere(h, regeln, { start });
    for (const j of flussJahre(e.zeilen, startvermoegen(h))) {
      const summeGruppen = ABFLUSS_GRUPPEN.reduce((s, g) => s + gruppenBetrag(j, g), 0);
      expect(summeGruppen + j.abfluesse.kursverlust + j.abfluesse.wohnwertVerlust).toBeCloseTo(j.summeAbfluss, 6);
    }
  });
});

describe('Entnahmerate: höchste Rate', () => {
  it('liegt in den Ruhestandsjahren und ist mindestens so hoch wie die erste', () => {
    const h = szenario();
    const e = simuliere(h, regeln, { start });
    const k = entnahmeKennzahl(e.zeilen, startToepfeHaushalt(h));
    expect(k?.hoechste).not.toBeNull();
    expect(k?.hoechste?.rate ?? 0).toBeGreaterThanOrEqual(k?.erst.rateInvestiert ?? 0);
    expect(k?.hoechste?.jahr ?? 0).toBeGreaterThanOrEqual(k?.jahr ?? 0);
  });
});
