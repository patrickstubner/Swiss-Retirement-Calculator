/**
 * K-11: Fehlendes Regeljahr darf nicht stumm bleiben.
 * - Die Logik von `regelJahrStatus` wird immer geprüft.
 * - Der «Jahreswechsel-Wächter» (Regeldatei für das laufende Jahr vorhanden?) läuft nur mit REGELJAHR_STRENG=1,
 *   also im eigenen Workflow `regeljahr.yml` (wöchentlich und bei Pull Requests, kein Pflicht-Check). So schlägt am
 *   1. Januar nicht jeder Build fehl, aber der Wächter meldet sich sichtbar.
 */
import { describe, expect, it } from 'vitest';
import { ladeRegeln, regelJahrStatus, VERFUEGBARE_JAHRE } from './index';

describe('regelJahrStatus', () => {
  it('Regeljahr vorhanden: kein Hinweis', () => {
    expect(regelJahrStatus(2026, [2026])).toEqual({ angefragt: 2026, verwendet: 2026, fehlt: false });
  });
  it('Jahr ohne Regeldatei: Rückfall auf das jüngste frühere Jahr, fehlt = true', () => {
    expect(regelJahrStatus(2027, [2026])).toEqual({ angefragt: 2027, verwendet: 2026, fehlt: true });
    expect(regelJahrStatus(2028, [2026, 2027])).toEqual({ angefragt: 2028, verwendet: 2027, fehlt: true });
  });
  it('Jahr vor der ersten Datei: verwendet das erste Jahr, fehlt = true', () => {
    expect(regelJahrStatus(2020, [2026])).toEqual({ angefragt: 2020, verwendet: 2026, fehlt: true });
  });
  it('stimmt mit ladeRegeln überein', () => {
    for (const j of [2025, 2026, 2027, 2030]) {
      const s = regelJahrStatus(j);
      expect(ladeRegeln(j)).toBe(ladeRegeln(s.verwendet));
    }
  });
});

describe.runIf(process.env.REGELJAHR_STRENG === '1')('Jahreswechsel-Wächter', () => {
  it('für das laufende Kalenderjahr gibt es eine Regeldatei', () => {
    const jahr = new Date().getFullYear();
    expect(
      VERFUEGBARE_JAHRE,
      `Keine Regeldatei für ${jahr}: src/rules/${jahr}.json anlegen (Quellen prüfen) und in REGELDATEIEN eintragen`,
    ).toContain(jahr);
  });
});
