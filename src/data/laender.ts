/**
 * Wegzugsländer aus data/laender-2026.json (Recherche: docs/laender.md) mit EU/EFTA-Kennzeichen,
 * ergänzt um zwei generische Einträge. Massgebend für die freiwillige AHV ist, ob der Wohnsitz
 * in einem EU/EFTA-Staat liegt (Art. 2 Abs. 1 AHVG).
 */
import laenderJson from '../../data/laender-2026.json';

export interface WegzugsLand {
  code: string;
  name: string;
  /** Wohnsitz in einem EU- oder EFTA-Staat */
  euEfta: boolean;
  /** Schweizer Quellensteuer auf PK-Kapital: Rückforderbarkeit laut data/laender-2026.json (ESTV 2-217) */
  pkKapitalCh?: string;
}

export const LAND_ANDERES_EU = 'XE';
export const LAND_ANDERES = 'XX';

const ausDaten: WegzugsLand[] = laenderJson.laender.map((l) => ({
  code: l.code,
  name: l.name.replace(/\s*\(Referenz\)$/, ''),
  euEfta: l.eu === true,
  pkKapitalCh: l.pkKapital?.ch,
}));

/** Auswahlliste: zuerst EU/EFTA, dann übrige Länder (je in Datenreihenfolge). */
export const WEGZUGS_LAENDER: readonly WegzugsLand[] = [
  ...ausDaten.filter((l) => l.euEfta),
  { code: LAND_ANDERES_EU, name: 'Anderes Land in der EU/EFTA', euEfta: true },
  ...ausDaten.filter((l) => !l.euEfta),
  { code: LAND_ANDERES, name: 'Anderes Land ausserhalb EU/EFTA', euEfta: false },
];

export function wegzugsLand(code: string): WegzugsLand | undefined {
  return WEGZUGS_LAENDER.find((l) => l.code === code);
}
