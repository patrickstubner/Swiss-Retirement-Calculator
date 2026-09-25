/**
 * Steuern im Wohnsitzstaat nach dem Wegzug (vereinfachtes Modell je Land aus
 * data/laender-2026.json, Block «steuern»; Quellen und Stand dort und in docs/laender.md).
 *
 * - Tarife in Landeswährung, Umrechnung mit einem festen Kurs (kursProChf); Stufen und Kurs gelten
 *   wie die Schweizer Tarife als real konstant (Näherung).
 * - Einkommen je Steuereinheit (Person, bei gemeinsamem Tarif das Ehepaar) in heutigen Franken.
 * - Eigener effektiver Satz: ersetzt das Modell (Satz × alle Einkünfte inkl. Kapitalerträge).
 * - Nicht abgebildet (je Land in `hinweise`): Abzüge ausser den genannten, Zuschläge, Vermögens-
 *   steuern ausser IVAFE (IT) und Sollertrag (LI), Anrechnung ausländischer Steuern.
 */
import { stufenSteuer } from './quellensteuer';

/** Grenzsätze je Stufe: [obere Grenze (null = alle weiteren), Satz] */
export type Tarif = readonly (readonly [number | null, number])[];

export interface ZiellandOption {
  code: string;
  label: string;
  /** Faktor auf die Tarifsteuer (z.B. Azoren 0,7) */
  faktor?: number;
  /** Pauschalsatz auf alle ausländischen Einkünfte (Renten, Kapitalerträge), z.B. IT 7 % */
  pauschalSatz?: number;
  /** Ersetzt den Vermögenssteuersatz */
  vermoegenSatz?: number;
}

export interface ZiellandSteuerModell {
  code: string;
  status: 'verifiziert' | 'naeherung' | 'offen';
  /** keine = keine Einkommenssteuer; territorial = Auslandseinkommen nicht steuerbar; tarif = Modell */
  art: 'keine' | 'territorial' | 'tarif';
  waehrung?: string;
  /** Einheiten Landeswährung je CHF */
  kursProChf?: number;
  tarif?: Tarif;
  /** Gemeinsamer Tarif für Ehepaare (sonst Besteuerung pro Person) */
  tarifVerheiratet?: Tarif;
  /** Faktor auf die Tarifsteuer (ES: regionaler Anteil wie Staatstarif = 2; LI: Gemeindezuschlag 150 % = 2,5) */
  faktor?: number;
  /** Abzug pro Person vom steuerbaren Einkommen (Landeswährung) */
  freibetrag?: number;
  /** ES: persönliches Minimum pro Person – Steuer darauf wird abgezogen */
  persoenlichesMinimum?: number;
  /** Abzug auf Renten pro Person (Landeswährung), höchstens die Rente */
  abzugRente?: number;
  /** Abzug in Prozent der Renten, höchstens abzugRenteMax pro Person */
  abzugRenteAnteil?: number;
  abzugRenteMax?: number;
  /** Pauschalsatz auf AHV- und PK-Renten aus der Schweiz (IT: 5 %) */
  chRentenSatz?: number;
  /** Satz auf Vorsorgekapital nach Rückforderung der CH-Quellensteuer (IT: 5 %) */
  kapitalVorsorgeSatz?: number;
  kapitalertrag?: { art: 'tarif'; tarif?: Tarif } | { art: 'satz'; satz: number } | { art: 'keine' };
  /** Jährlicher Satz auf dem Vermögen (IT: IVAFE 0,2 %) */
  vermoegenSatz?: number;
  /** Sollertrag: Anteil des Vermögens, der als Einkommen zählt (LI: 4 %) */
  sollertrag?: number;
  /** Wahlweise Pauschale auf Renten über einem Freibetrag pro Person (CY: 5 % über 5'000 EUR) */
  auslandsrenteOption?: { freibetrag: number; satz: number };
  /** Schweizer Quellensteuer auf PK-Renten laut ESTV 2-217 */
  chQstPkRente: 'ja' | 'rueckforderbar' | 'nein';
  /** Quellensteuer auf Vorsorgekapital laut ESTV 2-217 rückforderbar */
  kapitalRueckforderbar: boolean;
  optionen?: readonly ZiellandOption[];
  quellen: readonly { text: string; url: string; stand: string }[];
  hinweise: readonly string[];
}

/** Einkünfte einer Steuereinheit pro Jahr in heutigen Franken. */
export interface ZiellandEinkommen {
  /** AHV inkl. 13. Rente und Rentenzuschlag */
  ahv: number;
  pkRente: number;
  auslandRenten: number;
  lohn: number;
  /** Übrige steuerbare Einnahmen */
  uebrige: number;
  /** Steuerbarer Vermögensertrag */
  kapitalertrag: number;
  /** Nettovermögen */
  vermoegen: number;
  /** Anzahl Personen der Einheit (Abzüge pro Person) */
  personen: number;
}

export interface ZiellandSteuer {
  einkommen: number;
  kapitalertrag: number;
  vermoegen: number;
  total: number;
  /** Eigener Satz verwendet */
  eigenerSatz: boolean;
}

