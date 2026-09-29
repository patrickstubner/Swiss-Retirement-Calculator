import { describe, expect, it } from 'vitest';
import { effektiverHaushalt } from '../core/schaetzwerte';
import type { Person } from '../core/typen';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { uwsKurz, uwsSchaetzungText } from './texte';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 9 };

function schaetzung(lohn: number, guthaben: number) {
  const p: Person = neuePerson(regeln, { geburtsjahr: 1972, lohn, manuell: { pkGuthaben: true } });
  p.pk = { ...p.pk, guthaben };
  const e = effektiverHaushalt({ ...standardHaushalt(regeln), personen: [p] }, regeln, heute);
  const u = e.umwandlungssatz[0];
  if (!u) throw new Error('keine Schätzung');
  return { u, satz: e.werte[0]?.pkUmwandlungssatz ?? 0 };
}

describe('Text der Umwandlungssatz-Schätzung ohne obligatorischen Teil', () => {
  it('PK-Guthaben, Lohn 0 → «kein obligatorischer Teil geschätzt (kein Lohn angegeben)», kein «ca. 0%»', () => {
    const { u, satz } = schaetzung(0, 650000);
    expect(u.anteilObligatorium).toBe(0);
    expect(u.ohneObligatorium).toBe('keinLohn');
    const t = uwsSchaetzungText(u);
    expect(t).toContain('kein obligatorischer Teil geschätzt (kein Lohn angegeben)');
    expect(t).toContain('5.17% auf das ganze Guthaben');
    expect(t).not.toMatch(/ca\. 0%/);
    // Karte «Genauigkeit»
    const k = uwsKurz(satz, u);
    expect(k).toContain('5.17% auf das ganze Guthaben');
    expect(k).toContain('kein Lohn angegeben');
    expect(k).not.toMatch(/ca\. 0%/);
  });

  it('Lohn unter der Eintrittsschwelle → eigener Grund', () => {
    const { u } = schaetzung(15000, 100000);
    expect(u.ohneObligatorium).toBe('unterSchwelle');
    expect(uwsSchaetzungText(u)).toContain('Lohn unter der BVG-Eintrittsschwelle');
  });

  it('mit Lohn über der Schwelle → weiterhin die Aufteilung', () => {
    const { u, satz } = schaetzung(150000, 650000);
    expect(u.ohneObligatorium).toBeNull();
    expect(uwsSchaetzungText(u)).toMatch(/auf den obligatorischen Teil \(ca\. \d+%/);
    expect(uwsKurz(satz, u)).toContain('auf den Rest');
  });
});
