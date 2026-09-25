/**
 * Wegzugsländer aus data/laender-2026.json (Recherche: docs/laender.md) mit EU/EFTA-Kennzeichen,
 * ergänzt um zwei generische Einträge. Massgebend für die freiwillige AHV ist, ob der Wohnsitz
 * in einem EU/EFTA-Staat liegt (Art. 2 Abs. 1 AHVG).
 */
import laenderJson from '../../data/laender-2026.json';
import type { ZiellandSteuerModell } from '../core/zielland';

export interface WegzugsLand {
  code: string;
  name: string;
  /** Wohnsitz in einem EU- oder EFTA-Staat */
  euEfta: boolean;
  /** Schweizer Quellensteuer auf PK-Kapital: Rückforderbarkeit laut data/laender-2026.json (ESTV 2-217) */
  pkKapitalCh?: string;
  /**
   * BVG-Altersguthaben bei Wohnsitz dort immer gesperrt, unabhängig von einer Versicherungspflicht
   * (Liechtenstein: Art. 25f Abs. 1 lit. c FZG)
   */
  obligatoriumImmerGesperrt?: boolean;
  /** Vereinfachtes Steuermodell des Wohnsitzstaats (core/zielland.ts); fehlt = OFFEN */
  steuern?: ZiellandSteuerModell;
}

export const LAND_ANDERES_EU = 'XE';
export const LAND_ANDERES = 'XX';

interface LandJson {
  code: string;
  name: string;
  eu: boolean;
  pkKapital?: { ch?: string };
  art25fImmerGesperrt?: boolean;
  steuern?: unknown;
}

const ausDaten: WegzugsLand[] = (laenderJson.laender as LandJson[]).map((l) => ({
  code: l.code,
  name: l.name.replace(/\s*\(Referenz\)$/, ''),
  euEfta: l.eu === true,
  pkKapitalCh: l.pkKapital?.ch,
  obligatoriumImmerGesperrt: l.art25fImmerGesperrt === true,
  steuern: l.steuern ? ({ ...(l.steuern as object), code: l.code } as ZiellandSteuerModell) : undefined,
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
