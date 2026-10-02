/**
 * WCAG 2.2 SC 2.5.8 (Zielgrösse ≥ 24×24 px, Audit BAR-02): Die Prüfung im Browser lief mit Playwright (360 px, alle
 * Schritte, beide Modi). Dieser Test sichert die CSS-Regeln, die das Ergebnis herbeiführen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, 'styles.css'), 'utf8');
const block = (selektor: string): string => {
  const i = css.indexOf(`${selektor} {`);
  expect(i, selektor).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf('}', i));
};

describe('Zielgrösse ≥ 24 px', () => {
  it('unsichtbare Radio-Eingaben der Segmente füllen das ganze Segment', () => {
    const b = block('.segment input');
    expect(b).toMatch(/position:\s*absolute/);
    expect(b).toMatch(/inset:\s*0/);
    expect(b).toMatch(/width:\s*100%/);
    expect(b).toMatch(/height:\s*100%/);
    expect(block('.segment')).toMatch(/position:\s*relative/);
  });
  it('Quellenlinks haben vertikale Polsterung (≥ 24 px hohe Fläche bei 17 px Zeilenhöhe)', () => {
    expect(block('.quellen a,\n.inhalt a')).toMatch(/padding-block:\s*4px/);
  });
  it('Schalter und Speicher-Checkbox sind mindestens 24 px gross', () => {
    for (const s of ['.schalter input', '.speicherleiste__schalter input']) {
      const px = Number(/width:\s*(\d+)px/.exec(block(s))?.[1]);
      expect(px, s).toBeGreaterThanOrEqual(24);
    }
  });
  it('Standard-Mindesthöhe der Knöpfe und Felder ist 48 px', () => {
    expect(css).toMatch(/--touch:\s*48px/);
  });
});
