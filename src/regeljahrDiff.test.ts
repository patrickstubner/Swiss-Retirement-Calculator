import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { alsMarkdown, regeljahrDiff } from '../scripts/regeljahr-diff-lib.mjs';

const knoten = (value: unknown, status = 'verifiziert', source = 'https://x', stand = '1.1.2026') => ({
  value,
  source,
  stand,
  status,
});

describe('Regeljahr-Diff', () => {
  const alt = { meta: { jahr: 2026 }, a: { x: knoten(1), y: knoten(2), weg: knoten(3) } };
  const neu = {
    meta: { jahr: 2027 },
    a: { x: knoten(1), y: knoten(5, 'offen', 'https://y'), dazu: knoten('n', 'offen') },
  };

  it('erkennt geänderte, neue, entfernte und offene Werte; meta zählt nicht', () => {
    const d = regeljahrDiff(alt, neu);
    expect(d.neuHinzu).toEqual(['a.dazu']);
    expect(d.entfernt).toEqual(['a.weg']);
    expect(d.unveraendert).toBe(1);
    expect(d.geaendert).toEqual([
      {
        schluessel: 'a.y',
        felder: ['value', 'status', 'source'],
        alt: 2,
        neu: 5,
        statusAlt: 'verifiziert',
        statusNeu: 'offen',
      },
    ]);
    expect(d.offenNeu).toEqual(['a.dazu', 'a.y']);
  });

  it('Markdown nennt Zahlen und maskiert Pipe-Zeichen', () => {
    const md = alsMarkdown(regeljahrDiff({ a: knoten('p|q') }, { a: knoten('r') }), '2026', '2027');
    expect(md).toContain('Geändert: 1, neu: 0, entfernt: 0');
    expect(md).toContain('"p\\|q"');
  });

  it('CLI vergleicht die echten Regeljahre 2026 → 2027', () => {
    const script = resolve(__dirname, '../scripts/regeljahr-diff.mjs');
    const out = execFileSync(process.execPath, [script, '2026', '2027', '--json'], { encoding: 'utf8' });
    const d = JSON.parse(out);
    expect(d.entfernt).toEqual([]);
    expect(d.neuHinzu).toEqual([]);
    expect(d.geaendert.map((g: { schluessel: string }) => g.schluessel)).toContain('bvg.mindestzins');
  });

  it('CLI lehnt ungültige Jahre ab', () => {
    const script = resolve(__dirname, '../scripts/regeljahr-diff.mjs');
    expect(() => execFileSync(process.execPath, [script, '../x', '2027'], { stdio: 'pipe' })).toThrow();
  });
});
