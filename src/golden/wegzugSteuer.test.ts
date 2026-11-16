/**
 * Erklärtest zum Golden-Master-Haushalt «zh-wegzug-pt» (kein Rechenfehler, Analyse 16.11.2026):
 * Ab dem Wegzug 2032 steigen die Steuern um rund CHF 10'000 pro Jahr, das Vermögen bleibt gleich.
 * 1. Portugal besteuert die Renten (AHV und PK, Kategorie H) progressiv nach IRS Art. 68 (Grenzsatz 44,6 %
 *    ab 46'566 EUR), Abzug 4'587 EUR (Art. 53), Kapitalerträge 28 % (Art. 72). Zürich ist deutlich tiefer;
 *    die Schweizer Vermögenssteuer fällt weg (data/laender-2026.json, Block PT.steuern).
 * 2. Die Standardstrategie «gestaffelt» entnimmt einen Satz des freien Vermögens, unabhängig von den Steuern.
 *    Höhere Steuern senken deshalb die ausgegebene Lebenshaltung, nicht das Vermögen (core/entnahme.ts,
 *    `lebenshaltungFuerEntnahme`). Die Golden-Master-Kennzahlen zeigen nur das Vermögen.
 */
import { describe, expect, it } from 'vitest';
import { stufenSteuer } from '../core/quellensteuer';
import { simuliere } from '../core/simulation';
import { wegzugsLand } from '../data/laender';
import { ladeRegeln, VERFUEGBARE_JAHRE } from '../rules';
import { REFERENZHAUSHALTE } from './referenzhaushalte';

function rechne(jahr: number, wegzug: boolean) {
  const regeln = ladeRegeln(jahr);
  const ref = REFERENZHAUSHALTE.find((x) => x.id === 'zh-wegzug-pt');
  if (!ref) throw new Error('zh-wegzug-pt fehlt');
  const h = ref.haushalt(regeln);
  const p = h.personen[0];
  if (!p) throw new Error('Person fehlt');
  p.wohnsitzAusland.aktiv = wegzug;
  return simuliere(h, regeln, { start: { jahr, monat: 1 } });
}

const steuern = (z: { steuernEinkommen: number; steuernVermoegen: number; steuernKapital: number }) =>
  z.steuernEinkommen + z.steuernVermoegen + z.steuernKapital;

describe.each(VERFUEGBARE_JAHRE)('zh-wegzug-pt, Regeljahr %i: Steuersprung beim Wegzug', (jahr) => {
  const mit = rechne(jahr, true);
  const ohne = rechne(jahr, false);

  it('bis 2031 identisch, 2032 rund 10\u2019000 bis 11\u2019000 Franken mehr Steuern, danach leicht weniger', () => {
    for (const [i, z] of mit.zeilen.entries()) {
      const o = ohne.zeilen[i];
      if (!o) throw new Error('Zeile fehlt');
      const diff = steuern(z) - steuern(o);
      if (z.jahr < 2032) expect(Math.abs(diff)).toBeLessThan(1);
      else if (z.jahr === 2032) {
        expect(diff).toBeGreaterThan(10_000);
        expect(diff).toBeLessThan(11_500);
      } else expect(diff).toBeGreaterThan(7_000); // sinkt leicht mit der real sinkenden PK-Rente
    }
  });

  it('gleiches Vermögen, weil die gestaffelte Entnahme die Lebenshaltung um die Mehrsteuer senkt', () => {
    expect(Math.abs(mit.endVermoegen - ohne.endVermoegen)).toBeLessThan(1);
    for (const [i, z] of mit.zeilen.entries()) {
      const o = ohne.zeilen[i];
      if (!o || z.jahr < 2032) continue;
      expect(Math.abs(z.vermoegen - o.vermoegen)).toBeLessThan(1);
      expect(Math.abs(z.entnahmeFrei - o.entnahmeFrei)).toBeLessThan(1);
      // Mehrsteuer = weniger Lebenshaltung (übrige Ausgaben und Einnahmen gleich)
      expect(Math.abs(steuern(z) - steuern(o) - (o.lebenshaltung - z.lebenshaltung))).toBeLessThan(1);
    }
  });

  it('Steuer Portugal 2032 = IRS-Tarif auf Renten minus Abzug, plus 28 % auf Kapitalerträge', () => {
    const m = wegzugsLand('PT')?.steuern;
    const info = mit.personen[0]?.zielland;
    const z = mit.zeilen.find((x) => x.jahr === 2032);
    if (!m?.tarif || !m.kursProChf || m.abzugRente === undefined || !info || !z) throw new Error('Daten fehlen');
    const k = m.kursProChf;
    const renten = z.ahv + z.pkRente;
    const kapitalertrag = info.einkommen - renten;
    const irs = stufenSteuer(Math.max(0, renten * k - m.abzugRente), m.tarif as [number | null, number][]) / k;
    const soll = irs + 0.28 * kapitalertrag;
    expect(info.jahr).toBe(2032);
    expect(Math.abs(info.steuer - soll)).toBeLessThan(1);
    expect(Math.abs(z.steuernEinkommen - info.steuer)).toBeLessThan(1);
    expect(z.steuernVermoegen).toBe(0); // keine Vermögenssteuer in Portugal, keine Schweizer mehr
  });
});