const NULL: ZiellandSteuer = { einkommen: 0, kapitalertrag: 0, vermoegen: 0, total: 0, eigenerSatz: false };

/**
 * Steuer im Wohnsitzstaat für ein ganzes Jahr.
 * @param gemeinsam Einheit = Ehepaar mit gemeinsamem Tarif (nur wenn `tarifVerheiratet` vorhanden)
 */
export function ziellandSteuer(
  m: ZiellandSteuerModell | undefined,
  e: ZiellandEinkommen,
  opt: { gemeinsam: boolean; option: string; eigenerSatz: number | null },
): ZiellandSteuer {
  const pos = (x: number) => Math.max(0, x);
  if (opt.eigenerSatz !== null) {
    const s = pos(opt.eigenerSatz);
    const einkommen = (pos(e.ahv) + pos(e.pkRente) + pos(e.auslandRenten) + pos(e.lohn) + pos(e.uebrige)) * s;
    const kapitalertrag = pos(e.kapitalertrag) * s;
    return { einkommen, kapitalertrag, vermoegen: 0, total: einkommen + kapitalertrag, eigenerSatz: true };
  }
  if (m?.art !== 'tarif') return NULL;
  const k = m.kursProChf ?? 1;
  const n = Math.max(1, e.personen);
  const option = m.optionen?.find((o) => o.code === opt.option);
  const faktor = (m.faktor ?? 1) * (option?.faktor ?? 1);
  const tarif = (opt.gemeinsam && m.tarifVerheiratet ? m.tarifVerheiratet : m.tarif) ?? [];
  const tarifSteuer = (chf: number) => (stufenSteuer(pos(chf) * k, tarif as [number | null, number][]) / k) * faktor;
  const pauschal = option?.pauschalSatz;

  const chRenten = pos(e.ahv) + pos(e.pkRente);
  let pauschalSteuer = 0;
  let renten = pos(e.auslandRenten);
  if (pauschal !== undefined) {
    // Pauschale auf alle ausländischen Renten und Kapitalerträge (z.B. IT Art. 24-ter TUIR)
    pauschalSteuer = (chRenten + renten) * pauschal;
    renten = 0;
  } else if (m.chRentenSatz !== undefined) pauschalSteuer = chRenten * m.chRentenSatz;
  else renten += chRenten;

  let abzug = 0;
  if (m.abzugRente !== undefined) abzug = Math.min(renten, (m.abzugRente / k) * n);
  if (m.abzugRenteAnteil !== undefined)
    abzug = Math.min(renten * m.abzugRenteAnteil, ((m.abzugRenteMax ?? Number.POSITIVE_INFINITY) / k) * n);

  const ka = m.kapitalertrag ?? { art: 'tarif' };
  let kapSteuer = 0;
  let kapImTarif = 0;
  if (pauschal !== undefined) kapSteuer = pos(e.kapitalertrag) * pauschal;
  else if (ka.art === 'satz') kapSteuer = pos(e.kapitalertrag) * ka.satz;
  else if (ka.art === 'tarif' && ka.tarif)
    kapSteuer = stufenSteuer(pos(e.kapitalertrag) * k, ka.tarif as [number | null, number][]) / k;
  else if (ka.art === 'tarif') kapImTarif = pos(e.kapitalertrag);

  const soll = pos(e.vermoegen) * (m.sollertrag ?? 0);
  const frei = ((m.freibetrag ?? 0) / k) * n;
  const uebrig = pos(e.lohn) + pos(e.uebrige) + kapImTarif + soll;
  const minimum = m.persoenlichesMinimum ? tarifSteuer((m.persoenlichesMinimum / k) * n) : 0;
  const ordentlich = (basis: number) => pos(tarifSteuer(basis - frei) - minimum);

  let einkommen = ordentlich(renten - abzug + uebrig);
  const ro = m.auslandsrenteOption;
  if (ro && renten > 0) {
    // Wahl pro Jahr: ordentlicher Tarif oder Pauschale auf den Renten über dem Freibetrag
    const alternativ = ordentlich(uebrig) + pos(renten * k - ro.freibetrag * n) * (ro.satz / k);
    einkommen = Math.min(einkommen, alternativ);
  }
  einkommen += pauschalSteuer;
  const vSatz = option?.vermoegenSatz ?? m.vermoegenSatz ?? 0;
  const vermoegen = pos(e.vermoegen) * vSatz;
  return {
    einkommen,
    kapitalertrag: kapSteuer,
    vermoegen,
    total: einkommen + kapSteuer + vermoegen,
    eigenerSatz: false,
  };
}

/** Kurztext zur Behandlung im Zielland (für Hinweise und UI). */
export function ziellandKurz(m: ZiellandSteuerModell | undefined): string {
  if (!m) return 'kein Steuermodell (OFFEN)';
  if (m.art === 'keine') return 'keine Einkommens- und Vermögenssteuer';
  if (m.art === 'territorial') return 'Auslandseinkommen nicht steuerbar (Territorialprinzip)';
  return 'vereinfachtes Steuermodell des Landes';
}
