import type { SimulationsErgebnis } from '../core';

/**
 * Audit 5.4: «Reicht nicht» (erfolg = false) und trotzdem positives Endvermögen wirkt widersprüchlich.
 * Ursache: Das Ergebnis gilt als nicht erfüllt, sobald in einem einzelnen Jahr die verfügbaren Mittel nicht reichen
 * (Fehlbetrag), auch wenn später Geld zufliesst (z. B. Pensionskassen-, 3a- oder Freizügigkeitsbezug) und am Ende
 * rechnerisch wieder Vermögen vorhanden ist.
 */
export interface MisserfolgErklaerung {
  /** Jahre mit einem Fehlbetrag (aufsteigend) */
  fehlJahre: number[];
  /** Mindestens eines dieser Jahre fällt in eine Liquiditätslücke (gesperrte Vorsorgegelder noch vorhanden) */
  mitLiquiditaetsluecke: boolean;
}

export function misserfolgErklaerung(e: SimulationsErgebnis): MisserfolgErklaerung | null {
  if (e.erfolg || !(e.endVermoegen > 0.5)) return null;
  const fehlJahre = e.zeilen.filter((z) => z.fehlbetrag > 0.5).map((z) => z.jahr);
  if (fehlJahre.length === 0 && e.ruinJahr !== null) fehlJahre.push(e.ruinJahr);
  return { fehlJahre, mitLiquiditaetsluecke: e.liquiditaetsluecken.length > 0 };
}
