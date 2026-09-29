import { describe, expect, it } from 'vitest';
import { staffelVarianten } from '../core/staffelung';
import type { Haushalt } from '../core/typen';
import { neueAusgaben, neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { besteVariante, MIN_ERSPARNIS, steuerTipps } from './steuerTipps';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 9 };

function haushalt(o: { verheiratet?: boolean; kanton?: string; wegzug?: boolean; klein?: boolean } = {}): Haushalt {
  const h = standardHaushalt(regeln);
  const a = neuePerson(regeln, { name: 'Person A', geburtsjahr: 1966, stoppAlter: 62, geschlecht: 'm' });
  a.ahv.renteMonat = 2200;
  a.pk = { ...a.pk, guthaben: o.klein ? 20_000 : 500_000, kapitalanteil: o.klein ? 0 : 0 };
  a.freizuegigkeit = { ...a.freizuegigkeit, guthaben: o.klein ? 10_000 : 200_000 };
  a.saeule3a = { ...a.saeule3a, guthaben: o.klein ? 10_000 : 300_000 };
  if (o.wegzug)
    a.wohnsitzAusland = {
      ...a.wohnsitzAusland,
      aktiv: true,
      modus: 'alter',
      alter: 61,
      land: 'BR',
      barauszahlung: true,
    };
  const personen = [a];
  if (o.verheiratet) {
    const b = neuePerson(regeln, { name: 'Person B', geburtsjahr: 1967, stoppAlter: 62, geschlecht: 'w' });
    b.saeule3a = { ...b.saeule3a, guthaben: 200_000 };
    personen.push(b);
  }
  return {
    ...h,
    zivilstand: o.verheiratet ? 'verheiratet' : 'alleinstehend',
    personen,
    planungsalter: 90,
    ausgaben: { ...neueAusgaben(), lebenshaltung: 50_000, faktorAb75: 1, faktorAb85: 1 },
    steuern: { ...h.steuern, kanton: o.kanton ?? 'ZH', gemeinde: '' },
    krisen: { ...h.krisen, modus: 'keine' },
  };
}
const tipps = (h: Haushalt) =>
  steuerTipps(
    h,
    regeln,
    heute,
    staffelVarianten(h, regeln, heute),
    h.personen.map((p) => p.name),
  );

describe('Steuer-Tipps', () => {
  it('Staffel-Tipp mit Ersparnis und Hinweis auf mehrere 3a-Konten, wenn realistisch', () => {
    const t = tipps(haushalt()).find((x) => x.art === 'staffeln');
    expect(t).toBeDefined();
    expect(t?.ersparnis).toBeGreaterThanOrEqual(MIN_ERSPARNIS);
    expect(t?.text).toMatch(/mehrere 3a-Konten/);
    expect(t?.text).toMatch(/höchstens zwei Einrichtungen/);
  });

  it('warnt, wenn das Endvermögen trotz Steuerersparnis sinkt (3a-Rendite tiefer als Wertschriften)', () => {
    const h = haushalt();
    h.annahmen = { ...h.annahmen, renditeNominal: 0.06 };
    h.personen[0]!.saeule3a.rendite = 0;
    h.personen[0]!.wertschriften = 800_000;
    const t = tipps(h).find((x) => x.art === 'staffeln');
    expect(t?.endDifferenz).toBeLessThan(0);
    expect(t?.text).toMatch(/sinkt das Endvermögen trotzdem/);
  });

  it('kein Staffel-Tipp bei kleinen Beträgen (Ersparnis unter der Schwelle)', () => {
    expect(tipps(haushalt({ klein: true })).some((x) => x.art === 'staffeln')).toBe(false);
  });

  it('mit erfasstem Wegzug: Hinweis «nicht staffeln», kein Staffel-Tipp', () => {
    const t = tipps(haushalt({ wegzug: true }));
    expect(t.some((x) => x.art === 'staffeln')).toBe(false);
    const w = t.find((x) => x.art === 'wegzug');
    expect(w?.text).toMatch(/Quellensteuer/);
    expect(w?.text).toMatch(/nichts/);
  });

  it('ohne Vorsorgekapital gibt es keine Tipps', () => {
    const h = haushalt();
    const p = h.personen[0]!;
    p.pk.guthaben = 0;
    p.freizuegigkeit.guthaben = 0;
    p.saeule3a.guthaben = 0;
    expect(tipps(h)).toEqual([]);
  });

  it('Ehepaar: Tipp zur Verschiebung der Bezüge gegeneinander, nicht in BL (Staatssteuer getrennt)', () => {
    const h = haushalt({ verheiratet: true });
    // beide beziehen im selben Jahr
    h.personen[0]!.saeule3a.bezugsAlter = 61;
    h.personen[1]!.saeule3a.bezugsAlter = 60;
    expect(tipps(h).some((x) => x.art === 'ehegatten')).toBe(true);
    const bl = haushalt({ verheiratet: true, kanton: 'BL' });
    bl.personen[0]!.saeule3a.bezugsAlter = 61;
    bl.personen[1]!.saeule3a.bezugsAlter = 60;
    expect(tipps(bl).some((x) => x.art === 'ehegatten')).toBe(false);
  });

  it('Einkauf: Hinweis auf die Sperrfrist nur, wenn der Kapitalbezug in den nächsten drei Jahren liegt', () => {
    const nah = haushalt();
    nah.personen[0]!.freizuegigkeit.bezugsAlter = 60;
    expect(tipps(nah).some((x) => x.art === 'einkauf')).toBe(true);
    const fern = haushalt();
    fern.personen[0]!.geburtsjahr = 1985;
    fern.personen[0]!.stoppAlter = 65;
    expect(tipps(fern).some((x) => x.art === 'einkauf')).toBe(false);
  });

  it('EU/EFTA: das gesperrte Obligatorium wird nie als Kapital vorgeschlagen (kein PK-Staffel-Tipp ohne Kapitalanteil)', () => {
    const h = haushalt();
    const t = tipps(h);
    expect(t.some((x) => /Obligatorium/.test(x.text) && /Kapital/.test(x.titel))).toBe(false);
  });

  it('beste Variante: kleinste Jahreszahl mit mindestens 90 % der grössten Ersparnis', () => {
    const v = staffelVarianten(haushalt(), regeln, heute);
    const b = besteVariante(v);
    const maxE = Math.max(...v.map((x) => x.ersparnis));
    expect(b?.ersparnis).toBeGreaterThanOrEqual(0.9 * maxE);
    expect(v.filter((x) => x.jahre < (b?.jahre ?? 0)).every((x) => x.ersparnis < 0.9 * maxE)).toBe(true);
  });

  it('eingeschaltete Staffelung: Tipp meldet die aktive Staffelung statt eines neuen Vorschlags', () => {
    const h = haushalt();
    h.staffelung = { aktiv: true, jahre: 3, pk: false, fz: true, s3a: true };
    const t = tipps(h);
    expect(t.some((x) => x.art === 'aktiv')).toBe(true);
    expect(t.some((x) => x.art === 'staffeln')).toBe(false);
  });
});
