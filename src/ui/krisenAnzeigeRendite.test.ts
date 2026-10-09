import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Haushalt, SimulationsErgebnis } from '../core/typen';
import { neueGeplanteKrise, neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { KEIN_WAS_WAERE, mitWasWaere, rechne, simulierteRenditeNominal } from './components/Auswertung';
import { KrisenSteuerung } from './components/Krisen';
import { fmtProzent } from './format';

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

function kasten(h: Haushalt, annahme: number, wunsch: SimulationsErgebnis | null): string {
  return renderToStaticMarkup(
    createElement(KrisenSteuerung, {
      h,
      setH: () => {},
      effH: h,
      regeln,
      heute: start,
      wunsch,
      refIdx: 0,
      namen: ['Muster'],
      aktienanteilHier: false,
      annahmeRendite: annahme,
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

    const html = kasten(h, REGLER, beiRegler.wunsch);
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
    const html = kasten(h, REGLER, beiRegler.wunsch);
    expect(html).toContain(`statt ${fmtProzent(REGLER, 2)}`);
    expect(html).not.toContain('statt 7%');
    expect(html).toContain(fmtProzent(normal.wertschriften, 2));
  });
});
