/** BVG / Pensionskasse (reine Funktionen). */
import type { Regeln } from '../rules';

type BvgRegeln = Regeln['bvg'];

/** Koordinierter Lohn nach BVG (Obligatorium). 0 unter der Eintrittsschwelle. */
export function bvgKoordinierterLohn(jahreslohn: number, r: BvgRegeln): number {
  if (jahreslohn < r.eintrittsschwelle) return 0;
  const koord = Math.min(jahreslohn, r.obereGrenzeJahreslohn) - r.koordinationsabzug;
  return Math.min(Math.max(koord, r.koordinierterLohnMin), r.koordinierterLohnMax);
}

/** Altersgutschrift-Satz nach BVG-Alter (Kalenderjahr − Geburtsjahr). */
export function bvgAltersgutschriftSatz(bvgAlter: number, referenzalterJahre: number, r: BvgRegeln): number {
  if (bvgAlter > referenzalterJahre) return 0;
  let satz = 0;
  for (const s of r.altersgutschriften) if (bvgAlter >= s.abAlter) satz = s.satz;
  return satz;
}

/** Minimale jährliche Altersgutschrift (BVG-Obligatorium). */
export function bvgAltersgutschrift(
  jahreslohn: number,
  bvgAlter: number,
  referenzalterJahre: number,
  r: BvgRegeln,
): number {
  return bvgKoordinierterLohn(jahreslohn, r) * bvgAltersgutschriftSatz(bvgAlter, referenzalterJahre, r);
}

/**
 * Projektion des Altersguthabens: jährliche Verzinsung, Beiträge am Jahresende
 * (ohne Zins im Einzahlungsjahr, wie Art. 16 BVG-Gutschriften).
 * @param beitraege Beitrag je Projektionsjahr (Länge = Anzahl Jahre)
 */
export function pkProjektion(guthaben: number, beitraege: readonly number[], zins: number): number {
  let g = guthaben;
  for (const b of beitraege) g = g * (1 + zins) + b;
  return g;
}

export interface PkLeistung {
  kapital: number;
  renteJahr: number;
}

/** Aufteilung des Altersguthabens in Kapital (Anteil) und Rente (Umwandlungssatz). */
export function pkLeistung(guthaben: number, umwandlungssatz: number, kapitalanteil: number): PkLeistung {
  const k = Math.min(Math.max(kapitalanteil, 0), 1);
  return { kapital: guthaben * k, renteJahr: guthaben * (1 - k) * umwandlungssatz };
}

/** Prüft PK-Eingaben gegen die Regeln; gibt Hinweise zurück. */
export function pruefePk(fruehestesAlter: number, bezugsAlter: number | null, r: BvgRegeln): string[] {
  const h: string[] = [];
  if (fruehestesAlter < r.bezugsalter.reglementFruehestens)
    h.push(`PK-Bezug frühestens ab ${r.bezugsalter.reglementFruehestens} (Art. 1i BVV 2).`);
  if (bezugsAlter !== null && bezugsAlter > r.bezugsalter.aufschubBis)
    h.push(`PK-Aufschub höchstens bis ${r.bezugsalter.aufschubBis}.`);
  return h;
}
