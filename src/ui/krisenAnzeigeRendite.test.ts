import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { simuliere } from '../core/simulation';
import type { Haushalt, SimulationsErgebnis } from '../core/typen';
import { neueGeplanteKrise, neuePerson, standardHaushalt } from '../data/defaults';
import { autoNormal, krisenOptionen } from '../data/krisen';
import { ladeRegeln } from '../rules';
import { KEIN_WAS_WAERE, mitWasWaere, rechne, simulierteRenditeNominal } from './components/Auswertung';
import { haushaltOhneKrise, KrisenSteuerung, vergleichOhneKrise } from './components/Krisen';
import { darstellungVon, endBetrag } from './darstellung';
import { fmtChf, fmtProzent } from './format';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };
const EINGABE = 0.07;
const REGLER = 0.05;

/** Erfundenes Beispiel. Die Eingabe bleibt 7 %, der Regler rechnet mit 5 %. */
function haushalt(modus: 'individuell' | 'automatisch', ausgleich: boolean): Haushalt {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: 'Muster',
    geburtsjahr: 1970,
    geburtsmonat: 6,
    lohn: 90_000,
    stoppAlter: 65,
    wertschriften: 400_000,
  });
  return {
    ...h,
    personen: [p],
    ausgaben: { ...h.ausgaben, lebenshaltung: 60_000 },
    planungsalter: 90,
    annahmen: { ...h.annahmen, renditeNominal: EINGABE },
    krisen: {
      ...h.krisen,
      modus,
      ausgleich,
      auswahl: modus === 'individuell' ? [neueGeplanteKrise('zinsschock2022', 'CHE', 2030)] : [],
    },
  };
}

function kasten(h: Haushalt, annahme: number, wunsch: SimulationsErgebnis | null, rechnungH: Haushalt = h): string {
  return renderToStaticMarkup(
    createElement(KrisenSteuerung, {
      h,
      setH: () => {},
      regeln,
      heute: start,
      wunsch,
      refIdx: 0,
      namen: ['Muster'],
      aktienanteilHier: false,
      annahmeRendite: annahme,
      rechnungH,
    }),
  );
}

describe('Angezeigte Rendite bei abweichendem Regler', () => {
  it('ohne Ausgleich nennt der Kasten den Regler, nicht die Eingabe', () => {
    const h = haushalt('individuell', false);
    const hw = mitWasWaere(h, { ...KEIN_WAS_WAERE, rendite: REGLER }, 2026);
    expect(h.annahmen.renditeNominal).toBe(EINGABE);
    expect(hw.annahmen.renditeNominal).toBe(REGLER);
    expect(simulierteRenditeNominal(h.annahmen.renditeNominal, REGLER)).toBe(hw.annahmen.renditeNominal);

    const html = kasten(h, hw.annahmen.renditeNominal, null);
    expect(html).toContain('Ihre Renditeannahme (5%)');
    expect(html).toContain('danach gilt Ihre Renditeannahme (5%)');
    expect(html).not.toContain('Ihre Renditeannahme (7%)');
  });

  it('mit Ausgleich zeigt «statt» den Regler und die Sätze dieser Rechnung', () => {
    const h = haushalt('individuell', true);
    const beiRegler = rechne(mitWasWaere(h, { ...KEIN_WAS_WAERE, rendite: REGLER }, 2026), regeln, start, 'gemeinsam');
    const beiEingabe = rechne(h, regeln, start, 'gemeinsam');
    const normal = beiRegler.wunsch.krisenNormal;
    const normalEingabe = beiEingabe.wunsch.krisenNormal;
    expect(normal).not.toBeNull();
    expect(normalEingabe).not.toBeNull();
    if (!normal || !normalEingabe) return;
    expect(normal.wertschriften).not.toBeCloseTo(normalEingabe.wertschriften, 6);

    const hw = mitWasWaere(h, { ...KEIN_WAS_WAERE, rendite: REGLER }, 2026);
    const html = kasten(h, REGLER, beiRegler.wunsch, hw);
    expect(html).toContain(`statt ${fmtProzent(REGLER, 2)}`);
    expect(html).not.toContain('statt 7%');
    expect(html).toContain(fmtProzent(normal.wertschriften, 2));
    expect(html).toContain(`Hauspreisrendite (${fmtProzent(normal.wohneigentum, 2)})`);
    expect(html).toContain(
      `Wertschriften ${fmtProzent(normal.wertschriften, 2)}, Hauspreise ${fmtProzent(normal.wohneigentum, 2)}`,
    );
    expect(html).not.toContain(fmtProzent(normalEingabe.wertschriften, 2));
  });

  it('im Modus Automatisch steht beim «statt» ebenfalls der Regler', () => {
    const h = haushalt('automatisch', false);
    const beiRegler = rechne(mitWasWaere(h, { ...KEIN_WAS_WAERE, rendite: REGLER }, 2026), regeln, start, 'gemeinsam');
    const normal = beiRegler.wunsch.krisenNormal;
    expect(normal).not.toBeNull();
    if (!normal) return;
    const hw = mitWasWaere(h, { ...KEIN_WAS_WAERE, rendite: REGLER }, 2026);
    const html = kasten(h, REGLER, beiRegler.wunsch, hw);
    expect(html).toContain(`statt ${fmtProzent(REGLER, 2)}`);
    expect(html).not.toContain('statt 7%');
    expect(html).toContain(fmtProzent(normal.wertschriften, 2));
  });
});

