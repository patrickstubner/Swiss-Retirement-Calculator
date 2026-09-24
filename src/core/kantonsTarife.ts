/**
 * Tarifbasierte Kantonsmodelle (Kantons- und Gemeindesteuern) aus data/kantone-<jahr>.json.
 *
 * - ZH und AG: exakt (Tarife 2026, Kapitalleistungsregel, Kantons-, Gemeinde- und
 *   Kirchensteuerfüsse); an Testfällen mit dem ESTV-Steuerrechner 2026 frankengenau validiert.
 * - Übrige Kantone: Näherung über effektive Referenzsätze des Kantonshauptorts
 *   (ESTV-Steuerrechner 2026), linear interpoliert, ohne Kirchensteuer und kantonale Abzüge.
 *
 * Alle Funktionen sind rein; die Daten werden als Parameter übergeben.
 */
import type { KantonsSteuerModell } from './kantone';
import type { Konfession, Zivilstand } from './typen';

/** [Bandbreite in CHF | null = Rest, Satz in % (Einkommen) bzw. ‰ (Vermögen)] */
export type Band = [number | null, number];

export interface ZhDaten {
  staatssteuerfuss: { wert: number };
  einkommenstarif: { grundtarif: Band[]; verheiratetentarif: Band[] };
  vermoegenstarif: { grundtarif: Band[]; verheiratetentarif: Band[] };
  kapitalleistung: { parameter: { divisor: number; minSatzEinfach: number } };
  personalsteuer: { wert: number };
  gemeindesteuerfuesse: {
    gemeinden: {
      name: string;
      bfs: number;
      steuerfussOhneKirche: number;
      mitReformiert: number | null;
      mitKatholisch: number | null;
      mitChristkatholisch: number | null;
    }[];
  };
}

export interface AgDaten {
  kantonssteuerfuss: { wert: number };
  einkommenstarif: { tarifA: Band[] };
  vermoegenstarif: { tarif: Band[]; freibetraege: { verheiratet: number; uebrige: number } };
  kapitalleistung: { parameter: { anteil: number; minSatzEinfach: number } };
  gemeindesteuerfuesse: {
    gemeinden: {
      name: string;
      steuerfuss: number;
      reformiert: number | null;
      katholisch: number | null;
      christkatholisch: number | null;
    }[];
  };
}

export interface RasterPunkt {
  steuerbaresEinkommen: number;
  steuerbaresVermoegen: number;
  einkommenKantonGemeinde: number;
  vermoegenKantonGemeinde: number;
  personalsteuer: number;
}

export interface KantonEintrag {
  code: string;
  name: string;
  status: string;
  hauptort: { name: string };
  referenzEstv2026: {
    kapitalleistungSatzPct: { ledig: Record<string, number>; verheiratet: Record<string, number> };
    raster: { ledig: RasterPunkt[]; verheiratet: RasterPunkt[] };
  };
  kapitalleistung: { status: string; methode: string };
}

export interface KantonsDaten {
  meta: { stand: string; steuerjahr: number };
  zh: ZhDaten;
  ag: AgDaten;
  kantone: KantonEintrag[];
}

/** Steuer nach Bandtarif (Bandbreiten nacheinander); Satz in Einheiten von `einheit` (100 = %, 1000 = ‰). */
export function bandTarif(betrag: number, baender: readonly Band[], einheit = 100): number {
  let rest = Math.max(0, betrag);
  let steuer = 0;
  for (const [breite, satz] of baender) {
    if (rest <= 0) break;
    const teil = breite === null ? rest : Math.min(rest, breite);
    steuer += (teil * satz) / einheit;
    rest -= teil;
  }
  return steuer;
}

const gerundet = (einfach: number, fuesse: readonly number[]): number =>
  fuesse.reduce((s, f) => s + Math.round((einfach * f) / 100), 0);

// ---------------------------------------------------------------- Zürich

export function zhEinfacheEinkommenssteuer(steuerbar: number, zivilstand: Zivilstand, d: ZhDaten): number {
  const t = zivilstand === 'verheiratet' ? d.einkommenstarif.verheiratetentarif : d.einkommenstarif.grundtarif;
  return Math.round(bandTarif(steuerbar, t));
}

