/**
 * Golden-Master pro Regelstand (ADR-003): Referenzhaushalte × Regeljahr → Kennzahlen.
 * Ein Daten- oder Code-Update, das Ergebnisse verändert, lässt diesen Test fehlschlagen. Bewusste Änderungen:
 * `pnpm run golden:update` schreibt src/golden/erwartet/<jahr>.json neu; der Diff im PR ist die fachliche Prüfung.
 * Deterministisch: Start 1.1. des Regeljahres, keine Krisen, kein Monte Carlo.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { simuliere } from '../core/simulation';
import { ladeRegeln, VERFUEGBARE_JAHRE } from '../rules';
import { REFERENZHAUSHALTE } from './referenzhaushalte';

type Kennzahlen = Record<string, number | boolean | null>;

const r = (x: number | undefined | null): number | null => (x === undefined || x === null ? null : Math.round(x));

function kennzahlen(jahr: number, id: string): Kennzahlen {
  const regeln = ladeRegeln(jahr);
  const ref = REFERENZHAUSHALTE.find((x) => x.id === id);
  if (!ref) throw new Error(id);
  const e = simuliere(ref.haushalt(regeln), regeln, { start: { jahr, monat: 1 } });
  const z = e.zeilen;
  const alter0 = (a: number) => z.find((zeile) => zeile.alter[0] === a);
  const erstesAhvJahr = z.find((zeile) => zeile.ahv > 0);
  const volleAhv = erstesAhvJahr ? z.find((zeile) => zeile.jahr === erstesAhvJahr.jahr + 1) : undefined;
  return {
    erfolg: e.erfolg,
    ruinAlter: e.ruinAlter,
    endVermoegen: r(e.endVermoegen),
    ersteAhvJahr: erstesAhvJahr?.jahr ?? null,
    ahvVollesJahr: r(volleAhv?.ahv),
    pkRenteVollesJahr: r(volleAhv?.pkRente),
    steuernVollesJahr: r(volleAhv ? volleAhv.steuernEinkommen + volleAhv.steuernVermoegen : null),
    steuernKapitalTotal: r(z.reduce((s, zeile) => s + zeile.steuernKapital, 0)),
    sozialabgabenErstesJahr: r(z[0]?.sozialabgaben),
    vermoegenMit75: r(alter0(75)?.vermoegen),
    vermoegenMit85: r(alter0(85)?.vermoegen),
  };
}

const UPDATE = process.env.GOLDEN_UPDATE === '1';
const datei = (jahr: number) => new URL(`./erwartet/${jahr}.json`, import.meta.url);

describe.each(VERFUEGBARE_JAHRE)('Golden-Master Regeljahr %i', (jahr) => {
  const ist: Record<string, Kennzahlen> = {};
  for (const ref of REFERENZHAUSHALTE) ist[ref.id] = kennzahlen(jahr, ref.id);

  if (UPDATE) {
    it('schreibt die Erwartungen neu (GOLDEN_UPDATE=1)', () => {
      writeFileSync(datei(jahr), `${JSON.stringify({ regeljahr: jahr, haushalte: ist }, null, 2)}\n`);
    });
    return;
  }

  const erwartet = JSON.parse(readFileSync(datei(jahr), 'utf8')) as {
    regeljahr: number;
    haushalte: Record<string, Kennzahlen>;
  };

  it('deckt genau die Referenzhaushalte ab', () => {
    expect(erwartet.regeljahr).toBe(jahr);
    expect(Object.keys(erwartet.haushalte).sort()).toEqual(REFERENZHAUSHALTE.map((x) => x.id).sort());
  });

  for (const ref of REFERENZHAUSHALTE) {
    it(`${ref.id}: ${ref.beschreibung}`, () => {
      const soll = erwartet.haushalte[ref.id] ?? {};
      for (const [k, v] of Object.entries(ist[ref.id] ?? {})) {
        const s = soll[k];
        if (typeof v === 'number' && typeof s === 'number')
          expect(Math.abs(v - s), `${ref.id}.${k}: ist ${v}, soll ${s}`).toBeLessThanOrEqual(1);
        else expect(v, `${ref.id}.${k}`).toEqual(s);
      }
    });
  }
});