describe('Vergleich Ohne Krise mit dem Regler', () => {
  it('ohne Regler bleibt «Ohne Krise» bitgleich zur bisherigen Eingabe', () => {
    const h = haushalt('individuell', false);
    const hw = mitWasWaere(h, KEIN_WAS_WAERE, 2026);
    const bisher = simuliere({ ...h, krisen: { ...h.krisen, modus: 'keine' } }, regeln, { start });
    expect(vergleichOhneKrise(hw, regeln, start).endVermoegen).toBe(vergleichOhneKrise(h, regeln, start).endVermoegen);
    expect(vergleichOhneKrise(h, regeln, start).endVermoegen).toBe(bisher.endVermoegen);
  });

  it('Regler 0 % und 10 % ändern «Ohne Krise», die Eingabe bleibt 7 %', () => {
    const h = haushalt('individuell', true);
    expect(h.annahmen.renditeNominal).toBe(EINGABE);
    const eingabe = vergleichOhneKrise(h, regeln, start).endVermoegen;
    const bei0 = vergleichOhneKrise(
      mitWasWaere(h, { ...KEIN_WAS_WAERE, rendite: 0 }, 2026),
      regeln,
      start,
    ).endVermoegen;
    const bei10 = vergleichOhneKrise(
      mitWasWaere(h, { ...KEIN_WAS_WAERE, rendite: 0.1 }, 2026),
      regeln,
      start,
    ).endVermoegen;
    expect(bei0).not.toBe(eingabe);
    expect(bei10).not.toBe(eingabe);
    expect(bei10).toBeGreaterThan(bei0);
  });

  it('Teuerung, Rücktritt, Ausgaben und Planungsalter ändern «Ohne Krise»', () => {
    const h = haushalt('individuell', false);
    const basis = vergleichOhneKrise(h, regeln, start).endVermoegen;
    const teuerung = vergleichOhneKrise(
      mitWasWaere(h, { ...KEIN_WAS_WAERE, teuerung: 0.05 }, 2026),
      regeln,
      start,
    ).endVermoegen;
    const ausgaben = vergleichOhneKrise(
      mitWasWaere(h, { ...KEIN_WAS_WAERE, ausgaben: 80_000 }, 2026),
      regeln,
      start,
    ).endVermoegen;
    const plan = vergleichOhneKrise(
      mitWasWaere(h, { ...KEIN_WAS_WAERE, planungsalter: 80 }, 2026),
      regeln,
      start,
    ).endVermoegen;
    const alter = vergleichOhneKrise(
      mitWasWaere(h, { ...KEIN_WAS_WAERE, alter: [60 * 12, null] }, 2026),
      regeln,
      start,
    ).endVermoegen;
    expect(teuerung).not.toBe(basis);
    expect(ausgaben).not.toBe(basis);
    expect(plan).not.toBe(basis);
    expect(alter).not.toBe(basis);
  });

  it('bei gleichen Einstellungen unterscheidet sich «Ohne Krise» nur durch den Krisenmodus', () => {
    const h = haushalt('automatisch', false);
    const hw = mitWasWaere(
      h,
      { ...KEIN_WAS_WAERE, rendite: 0.1, teuerung: 0.03, ausgaben: 55_000, planungsalter: 88, alter: [64 * 12, null] },
      2026,
    );
    const ohneH = haushaltOhneKrise(hw);
    expect(ohneH.krisen.modus).toBe('keine');
    expect(hw.krisen.modus).toBe('automatisch');
    expect({ ...ohneH, krisen: hw.krisen }).toEqual(hw);
    expect(ohneH.annahmen.renditeNominal).toBe(0.1);
    const ohne = vergleichOhneKrise(hw, regeln, start);
    const mit = rechne(hw, regeln, start, 'gemeinsam').wunsch;
    expect(ohne.endVermoegen).toBe(simuliere(ohneH, regeln, { start }).endVermoegen);
    expect(mit.endVermoegen).toBe(simuliere(hw, regeln, { start, krisen: krisenOptionen(hw) }).endVermoegen);
  });

  it('der Kasten zeigt «Ohne Krise» zum Regler 10 %, nicht zur Eingabe', () => {
    const h = haushalt('individuell', false);
    const hw = mitWasWaere(h, { ...KEIN_WAS_WAERE, rendite: 0.1 }, 2026);
    const ohneRegler = vergleichOhneKrise(hw, regeln, start);
    const ohneEingabe = vergleichOhneKrise(h, regeln, start);
    const mit = rechne(hw, regeln, start, 'gemeinsam').wunsch;
    const html = kasten(h, 0.1, mit, hw);
    const dar = darstellungVon(h);
    expect(html).toContain('Ohne Krise');
    expect(html).toContain(`Am Ende: ${fmtChf(endBetrag(ohneRegler, dar))}`);
    expect(html).toContain(`Am Ende: ${fmtChf(endBetrag(mit, dar))}`);
    expect(html).not.toContain(`Am Ende: ${fmtChf(endBetrag(ohneEingabe, dar))}`);
  });

  it('der Umlauf-Vergleich nennt den Regler, nicht die Eingabe', () => {
    const h = haushalt('automatisch', false);
    const hw = mitWasWaere(h, { ...KEIN_WAS_WAERE, rendite: 0.1 }, 2026);
    const umlaufRegler = autoNormal(hw);
    const umlaufEingabe = autoNormal(h);
    expect(umlaufRegler.wertschriften).not.toBeCloseTo(umlaufEingabe.wertschriften, 6);
    const bei = rechne(hw, regeln, start, 'gemeinsam');
    const html = kasten(h, 0.1, bei.wunsch, hw);
    expect(html).toContain(`wären ${fmtProzent(umlaufRegler.wertschriften, 2)}`);
    expect(html).not.toContain(`wären ${fmtProzent(umlaufEingabe.wertschriften, 2)}`);
  });
});
