/**
 * Schwere der Katalogkrisen: aus data/krisen-historisch.json gerechnet, nicht aus einer Tabelle.
 * Die Sortierung betrifft nur die Auswahl. `KRISEN` und die automatische Abfolge bleiben historisch.
 */
import { describe, expect, it } from 'vitest';
import { krisenPfad, maxRealerRueckgang } from '../core/krisen';
import {
  AUTO_KRISEN_IDS,
  aktienKennzahl,
  KRISEN,
  KRISEN_DATEN,
  type KrisenSchwere,
  krisenNachSchwere,
  krisenSchwere,
  vergleicheKrisenSchwere,
} from './krisen';

const basis = { renditeNominal: 0, renditeBargeld: 0, inflation: 0 };

/** Dieselbe Definition wie `krisenSchwere`, hier noch einmal aus der Reihe gerechnet. */
function erwartet(krise: (typeof KRISEN)[number]) {
  const daten = KRISEN_DATEN[krise.land];
  let index = 1;
  let peak = 1;
  let peakJahr = krise.von - 1;
  let maxDd = 0;
  let ddPeakJahr = peakJahr;
  let ddTroughJahr = peakJahr;
  let unter = false;
  let erholtJahr: number | null = null;
  for (let j = krise.von; j <= krise.bis; j++) {
    const h = daten.get(j);
    if (!h || h.aktien === null || h.teuerung === null) throw new Error(`Datenlücke ${krise.id} ${j}`);
    index *= (1 + h.aktien) / (1 + h.teuerung);
    if (index > peak) {
      peak = index;
      peakJahr = j;
    }
    const dd = index / peak - 1;
    if (dd < maxDd) {
      maxDd = dd;
      ddPeakJahr = peakJahr;
      ddTroughJahr = j;
    }
    if (index < 1 - 1e-9) unter = true;
    else if (unter && erholtJahr === null && index >= 1 - 1e-9) erholtJahr = j;
  }
  const endeIndex = index;
  if (unter && erholtJahr === null) {
    for (let j = krise.bis + 1; j <= krise.von + 80; j++) {
      const h = daten.get(j);
      if (!h || h.aktien === null || h.teuerung === null) break;
      index *= (1 + h.aktien) / (1 + h.teuerung);
      if (index >= 1 - 1e-9) {
        erholtJahr = j;
        break;
      }
    }
  }
  const phasenJahre = krise.bis - krise.von + 1;
  const hatRueckgang = maxDd < -1e-12;
  return {
    maxRueckgang: hatRueckgang ? maxDd : 0,
    peakJahr: hatRueckgang ? ddPeakJahr : peakJahr,
    tiefpunktJahr: hatRueckgang ? ddTroughJahr : null,
    jahreBisTiefpunkt: hatRueckgang ? ddTroughJahr - ddPeakJahr : null,
    endeKumuliert: endeIndex - 1,
    endeteImPlus: endeIndex - 1 > 1e-9,
    erholtJahr,
    dauerJahre: erholtJahr !== null ? erholtJahr - krise.von + 1 : phasenJahre,
    dauerArt: erholtJahr !== null ? 'erholt' : unter ? 'offen' : 'phase',
    hauspreise: hauspreiseErwartet(krise),
    hauspreisJahreOhneDaten: jahreOhneHauspreis(krise),
  };
}

function jahreOhneHauspreis(krise: (typeof KRISEN)[number]): number[] {
  const daten = KRISEN_DATEN[krise.land];
  const fehlend: number[] = [];
  for (let j = krise.von; j <= krise.bis; j++) {
    const h = daten.get(j);
    if (!h || h.immobilien === null || h.teuerung === null) fehlend.push(j);
  }
  return fehlend;
}