export function zhEinfacheVermoegenssteuer(vermoegen: number, zivilstand: Zivilstand, d: ZhDaten): number {
  const t = zivilstand === 'verheiratet' ? d.vermoegenstarif.verheiratetentarif : d.vermoegenstarif.grundtarif;
  return Math.round(bandTarif(vermoegen, t, 1000));
}

/** § 37 StG ZH: Satz für 1/20 der Leistung, mindestens 2%, auf die ganze Leistung. */
export function zhEinfacheKapitalsteuer(betrag: number, zivilstand: Zivilstand, d: ZhDaten): number {
  if (betrag <= 0) return 0;
  const { divisor, minSatzEinfach } = d.kapitalleistung.parameter;
  const t = zivilstand === 'verheiratet' ? d.einkommenstarif.verheiratetentarif : d.einkommenstarif.grundtarif;
  const teil = betrag / divisor;
  const satz = Math.max(bandTarif(teil, t) / teil, minSatzEinfach);
  return Math.round(betrag * satz);
}

export function zhModell(d: ZhDaten, gemeindeName: string, kirche: Konfession): KantonsSteuerModell {
  const g =
    d.gemeindesteuerfuesse.gemeinden.find((x) => x.name === gemeindeName) ??
    d.gemeindesteuerfuesse.gemeinden.find((x) => x.name === 'Zürich');
  if (!g) throw new Error('ZH-Gemeindedaten fehlen');
  const mitKirche =
    kirche === 'reformiert'
      ? g.mitReformiert
      : kirche === 'katholisch'
        ? g.mitKatholisch
        : kirche === 'christkatholisch'
          ? g.mitChristkatholisch
          : null;
  const gemeinde = g.steuerfussOhneKirche;
  const kircheFuss = mitKirche !== null ? mitKirche - gemeinde : 0;
  const fuesse = [d.staatssteuerfuss.wert, gemeinde, ...(kircheFuss > 0 ? [kircheFuss] : [])];
  return {
    id: `ZH-${g.name}`,
    beschreibung: `Zürich, ${g.name}: Tarif 2026 exakt (Staat ${d.staatssteuerfuss.wert}%, Gemeinde ${gemeinde}%${kircheFuss > 0 ? `, Kirche ${kircheFuss}%` : ''})`,
    einkommenssteuer: (s, z) =>
      gerundet(zhEinfacheEinkommenssteuer(s, z, d), fuesse) + d.personalsteuer.wert * (z === 'verheiratet' ? 2 : 1),
    vermoegenssteuer: (v, z) => gerundet(zhEinfacheVermoegenssteuer(v, z, d), fuesse),
    kapitalleistungssteuer: (k, z) => gerundet(zhEinfacheKapitalsteuer(k, z, d), fuesse),
  };
}

// ---------------------------------------------------------------- Aargau

/** § 43 StG AG: Tarif A; Tarif B (Verheiratete) = Satz des halben Einkommens. Abgerundet auf Franken. */
export function agEinfacheEinkommenssteuer(steuerbar: number, zivilstand: Zivilstand, d: AgDaten): number {
  const s = Math.max(0, steuerbar);
  if (s === 0) return 0;
  const t = d.einkommenstarif.tarifA;
  if (zivilstand !== 'verheiratet') return Math.floor(bandTarif(s, t));
  const halb = s / 2;
  return Math.floor((s * bandTarif(halb, t)) / halb);
}

/** § 55 StG AG auf dem Vermögen nach Freibeträgen (§ 54, ohne Kinderfreibetrag). */
export function agEinfacheVermoegenssteuer(vermoegen: number, zivilstand: Zivilstand, d: AgDaten): number {
  const frei =
    zivilstand === 'verheiratet' ? d.vermoegenstarif.freibetraege.verheiratet : d.vermoegenstarif.freibetraege.uebrige;
  return Math.floor(bandTarif(Math.max(0, vermoegen - frei), d.vermoegenstarif.tarif, 1000));
}

/** § 45 StG AG: 30% des Tarifs (A bzw. B) auf die ganze Leistung, mindestens 1%. */
export function agEinfacheKapitalsteuer(betrag: number, zivilstand: Zivilstand, d: AgDaten): number {
  if (betrag <= 0) return 0;
  const { anteil, minSatzEinfach } = d.kapitalleistung.parameter;
  const t = d.einkommenstarif.tarifA;
  const voll = zivilstand === 'verheiratet' ? (betrag * bandTarif(betrag / 2, t)) / (betrag / 2) : bandTarif(betrag, t);
  // Rundung auf ganze Franken (kaufmännisch) wie im ESTV-Rechner (14'772.60 → 14'773)
  return Math.round(Math.max(anteil * voll, minSatzEinfach * betrag));
}

