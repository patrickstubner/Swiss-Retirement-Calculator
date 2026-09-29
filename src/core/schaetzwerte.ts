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
 *   Plafonierung 150% in der Simulation).
 * - Erziehungs- und Betreuungsgutschriften: nur mit Angabe der Jahre (Felder der AHV-Schätzhilfe,
 *   `ahvSchaetzhilfe.erziehungsJahre`/`betreuungsJahre`; Standard 0 → eher zu tief bei Kindern).
 *   Ehepaare: Kinder gelten als gemeinsam (grössere Angabe beider Personen), Gutschrift hälftig.
 *
 * Nicht erwerbstätige Person (z.B. Familienarbeit, `erwerbsstatus: 'nichtErwerbstaetig'`):
 * - kein Lohn, keine PK- und 3a-Einzahlungen, kein PK-Guthaben (ein früheres Guthaben liegt auf
 *   einem Freizügigkeitskonto, Art. 2 und 4 FZG); der gespeicherte Lohn bleibt für einen Wechsel erhalten.
 * - AHV: volle Beitragsjahre ab dem 1.1. nach dem 20. Geburtstag bzw. ab Zuzug – entweder gelten die
 *   Beiträge dank des erwerbstätigen Ehegatten als bezahlt (Art. 3 Abs. 3 AHVG, mind. doppelter
 *   Mindestbeitrag 1'060) oder die Person zahlt eigene NE-Beiträge (die Simulation rechnet sie).
 * - Eigenes Einkommen = frühere Erwerbstätigkeit in der Schweiz (Jahre × Durchschnittslohn), auf die
 *   ganze Beitragsdauer verteilt; eigene NE-Beiträge werden vereinfacht nicht als Einkommen angerechnet
 *   (eher zu tief). Bei Ehepaaren Splitting mit dem Einkommen des Ehegatten.
 *
 * Pensionskasse (BVG-Obligatorium – rules: bvg.*):
 * - Altersguthaben heute (falls nicht eingegeben): Summe der BVG-Altersgutschriften (Art. 16 BVG)
 *   auf dem koordinierten heutigen Lohn ab dem BVG-Alter 25 bzw. ab dem Zuzugsjahr bis zum
 *   Vorjahr, verzinst mit dem BVG-Mindestzins 2026 für alle Jahre. Grobe Schätzung: bei
 *   umhüllenden Kassen (höhere Beiträge, Lohn über 90'720) meist deutlich zu tief; frühere
 *   Stellen/Freizügigkeitsguthaben sind nicht enthalten.
 * - Sparbeitrag: BVG-Minimum (Altersgutschrift auf dem koordinierten Lohn, altersabhängig).
 * - Umwandlungssatz (falls nicht laut Vorsorgeausweis eingegeben), aufgeteilt (siehe
 *   schaetzeUmwandlungssatz):
 *   · obligatorischer Teil: BVG-Mindestumwandlungssatz 6,8% (Art. 14 BVG – rules: bvg.mindestumwandlungssatz),
 *   · überobligatorischer Rest: durchschnittlicher umhüllender Umwandlungssatz der Vorsorgeeinrichtungen
 *     5,17% (OAK BV, Bericht zur finanziellen Lage 2025, Stand 31.12.2025 – rules:
 *     bvg.umwandlungssatzUmhuellendDurchschnitt). Einen amtlichen Durchschnitt nur fürs Überobligatorium
 *     gibt es nicht; der umhüllende Satz gilt in den Kassen für das ganze Guthaben → bei stark
 *     umhüllenden Kassen eher etwas zu hoch, bei BVG-nahen Kassen realistisch.
 *   · Aufteilung (Näherung): BVG-Altersguthaben heute laut Vorsorgeausweis (Detailfeld) bzw.
 *     geschätzt wie das PK-Guthaben (BVG-Mindestgutschriften), höchstens das ganze Guthaben; beide
 *     Teile bis zum Referenzalter hochgerechnet: BVG-Teil mit BVG-Mindestgutschriften, Gesamtguthaben
 *     mit dem (eingegebenen bzw. geschätzten) Sparbeitrag, beide mit demselben PK-Zins (real).
 *     Resultat: effektiver Satz = 6,8% × Anteil Obligatorium + 5,17% × Rest.
 * - Bezug: als Rente (Kapitalanteil 0), frühestens gemäss Standard-Reglement (bvg.bezugsalter).
 *
 * Säule 3a: nur das eingegebene Guthaben, keine weiteren Einzahlungen (Standard 0).
 * Rendite, Teuerung, Kosten: Standardannahmen aus data/defaults.ts (Schritt «Annahmen»).
 * Steuern: Kantonsdaten 2026 (data/kantone-2026.json) für Kanton + Gemeinde.
 */
export const SCHAETZ_ANNAHMEN = {
  pkKapitalanteil: 0,
  saeule3aBeitragJahr: 0,
  /** Standard ohne Angabe (Feld der AHV-Schätzhilfe) */
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

export const istNichtErwerbstaetig = (p: Pick<Person, 'erwerbsstatus'>): boolean =>
  p.erwerbsstatus === 'nichtErwerbstaetig';

/**
 * Person, wie sie gerechnet wird: bei nicht Erwerbstätigen ohne Lohn, ohne Erwerbsaufgabe (Alter 0),
 * ohne PK-Guthaben/-Beiträge und ohne 3a-Einzahlungen. Der gespeicherte Zustand bleibt unverändert.
 */
export function gerechnetePerson(p: Person): Person {
  if (!istNichtErwerbstaetig(p)) return p;
  return {
    ...p,
    lohn: 0,
    lohnwachstumReal: 0,
    stoppModus: 'alter',
    stoppAlter: 0,
    pk: { ...p.pk, guthaben: 0, bvgGuthaben: 0, beitragModus: 'eingabe', sparbeitragJahr: 0 },
    saeule3a: { ...p.saeule3a, beitragJahr: 0 },
  };
}

/** Mindestlohn des Ehegatten, damit seine Beiträge (AN + AG) den doppelten Mindestbeitrag erreichen. */
export function lohnFuerBefreiung(regeln: Regeln): number {
  return regeln.beitraege.nichterwerbstaetige.befreiungEhegatteMindestbeitrag / regeln.beitraege.ahvIvEoSatzTotal;
}

/** Durchschnittliches eigenes AHV-Einkommen über `beitragsjahre` (heutige Franken). */
export function ahvEigenesEinkommen(p: Person, beitragsjahre: number): number {
  if (!istNichtErwerbstaetig(p)) return Math.max(0, p.lohn);
  if (beitragsjahre <= 0) return 0;
  const jahre = Math.min(beitragsjahre, Math.max(0, Math.round(p.frueherErwerb.jahre)));
  return (Math.max(0, p.frueherErwerb.lohn) * jahre) / beitragsjahre;
}

/**
 * Umwandlungssatz laut Vorsorgeausweis setzen – derselbe Zustand für die Modi «Schnell» und
 * «Detailliert». Leer bzw. 0 (ein Umwandlungssatz von 0% ist nicht sinnvoll) = keine eigene
 * Eingabe → wieder die aufgeteilte Schätzung (6,8% Obligatorium / umhüllender Durchschnitt).
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

/**
 * Umwandlungssatz nur geschätzt, obwohl ein PK-Guthaben vorhanden ist → Hinweis «Satz vom
 * Vorsorgeausweis eintragen» (die Schätzung ist nicht mehr systematisch zu optimistisch, kann aber
 * je nach Kasse deutlich abweichen).
 */
export function umwandlungssatzGeschaetztMitGuthaben(p: Person, effektiv: Person | undefined): boolean {
  return !istManuell(p, 'pkUmwandlungssatz') && (effektiv?.pk.guthaben ?? p.pk.guthaben) > 0;
}

/** Aufgeteilte Schätzung des Umwandlungssatzes (Obligatorium / Überobligatorium). */
export interface UmwandlungssatzSchaetzung {
  /** Effektiver Satz auf dem ganzen Guthaben (gewichtet) */
  satz: number;
  /** Satz auf dem obligatorischen Teil (BVG-Mindestumwandlungssatz) */
  satzObligatorium: number;
  /** Satz auf dem überobligatorischen Rest (umhüllender Durchschnitt OAK BV) */
  satzUeberobligatorium: number;
  /** Anteil des obligatorischen Teils am Guthaben im Referenzalter (0–1, Näherung) */
  anteilObligatorium: number;
  /** BVG-Altersguthaben heute (eingegeben oder geschätzt, höchstens das ganze Guthaben) */
  bvgGuthabenHeute: number;
  /** true: BVG-Altersguthaben laut Vorsorgeausweis eingegeben (Detailfeld) */
  bvgGuthabenEingegeben: boolean;
  /**
   * Warum kein obligatorischer Teil geschätzt wird (nur wenn der Anteil 0 ist):
   * 'keinLohn' = Lohn 0, 'unterSchwelle' = Lohn unter der BVG-Eintrittsschwelle, 'andere' = sonst.
   */
  ohneObligatorium: 'keinLohn' | 'unterSchwelle' | 'andere' | null;
}

/**
 * Schätzt den Umwandlungssatz aufgeteilt in Obligatorium (6,8%) und Überobligatorium
 * (umhüllender Durchschnitt), siehe Annahmen oben.
 * @param guthabenHeute verwendetes PK-Guthaben heute (eingegeben oder geschätzt)
 * @param sparbeitragEingabe jährlicher Sparbeitrag laut Vorsorgeausweis oder null (= BVG-Minimum)
 */
export function schaetzeUmwandlungssatz(
  p: Person,
  regeln: Regeln,
  heute: Monat,
  guthabenHeute: number,
  sparbeitragEingabe: number | null,
  inflation: number,
): UmwandlungssatzSchaetzung {
  const bvg = regeln.bvg;
  const satzObligatorium = bvg.mindestumwandlungssatz;
  const satzUeberobligatorium = bvg.umwandlungssatzUmhuellendDurchschnitt;
  const pr = projiziereObligatorium(p, regeln, heute, guthabenHeute, sparbeitragEingabe, inflation);
  const anteil = pr.anteil;
  return {
    satz: satzObligatorium * anteil + satzUeberobligatorium * (1 - anteil),
    satzObligatorium,
    satzUeberobligatorium,
    anteilObligatorium: anteil,
    bvgGuthabenHeute: Math.round(pr.bvgHeute),
    bvgGuthabenEingegeben: pr.eingegeben,
    ohneObligatorium:
      anteil > 0 ? null : !(p.lohn > 0) ? 'keinLohn' : p.lohn < bvg.eintrittsschwelle ? 'unterSchwelle' : 'andere',
  };
}

export interface ObligatoriumsProjektion {
  /** BVG-Altersguthaben heute (eingegeben oder geschätzt, höchstens das ganze Guthaben) */
  bvgHeute: number;
  eingegeben: boolean;
  /** Projiziertes BVG-Guthaben bzw. Gesamtguthaben (real) */
  bvg: number;
  gesamt: number;
  /** Anteil des Obligatoriums (0–1; ohne Guthaben 1) */
  anteil: number;
}

/**
 * Hochrechnung von BVG-Altersguthaben und Gesamtguthaben (Näherung, siehe Annahmen oben):
 * volle Jahre ab dem laufenden Jahr bis zum Referenzalter bzw. bis vor `bisJahr`.
 */
export function projiziereObligatorium(
  p: Person,
  regeln: Regeln,
  heute: Monat,
  guthabenHeute: number,
  sparbeitragEingabe: number | null,
  inflation: number,
  bisJahr: number = Number.POSITIVE_INFINITY,
): ObligatoriumsProjektion {
  const bvg = regeln.bvg;
  const g0 = Math.max(0, guthabenHeute);
  const eingegeben = p.pk.bvgGuthaben > 0;
  const b0 = Math.min(g0, eingegeben ? p.pk.bvgGuthaben : schaetzePkGuthaben(p, regeln, heute));
  const raJahre = Math.floor(inMonaten(ahvReferenzalter(p.geburtsjahr, p.geschlecht, regeln.ahv)) / 12);
  const zins = (1 + p.pk.zins) / (1 + inflation) - 1;
  let b = b0;
  let g = g0;
  for (let jahr = heute.jahr, t = 0; jahr - p.geburtsjahr <= raJahre && jahr < bisJahr; jahr++, t++) {
    const bvgGutschrift = bvgAltersgutschrift(p.lohn, jahr - p.geburtsjahr, raJahre, bvg);
    const beitrag =
      sparbeitragEingabe !== null ? Math.max(0, sparbeitragEingabe) * (1 + p.lohnwachstumReal) ** t : bvgGutschrift;
    b = b * (1 + zins) + bvgGutschrift;
    g = g * (1 + zins) + beitrag;
  }
  const anteil = g > 0 ? Math.min(1, Math.max(0, b / g)) : 1;
  return { bvgHeute: b0, eingegeben, bvg: b, gesamt: g, anteil };
}

/**
 * Anteil des Obligatoriums am PK-Guthaben beim Wegzug (für Art. 25f FZG), aus der Person des
 * effektiven Haushalts (Guthaben eingegeben oder geschätzt, Sparbeitrag eingegeben oder BVG-Minimum).
 */
export function obligatoriumsAnteilBei(
  p: Person,
  regeln: Regeln,
  heute: Monat,
  jahr: number,
  inflation: number,
): number {
  const spar = p.pk.beitragModus === 'eingabe' ? p.pk.sparbeitragJahr : null;
  return projiziereObligatorium(p, regeln, heute, p.pk.guthaben, spar, inflation, jahr).anteil;
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
  const ez = Math.max(
    0,
    p.ahvSchaetzhilfe.erziehungsJahre,
    ehe && partner ? partner.ahvSchaetzhilfe.erziehungsJahre : 0,
  );
  let partnerEinkommen = 0;
  if (ehe && partner) {
    const pRa = ahvRaJahr(partner, regeln);
    const pBeginn = ahvBeitragsbeginn(partner, regeln);
    const pJahre = Math.max(0, pRa - Math.max(pBeginn, partner.inChSeit > 0 ? partner.inChSeit : pBeginn));
    partnerEinkommen = ahvEigenesEinkommen(partner, pJahre);
  }
  return ahvSchaetzung(
    {
      geburtsjahr: p.geburtsjahr,
      geburtsmonat: p.geburtsmonat,
      geschlecht: p.geschlecht,
      beitragsModus: 'jahreCh',
      luecken: 0,
      jahreCh,
      einkommen: ahvEigenesEinkommen(p, jahreCh),
      ehejahre: ehe ? jahreCh : 0,
      einkommenEhepartner: partnerEinkommen,
      erziehungsJahre: ez,
      betreuungsJahre: Math.max(0, p.ahvSchaetzhilfe.betreuungsJahre),
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
  /** Aufteilung der Umwandlungssatz-Schätzung pro Person (zur Anzeige) */
  umwandlungssatz: UmwandlungssatzSchaetzung[];
}

/** Wendet alle Schätzungen auf Felder ohne eigene Eingabe an. Der gespeicherte Zustand bleibt unverändert. */
export function effektiverHaushalt(h: Haushalt, regeln: Regeln, heute: Monat): EffektiverHaushalt {
  const verheiratet = h.zivilstand === 'verheiratet';
  const schaetzungen: Schaetzung[] = [];
  const werte: Record<SchaetzFeld, number>[] = [];
  const uws: UmwandlungssatzSchaetzung[] = [];
  const gerechnet = h.personen.map(gerechnetePerson);
  const personen = h.personen.map((roh, i) => {
    const p = gerechnet[i] ?? roh;
    const partner = gerechnet.find((_, j) => j !== i) ?? null;
    const ahv = schaetzeAhv(p, partner, verheiratet, regeln);
    const pkGuthaben = schaetzePkGuthaben(p, regeln, heute);
    const u = schaetzeUmwandlungssatz(
      p,
      regeln,
      heute,
      istManuell(p, 'pkGuthaben') ? p.pk.guthaben : pkGuthaben,
      istManuell(p, 'pkSparbeitrag') ? p.pk.sparbeitragJahr : null,
      h.annahmen.inflation,
    );
    uws.push(u);
    const w: Record<SchaetzFeld, number> = {
      ahvRente: ahv.renteMonat,
      pkGuthaben,
      pkSparbeitrag: schaetzePkSparbeitrag(p, regeln, heute),
      pkUmwandlungssatz: u.satz,
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
  return { haushalt: { ...h, personen }, schaetzungen, werte, umwandlungssatz: uws };
}

/**
 * Eingaben, die nur im Modus «Detailliert» sichtbar sind und vom Standard abweichen. Der Modus
 * «Schnell» verwendet sie trotzdem und zeigt ihre Anzahl an.
 */
export function detailwerte(h: Haushalt, standard: Haushalt): string[] {
  const out: string[] = [];
  const std = standard.personen[0];
  if (h.wohnen?.separat) out.push('Wohnkosten separat');
  h.personen.forEach((p, i) => {
    const n = h.personen.length > 1 ? ` (${p.name || `Person ${i + 1}`})` : '';
    // PK-Guthaben und Umwandlungssatz sind auch im Modus «Schnell» sichtbar → keine Detailwerte
    for (const f of SCHAETZ_FELDER)
      if (f !== 'pkGuthaben' && f !== 'pkUmwandlungssatz' && istManuell(p, f)) out.push(SCHAETZ_LABEL[f] + n);
    if (p.pk.bvgGuthaben > 0 && !istManuell(p, 'pkUmwandlungssatz')) out.push(`BVG-Altersguthaben (Obligatorium)${n}`);
    if (p.bargeld > 0) out.push(`Bargeld/Konten${n}`);
    if (p.sonstiges.wert > 0) out.push(`Sonstiges Vermögen${n}`);
    if (p.wohneigentum.vorhanden && p.wohneigentum.hypothek > 0) out.push(`Hypothek${n}`);
    if (p.wohneigentum.vorhanden && p.wohneigentum.verkauf?.aktiv) out.push(`Verkauf Wohneigentum${n}`);
    if (p.freizuegigkeit.guthaben > 0) out.push(`Freizügigkeitsguthaben${n}`);
    const ne = istNichtErwerbstaetig(p);
    if (p.saeule3a.beitragJahr > 0 && !ne) out.push(`3a-Einzahlungen${n}`);
    // Bei nicht Erwerbstätigen sind die Gutschriften-Jahre auch im Modus «Schnell» sichtbar
    if (!ne && (p.ahvSchaetzhilfe.erziehungsJahre > 0 || p.ahvSchaetzhilfe.betreuungsJahre > 0))
      out.push(`Erziehungs-/Betreuungsgutschriften${n}`);
    if (p.auslandRenten.length > 0) out.push(`Ausländische Renten${n}`);
    if (p.ahv.bezugVerschiebungMonate !== 0) out.push(`AHV-Vorbezug/Aufschub${n}`);
    if (p.lohnwachstumReal !== 0) out.push(`Lohnentwicklung${n}`);
    // Wegzug (Alter/Datum, Land, Barauszahlung) ist auch im Modus «Schnell» erfassbar; nur die AHV-Details zählen
    const w = p.wohnsitzAusland;
    if (w.aktiv && (w.freiwilligeAhv || w.nationalitaet !== 'CH' || !w.vorherVersichert5Jahre))
      out.push(`Wohnsitz im Ausland (AHV-Details)${n}`);
    if (w.aktiv && (w.sitzkantonVorsorge !== '' || w.sitzkantonFz !== '' || w.sitzkanton3a !== ''))
      out.push(`Sitzkanton der Vorsorgeeinrichtung${n}`);
    if (w.aktiv && (w.steuerSatzZielland !== null || w.steuerOption !== '' || w.qstKapitalRueckforderung))
      out.push(`Steuern im Zielland${n}`);
    if (std) {
      if (p.pk.kapitalanteil !== std.pk.kapitalanteil) out.push(`PK-Kapitalbezug${n}`);
      if (p.pk.fruehestesAlter !== std.pk.fruehestesAlter) out.push(`PK-Bezugsalter laut Reglement${n}`);
      if (p.pk.zins !== std.pk.zins) out.push(`PK-Verzinsung${n}`);
    }
  });
  if (h.ausgaben.phasen.length > 0) out.push('Ausgabenphasen');
  if (h.ausgaben.einzeljahre.length > 0) out.push('Ausgaben: einzelne Jahre');
  if (h.posten.length > 0) out.push('Weitere Einnahmen/Ausgaben');
  if (h.ereignisse.length > 0) out.push('Einmalige Ereignisse');
  if (h.ausgaben.faktorAb75 !== standard.ausgaben.faktorAb75 || h.ausgaben.faktorAb85 !== standard.ausgaben.faktorAb85)
    out.push('Ausgaben im Alter');
  if (JSON.stringify(h.annahmen) !== JSON.stringify(standard.annahmen)) out.push('Annahmen (Rendite, Teuerung usw.)');
  if (h.steuern.eigeneSaetze) out.push('Eigene Steuersätze');
  if (h.steuern.kirche !== standard.steuern.kirche) out.push('Kirchensteuer');
  return out;
}
