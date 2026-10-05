import { describe, expect, it } from 'vitest';
import { neueAusgaben, neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { entnahmeVorlage, standardStufen, standardToepfe, tiefereStufe } from './entnahme';
import { nominalErgebnis } from './nominal';
import { simuliere } from './simulation';
import type { Entnahme, Haushalt, Person } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

/** Bereits im Ruhestand, ohne AHV und ohne Steuern, damit die Entnahme sichtbar bleibt. */
function ruhestand(
  o: {
    wertschriften?: number;
    ausgaben?: number;
    entnahme?: Entnahme;
    rendite?: number;
    inflation?: number;
    planung?: number;
    geburtsjahr?: number;
  } = {},
): Haushalt {
  const h = standardHaushalt(regeln);
  const p: Person = neuePerson(regeln, {
    geburtsjahr: o.geburtsjahr ?? 1950,
    geburtsmonat: 1,
    lohn: 0,
    stoppAlter: 0,
    wertschriften: o.wertschriften ?? 1_000_000,
  });
  p.ahv.renteMonat = 0;
  return {
    ...h,
    personen: [p],
    planungsalter: o.planung ?? 85,
    ausgaben: { ...neueAusgaben(), lebenshaltung: o.ausgaben ?? 0, faktorAb75: 1, faktorAb85: 1 },
    annahmen: {
      ...h.annahmen,
      renditeNominal: o.rendite ?? 0,
      renditeBargeld: o.rendite ?? 0,
      inflation: o.inflation ?? 0,
      kosten: 0,
      steuerbarerErtrag: 0,
      aktienanteil: 1,
    },
    steuern: { ...h.steuern, eigeneSaetze: true, einkommenSatz: 0, vermoegenPromille: 0, kapitalSatz: 0 },
    entnahme: o.entnahme ?? h.entnahme,
  };
}

describe('Simulation der Entnahmestrategien', () => {
  it('gestaffelt: ohne Vorjahr 3,5 %, nach 10 % Wachstum 5 %, auch unter −4 % bleibt 3,5 %', () => {
    const zehn = simuliere(ruhestand({ rendite: 0.1, entnahme: entnahmeVorlage('gestaffelt') }), regeln, { start });
    expect(zehn.zeilen[0]?.entnahmeSatz).toBeCloseTo(0.035);
    expect(zehn.zeilen[0]?.entnahmeWachstum).toBeNull();
    expect(zehn.zeilen[0]?.entnahmeFrei).toBeCloseTo(1_100_000 * 0.035, 0);
    expect(zehn.zeilen[1]?.entnahmeWachstum).toBeCloseTo(0.1, 6);
    expect(zehn.zeilen[1]?.entnahmeSatz).toBeCloseTo(0.05);

    const grenze = simuliere(ruhestand({ rendite: -0.04, entnahme: entnahmeVorlage('gestaffelt') }), regeln, { start });
    expect(grenze.zeilen[1]?.entnahmeWachstum).toBeCloseTo(-0.04, 6);
    expect(grenze.zeilen[1]?.entnahmeSatz).toBeCloseTo(0.035);

    const darunter = simuliere(ruhestand({ rendite: -0.05, entnahme: entnahmeVorlage('gestaffelt') }), regeln, {
      start,
    });
    expect(darunter.zeilen[1]?.entnahmeSatz).toBeCloseTo(0.035);

    const mitStufe = simuliere(
      ruhestand({
        rendite: -0.05,
        entnahme: { art: 'gestaffelt', stufen: tiefereStufe(standardStufen()) },
      }),
      regeln,
      { start },
    );
    expect(mitStufe.zeilen[1]?.entnahmeSatz).toBeCloseTo(0.03);
    const genau = simuliere(
      ruhestand({
        rendite: -0.04,
        entnahme: { art: 'gestaffelt', stufen: tiefereStufe(standardStufen()) },
      }),
      regeln,
      { start },
    );
    expect(genau.zeilen[1]?.entnahmeSatz).toBeCloseTo(0.035);
  });

  it('fester Prozentsatz und Anfangssatz; Inflation lässt den realen Anfangssatz gleich', () => {
    const dyn = simuliere(ruhestand({ rendite: 0, entnahme: { art: 'dynamisch', satz: 0.04 } }), regeln, { start });
    expect(dyn.zeilen[0]?.entnahmeFrei).toBeCloseTo(40_000, 0);
    expect(dyn.zeilen[1]?.entnahmeFrei).toBeCloseTo(960_000 * 0.04, 0);

    const stat = simuliere(
      ruhestand({
        rendite: 0.02,
        inflation: 0.02,
        entnahme: { art: 'statisch', quelle: 'satz', satz: 0.04 },
      }),
      regeln,
      { start },
    );
    expect(stat.zeilen[0]?.entnahmeFrei).toBeCloseTo(40_000, 0);
    expect(stat.zeilen[1]?.entnahmeFrei).toBeCloseTo(stat.zeilen[0]?.entnahmeFrei ?? 0, 0);
    const nominal = nominalErgebnis(stat);
    expect(nominal.zeilen[1]?.entnahmeFrei).toBeGreaterThan(nominal.zeilen[0]?.entnahmeFrei ?? 0);
  });

  it('Ausgaben bleiben die Lücke, wenn die Strategie statisch auf Ausgaben steht', () => {
    const e = simuliere(
      ruhestand({ ausgaben: 50_000, entnahme: { art: 'statisch', quelle: 'ausgaben', satz: 0.04 } }),
      regeln,
      { start },
    );
    expect(e.zeilen[0]?.entnahmeFrei).toBeCloseTo(50_000, 0);
    expect(e.zeilen[0]?.vermoegen).toBeCloseTo(950_000, 0);
  });

  it('Annuität endet am Planungshorizont bei etwa null', () => {
    const e = simuliere(
      ruhestand({
        geburtsjahr: 1946,
        planung: 90,
        wertschriften: 400_000,
        rendite: 0.03,
        entnahme: {
          art: 'annuitaet',
          renditeModus: 'gewichtet',
          aktienReal: 0.03,
          obligationenReal: 0.01,
          satz: 0.03,
        },
      }),
      regeln,
      { start },
    );
    expect(e.zeilen[0]?.entnahmeFrei).toBeGreaterThan(0);
    expect(Math.abs(e.endVermoegen)).toBeLessThan(1);
  });

  it('Mehr-Töpfe: Puffer am Jahresende 1 Jahr, nach 4 Jahren 2 Jahre; Drawdown verkauft keine Aktien zur Auffüllung', () => {
    const strategie = entnahmeVorlage('toepfe');
    if (strategie.art !== 'toepfe') throw new Error('Vorlage');
    const ruhig = simuliere(
      ruhestand({
        ausgaben: 36_000,
        wertschriften: 500_000,
        entnahme: { ...strategie, toepfe: standardToepfe(3).map((t) => ({ ...t, renditeReal: 0 })) },
      }),
      regeln,
      { start },
    );
    const z0 = ruhig.zeilen[0];
    const z4 = ruhig.zeilen[4];
    expect(z0?.entnahmeToepfe?.find((t) => t.label === 'Cash / Geldmarkt')?.wert).toBeCloseTo(36_000, 0);
    expect(z4?.entnahmeToepfe?.find((t) => t.label === 'Cash / Geldmarkt')?.wert).toBeCloseTo(72_000, 0);
    expect(z0?.toepfe.bargeld).toBeCloseTo(36_000, 0);

    const stress = simuliere(
      ruhestand({
        ausgaben: 36_000,
        wertschriften: 500_000,
        entnahme: {
          ...strategie,
          anzahl: 2,
          toepfe: standardToepfe(2).map((t) => ({
            ...t,
            renditeReal: t.rolle === 'aktien' ? -0.2 : 0,
          })),
        },
      }),
      regeln,
      { start },
    );
    const s0 = stress.zeilen[0];
    expect(s0?.toepfe.bargeld).toBeCloseTo(0, 0);
    expect(s0?.toepfe.wertschriften).toBeCloseTo(464_000 * 0.8, 0);
  });

  it('leeres Depot: die Entnahme fällt auf 0', () => {
    const e = simuliere(
      ruhestand({ wertschriften: 100, rendite: 0, entnahme: { art: 'dynamisch', satz: 0.2 }, planung: 100 }),
      regeln,
      { start },
    );
    const letzte = e.zeilen.at(-1);
    expect(letzte?.entnahmeFrei ?? 1).toBeLessThan(1);
    expect(letzte?.vermoegen ?? 1).toBeLessThan(1);
  });
});
