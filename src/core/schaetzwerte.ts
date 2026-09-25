/**
 * Schätzwerte für den Modus «Schnell» (und für leere Detailfelder) – alle an einem Ort.
 *
 * Grundsatz: keine erfundenen Regelwerte. Jeder Schätzwert wird aus den verifizierten Regeln
 * (rules/<jahr>.json) und den wenigen Schnell-Eingaben abgeleitet. Die Annahmen dahinter sind
 * hier dokumentiert und werden in der Oberfläche als «geschätzt» gekennzeichnet. Eine eigene
 * Eingabe (Person.manuell) hat immer Vorrang.
 */
import type { Regeln } from '../rules';
import { ahvReferenzalter, inMonaten } from './ahv';
import { type AhvSchaetzungErgebnis, ahvSchaetzung } from './ahvSchaetzung';
import { bvgAltersgutschrift } from './bvg';
import type { Haushalt, Monat, Person, SchaetzFeld } from './typen';

export const SCHAETZ_FELDER: readonly SchaetzFeld[] = ['ahvRente', 'pkGuthaben', 'pkSparbeitrag', 'pkUmwandlungssatz'];

export const SCHAETZ_LABEL: Record<SchaetzFeld, string> = {
  ahvRente: 'AHV-Rente',
  pkGuthaben: 'PK-Altersguthaben heute',
  pkSparbeitrag: 'PK-Sparbeitrag',
  pkUmwandlungssatz: 'PK-Umwandlungssatz',
};

/**
 * Dokumentierte Annahmen der Schätzung (keine Regelwerte, sondern Modellannahmen):
 *
 * AHV (Schätzhilfe Skala 44, MB 3.01 – rules: ahv.rentenformel, ahv.schaetzhilfe):
 * - Durchschnittliches AHV-Einkommen = heutiger Bruttolohn (real konstant über die ganze
 *   Beitragsdauer); oberhalb des mdJE-Maximums (90'720) ändert sich die Rente nicht (Skala 44).
 * - Keine Beitragslücken, ausser «in der Schweiz seit» liegt nach dem Beitragsbeginn
 *   (1.1. nach dem 20. Geburtstag): dann zählen die Jahre ab dem Zuzugsjahr (Zuzugsjahr voll).
 * - Ehepaare: Ehe während der ganzen Beitragsdauer (Splitting aller Jahre je hälftig,
 *   Plafonierung 150% in der Simulation). Keine Erziehungsgutschriften (eher zu tief bei Kindern).
 *
 * Pensionskasse (BVG-Obligatorium – rules: bvg.*):
 * - Altersguthaben heute (falls nicht eingegeben): Summe der BVG-Altersgutschriften (Art. 16 BVG)
 *   auf dem koordinierten heutigen Lohn ab dem BVG-Alter 25 bzw. ab dem Zuzugsjahr bis zum
 *   Vorjahr, verzinst mit dem BVG-Mindestzins 2026 für alle Jahre. Grobe Schätzung: bei
 *   umhüllenden Kassen (höhere Beiträge, Lohn über 90'720) meist deutlich zu tief; frühere
 *   Stellen/Freizügigkeitsguthaben sind nicht enthalten.
 * - Sparbeitrag: BVG-Minimum (Altersgutschrift auf dem koordinierten Lohn, altersabhängig).
 * - Umwandlungssatz: BVG-Mindestumwandlungssatz 6,8% (gilt nur fürs Obligatorium; umhüllende
 *   Kassen tiefer).
 * - Bezug: als Rente (Kapitalanteil 0), frühestens gemäss Standard-Reglement (bvg.bezugsalter).
 *
 * Säule 3a: nur das eingegebene Guthaben, keine weiteren Einzahlungen (Standard 0).
 * Rendite, Teuerung, Kosten: Standardannahmen aus data/defaults.ts (Schritt «Annahmen»).
 * Steuern: Kantonsdaten 2026 (data/kantone-2026.json) für Kanton + Gemeinde.
 */
