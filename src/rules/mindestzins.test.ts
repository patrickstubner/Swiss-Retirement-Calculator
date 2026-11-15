/**
 * BVG-Mindestzins ohne Jahreszahl im Schlüssel (RR-2):
 * - `bvg.mindestzins` ist der Satz des Regeljahres (Default für die PK-Verzinsung),
 * - `bvg.mindestzinsVorjahr` verzinst die Schätzung des heutigen PK-Guthabens (bis Vorjahr).
 * Quelle 2027: Bundesratsentscheid 04.11.2026, https://www.bsv.admin.ch/de/newnsb/8DF8zxcfvu7l
 */
import { describe, expect, it } from 'vitest';
import { neuePerson } from '../data/defaults';
import { ladeRegeln, regelEintraege, VERFUEGBARE_JAHRE } from './index';

describe('BVG-Mindestzins pro Regeljahr', () => {
  it('Default-PK-Zins folgt dem Regeljahr: 2026 = 1,25 %, 2027 = 2 %', () => {
    expect(neuePerson(ladeRegeln(2026)).pk.zins).toBe(0.0125);
    expect(neuePerson(ladeRegeln(2027)).pk.zins).toBe(0.02);
  });

  it('Vorjahressatz entspricht dem Satz der Vorjahresdatei', () => {
    for (const jahr of VERFUEGBARE_JAHRE) {
      const vorjahr = VERFUEGBARE_JAHRE.find((j) => j === jahr - 1);
      if (vorjahr === undefined) continue;
      expect(ladeRegeln(jahr).bvg.mindestzinsVorjahr, String(jahr)).toBe(ladeRegeln(vorjahr).bvg.mindestzins);
    }
  });

  it('keine Mindestzins-Schlüssel mit Jahreszahl mehr; Werte verifiziert mit URL', () => {
    for (const jahr of VERFUEGBARE_JAHRE) {
      const eintraege = regelEintraege(jahr).filter((e) => e.pfad.startsWith('bvg.mindestzins'));
      expect(eintraege.map((e) => e.pfad).sort(), String(jahr)).toEqual(['bvg.mindestzins', 'bvg.mindestzinsVorjahr']);
      for (const e of eintraege) {
        expect(e.status, `${jahr} ${e.pfad}`).toBe('verifiziert');
        expect(e.source, `${jahr} ${e.pfad}`).toMatch(/^https:\/\//);
      }
    }
  });
});
