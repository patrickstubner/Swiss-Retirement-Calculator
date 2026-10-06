import { describe, expect, it } from 'vitest';
import { neueGeplanteKrise, neueKrisenEinstellungen } from '../data/defaults';
import { automatischeKrisenAlsAuswahl } from '../data/krisen';
import { krisenNachModuswechsel } from './krisenModus';

const fenster = { von: 2026, bis: 2090 };

describe('Wechsel auf Individuell', () => {
  it('leere Liste übernimmt die automatischen Krisen und schaltet den Ausgleich ein', () => {
    const k = neueKrisenEinstellungen();
    const uebernahme = automatischeKrisenAlsAuswahl(k, 2035, fenster);
    expect(uebernahme.length).toBeGreaterThan(0);
    const w = krisenNachModuswechsel(k, 'individuell', uebernahme);
    expect(w.hinweis).toBeNull();
    expect(w.krisen.modus).toBe('individuell');
    expect(w.krisen.ausgleich).toBe(true);
    expect(w.krisen.auswahl.map((a) => [a.id, a.jahr])).toEqual(uebernahme.map((a) => [a.id, a.jahr]));
  });

  it('gefüllte Liste bleibt, der Ausgleich bleibt, wie er steht', () => {
    const eintrag = neueGeplanteKrise('covid2020', 'CHE', 2040);
    const k = { ...neueKrisenEinstellungen(), auswahl: [eintrag], ausgleich: false };
    const uebernahme = automatischeKrisenAlsAuswahl(k, 2035, fenster);
    const w = krisenNachModuswechsel(k, 'individuell', uebernahme);
    expect(w.krisen.modus).toBe('individuell');
    expect(w.krisen.auswahl).toEqual([eintrag]);
    expect(w.krisen.ausgleich).toBe(false);
    expect(w.hinweis).toBeNull();
  });

  it('ohne automatische Krise im Horizont bleibt die Liste leer', () => {
    const w = krisenNachModuswechsel(neueKrisenEinstellungen(), 'individuell', []);
    expect(w.krisen.modus).toBe('individuell');
    expect(w.krisen.auswahl).toEqual([]);
    expect(w.krisen.ausgleich).toBe(false);
    expect(w.hinweis).toMatch(/keine automatische Krise/);
  });

  it('Wechsel auf einen anderen Modus lässt die Liste stehen', () => {
    const eintrag = neueGeplanteKrise('covid2020', 'CHE', 2040);
    const k = { ...neueKrisenEinstellungen(), modus: 'individuell' as const, auswahl: [eintrag], ausgleich: true };
    const w = krisenNachModuswechsel(k, 'keine', []);
    expect(w.krisen.modus).toBe('keine');
    expect(w.krisen.auswahl).toEqual([eintrag]);
    expect(w.krisen.ausgleich).toBe(true);
  });
});
