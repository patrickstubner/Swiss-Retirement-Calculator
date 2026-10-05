import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  annuitaetEntnahme,
  ausPufferEntnehmen,
  dynamischeEntnahme,
  ENTNAHME_NAME,
  entnahmeKurztext,
  entnahmeVorlage,
  gewichteteRealrendite,
  jahreswachstum,
  lebenshaltungFuerEntnahme,
  normalisiereEntnahme,
  pufferAuffuellen,
  pufferJahre,
  satzFuerWachstum,
  standardStufen,
  standardToepfe,
  statischeEntnahme,
  tiefereStufe,
  tiefereStufeEntfernen,
  toepfeAufteilen,
  toepfeVerzinsen,
} from './entnahme';

const stufen = standardStufen();

describe('Dynamisch gestaffelt: Stufen inklusive Grenzen', () => {
  it('jede Stufe und jede Grenze', () => {
    expect(satzFuerWachstum(stufen, 0.14)).toBeCloseTo(0.06);
    expect(satzFuerWachstum(stufen, 0.2)).toBeCloseTo(0.06);
    expect(satzFuerWachstum(stufen, 0.14 - 1e-12)).toBeCloseTo(0.05);
    expect(satzFuerWachstum(stufen, 0.07)).toBeCloseTo(0.05);
    expect(satzFuerWachstum(stufen, 0.07 - 1e-12)).toBeCloseTo(0.04);
    expect(satzFuerWachstum(stufen, 0.02)).toBeCloseTo(0.04);
    expect(satzFuerWachstum(stufen, 0.02 - 1e-12)).toBeCloseTo(0.035);
    expect(satzFuerWachstum(stufen, 0)).toBeCloseTo(0.035);
    expect(satzFuerWachstum(stufen, -0.04)).toBeCloseTo(0.035);
    expect(satzFuerWachstum(stufen, -0.04 - 1e-12)).toBeCloseTo(0.035);
    expect(satzFuerWachstum(stufen, -0.5)).toBeCloseTo(0.035);
    expect(Math.min(...stufen.map((s) => s.satz))).toBeCloseTo(0.035);
    expect(stufen.some((s) => Math.abs(s.satz - 0.03) < 1e-12)).toBe(false);
  });

  it('optionale Stufe: unter −4 % dann 3 %, genau −4 % bleibt 3,5 %', () => {
    const extra = tiefereStufe(stufen);
    expect(satzFuerWachstum(extra, -0.04)).toBeCloseTo(0.035);
    expect(satzFuerWachstum(extra, -0.04 - 1e-12)).toBeCloseTo(0.03);
    expect(satzFuerWachstum(extra, 0)).toBeCloseTo(0.035);
    expect(satzFuerWachstum(extra, 0.02)).toBeCloseTo(0.04);
    expect(satzFuerWachstum(tiefereStufeEntfernen(extra), -0.5)).toBeCloseTo(0.035);
    expect(tiefereStufeEntfernen(stufen)).toEqual(stufen);
  });

  it('editierte Schwellen und Sätze ersetzen die Standardstufen', () => {
    const eigene = [
      { id: 'oben', abWachstum: 0.1, satz: 0.09 },
      { id: 'unten', abWachstum: -1, satz: 0.01 },
    ];
    expect(satzFuerWachstum(eigene, 0.1)).toBeCloseTo(0.09);
    expect(satzFuerWachstum(eigene, 0.1 - 1e-9)).toBeCloseTo(0.01);
  });
});