export function agModell(d: AgDaten, gemeindeName: string, kirche: Konfession): KantonsSteuerModell {
  const g =
    d.gemeindesteuerfuesse.gemeinden.find((x) => x.name === gemeindeName) ??
    d.gemeindesteuerfuesse.gemeinden.find((x) => x.name === 'Aarau');
  if (!g) throw new Error('AG-Gemeindedaten fehlen');
  const kircheFuss = kirche === 'keine' ? 0 : (g[kirche] ?? 0);
  const fuesse = [d.kantonssteuerfuss.wert, g.steuerfuss, ...(kircheFuss > 0 ? [kircheFuss] : [])];
  return {
    id: `AG-${g.name}`,
    beschreibung: `Aargau, ${g.name}: Tarif 2026 exakt (Kanton ${d.kantonssteuerfuss.wert}%, Gemeinde ${g.steuerfuss}%${kircheFuss > 0 ? `, Kirche ${kircheFuss}%` : ''})`,
    einkommenssteuer: (s, z) => gerundet(agEinfacheEinkommenssteuer(s, z, d), fuesse),
    vermoegenssteuer: (v, z) => gerundet(agEinfacheVermoegenssteuer(v, z, d), fuesse),
    kapitalleistungssteuer: (k, z) => gerundet(agEinfacheKapitalsteuer(k, z, d), fuesse),
  };
}

// ---------------------------------------------------------------- Näherung (übrige Kantone)

/** Lineare Interpolation der Steuer zwischen Stützpunkten (inkl. Ursprung), darüber konstanter Satz. */
export function interpoliereSteuer(betrag: number, punkte: readonly [number, number][]): number {
  const x = Math.max(0, betrag);
  const p: [number, number][] = [[0, 0], ...[...punkte].sort((a, b) => a[0] - b[0])];
  for (let i = 1; i < p.length; i++) {
    const [x1, y1] = p[i] as [number, number];
    const [x0, y0] = p[i - 1] as [number, number];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  const [xn, yn] = p[p.length - 1] as [number, number];
  return xn > 0 ? (x * yn) / xn : 0;
}

/** Interpolierter effektiver Satz (in %) zwischen Stützpunkten, ausserhalb konstant. */
export function interpoliereSatz(betrag: number, saetze: Record<string, number>): number {
  const p = Object.entries(saetze)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const erster = p[0];
  const letzter = p[p.length - 1];
  if (!erster || !letzter) return 0;
  if (betrag <= erster[0]) return erster[1];
  if (betrag >= letzter[0]) return letzter[1];
  for (let i = 1; i < p.length; i++) {
    const [x1, y1] = p[i] as [number, number];
    const [x0, y0] = p[i - 1] as [number, number];
    if (betrag <= x1) return y0 + ((y1 - y0) * (betrag - x0)) / (x1 - x0);
  }
  return letzter[1];
}

export function naeherungsModell(k: KantonEintrag): KantonsSteuerModell {
  const r = k.referenzEstv2026;
  const raster = (z: Zivilstand) => (z === 'verheiratet' ? r.raster.verheiratet : r.raster.ledig);
  return {
    id: `${k.code}-naeherung`,
    beschreibung: `${k.name}: Näherung, effektive Sätze ESTV-Steuerrechner 2026, Hauptort ${k.hauptort.name}`,
    einkommenssteuer: (s, z) => {
      const pts = raster(z);
      const steuer = interpoliereSteuer(
        s,
        pts.map((x) => [x.steuerbaresEinkommen, x.einkommenKantonGemeinde]),
      );
      return steuer + (pts[0]?.personalsteuer ?? 0);
    },
    vermoegenssteuer: (v, z) =>
      interpoliereSteuer(
        v,
        raster(z).map((x) => [x.steuerbaresVermoegen, x.vermoegenKantonGemeinde]),
      ),
    kapitalleistungssteuer: (b, z) =>
      b <= 0
        ? 0
        : (b *
            interpoliereSatz(
              b,
              z === 'verheiratet' ? r.kapitalleistungSatzPct.verheiratet : r.kapitalleistungSatzPct.ledig,
            )) /
          100,
  };
}
