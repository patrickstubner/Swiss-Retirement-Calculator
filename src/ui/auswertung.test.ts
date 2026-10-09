import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { simuliere } from '../core/simulation';
import type { Haushalt } from '../core/typen';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { autoNormal } from '../data/krisen';
import { ladeRegeln } from '../rules';
import { Auswertung, haushaltNachUebernehmen, KEIN_WAS_WAERE, mitWasWaere, rechne } from './components/Auswertung';
import { vergleichOhneKrise } from './components/Krisen';
import { darstellungVon, endBetrag } from './darstellung';
import { chartFarbe, mitAlpha } from './farben';
import { fmtChf, fmtProzent } from './format';
import { krisenAbschnitte, krisenText } from './krisenGrafik';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

/** Erfundenes Beispiel */
function haushalt(): Haushalt {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: 'Muster',
    geburtsjahr: 1965,
    geburtsmonat: 4,
    lohn: 95_000,
    stoppAlter: 65,
    wertschriften: 600_000,
  });
  // ohne Krisen (Standard beim ersten Start wäre «Automatisch»), damit die Vergleiche eindeutig sind
  return {
    ...h,
    personen: [p],
    ausgaben: { ...h.ausgaben, lebenshaltung: 65_000 },
    planungsalter: 95,
    krisen: { ...h.krisen, modus: 'keine' as const },
  };
}