export const SCHAETZ_ANNAHMEN = {
  pkKapitalanteil: 0,
  saeule3aBeitragJahr: 0,
  erziehungsJahre: 0,
} as const;

/**
 * Bandbreiten für die Sensitivität «Wo sich Genauigkeit lohnt» (je eine ungünstige Abweichung).
 * Modellannahmen für die Ausgabe, keine Regelwerte.
 */
export const SENSITIVITAET = {
  /** AHV: fehlende Beitragsjahre (z.B. Auslandsjahre, Lücken) */
  ahvFehlendeJahre: 5,
  /** PK-Guthaben: relative Abweichung */
  pkGuthabenRelativ: 0.2,
  /** Umwandlungssatz: Prozentpunkte tiefer */
  umwandlungssatzPunkte: 0.01,
  /** Börsenrendite: Prozentpunkte tiefer */
  renditePunkte: 0.01,
  /** Ausgaben: relativ höher */
  ausgabenRelativ: 0.1,
} as const;

export const istManuell = (p: Person, f: SchaetzFeld): boolean => p.manuell[f] === true;

/**
 * Umwandlungssatz laut Vorsorgeausweis setzen – derselbe Zustand für die Modi «Schnell» und
 * «Detailliert». Leer bzw. 0 (ein Umwandlungssatz von 0% ist nicht sinnvoll) = keine eigene
 * Eingabe → wieder die Schätzung (BVG-Mindestumwandlungssatz).
 */
export function mitUmwandlungssatz(p: Person, satz: number): Person {
  const manuell = { ...p.manuell };
  if (!(satz > 0)) {
    delete manuell.pkUmwandlungssatz;
    return { ...p, manuell };
  }
  manuell.pkUmwandlungssatz = true;
  return { ...p, manuell, pk: { ...p.pk, umwandlungssatz: satz } };
}

/** Umwandlungssatz geschätzt, obwohl ein PK-Guthaben vorhanden ist → Ergebnis vermutlich zu optimistisch. */
export function umwandlungssatzZuOptimistisch(p: Person, effektiv: Person | undefined): boolean {
  return !istManuell(p, 'pkUmwandlungssatz') && (effektiv?.pk.guthaben ?? p.pk.guthaben) > 0;
}

/** Erstes Beitragsjahr der AHV (1.1. nach dem 20. Geburtstag). */
const ahvBeitragsbeginn = (p: Person, regeln: Regeln): number =>
  p.geburtsjahr + regeln.ahv.schaetzhilfe.beitragsdauerBeginnAlter;

/** Jahr des Referenzalters (Beitragsdauer endet am 31.12. davor). */
function ahvRaJahr(p: Person, regeln: Regeln): number {
  const ra = inMonaten(ahvReferenzalter(p.geburtsjahr, p.geschlecht, regeln.ahv));
  return Math.floor((p.geburtsjahr * 12 + (p.geburtsmonat - 1) + ra) / 12);
}

/** Geschätzte fehlende AHV-Beitragsjahre wegen späteren Zuzugs (0 ohne Angabe). */
export function ahvLueckenZuzug(p: Person, regeln: Regeln): number {
  if (p.inChSeit <= 0) return 0;
  const beginn = ahvBeitragsbeginn(p, regeln);
  const raJahr = ahvRaJahr(p, regeln);
  return Math.max(0, Math.min(raJahr, p.inChSeit) - beginn);
}

