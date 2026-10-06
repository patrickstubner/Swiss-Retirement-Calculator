import { describe, expect, it } from 'vitest';
import { effektiverHaushalt } from '../core/schaetzwerte';
import type { Haushalt } from '../core/typen';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { kriseNach } from '../data/krisen';
import { ladeRegeln } from '../rules';
import {
  auswertungRechnung,
  bearbeiteRechnung,
  ganzeSeitenrechnung,
  type RechnungRueckmeldung,
  seitenGenauigkeit,
  seitenSuche,
  szenarienRechnung,
  szenarioEingaben,
} from './rechnungKern';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 1 };

/** Erfundenes Beispiel, klein genug für den Gleichheitstest. */
function leicht(): Haushalt {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: '',
    geburtsjahr: 1980,
    geburtsmonat: 6,
    lohn: 90_000,
    stoppAlter: 64,
    wertschriften: 400_000,
  });
  return { ...h, personen: [p], ausgaben: { ...h.ausgaben, lebenshaltung: 60_000 }, planungsalter: 90 };
}

/**
 * 120 überlappende Krisen, Monatsbeginn, junger Jahrgang: die Suche prüft viele Alter.
 * Das ist die Neuberechnung, die die Ergebnis-Seite auslöst.
 */
function schwer(monat: number): Haushalt {
  const lang = kriseNach('japan1990');
  if (!lang) throw new Error('japan1990');
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: '',
    geburtsjahr: 2000,
    geburtsmonat: 1,
    lohn: 0,
    stoppAlter: 64,
    wertschriften: 0,
  });
  return {
    ...h,
    personen: [p],
    ausgaben: { ...h.ausgaben, lebenshaltung: 150_000 },
    planungsalter: 95,
    krisen: {
      ...h.krisen,
      modus: 'individuell',
      ausgleich: true,
      auswahl: Array.from({ length: 120 }, (_, i) => ({
        uid: `k${i}`,
        id: lang.id,
        land: 'CHE' as const,
        startArt: 'jahr' as const,
        jahr: 2010 + i,
        alter: 70,
        person: 0,
        jahreNach: 0,
        monat,
        eigen: null,
      })),
    },
  };
}

describe('Seitenrechnung: gleiche Zahlen im Worker-Code und direkt', () => {
  it('Suche, Sensitivität, Auswertung und Szenarien bleiben bitweise gleich', () => {
    const eff = effektiverHaushalt(leicht(), regeln, heute);
    const h = eff.haushalt;
    const suche = seitenSuche(h, regeln, heute, 'gemeinsam');
    const sens = seitenGenauigkeit(h, eff.schaetzungen, regeln, heute, 'gemeinsam');
    const aus = auswertungRechnung(h, regeln, heute, 'gemeinsam');
    const eingaben = szenarioEingaben(h, heute.jahr);
    const szen = szenarienRechnung(eingaben, regeln, heute, 'gemeinsam');
    const meldungen: RechnungRueckmeldung[] = [];
    const basis = { id: 3, jahr: heute.jahr, monat: heute.monat, suchModus: 'gemeinsam' as const };
    bearbeiteRechnung({ ...basis, art: 'suche', haushalt: h }, (m) => meldungen.push(m));
    bearbeiteRechnung({ ...basis, art: 'genauigkeit', haushalt: h, schaetzungen: eff.schaetzungen }, (m) =>
      meldungen.push(m),
    );
    bearbeiteRechnung({ ...basis, art: 'auswertung', haushalt: h }, (m) => meldungen.push(m));
    bearbeiteRechnung({ ...basis, art: 'szenarien', eingaben }, (m) => meldungen.push(m));
    const ohneDauer = (m: RechnungRueckmeldung): RechnungRueckmeldung =>
      m.art === 'suche' ? { ...m, berechnung: { ...m.berechnung, dauerMs: 0 } } : m;
    expect(ohneDauer(meldungen[0] as RechnungRueckmeldung)).toEqual({
      art: 'suche',
      id: 3,
      berechnung: { ...suche, dauerMs: 0 },
    });
    expect(meldungen[1]).toEqual({ art: 'genauigkeit', id: 3, ergebnis: sens });
    expect(meldungen[2]).toEqual({ art: 'auswertung', id: 3, kennzahlen: aus });
    expect(meldungen[3]).toEqual({ art: 'szenarien', id: 3, zeilen: szen });
    expect(suche.wunsch?.endVermoegen).toBe(aus.wunsch.endVermoegen);
  });

  it('übersteht die Strukturkopie des Workers', () => {
    const eff = effektiverHaushalt(leicht(), regeln, heute);
    const n = {
      art: 'suche' as const,
      id: 1,
      jahr: 2026,
      monat: 1,
      haushalt: eff.haushalt,
      suchModus: 'gemeinsam' as const,
    };
    const a: RechnungRueckmeldung[] = [];
    const b: RechnungRueckmeldung[] = [];
    bearbeiteRechnung(n, (m) => a.push(m));
    bearbeiteRechnung(structuredClone(n), (m) => b.push(structuredClone(m)));
    const nullZeit = (m: RechnungRueckmeldung | undefined) =>
      m?.art === 'suche' ? { ...m, berechnung: { ...m.berechnung, dauerMs: 0 } } : m;
    expect(nullZeit(b[0])).toEqual(nullZeit(a[0]));
  });
});

describe('Ganze Neuberechnung der Seite', () => {
  it('Wunsch, Suche, Sensitivität, Was-wäre-wenn und Szenarien bleiben unter der Grenze', () => {
    // Lokal deutlich unter einer Sekunde. Die Grenze lässt dem CI-Rechner Spielraum,
    // fängt aber einen Rückfall in mehrsekündige Neuberechnungen.
    const grenzeMs = 8_000;
    for (const monat of [1, 7]) {
      const eff = effektiverHaushalt(schwer(monat), regeln, heute);
      const h = eff.haushalt;
      ganzeSeitenrechnung(h, eff.schaetzungen, regeln, heute, 'gemeinsam');
      const a = ganzeSeitenrechnung(h, eff.schaetzungen, regeln, heute, 'gemeinsam');
      const b = ganzeSeitenrechnung(h, eff.schaetzungen, regeln, heute, 'gemeinsam');
      expect(a.suche.solver?.simulationen ?? 0).toBeGreaterThan(30);
      expect(a.szenarien.length).toBeGreaterThanOrEqual(2);
      expect(a.dauerMs).toBeLessThan(grenzeMs);
      expect(b.dauerMs).toBeLessThan(grenzeMs);
      expect(b.suche.wunsch?.endVermoegen).toBe(a.suche.wunsch?.endVermoegen);
      expect(b.suche.solver?.alterMonate).toBe(a.suche.solver?.alterMonate);
      expect(b.suche.solver?.simulationen).toBe(a.suche.solver?.simulationen);
      expect(b.auswertung.wunsch.endVermoegen).toBe(a.auswertung.wunsch.endVermoegen);
      expect(b.auswertung.solver.alterMonate).toBe(a.auswertung.solver.alterMonate);
      expect(b.sens.zeilen.map((z) => [z.id, z.deltaAlterMonate, z.deltaVermoegen])).toEqual(
        a.sens.zeilen.map((z) => [z.id, z.deltaAlterMonate, z.deltaVermoegen]),
      );
      expect(b.szenarien.map((s) => [s.name, s.k?.wunsch.endVermoegen, s.k?.solver.alterMonate])).toEqual(
        a.szenarien.map((s) => [s.name, s.k?.wunsch.endVermoegen, s.k?.solver.alterMonate]),
      );
    }
  }, 60_000);
});