describe('Was-wäre-wenn', () => {
  it('ohne Regleränderung identisch mit der normalen Berechnung (Rechenlogik unverändert)', () => {
    const h = haushalt();
    const hw = mitWasWaere(h, KEIN_WAS_WAERE, 2026);
    expect(hw).toEqual(h);
    const k = rechne(hw, regeln, start, 'gemeinsam');
    expect(k.wunsch.endVermoegen).toBe(simuliere(h, regeln, { start }).endVermoegen);
  });

  it('«Übernehmen» schreibt den Regler über die Eingabe', () => {
    const h = haushalt();
    const eingabe = { ...h, annahmen: { ...h.annahmen, renditeNominal: 0.07 } };
    const regler = { ...KEIN_WAS_WAERE, rendite: 0.05, teuerung: 0.03, ausgaben: 70_000, planungsalter: 88 };
    const nach = haushaltNachUebernehmen(eingabe, regler, 2026);
    expect(eingabe.annahmen.renditeNominal).toBe(0.07);
    expect(nach.annahmen.renditeNominal).toBe(0.05);
    expect(nach.annahmen.inflation).toBe(0.03);
    expect(nach.ausgaben.lebenshaltung).toBe(70_000);
    expect(nach.planungsalter).toBe(88);
    expect(nach).toEqual(mitWasWaere(eingabe, regler, 2026));
    expect(simuliere(nach, regeln, { start }).endVermoegen).not.toBe(
      simuliere(eingabe, regeln, { start }).endVermoegen,
    );
  });

  it('die Auswertung zeigt «Ohne Krise» und den Umlauf zum Regler, nicht zur Eingabe', () => {
    const basis = haushalt();
    const h: Haushalt = {
      ...basis,
      annahmen: { ...basis.annahmen, renditeNominal: 0.07 },
      krisen: { ...basis.krisen, modus: 'automatisch' },
    };
    const regler = { ...KEIN_WAS_WAERE, rendite: 0.1 };
    const hw = mitWasWaere(h, regler, 2026);
    const ohneRegler = vergleichOhneKrise(hw, regeln, start);
    const ohneEingabe = vergleichOhneKrise(h, regeln, start);
    const umlaufRegler = autoNormal(hw);
    const umlaufEingabe = autoNormal(h);
    expect(ohneRegler.endVermoegen).not.toBe(ohneEingabe.endVermoegen);
    expect(umlaufRegler.wertschriften).not.toBeCloseTo(umlaufEingabe.wertschriften, 6);
    const html = renderToStaticMarkup(
      createElement(Auswertung, {
        h,
        setH: () => {},
        effH: h,
        regeln,
        heute: start,
        suchModus: 'gemeinsam',
        namen: ['Muster'],
        refIdx: 0,
        aktienanteilHier: false,
        reglerAnfang: regler,
        sofort: true,
      }),
    );
    const dar = darstellungVon(h);
    expect(html).toContain('Ohne Krise');
    expect(html).toContain(`Am Ende: ${fmtChf(endBetrag(ohneRegler, dar))}`);
    expect(html).not.toContain(`Am Ende: ${fmtChf(endBetrag(ohneEingabe, dar))}`);
    expect(html).toContain(`wären ${fmtProzent(umlaufRegler.wertschriften, 2)}`);
    expect(html).not.toContain(`wären ${fmtProzent(umlaufEingabe.wertschriften, 2)}`);
    expect(html).toContain(`statt ${fmtProzent(0.1, 2)}`);
    expect(html).not.toContain('statt 7%');
  });

  it('überträgt Rücktrittsalter, Ausgaben, Rendite und Teuerung', () => {
    const h = haushalt();
    const hw = mitWasWaere(
      h,
      {
        ...KEIN_WAS_WAERE,
        alter: [62 * 12 + 6, null],
        ausgaben: 50_000,
        rendite: 0.03,
        teuerung: 0.02,
        planungsalter: 90,
      },
      2026,
    );
    expect(hw.personen[0]?.stoppAlter).toBe(62.5);
    expect(hw.personen[0]?.stoppModus).toBe('alter');
    expect(hw.planungsalter).toBe(90);
    expect(hw.ausgaben.lebenshaltung).toBe(50_000);
    expect(hw.annahmen.renditeNominal).toBe(0.03);
    expect(hw.annahmen.inflation).toBe(0.02);
  });

  it('Rücktritt per Datum bleibt ein Datum (Regler in Monaten)', () => {
    const h = haushalt();
    const p = {
      ...(h.personen[0] as (typeof h.personen)[0]),
      stoppModus: 'datum' as const,
      stoppDatum: { jahr: 2030, monat: 3 },
    };
    const hw = mitWasWaere({ ...h, personen: [p] }, { ...KEIN_WAS_WAERE, alter: [(2031 - 1965) * 12, null] }, 2026);
    // Jg. 4/1965, Alter 66 J. 0 Mt. = erster Monat ohne Lohn April 2031 → letzter Arbeitsmonat März 2031
    expect(hw.personen[0]?.stoppModus).toBe('datum');
    expect(hw.personen[0]?.stoppDatum).toEqual({ jahr: 2031, monat: 3 });
  });

  it('Planungsalter-Regler verlängert bzw. verkürzt die Rechnung sofort', () => {
    const h = haushalt();
    const kurz = rechne(mitWasWaere(h, { ...KEIN_WAS_WAERE, planungsalter: 80 }, 2026), regeln, start, 'gemeinsam');
    const lang = rechne(mitWasWaere(h, { ...KEIN_WAS_WAERE, planungsalter: 110 }, 2026), regeln, start, 'gemeinsam');
    expect(kurz.wunsch.zeilen.at(-1)?.alter[0]).toBe(80);
    expect(lang.wunsch.zeilen.at(-1)?.alter[0]).toBe(110);
  });

  it('Krisenmodus «Individuell» ohne Liste: Finanzkrise im Rücktrittsjahr', () => {
    const h = haushalt();
    const hw = mitWasWaere(h, { ...KEIN_WAS_WAERE, krise: 'individuell' }, 2026);
    expect(hw.krisen.modus).toBe('individuell');
    expect(hw.krisen.auswahl[0]?.id).toBe('finanzkrise2007');
    const mit = rechne(hw, regeln, start, 'gemeinsam');
    const ohne = rechne(h, regeln, start, 'gemeinsam');
    expect(mit.wunsch.krisenJahre.length).toBe(3);
    expect(mit.wunsch.endVermoegen).toBeLessThan(ohne.wunsch.endVermoegen);
  });

  it('mehr Ausgaben verschlechtern das Ergebnis', () => {
    const h = haushalt();
    const a = rechne(mitWasWaere(h, { ...KEIN_WAS_WAERE, ausgaben: 60_000 }, 2026), regeln, start, 'gemeinsam');
    const b = rechne(mitWasWaere(h, { ...KEIN_WAS_WAERE, ausgaben: 90_000 }, 2026), regeln, start, 'gemeinsam');
    expect(b.wunsch.endVermoegen).toBeLessThan(a.wunsch.endVermoegen);
  });

  it('Krisenmodus «Automatisch»: Krisenjahre erscheinen als beschriftete Abschnitte', () => {
    const h = haushalt();
    const k = rechne(mitWasWaere(h, { ...KEIN_WAS_WAERE, krise: 'automatisch' }, 2026), regeln, start, 'gemeinsam');
    const a = krisenAbschnitte(k.wunsch, 0);
    // Standard: erste Krise 2036 (Ölkrise 1973–74), dann alle 13.5 Jahre die nächste der Liste
    expect(a[0]).toMatchObject({ label: 'Ölkrise', jahrVon: 2036, jahrBis: 2037, von: 70, bis: 72 });
    expect(a[1]).toMatchObject({ label: 'Schwarzer Montag', jahrVon: 2050, jahrBis: 2050 });
    expect(krisenText(a.slice(0, 2))).toBe('Ölkrise 2036–2037 (Alter 71–72), Schwarzer Montag 2050 (Alter 85)');
  });

  it('zwei geplante Krisen: Bänder mit Namen am gewählten Startjahr', () => {
    const h = haushalt();
    h.personen[0] = { ...(h.personen[0] as (typeof h.personen)[number]), geburtsjahr: 1980 };
    h.planungsalter = 90;
    h.krisen = {
      ...h.krisen,
      modus: 'individuell',
      auswahl: [
        {
          uid: 'fin',
          id: 'finanzkrise2007',
          land: 'CHE',
          startArt: 'jahr',
          jahr: 2046,
          alter: 66,
          person: 0,
          jahreNach: 0,
          eigen: null,
        },
        {
          uid: 'dot',
          id: 'dotcom2000',
          land: 'CHE',
          startArt: 'jahr',
          jahr: 2055,
          alter: 75,
          person: 0,
          jahreNach: 0,
          eigen: null,
        },
      ],
    };
    const a = krisenAbschnitte(rechne(h, regeln, start, 'gemeinsam').wunsch, 0);
    expect(a[0]).toMatchObject({
      label: 'Finanzkrise',
      name: 'Finanz- und Immobilienkrise 2007–2009',
      jahrVon: 2046,
      jahrBis: 2048,
    });
    expect(a[1]).toMatchObject({ label: 'Dotcom', jahrVon: 2055, jahrBis: 2057 });
    expect(krisenText(a)).toContain('Finanzkrise 2046–2048');
    expect(krisenText(a)).toContain('Dotcom 2055–2057');
  });

  it('Beginn im Juli verschiebt das Band und nennt den Monat', () => {
    const h = haushalt();
    h.planungsalter = 90;
    h.krisen = {
      ...h.krisen,
      modus: 'individuell',
      auswahl: [
        {
          uid: 'euro',
          id: 'eurokrise2011',
          land: 'CHE',
          startArt: 'jahr',
          jahr: 2046,
          alter: 81,
          person: 0,
          jahreNach: 0,
          monat: 7,
          eigen: null,
        },
      ],
    };
    const a = krisenAbschnitte(rechne(h, regeln, start, 'gemeinsam').wunsch, 0);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ label: 'Eurokrise', jahrVon: 2046, jahrBis: 2047, monatVon: 7, monatBis: 6 });
    expect(a[0]?.von).toBeCloseTo(80.5, 6);
    expect(a[0]?.bis).toBeCloseTo(81.5, 6);
    expect(krisenText(a)).toBe('Eurokrise Juli 2046–Juni 2047 (Alter 80,5–81,5)');
  });
});

describe('Diagrammfarben', () => {
  it('Ersatzwerte ohne DOM und Alpha-Umrechnung', () => {
    expect(chartFarbe('haupt')).toMatch(/^#/);
    expect(mitAlpha('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
  });
});