/** Dieselbe Hauspreis-Rechnung wie `hauspreiseDerPhase`, noch einmal aus der Reihe. */
function hauspreiseErwartet(krise: (typeof KRISEN)[number]) {
  const daten = KRISEN_DATEN[krise.land];
  let index = 1;
  let peak = 1;
  let peakJahr = krise.von - 1;
  let maxDd = 0;
  let ddPeakJahr = peakJahr;
  let ddTroughJahr = peakJahr;
  for (let j = krise.von; j <= krise.bis; j++) {
    const h = daten.get(j);
    if (!h || h.immobilien === null || h.teuerung === null) return null;
    index *= (1 + h.immobilien) / (1 + h.teuerung);
    if (index > peak) {
      peak = index;
      peakJahr = j;
    }
    const dd = index / peak - 1;
    if (dd < maxDd) {
      maxDd = dd;
      ddPeakJahr = peakJahr;
      ddTroughJahr = j;
    }
  }
  const hatRueckgang = maxDd < -1e-12;
  return {
    maxRueckgang: hatRueckgang ? maxDd : 0,
    peakJahr: hatRueckgang ? ddPeakJahr : peakJahr,
    tiefpunktJahr: hatRueckgang ? ddTroughJahr : null,
    jahreBisTiefpunkt: hatRueckgang ? ddTroughJahr - ddPeakJahr : null,
  };
}

