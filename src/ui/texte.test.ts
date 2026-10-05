import { describe, expect, it } from 'vitest';
import { effektiverHaushalt } from '../core/schaetzwerte';
import type { Person } from '../core/typen';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { fmtChf } from './format';
import { disclaimerAbsaetze, saeule3aMaxHinweis, uwsKurz, uwsSchaetzungText } from './texte';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 9 };

function schaetzung(lohn: number, guthaben: number) {
  const p: Person = neuePerson(regeln, { geburtsjahr: 1974, lohn, manuell: { pkGuthaben: true } });
  p.pk = { ...p.pk, guthaben };
  const e = effektiverHaushalt({ ...standardHaushalt(regeln), personen: [p] }, regeln, heute);
  const u = e.umwandlungssatz[0];
  if (!u) throw new Error('keine Schätzung');
  return { u, satz: e.werte[0]?.pkUmwandlungssatz ?? 0 };
}

describe('Disclaimer nennt das Regeljahr der geladenen Regeln', () => {
  it('setzt das übergebene Jahr ein und enthält kein festes 2026', () => {
    const text = disclaimerAbsaetze(2027).join('\n');
    expect(text).toContain('Stand 2027');
    expect(text).not.toContain('Stand 2026');
    expect(text).toContain('Ihnen');
    expect(disclaimerAbsaetze(2026).join('\n')).toContain('Stand 2026');
  });
});

describe('Säule 3a: Maximum 2027 nur im Hinweis', () => {
  const r26 = ladeRegeln(2026);
  const r27 = ladeRegeln(2027);

  it('nennt bei Regeln 2026 das kommende Maximum und lässt die Rechnung bei 2026', () => {
    expect(r27.saeule3a.maxMitPk).toBe(7373);
    expect(r27.saeule3a.maxOhnePk).toBe(36864);
    const t = saeule3aMaxHinweis(r26, r27);
    expect(t).toContain(
      `Maximum 2026: mit PK ${fmtChf(r26.saeule3a.maxMitPk)}, ohne PK ${fmtChf(r26.saeule3a.maxOhnePk)}.`,
    );
    expect(t).toContain(`Ab 2027 beträgt das gesetzliche Maximum mit PK ${fmtChf(7373)} und ohne PK ${fmtChf(36864)}.`);
    expect(t).toContain('Für Ihre Rechnung gelten weiterhin die Beträge 2026.');
    expect(t).not.toMatch(/ß/);
  });

  it('ab Regeljahr 2027 ist das Maximum das geladene, ohne Hinweis auf ein späteres Jahr', () => {
    const t = saeule3aMaxHinweis(r27, r27);
    expect(t).toBe(`Maximum 2027: mit PK ${fmtChf(7373)}, ohne PK ${fmtChf(36864)}.`);
    expect(t).not.toContain('weiterhin');
    expect(saeule3aMaxHinweis(r26, null)).not.toContain('Ab 2027');
  });
});

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
