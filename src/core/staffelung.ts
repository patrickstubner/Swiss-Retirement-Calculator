/**
 * Staffelung der Kapitalbezüge (Schema 11): Vergleich «ein Bezug» gegen Bezug in 2 … n Jahren.
 *
 * Rechtsgrundlagen (Quellen: docs/quellen.md Abschnitt 18):
 * - Kapitalleistungen aus Vorsorge werden gesondert als volle Jahressteuer erfasst, beim Bund zu einem Fünftel des Tarifs
 *   (Art. 38 DBG); im gleichen Jahr fällige Leistungen werden zusammengerechnet (z.B. ZH ZStB 22.1 Rz 3, BE TaxInfo),
 *   bei Ehepaaren in den meisten Kantonen beider Personen (Ausnahme Staatssteuer BL, StB BL 36 Nr. 1 Ziff. 1.2).
 * - 3a und Freizügigkeit: Bezug frühestens 5 Jahre vor dem Referenzalter, mit Erwerbstätigkeit höchstens 5 Jahre danach
 *   (Art. 3 BVV 3; Art. 16 FZV). 3a-Konten werden ganz aufgelöst (StB SG 52 Nr. 3), Freizügigkeit höchstens auf zwei
 *   Einrichtungen (Art. 12 FZV).
 * - PK-Kapital: höchstens drei Schritte, ein Schritt = alle Kapitalbezüge eines Kalenderjahres (Art. 13a Abs. 2 BVG).
 *
 * Gerechnet wird mit der normalen Simulation; die Staffelung wirkt nur auf Personen ohne erfassten Wegzug.
 */
import { krisenOptionen } from '../data/krisen';
import type { Regeln } from '../rules';
import { simuliere } from './simulation';
import type { Haushalt, Monat, SimulationsErgebnis, Staffelung } from './typen';

export interface BezugsJahr {
  jahr: number;
  /** Kapitalbezüge des Jahres (heutige CHF, alle Personen) */
  kapital: number;
  /** Steuer auf diese Kapitalleistungen (heutige CHF) */
  steuer: number;
}

export interface StaffelVariante {
  /** Anzahl Bezugsjahre (1 = ohne Staffelung) */
  jahre: number;
  /** Summe der Steuern auf Kapitalleistungen im ganzen Zeitraum */
  kapitalSteuer: number;
  /** Ersparnis gegenüber dem Bezug in einem Schritt (positiv = weniger Steuer) */
  ersparnis: number;
  endVermoegen: number;
  reichtBis: number | null;
  bezuege: BezugsJahr[];
  sim: SimulationsErgebnis;
}

const summe = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

export function bezugsJahre(sim: SimulationsErgebnis): BezugsJahr[] {
  return sim.zeilen
    .filter((z) => z.kapitalBezuege > 0.5 || z.steuernKapital > 0.5)
    .map((z) => ({ jahr: z.jahr, kapital: z.kapitalBezuege, steuer: z.steuernKapital }));
}

/** Haushalt mit Staffelung in `jahre` Jahren (1 = aus). Übrige Einstellungen der Staffelung bleiben. */
export function mitStaffelung(h: Haushalt, jahre: number, st?: Partial<Staffelung>): Haushalt {
  const basis: Staffelung = { aktiv: false, jahre: 3, pk: false, fz: true, s3a: true, ...h.staffelung, ...st };
  return { ...h, staffelung: { ...basis, aktiv: jahre > 1, jahre } };
}

/** Rechnet den Plan mit Staffelung in n = 1 … `jahreListe` Jahren. Die erste Variante (1) ist die Vergleichsbasis. */
export function staffelVarianten(
  h: Haushalt,
  regeln: Regeln,
  heute: Monat,
  jahreListe: readonly number[] = [1, 2, 3, 4, 5],
  st?: Partial<Staffelung>,
): StaffelVariante[] {
  const rohe = jahreListe.map((n) => {
    const hh = mitStaffelung(h, n, st);
    const sim = simuliere(hh, regeln, { start: heute, krisen: krisenOptionen(hh) });
    return { jahre: n, sim };
  });
  const basis = rohe.find((r) => r.jahre === 1) ?? rohe[0];
  const basisSteuer = basis ? summe(basis.sim.zeilen.map((z) => z.steuernKapital)) : 0;
  return rohe.map(({ jahre, sim }) => {
    const kapitalSteuer = summe(sim.zeilen.map((z) => z.steuernKapital));
    return {
      jahre,
      kapitalSteuer,
      ersparnis: basisSteuer - kapitalSteuer,
      endVermoegen: sim.endVermoegen,
      reichtBis: sim.ruinAlter,
      bezuege: bezugsJahre(sim),
      sim,
    };
  });
}