describe('Statisch, fester Prozentsatz, Annuität', () => {
  it('statische Entnahme bleibt real gleich', () => {
    const w = statischeEntnahme(0.04, 800_000);
    expect(w).toBeCloseTo(32_000);
    expect(statischeEntnahme(0.04, 800_000)).toBe(w);
    expect(statischeEntnahme(-0.1, 800_000)).toBe(0);
  });

  it('dynamischer Satz vom aktuellen Bestand, auch bei 0', () => {
    expect(dynamischeEntnahme(0.04, 500_000)).toBeCloseTo(20_000);
    expect(dynamischeEntnahme(0.04, 0)).toBe(0);
    expect(dynamischeEntnahme(0.04, -10)).toBe(0);
  });

  it('Annuität zehrt das Kapital bei der angenommenen Realrendite auf', () => {
    let kapital = 250_000;
    const r = 0.03;
    const n0 = 25;
    for (let i = 0; i < n0; i++) {
      const nachRendite = kapital * (1 + r);
      const w = annuitaetEntnahme(nachRendite, n0 - i, r);
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(nachRendite + 1e-6);
      kapital = nachRendite - w;
    }
    expect(kapital).toBeCloseTo(0, 4);
  });

  it('Annuität: letztes Jahr, leeres Depot, Rendite 0 und negative Rendite', () => {
    expect(annuitaetEntnahme(80_000, 1, 0.03)).toBeCloseTo(80_000);
    expect(annuitaetEntnahme(0, 10, 0.03)).toBe(0);
    expect(annuitaetEntnahme(100_000, 4, 0)).toBeCloseTo(25_000);
    let kapital = 100_000;
    const r = -0.02;
    const n0 = 8;
    for (let i = 0; i < n0; i++) {
      const nachRendite = kapital * (1 + r);
      kapital = nachRendite - annuitaetEntnahme(nachRendite, n0 - i, r);
    }
    expect(kapital).toBeCloseTo(0, 3);
  });

  it('gewichtete Realrendite folgt dem Aktienanteil', () => {
    expect(gewichteteRealrendite(1, 0.05, 0.01)).toBeCloseTo(0.05);
    expect(gewichteteRealrendite(0, 0.05, 0.01)).toBeCloseTo(0.01);
    expect(gewichteteRealrendite(0.5, 0.05, 0.01)).toBeCloseTo(0.03);
  });

  it('Lebenshaltung folgt der Zielentnahme und fällt nicht unter 0', () => {
    const mehr = lebenshaltungFuerEntnahme(-40_000, 50_000, 60_000);
    expect(mehr.lebenshaltung).toBeCloseTo(70_000);
    expect(mehr.saldo).toBeCloseTo(-60_000);
    const weniger = lebenshaltungFuerEntnahme(-40_000, 50_000, 30_000);
    expect(weniger.lebenshaltung).toBeCloseTo(40_000);
    expect(weniger.saldo).toBeCloseTo(-30_000);
    const pflicht = lebenshaltungFuerEntnahme(-80_000, 10_000, 5_000);
    expect(pflicht.lebenshaltung).toBe(0);
    expect(pflicht.saldo).toBeCloseTo(-70_000);
  });

  it('Teiljahr wird auf ein Jahreswachstum hochgerechnet', () => {
    expect(jahreswachstum(0.1, 12)).toBeCloseTo(0.1);
    expect(jahreswachstum(0.1, 6)).toBeCloseTo(1.1 ** 2 - 1);
  });
});

