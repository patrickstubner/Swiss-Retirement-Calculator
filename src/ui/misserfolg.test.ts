import { describe, expect, it } from 'vitest';
import type { SimulationsErgebnis } from '../core';
import { simuliere } from '../core';
import { neueAusgaben, neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { misserfolgErklaerung } from './misserfolg';

const regeln = ladeRegeln(2026);

function ergebnis(teil: Partial<SimulationsErgebnis>, fehl: number[] = []): SimulationsErgebnis {
  return {
    erfolg: false,
    ruinJahr: fehl[0] ?? null,
    endVermoegen: 1000,
    liquiditaetsluecken: [],
    zeilen: [2030, 2031, 2032, 2033].map((jahr) => ({ jahr, fehlbetrag: fehl.includes(jahr) ? 5000 : 0 })),
    ...teil,
  } as unknown as SimulationsErgebnis;
}

describe('misserfolgErklaerung (Audit 5.4)', () => {
  it('keine Erklärung bei Erfolg oder ohne positives Endvermögen', () => {
    expect(misserfolgErklaerung(ergebnis({ erfolg: true }))).toBeNull();
    expect(misserfolgErklaerung(ergebnis({ endVermoegen: 0 }, [2031]))).toBeNull();
    expect(misserfolgErklaerung(ergebnis({ endVermoegen: -500 }, [2031]))).toBeNull();
  });
  it('nennt die Fehlbetrags-Jahre und die Liquiditätslücke', () => {
    expect(misserfolgErklaerung(ergebnis({ liquiditaetsluecken: [2031] }, [2031, 2032]))).toEqual({
      fehlJahre: [2031, 2032],
      mitLiquiditaetsluecke: true,
    });
    expect(misserfolgErklaerung(ergebnis({}, [2033]))).toEqual({ fehlJahre: [2033], mitLiquiditaetsluecke: false });
  });
  it('Ruinjahr als Rückfall, wenn keine Zeile einen Fehlbetrag trägt', () => {
    expect(misserfolgErklaerung(ergebnis({ ruinJahr: 2040 }))).toEqual({
      fehlJahre: [2040],
      mitLiquiditaetsluecke: false,
    });
  });

  it('echter Fall (Audit: kein Einkommen, PK später): erfolg = false, Endvermögen positiv → Erklärung', () => {
    const h = standardHaushalt(regeln);
    const p = neuePerson(regeln, { geburtsjahr: 1966, geburtsmonat: 1, lohn: 0, stoppAlter: 58, wertschriften: 20000 });
    p.pk = { ...p.pk, guthaben: 900000, umwandlungssatz: 0.05, fruehestesAlter: 63, kapitalanteil: 1 };
    h.personen = [p];
    h.ausgaben = { ...neueAusgaben(), lebenshaltung: 30000 };
    h.planungsalter = 95;
    const e = simuliere(h, regeln, { start: { jahr: 2026, monat: 1 } });
    // Voraussetzung des Testfalls: Lücke vor dem PK-Bezug, später wieder Vermögen
    expect(e.erfolg).toBe(false);
    expect(e.endVermoegen).toBeGreaterThan(0);
    const x = misserfolgErklaerung(e);
    expect(x).not.toBeNull();
    expect(x?.fehlJahre.length).toBeGreaterThan(0);
    expect(x?.mitLiquiditaetsluecke).toBe(true);
  });
});