/** AHV-Schätzung nach den oben dokumentierten Annahmen. */
export function schaetzeAhv(
  p: Person,
  partner: Person | null,
  verheiratet: boolean,
  regeln: Regeln,
): AhvSchaetzungErgebnis {
  const raJahr = ahvRaJahr(p, regeln);
  const beginn = ahvBeitragsbeginn(p, regeln);
  const jahreCh = Math.max(0, raJahr - Math.max(beginn, p.inChSeit > 0 ? p.inChSeit : beginn));
  const ehe = verheiratet && partner !== null;
  return ahvSchaetzung(
    {
      geburtsjahr: p.geburtsjahr,
      geburtsmonat: p.geburtsmonat,
      geschlecht: p.geschlecht,
      beitragsModus: 'jahreCh',
      luecken: 0,
      jahreCh,
      einkommen: Math.max(0, p.lohn),
      ehejahre: ehe ? jahreCh : 0,
      einkommenEhepartner: ehe && partner ? Math.max(0, partner.lohn) : 0,
      erziehungsJahre: SCHAETZ_ANNAHMEN.erziehungsJahre,
      ausland: false,
      auslandJahre: 0,
    },
    regeln,
  );
}

/** PK-Altersguthaben heute aus BVG-Altersgutschriften (grobe Schätzung, siehe oben). */
export function schaetzePkGuthaben(p: Person, regeln: Regeln, heute: Monat): number {
  const bvg = regeln.bvg;
  const raJahre = Math.floor(inMonaten(ahvReferenzalter(p.geburtsjahr, p.geschlecht, regeln.ahv)) / 12);
  const abAlter = bvg.altersgutschriften[0]?.abAlter ?? 25;
  const start = Math.max(p.geburtsjahr + abAlter, p.inChSeit > 0 ? p.inChSeit : 0);
  let g = 0;
  for (let jahr = start; jahr < heute.jahr; jahr++) {
    g = g * (1 + bvg.mindestzins2026) + bvgAltersgutschrift(p.lohn, jahr - p.geburtsjahr, raJahre, bvg);
  }
  return Math.round(g);
}

/** Heutiger BVG-Mindestsparbeitrag (Anzeige; die Simulation rechnet ihn jedes Jahr neu). */
export function schaetzePkSparbeitrag(p: Person, regeln: Regeln, heute: Monat): number {
  const raJahre = Math.floor(inMonaten(ahvReferenzalter(p.geburtsjahr, p.geschlecht, regeln.ahv)) / 12);
  return Math.round(bvgAltersgutschrift(p.lohn, heute.jahr - p.geburtsjahr, raJahre, regeln.bvg));
}

export interface Schaetzung {
  person: number;
  feld: SchaetzFeld;
  /** Geschätzter Wert (Anzeige) */
  wert: number;
  label: string;
}

export interface EffektiverHaushalt {
  /** Haushalt mit eingesetzten Schätzungen (für die Berechnung) */
  haushalt: Haushalt;
  /** Alle verwendeten Schätzungen (Felder ohne eigene Eingabe) */
  schaetzungen: Schaetzung[];
  /** Geschätzte Werte pro Person und Feld (auch für manuell überschriebene Felder, zur Anzeige) */
  werte: Record<SchaetzFeld, number>[];
}

/** Wendet alle Schätzungen auf Felder ohne eigene Eingabe an. Der gespeicherte Zustand bleibt unverändert. */
export function effektiverHaushalt(h: Haushalt, regeln: Regeln, heute: Monat): EffektiverHaushalt {
  const verheiratet = h.zivilstand === 'verheiratet';
  const schaetzungen: Schaetzung[] = [];
  const werte: Record<SchaetzFeld, number>[] = [];
  const personen = h.personen.map((p, i) => {
    const partner = h.personen.find((_, j) => j !== i) ?? null;
    const ahv = schaetzeAhv(p, partner, verheiratet, regeln);
    const w: Record<SchaetzFeld, number> = {
      ahvRente: ahv.renteMonat,
      pkGuthaben: schaetzePkGuthaben(p, regeln, heute),
      pkSparbeitrag: schaetzePkSparbeitrag(p, regeln, heute),
      pkUmwandlungssatz: regeln.bvg.mindestumwandlungssatz,
    };
    werte.push(w);
    let q: Person = p;
    for (const feld of SCHAETZ_FELDER) {
      if (istManuell(p, feld)) continue;
      schaetzungen.push({ person: i, feld, wert: w[feld], label: SCHAETZ_LABEL[feld] });
      if (feld === 'ahvRente')
        q = {
          ...q,
          ahv: {
            ...q.ahv,
            modus: 'eingabe',
            renteMonat: ahv.renteMonat,
            mdje: ahv.mdje,
            beitragsjahre: ahv.beitragsjahreSkala44,
          },
        };
      if (feld === 'pkGuthaben') q = { ...q, pk: { ...q.pk, guthaben: w.pkGuthaben } };
      if (feld === 'pkSparbeitrag') q = { ...q, pk: { ...q.pk, beitragModus: 'bvgMinimum' } };
      if (feld === 'pkUmwandlungssatz') q = { ...q, pk: { ...q.pk, umwandlungssatz: w.pkUmwandlungssatz } };
    }
    return q;
  });
  return { haushalt: { ...h, personen }, schaetzungen, werte };
}