describe('Mehr-Töpfe: Puffer 1 Jahr auf 2 Jahre in 4 Jahren', () => {
  it('linear von 1 auf 2, danach konstant', () => {
    expect(pufferJahre(0, 1, 2, 4)).toBeCloseTo(1);
    expect(pufferJahre(2, 1, 2, 4)).toBeCloseTo(1.5);
    expect(pufferJahre(4, 1, 2, 4)).toBeCloseTo(2);
    expect(pufferJahre(8, 1, 2, 4)).toBeCloseTo(2);
  });

  it('Cash deckt den Puffer, der Rest folgt den Anteilen; Obligationen liegen in der Mitte', () => {
    const drei = toepfeAufteilen(400_000, 40_000, 1, standardToepfe(3));
    const cash = drei.find((t) => t.rolle === 'cash');
    const aktien = drei.find((t) => t.rolle === 'aktien');
    const mittel = drei.find((t) => t.rolle === 'mittel');
    expect(cash?.label).toBe('Cash / Geldmarkt');
    expect(cash?.wert).toBeCloseTo(40_000);
    expect(cash?.renditeReal).toBeCloseTo(0.005);
    expect(mittel?.label).toBe('ETF und Obligationen');
    expect(aktien?.wert).toBeCloseTo(360_000 * 0.7);
    expect(mittel?.wert).toBeCloseTo(360_000 * 0.3);
    const zwei = toepfeAufteilen(400_000, 40_000, 2, standardToepfe(2));
    expect(zwei.find((t) => t.rolle === 'mittel')).toBeUndefined();
    expect(zwei.find((t) => t.rolle === 'cash')?.wert).toBeCloseTo(80_000);
  });

  it('Auffüllen meidet einen Topf im Drawdown; die Ausgabe verkauft ihn, wenn der Puffer fehlt', () => {
    const start = toepfeAufteilen(200_000, 20_000, 1, standardToepfe(3));
    const rendite = start.map((t) => (t.rolle === 'aktien' ? -0.2 : 0));
    const aufgefuellt = pufferAuffuellen(start, 50_000, -0.1, rendite);
    const aktien = aufgefuellt.find((t) => t.rolle === 'aktien');
    const mittel = aufgefuellt.find((t) => t.rolle === 'mittel');
    const cash = aufgefuellt.find((t) => t.rolle === 'cash');
    expect(aktien?.wert).toBeCloseTo(start.find((t) => t.rolle === 'aktien')?.wert ?? 0);
    expect(mittel?.wert).toBeLessThan(start.find((t) => t.rolle === 'mittel')?.wert ?? 0);
    expect(cash?.wert).toBeGreaterThan(20_000);
    const leer = start.map((t) => (t.rolle === 'cash' || t.rolle === 'mittel' ? { ...t, wert: 0 } : t));
    const entnommen = ausPufferEntnehmen(leer, 5_000);
    expect(entnommen.entnommen).toBeCloseTo(5_000);
    expect(entnommen.staende.find((t) => t.rolle === 'aktien')?.wert).toBeLessThan(
      leer.find((t) => t.rolle === 'aktien')?.wert ?? 0,
    );
  });

  it('Verzinsung des Cash-Topfes bleibt nahe 0', () => {
    const t = toepfeVerzinsen([{ rolle: 'cash', label: 'Cash / Geldmarkt', wert: 10_000, renditeReal: 0.005 }], 12);
    expect(t.staende[0]?.wert).toBeCloseTo(10_050);
    expect(t.rendite[0]).toBeCloseTo(0.005);
  });
});

describe('Texte', () => {
  it('Namen und Kurztexte ohne ß und ohne Personendaten', () => {
    const texte = [
      ...Object.values(ENTNAHME_NAME),
      ...(['gestaffelt', 'statisch', 'dynamisch', 'annuitaet', 'toepfe'] as const).map((art) =>
        entnahmeKurztext(entnahmeVorlage(art)),
      ),
      ...standardToepfe(2).map((t) => t.label),
      ...standardToepfe(3).map((t) => t.label),
    ].join('\n');
    expect(texte).not.toMatch(/ß/);
  });

  it('Quelltexte der Entnahme ohne ß', () => {
    for (const datei of [
      'src/core/entnahme.ts',
      'src/ui/components/EntnahmeStrategie.tsx',
      'src/ui/components/EntnahmeErgebnis.tsx',
    ]) {
      expect(readFileSync(datei, 'utf8'), datei).not.toMatch(/ß/);
    }
  });

  it('unbekannte Strategie wird zum gestaffelten Standard', () => {
    expect(normalisiereEntnahme(undefined).art).toBe('gestaffelt');
    expect(normalisiereEntnahme({ art: 'irgendwas' }).art).toBe('gestaffelt');
  });
});