describe('Krisen-Schwere aus der Jahresreihe', () => {
  it('jede Katalogkrise trifft die Reihe und den Peak-to-Trough der Simulation', () => {
    for (const krise of KRISEN) {
      const s = krisenSchwere(krise, krise.land);
      expect(s, krise.id).not.toBeNull();
      if (!s) continue;
      const e = erwartet(krise);
      expect(s.maxRueckgang, krise.id).toBeCloseTo(e.maxRueckgang, 12);
      expect(s.peakJahr, krise.id).toBe(e.peakJahr);
      expect(s.tiefpunktJahr, krise.id).toBe(e.tiefpunktJahr);
      expect(s.jahreBisTiefpunkt, krise.id).toBe(e.jahreBisTiefpunkt);
      expect(s.endeKumuliert, krise.id).toBeCloseTo(e.endeKumuliert, 12);
      expect(s.endeteImPlus, krise.id).toBe(e.endeteImPlus);
      expect(s.erholtJahr, krise.id).toBe(e.erholtJahr);
      expect(s.dauerJahre, krise.id).toBe(e.dauerJahre);
      expect(s.dauerArt, krise.id).toBe(e.dauerArt);
      expect(s.hauspreise, krise.id).toEqual(e.hauspreise);
      expect(s.hauspreisJahreOhneDaten, krise.id).toEqual(e.hauspreisJahreOhneDaten);
      expect(s.startjahr, krise.id).toBe(krise.von);
      expect(s.phasenJahre, krise.id).toBe(krise.bis - krise.von + 1);
      const pfad = krisenPfad(krise, krise.land, 1, KRISEN_DATEN, basis);
      expect(s.maxRueckgang, krise.id).toBeCloseTo(maxRealerRueckgang(pfad), 12);
    }
  });

  it('feste Anker aus der Datei: Japan, Dotcom, Covid, Immobilienkrise', () => {
    const japan = krisenSchwere(KRISEN.find((k) => k.id === 'japan1990') as (typeof KRISEN)[number], 'JPN');
    expect(japan?.maxRueckgang).toBeCloseTo(-0.6267913929, 8);
    expect(japan?.jahreBisTiefpunkt).toBe(14);
    expect(japan?.dauerArt).toBe('offen');
    expect(japan?.dauerJahre).toBe(14);
    expect(japan?.endeteImPlus).toBe(false);

    const dotcom = krisenSchwere(KRISEN.find((k) => k.id === 'dotcom2000') as (typeof KRISEN)[number], 'CHE');
    const dotcomAlt = aktienKennzahl(KRISEN.find((k) => k.id === 'dotcom2000') as (typeof KRISEN)[number], 'CHE');
    // 2000 war real noch positiv: der Peak liegt im Katalogfenster, nicht am Vorkrisenstand.
    expect(dotcom?.peakJahr).toBe(2000);
    expect(dotcom?.jahreBisTiefpunkt).toBe(2);
    expect(dotcom?.maxRueckgang).toBeCloseTo(-0.431926852, 8);
    expect(dotcomAlt?.dauer).toBe(3);
    expect(dotcom?.maxRueckgang).toBeLessThan(dotcomAlt?.rueckgang ?? 0);

    const covid = krisenSchwere(KRISEN.find((k) => k.id === 'covid2020') as (typeof KRISEN)[number], 'CHE');
    expect(covid?.maxRueckgang).toBe(0);
    expect(covid?.jahreBisTiefpunkt).toBeNull();
    expect(covid?.dauerArt).toBe('phase');
    expect(covid?.endeteImPlus).toBe(true);
    expect(covid?.endeKumuliert).toBeCloseTo(0.0476056168, 8);

    const immo = krisenSchwere(KRISEN.find((k) => k.id === 'immobilienCh1990') as (typeof KRISEN)[number], 'CHE');
    expect(immo?.maxRueckgang).toBeCloseTo(-0.2345675499, 8);
    expect(immo?.jahreBisTiefpunkt).toBe(1);
    expect(immo?.dauerArt).toBe('erholt');
    expect(immo?.dauerJahre).toBe(4);
    expect(immo?.endeteImPlus).toBe(true);
    expect(immo?.endeKumuliert).toBeCloseTo(1.8168792438, 8);
    // Hauspreise real, Peak-to-Trough 1989–1997, Tiefpunkt 1997. Aus der Datei, nicht aus einer Tabelle.
    expect(immo?.hauspreise?.maxRueckgang).toBeCloseTo(-0.3179619215, 8);
    expect(immo?.hauspreise?.tiefpunktJahr).toBe(1997);
    expect(immo?.hauspreise?.jahreBisTiefpunkt).toBe(8);

    const zins = krisenSchwere(KRISEN.find((k) => k.id === 'zinsschock2022') as (typeof KRISEN)[number], 'CHE');
    expect(zins?.dauerArt).toBe('offen');
    expect(zins?.hauspreise).toBeNull();
    expect(zins?.hauspreisJahreOhneDaten).toEqual([2022]);
    const dotcomHaus = krisenSchwere(KRISEN.find((k) => k.id === 'dotcom2000') as (typeof KRISEN)[number], 'CHE');
    expect(dotcomHaus?.hauspreise?.maxRueckgang).toBeGreaterThan(-0.01);
    expect(dotcomHaus?.hauspreise?.maxRueckgang).toBeLessThan(0);
  });

  it('Sortierung: nur nach dem Aktienrückgang, Plus bleibt in der Reihe, Katalog selbst historisch', () => {
    expect(KRISEN.map((k) => k.id)[0]).toBe('depression1929');
    expect([...AUTO_KRISEN_IDS]).toEqual([
      'oelkrise1973',
      'schwarzerMontag1987',
      'immobilienCh1990',
      'dotcom2000',
      'finanzkrise2007',
      'eurokrise2011',
      'covid2020',
      'zinsschock2022',
    ]);
    expect(krisenNachSchwere().map((k) => k.id)).toEqual([
      'japan1990',
      'oelkrise1973',
      'depression1929',
      'stagflation1973',
      'dotcom2000',
      'finanzkrise2007',
      'schwarzerMontag1987',
      'immobilienCh1990',
      'zinsschock2022',
      'eurokrise2011',
      'covid2020',
    ]);
    const ids = krisenNachSchwere().map((k) => k.id);
    expect(ids.indexOf('immobilienCh1990')).toBeLessThan(ids.indexOf('zinsschock2022'));
    expect(ids.indexOf('immobilienCh1990')).toBeLessThan(ids.indexOf('eurokrise2011'));
    expect(ids.indexOf('covid2020')).toBe(ids.length - 1);
    const nochmals = krisenNachSchwere();
    expect(nochmals.map((k) => k.id)).toEqual(ids);
  });

  it('ein Plus am Phasenende sortiert nicht nach hinten', () => {
    const leicht: KrisenSchwere = {
      id: 'leicht',
      startjahr: 2000,
      phasenJahre: 1,
      maxRueckgang: -0.05,
      peakJahr: 1999,
      tiefpunktJahr: 2000,
      jahreBisTiefpunkt: 1,
      endeKumuliert: -0.05,
      endeteImPlus: false,
      erholtJahr: null,
      dauerJahre: 1,
      dauerArt: 'offen',
      hauspreise: null,
      hauspreisJahreOhneDaten: [],
    };
    const plus: KrisenSchwere = {
      ...leicht,
      id: 'plus',
      startjahr: 1990,
      maxRueckgang: -0.8,
      endeKumuliert: 0.2,
      endeteImPlus: true,
      dauerArt: 'erholt',
    };
    expect(vergleicheKrisenSchwere(plus, leicht)).toBeLessThan(0);
    expect(vergleicheKrisenSchwere(leicht, plus)).toBeGreaterThan(0);
    const gleichTief = { ...leicht, id: 'b', startjahr: 2001 };
    expect(vergleicheKrisenSchwere(leicht, gleichTief)).toBeLessThan(0);
  });
});
