import { describe, expect, it } from 'vitest';
import json2026 from './2026.json';
import { ladeRegeln, pruefeRegeln, regelEintraege } from './index';

describe('rules/2026.json', () => {
  it('ist strukturell gültig (value, source, stand, status)', () => {
    expect(pruefeRegeln(json2026)).toEqual([]);
  });

  it('enthält verifizierte Kernwerte aus quellen.md', () => {
    const r = ladeRegeln(2026);
    expect(r.ahv.minimalrenteMonat).toBe(1260);
    expect(r.ahv.maximalrenteMonat).toBe(2520);
    expect(r.ahv.plafondEhepaarFaktor * r.ahv.maximalrenteMonat).toBe(3780);
    expect(r.bvg.eintrittsschwelle).toBe(22680);
    expect(r.bvg.koordinationsabzug).toBe(26460);
    expect(r.bvg.mindestzins2026).toBe(0.0125);
    expect(r.saeule3a.maxMitPk).toBe(7258);
    expect(r.saeule3a.maxOhnePk).toBe(36288);
    expect(r.beitraege.alvHoechstlohn).toBe(148200);
    expect(r.beitraege.nichterwerbstaetige.tabelle.maximalbeitrag).toBe(26500);
    expect(r.ahv.vorbezugKuerzung).toHaveLength(24);
  });

  it('markiert offene Werte als offen', () => {
    const offen = regelEintraege(2026)
      .filter((e) => e.status === 'offen')
      .map((e) => e.pfad);
    expect(offen).toContain('ahv.rentenanpassung2027');
    expect(offen).toContain('bvg.mindestzins2027');
    expect(offen).toContain('beitraege.freiwilligeAhv.vorsorgeguthabenImVermoegen');
    expect(offen).not.toContain('beitraege.freiwilligeAhv.tabelleNichterwerbstaetige');
    expect(offen).not.toContain('steuern.quellensteuer.uebrigeKantone');
    expect(offen).toContain('saeule3a.barauszahlungAusreise');
  });

  it('spätere Jahre fallen auf die jüngste verfügbare Datei zurück', () => {
    expect(ladeRegeln(2030).meta.jahr).toBe(2026);
  });

  it('erkennt fehlerhafte Einträge', () => {
    expect(
      pruefeRegeln({ meta: { jahr: 2026 }, a: { b: { value: 1, source: '', stand: 'x', status: 'neu' } } }),
    ).toHaveLength(2);
  });
});