/**
 * Eingaben, die nur im Modus «Detailliert» sichtbar sind und vom Standard abweichen. Der Modus
 * «Schnell» verwendet sie trotzdem und zeigt ihre Anzahl an.
 */
export function detailwerte(h: Haushalt, standard: Haushalt): string[] {
  const out: string[] = [];
  const std = standard.personen[0];
  h.personen.forEach((p, i) => {
    const n = h.personen.length > 1 ? ` (${p.name || `Person ${i + 1}`})` : '';
    // PK-Guthaben und Umwandlungssatz sind auch im Modus «Schnell» sichtbar → keine Detailwerte
    for (const f of SCHAETZ_FELDER)
      if (f !== 'pkGuthaben' && f !== 'pkUmwandlungssatz' && istManuell(p, f)) out.push(SCHAETZ_LABEL[f] + n);
    if (p.bargeld > 0) out.push(`Bargeld/Konten${n}`);
    if (p.sonstiges.wert > 0) out.push(`Sonstiges Vermögen${n}`);
    if (p.wohneigentum.vorhanden && p.wohneigentum.hypothek > 0) out.push(`Hypothek${n}`);
    if (p.freizuegigkeit.guthaben > 0) out.push(`Freizügigkeitsguthaben${n}`);
    if (p.saeule3a.beitragJahr > 0) out.push(`3a-Einzahlungen${n}`);
    if (p.auslandRenten.length > 0) out.push(`Ausländische Renten${n}`);
    if (p.ahv.bezugVerschiebungMonate !== 0) out.push(`AHV-Vorbezug/Aufschub${n}`);
    if (p.lohnwachstumReal !== 0) out.push(`Lohnentwicklung${n}`);
    if (p.wohnsitzAusland.aktiv) out.push(`Wohnsitz im Ausland${n}`);
    if (std) {
      if (p.pk.kapitalanteil !== std.pk.kapitalanteil) out.push(`PK-Kapitalbezug${n}`);
      if (p.pk.fruehestesAlter !== std.pk.fruehestesAlter) out.push(`PK-Bezugsalter laut Reglement${n}`);
      if (p.pk.zins !== std.pk.zins) out.push(`PK-Verzinsung${n}`);
    }
  });
  if (h.posten.length > 0) out.push('Weitere Einnahmen/Ausgaben');
  if (h.ereignisse.length > 0) out.push('Einmalige Ereignisse');
  if (h.ausgaben.faktorAb75 !== standard.ausgaben.faktorAb75 || h.ausgaben.faktorAb85 !== standard.ausgaben.faktorAb85)
    out.push('Ausgaben im Alter');
  if (JSON.stringify(h.annahmen) !== JSON.stringify(standard.annahmen)) out.push('Annahmen (Rendite, Teuerung usw.)');
  if (h.steuern.eigeneSaetze) out.push('Eigene Steuersätze');
  if (h.steuern.kirche !== standard.steuern.kirche) out.push('Kirchensteuer');
  return out;
}
