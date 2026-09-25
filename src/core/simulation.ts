/**
 * Jährliche Vermögensprojektion in realen CHF (heutige Kaufkraft) von heute bis zum
 * Planungsalter der jüngeren Person. Ereignisse (Lohnende, Rentenbeginn, Freigabe von
 * Vorsorgeguthaben, Einmalereignisse) werden monatsgenau erfasst, Steuern und Rendite
 * jährlich.
 *
 * Vermögens-Töpfe pro Person (nie vermischt):
 * - verfügbar: Bargeld, Wertschriften, Sonstiges, Wohneigentum (netto)
 * - gebunden: Pensionskasse, Freizügigkeit, Säule 3a (gesperrt bis zum zulässigen Bezugsalter)
 * Jeder Topf hat eine eigene Rendite. Ausgaben werden nur aus verfügbaren Töpfen bezahlt
 * (Bargeld → Wertschriften → Sonstiges → Wohneigentum). Reicht das nicht, entsteht ein
 * Fehlbetrag; ist dann noch gebundenes Vorsorgevermögen vorhanden, ist das eine
 * Liquiditätslücke.
 *
 * Konventionen:
 * - Steuertarife und Grenzbeträge gelten als an die Teuerung angepasst (real konstant).
 * - AHV-Renten folgen der Teuerung + `ahvAnpassungReal`.
 * - PK-Renten und der AHV-Rentenzuschlag sind nominal fix (verlieren real an Wert).
 * - Rendite auf den Anfangsbeständen; Kapitalbezüge und Jahressaldo am Jahresende.
 * - AHV-Beiträge: Nichterwerbstätige mit Wohnsitz CH (MB 2.03) bis zum Referenzalter; bei
 *   Wohnsitz im Ausland nur mit freiwilliger AHV (VFV, MB 10.02), sonst entstehen Beitragslücken.
 *   Bemessung: Vermögen am 31.12. (inkl. im Jahr bezogener Vorsorgekapitalien, ohne noch
 *   gesperrte PK/FZ/3a) + 20 × Renteneinkommen (alle Renten inkl. AHV, ohne IV), Ehepaare je hälftig.
 * - Wegzug mit Barauszahlung (Art. 5 Abs. 1 lit. a FZG, Art. 14 FZV, Art. 3 Abs. 2 lit. d BVV 3):
 *   PK, Freizügigkeit und 3a werden ab dem Wegzugsmonat als Kapital frei, sofern der Wegzug vor
 *   dem jeweiligen Bezugsalter liegt (PK: vor dem Bezugsalter laut Reglement, sonst Altersleistung,
 *   Art. 2 Abs. 1bis FZG). EU/EFTA (Art. 25f FZG): der obligatorische Teil (Näherung, siehe
 *   schaetzwerte.ts) bleibt als Freizügigkeitsguthaben gesperrt (Bezug ab RA−5), ausser die Person
 *   ist im neuen Land nicht obligatorisch versichert; Freizügigkeitsguthaben bleibt dann ganz
 *   gesperrt (Anteil unbekannt). Kapitalleistungen nach dem Wegzug: Schweizer Quellensteuer
 *   (Bund + Sitzkanton der Vorsorgeeinrichtung, core/quellensteuer.ts) statt der ordentlichen
 *   Kapitalleistungssteuer. Einkommens-/Vermögenssteuern im Wohnsitzstaat sind nicht abgebildet.
 */

import { kantonsModellFuer } from '../data/kantone';
import { type WegzugsLand, wegzugsLand } from '../data/laender';
import type { Regeln } from '../rules';
import {
  ahv13,
  ahvBezugFaktor,
  ahvMdjeAusRente,
  ahvPlafonierung,
  ahvReferenzalter,
  ahvRentenzuschlag,
  ahvRenteSkala44,
  ahvTeilrente,
  ausMonatIndex,
  inMonaten,
  monatIndex,
  pruefeAhvVerschiebung,
} from './ahv';
import { auslandRenteNetto, auslandRenteRealJahr } from './auslandRenten';
import { bvgAltersgutschrift, pkLeistung } from './bvg';
import {
  fwBefreitDurchEhegatte,
  fwBeitragErwerbstaetig,
  fwBeitragNichterwerbstaetig,
  pruefeFreiwilligeAhv,
} from './freiwilligeAhv';
import { realerBetrag } from './indexierung';
import { neBefreitDurchEhegatte, neBeitrag } from './neBeitrag';
import { quellensteuerKapital } from './quellensteuer';
import { deterministisch, type RenditeModell } from './renditen';
import { obligatoriumsAnteilBei } from './schaetzwerte';
import { dbgEinkommen, dbgKapital } from './steuern';
import type { Haushalt, JahresZeile, Monat, Person, PersonInfo, SimulationsErgebnis, Toepfe } from './typen';
import { geburtIndex, stoppAlterMonate, wegzugIndex } from './zeitpunkt';

export { geburtIndex } from './zeitpunkt';

export interface SimOptionen {
  /** Erster simulierter Monat (z.B. aktueller Monat) */
  start: Monat;
  renditeModell?: RenditeModell;
  /** Überschreibt das Stopp-Alter pro Person (in Monaten), z.B. für den Solver */
  stoppAlterMonate?: readonly (number | undefined)[];
}

interface PersonPlan {
  p: Person;
  geburtIdx: number;
  raMonate: number;
  stoppMonate: number;
  ahvStartIdx: number;
  ahvBasisMonat: number;
  ahvFaktor: number;
  zuschlagNominal: number;
  pkStartIdx: number;
  s3aStartIdx: number;
  fzStartIdx: number;
  s3aMax: number;
  auslandStartIdx: number[];
  /** Erster Monat mit Wohnsitz im Ausland (Infinity = kein Wegzug) */
  wegIdx: number;
  /** Freiwillige AHV wird gerechnet */
  fwAktiv: boolean;
  /** Barauszahlung beim Wegzug: Monatsindex je Topf (Infinity = keine) */
  barPkIdx: number;
  barFzIdx: number;
  barS3aIdx: number;
  /** Ganzes PK-Guthaben frei (nicht EU/EFTA bzw. dort nicht obligatorisch versichert) */
  barVoll: boolean;
  land: WegzugsLand | undefined;
  info: PersonInfo;
  // laufender Zustand
  t: Toepfe;
  pkBezogen: boolean;
  pkRenteNominal: number;
  s3aBezogen: boolean;
  fzBezogen: boolean;
}

/** Index der jüngeren Person (Referenz für Planungsalter und Ausgabenphasen). */
export function referenzPerson(personen: readonly Person[]): number {
  let best = 0;
  personen.forEach((p, i) => {
    const b = personen[best];
    if (b && p.geburtsjahr * 12 + p.geburtsmonat > b.geburtsjahr * 12 + b.geburtsmonat) best = i;
  });
  return best;
}

/** Nettowert des Wohneigentums (Verkehrswert − Hypothek), 0 ohne Wohneigentum. */
export function wohneigentumNetto(p: Person): number {
  const w = p.wohneigentum;
  return w.vorhanden ? Math.max(0, w.verkehrswert) - Math.max(0, w.hypothek) : 0;
}

/** Töpfe einer Person heute. */
export function startToepfe(p: Person): Toepfe {
  return {
    bargeld: Math.max(0, p.bargeld),
    wertschriften: Math.max(0, p.wertschriften),
    sonstiges: Math.max(0, p.sonstiges.wert),
    wohneigentum: wohneigentumNetto(p),
    pk: Math.max(0, p.pk.guthaben),
    freizuegigkeit: Math.max(0, p.freizuegigkeit.guthaben),
    saeule3a: Math.max(0, p.saeule3a.guthaben),
  };
}

export const verfuegbar = (t: Toepfe): number => t.bargeld + t.wertschriften + t.sonstiges + t.wohneigentum;
export const gebunden = (t: Toepfe): number => t.pk + t.freizuegigkeit + t.saeule3a;

/**
 * Verfügbares Vermögen zu Beginn (alle Personen): Bargeld, Wertschriften, Sonstiges und
 * Nettowert Wohneigentum. Vereinfachung (Vorgabe): Wohneigentum wird wie an der Börse
 * angelegtes Kapital behandelt; Eigenmietwert, Unterhalt und Verkaufskosten fehlen.
 */
export function startvermoegen(h: Haushalt): number {
  return h.personen.reduce((s, p) => s + verfuegbar(startToepfe(p)), 0);
}

const summeToepfe = (xs: Toepfe[]): Toepfe =>
  xs.reduce(
    (s, x) => ({
      bargeld: s.bargeld + x.bargeld,
      wertschriften: s.wertschriften + x.wertschriften,
      sonstiges: s.sonstiges + x.sonstiges,
      wohneigentum: s.wohneigentum + x.wohneigentum,
      pk: s.pk + x.pk,
      freizuegigkeit: s.freizuegigkeit + x.freizuegigkeit,
      saeule3a: s.saeule3a + x.saeule3a,
    }),
    { bargeld: 0, wertschriften: 0, sonstiges: 0, wohneigentum: 0, pk: 0, freizuegigkeit: 0, saeule3a: 0 },
  );

/** Zulässiges Bezugsalter (Monate) für 3a bzw. Freizügigkeit: RA−5 … RA (+5 bei Erwerb). */
export function vorsorgeBezugMonate(
  stoppMonate: number,
  raMonate: number,
  fixAlter: number | null,
  jahreVorRA: number,
  jahreNachRA: number,
): number {
  const frueh = raMonate - jahreVorRA * 12;
  const spaet = raMonate + (stoppMonate > raMonate ? Math.min(stoppMonate - raMonate, jahreNachRA * 12) : 0);
  const wunsch = fixAlter !== null ? Math.round(fixAlter * 12) : stoppMonate;
  return Math.min(Math.max(wunsch, frueh), spaet);
}

/** PK-Bezugsalter (Monate): bei Erwerbsaufgabe, frühestens gemäss Reglement (58–70), spätestens 70. */
export function pkBezugMonate(p: Person, stoppMonate: number, regeln: Regeln): number {
  const b = regeln.bvg.bezugsalter;
  const frueh = Math.min(Math.max(p.pk.fruehestesAlter, b.reglementFruehestens), b.aufschubBis) * 12;
  const wunsch = p.pk.bezugsAlter !== null ? Math.round(p.pk.bezugsAlter * 12) : stoppMonate;
  return Math.min(Math.max(wunsch, frueh), b.aufschubBis * 12);
}

/**
 * Beitragsjahre, die wegen Wohnsitz im Ausland ohne freiwillige AHV fehlen: Monate ab dem
 * Wegzug (frühestens ab heute und ab 1.1. nach dem 20. Geburtstag) bis Ende der Beitragsdauer
 * (31.12. vor dem Jahr, in dem das Referenzalter erreicht wird), auf ganze Jahre gerundet.
 */
export function ahvLueckenJahreAusland(p: Person, raMonate: number, wegIdx: number, startIdx: number): number {
  const raJahr = Math.floor((geburtIndex(p) + raMonate) / 12);
  const beginn = Math.max(wegIdx, startIdx, (p.geburtsjahr + 21) * 12);
  return Math.max(0, Math.round((raJahr * 12 - beginn) / 12));
}

function planePerson(p: Person, regeln: Regeln, stoppMonate: number, startIdx: number): PersonPlan {
  const hinweise: string[] = [];
  const geburtIdx = geburtIndex(p);
  const raMonate = inMonaten(ahvReferenzalter(p.geburtsjahr, p.geschlecht, regeln.ahv));

  // Wohnsitz im Ausland und freiwillige AHV
  const weg = wegzugIndex(p);
  const wegIdx = weg ?? Number.POSITIVE_INFINITY;
  const fwPruefung = pruefeFreiwilligeAhv(p, regeln);
  const fwAktiv = weg !== null && p.wohnsitzAusland.freiwilligeAhv && fwPruefung.berechtigt;
  const bjVoll = regeln.ahv.vollrenteBeitragsjahre;
  const bj = Math.min(Math.max(p.ahv.beitragsjahre, 0), bjVoll);
  const lueckenAusland =
    weg !== null && !fwAktiv ? Math.min(bj, ahvLueckenJahreAusland(p, raMonate, weg, startIdx)) : 0;
  const bjEffektiv = bj - lueckenAusland;
  const lueckenFaktor = bj > 0 ? bjEffektiv / bj : 1;
  if (weg !== null) {
    if (p.wohnsitzAusland.freiwilligeAhv && !fwPruefung.berechtigt)
      hinweise.push(`Freiwillige AHV nicht möglich: ${fwPruefung.gruende.join(' ')}`);
    if (lueckenAusland > 0)
      hinweise.push(
        `Wohnsitz im Ausland ohne freiwillige AHV: ca. ${lueckenAusland} Beitragsjahre fehlen bis zum Referenzalter. Die AHV-Rente wird vereinfacht um ${lueckenAusland}/${bj} gekürzt (−${Math.round((1 - lueckenFaktor) * 1000) / 10}%).`,
      );
    if (fwPruefung.landEuEfta)
      hinweise.push(
        'Wohnsitz in der EU/EFTA: Allfällige Versicherungszeiten dort begründen eigene Rentenansprüche im Wohnsitzstaat – bitte separat unter «Ausländische Renten» erfassen.',
      );
    if (p.wohnsitzAusland.nationalitaet === 'andere')
      hinweise.push(
        'Staatsangehörige von Nichtvertragsstaaten erhalten die AHV-Rente bei Wohnsitz im Ausland unter Umständen nicht (stattdessen Rückvergütung der Beiträge). Bitte bei der Zentralen Ausgleichsstelle (zas.admin.ch) prüfen.',
      );
    if (stoppMonate > wegIdx - geburtIdx)
      hinweise.push(
        'Erwerbstätigkeit nach dem Wegzug: keine Schweizer Lohnabzüge mehr; ausländische Sozialabgaben sind nicht abgebildet.',
      );
    hinweise.push(
      'Einkommens- und Vermögenssteuern bei Wohnsitz im Ausland sind noch nicht abgebildet – es wird weiterhin mit Schweizer Steuern gerechnet. Kapitalleistungen aus Vorsorge nach dem Wegzug: Schweizer Quellensteuer (Näherung, siehe Ergebnis).',
    );
  }

  let verschiebung = p.ahv.bezugVerschiebungMonate;
  const fehler = pruefeAhvVerschiebung(verschiebung, p.geburtsjahr, p.geschlecht, regeln.ahv);
  if (fehler) {
    hinweise.push(`AHV: ${fehler} Es wird mit ordentlichem Bezug gerechnet.`);
    verschiebung = 0;
  }
  const mdje = p.ahv.modus === 'skala44' || p.ahv.mdje > 0 ? p.ahv.mdje : ahvMdjeAusRente(p.ahv.renteMonat, regeln.ahv);
  const ahvBasisMonat =
    (p.ahv.modus === 'eingabe'
      ? Math.max(0, p.ahv.renteMonat)
      : ahvTeilrente(ahvRenteSkala44(mdje, regeln.ahv), p.ahv.beitragsjahre, regeln.ahv)) * lueckenFaktor;
  const ahvFaktor = ahvBezugFaktor(verschiebung, p.geburtsjahr, p.geschlecht, mdje, regeln.ahv);
  const zuschlagNominal =
    ahvBasisMonat > 0 ? ahvRentenzuschlag(p.geburtsjahr, p.geschlecht, mdje, verschiebung, bjEffektiv, regeln.ahv) : 0;
  const ahvStartIdx = geburtIdx + raMonate + 1 + verschiebung;

  const pkStartMonate = pkBezugMonate(p, stoppMonate, regeln);

  const b3a = regeln.saeule3a.bezug;
  const s3aStartMonate = vorsorgeBezugMonate(
    stoppMonate,
    raMonate,
    p.saeule3a.bezugsAlter,
    b3a.fruehestensJahreVorRA,
    b3a.aufschubJahreNachRA,
  );
  const bfz = regeln.bvg.freizuegigkeitBezug;
  const fzStartMonate = vorsorgeBezugMonate(
    stoppMonate,
    raMonate,
    p.freizuegigkeit.bezugsAlter,
    bfz.fruehestensJahreVorRA,
    bfz.aufschubJahreNachRA,
  );
  const s3aMax =
    p.pk.guthaben > 0 || p.pk.sparbeitragJahr > 0 || p.pk.beitragModus === 'bvgMinimum'
      ? regeln.saeule3a.maxMitPk
      : Math.min(regeln.saeule3a.maxOhnePk, p.lohn * regeln.saeule3a.maxOhnePkSatz);
  if (p.saeule3a.beitragJahr > s3aMax) hinweise.push(`3a-Beitrag auf das Maximum von ${s3aMax} begrenzt.`);

  // Barauszahlung beim Wegzug
  const land = weg !== null ? wegzugsLand(p.wohnsitzAusland.land) : undefined;
  let barPkIdx = Number.POSITIVE_INFINITY;
  let barFzIdx = Number.POSITIVE_INFINITY;
  let barS3aIdx = Number.POSITIVE_INFINITY;
  const barVoll = land !== undefined && (!land.euEfta || p.wohnsitzAusland.nichtObligatorischVersichert);
  const hatPk = p.pk.guthaben > 0 || p.pk.sparbeitragJahr > 0 || p.pk.beitragModus === 'bvgMinimum';
  if (weg !== null && p.wohnsitzAusland.barauszahlung) {
    const bIdx = Math.max(weg, startIdx);
    if (!land)
      hinweise.push(
        'Barauszahlung beim Wegzug: bitte das Land wählen (EU/EFTA oder nicht) – bis dahin nicht gerechnet.',
      );
    else {
      if (bIdx < geburtIdx + pkStartMonate) barPkIdx = bIdx;
      else if (hatPk)
        hinweise.push(
          'Wegzug erst ab dem PK-Bezugsalter: keine Barauszahlung der Austrittsleistung, sondern Altersleistung gemäss Reglement (Art. 2 Abs. 1bis FZG).',
        );
      if (bIdx < geburtIdx + fzStartMonate && barVoll) barFzIdx = bIdx;
      if (bIdx < geburtIdx + s3aStartMonate) barS3aIdx = bIdx;
    }
  }
  if (stoppMonate < pkStartMonate && p.pk.guthaben > 0 && barPkIdx === Number.POSITIVE_INFINITY)
    hinweise.push(
      'Erwerbsaufgabe vor dem frühesten PK-Bezugsalter: Das Guthaben bleibt bis dahin gesperrt und wird weiter verzinst.',
    );

  return {
    p,
    geburtIdx,
    raMonate,
    stoppMonate,
    ahvStartIdx,
    ahvBasisMonat,
    ahvFaktor,
    zuschlagNominal,
    pkStartIdx: geburtIdx + pkStartMonate,
    s3aStartIdx: geburtIdx + s3aStartMonate,
    fzStartIdx: geburtIdx + fzStartMonate,
    s3aMax,
    auslandStartIdx: p.auslandRenten.map((r) => geburtIdx + Math.round(r.startAlter * 12)),
    wegIdx,
    fwAktiv,
    barPkIdx,
    barFzIdx,
    barS3aIdx,
    barVoll,
    land,
    info: {
      referenzalterMonate: raMonate,
      ahvStart: ausMonatIndex(ahvStartIdx),
      ahvFaktor,
      ahvRenteMonatStart: ahvBasisMonat * ahvFaktor,
      pkStart: ausMonatIndex(geburtIdx + pkStartMonate),
      pkRenteJahr: 0,
      pkKapital: 0,
      saeule3aStart: ausMonatIndex(geburtIdx + s3aStartMonate),
      saeule3aKapital: 0,
      freizuegigkeitStart: ausMonatIndex(geburtIdx + fzStartMonate),
      freizuegigkeitKapital: 0,
      wegzug: weg === null ? null : ausMonatIndex(weg),
      freiwilligeAhvAktiv: fwAktiv,
      ahvLueckenAusland: lueckenAusland,
      ahvLueckenFaktor: lueckenFaktor,
      freiwilligeAhvJahre: [],
      neBeitraegeJahre: [],
      barauszahlung: null,
      quellensteuerKapital: 0,
      hinweise,
    },
    t: startToepfe(p),
    pkBezogen: false,
    pkRenteNominal: 0,
    s3aBezogen: false,
    fzBezogen: false,
  };
}

const ENTNAHME_REIHENFOLGE = ['bargeld', 'wertschriften', 'sonstiges', 'wohneigentum'] as const;

/**
 * Entnimmt `betrag` aus den verfügbaren Töpfen aller Personen (Bargeld → Wertschriften →
 * Sonstiges → Wohneigentum). Gibt den nicht gedeckten Rest und ob Wohneigentum angetastet
 * wurde zurück.
 */
export function entnehme(toepfe: Toepfe[], betrag: number): { rest: number; wohneigentum: boolean } {
  let rest = betrag;
  let wohneigentum = false;
  for (const topf of ENTNAHME_REIHENFOLGE) {
    for (const t of toepfe) {
      if (rest <= 0) return { rest: 0, wohneigentum };
      const x = Math.min(Math.max(0, t[topf]), rest);
      if (x > 0) {
        t[topf] -= x;
        rest -= x;
        if (topf === 'wohneigentum') wohneigentum = true;
      }
    }
  }
  return { rest: Math.max(0, rest), wohneigentum };
}

export function simuliere(h: Haushalt, regeln: Regeln, opt: SimOptionen): SimulationsErgebnis {
  if (h.personen.length === 0) throw new Error('Mindestens eine Person erforderlich');
  const verheiratet = h.zivilstand === 'verheiratet' && h.personen.length >= 2;
  const a = h.annahmen;
  const modell = opt.renditeModell ?? deterministisch(a.renditeNominal, a.inflation);
  const kanton = kantonsModellFuer(h.steuern);
  /** Sitzkanton der Vorsorgeeinrichtung je Person (Quellensteuer) und dessen ordentliches Modell (Näherung) */
  const sitz = h.personen.map((p) => p.wohnsitzAusland.sitzkantonVorsorge || h.steuern.kanton);
  const sitzModell = sitz.map((k) =>
    k === h.steuern.kanton
      ? kanton
      : kantonsModellFuer({ ...h.steuern, kanton: k, gemeinde: '', kirche: 'keine', eigeneSaetze: false }),
  );
  const qstNaeherungGemeldet = h.personen.map(() => false);
  const startIdx = monatIndex(opt.start);
  const plaene = h.personen.map((p, i) =>
    planePerson(p, regeln, opt.stoppAlterMonate?.[i] ?? stoppAlterMonate(p), startIdx),
  );
  const refIdx = referenzPerson(h.personen);
  const ref = h.personen[refIdx] as Person;
  const endJahr = ref.geburtsjahr + Math.max(0, Math.floor(h.planungsalter));
  // Bezugsdaten in der Vergangenheit: Bezug frühestens im Startmonat
  for (const pl of plaene) {
    const ab = (idx: number) => ausMonatIndex(Math.max(idx, startIdx));
    pl.info.pkStart = ab(Math.min(pl.pkStartIdx, pl.barPkIdx));
    pl.info.saeule3aStart = ab(Math.min(pl.s3aStartIdx, pl.barS3aIdx));
    pl.info.freizuegigkeitStart = ab(Math.min(pl.fzStartIdx, pl.barFzIdx));
  }
  const beitr = regeln.beitraege;
  const ne = beitr.nichterwerbstaetige;
  const fw = beitr.freiwilligeAhv;
  const posten = h.posten ?? [];
  const ereignisse = h.ereignisse ?? [];
  const ereignisIdx = ereignisse.map((e) => {
    const p = h.personen[e.person] ?? ref;
    return geburtIndex(p) + Math.round(e.alter * 12);
  });

  let fehlbetrag = 0;
  let deflator = 1;
  let ruinJahr: number | null = null;
  let wohneigentumAngetastetJahr: number | null = null;
  const liquiditaetsluecken: number[] = [];
  const zeilen: JahresZeile[] = [];
  const n = plaene.length;
  const neu = () => new Array<number>(n).fill(0);
  const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

  for (let jahr = opt.start.jahr; jahr <= endJahr; jahr++) {
    const t = jahr - opt.start.jahr;
    const inflation = modell.inflation(t);
    const rNom = modell.renditeNominal(t);
    const real = (nominal: number) => (1 + nominal) / (1 + inflation) - 1;
    const rWert = real(rNom - a.kosten);
    const rBar = real(a.renditeBargeld);
    const ersterMonat = jahr === opt.start.jahr ? opt.start.monat : 1;
    const nMonate = 13 - ersterMonat;
    const wachstum = (r: number) => (1 + r) ** (nMonate / 12);

    // Anfangsbestände (für Vermögenssteuer und Vermögensertrag)
    const verfuegbarStart = sum(plaene.map((pl) => verfuegbar(pl.t))) - fehlbetrag;
    const finanzStart = sum(plaene.map((pl) => pl.t.bargeld + pl.t.wertschriften + pl.t.sonstiges));

    const lohn = neu();
    const ahv = neu();
    const zuschlag = neu();
    const pkRente = neu();
    const ausland = neu();
    const auslandSteuerbar = neu();
    const lohnCh = neu(); // Lohn bei Wohnsitz CH (obligatorische Lohnbeiträge)
    const neMonate = neu(); // obligatorische NE-Beitragspflicht (Wohnsitz CH)
    const fwNeMonate = neu(); // freiwillige AHV als Nichterwerbstätige
    const fwErwMonate = neu(); // freiwillige AHV als Erwerbstätige
    const fwLohn = neu(); // Erwerbseinkommen während der freiwilligen Versicherung
    const renteInPflicht = neu(); // massgebendes Renteneinkommen während der NE-Beitragspflicht
    const pkBeitragAN = neu();
    const s3aBeitrag = neu();
    const kapital = neu();
    const kapitalAusland = neu(); // Kapitalleistungen nach dem Wegzug (Quellensteuer)
    let weitereEinnahmen = 0;
    let weitereEinnahmenSteuerbar = 0;
    let weitereAusgaben = 0;
    let einmalig = 0;
    const ahvIndex = (1 + a.ahvAnpassungReal) ** t;

    for (let m = ersterMonat; m <= 12; m++) {
      const idx = jahr * 12 + (m - 1);
      if (idx < startIdx) continue;
      let basen = plaene.map((pl) => (idx >= pl.ahvStartIdx ? pl.ahvBasisMonat : 0));
      if (verheiratet && basen.length >= 2 && (basen[0] ?? 0) > 0 && (basen[1] ?? 0) > 0) {
        const [r1, r2] = ahvPlafonierung(basen[0] ?? 0, basen[1] ?? 0, regeln.ahv);
        basen = [r1, r2, ...basen.slice(2)];
      }
      const renteMonat = neu(); // Renteneinkommen dieses Monats (alle Renten ausser IV)
      const lohnMonat = neu();
      const pflicht = neu(); // 1 = NE obligatorisch, 2 = NE freiwillig
      plaene.forEach((pl, i) => {
        const p = pl.p;
        const alterM = idx - pl.geburtIdx;
        const erwerb = alterM >= 0 && alterM < pl.stoppMonate;
        const imAusland = idx >= pl.wegIdx;
        const lohnJahr = Math.max(0, p.lohn) * (1 + p.lohnwachstumReal) ** t;
        if (erwerb) {
          lohn[i] = (lohn[i] ?? 0) + lohnJahr / 12;
          lohnMonat[i] = lohnJahr / 12;
          if (!imAusland) lohnCh[i] = (lohnCh[i] ?? 0) + lohnJahr / 12;
          else if (pl.fwAktiv && alterM <= pl.raMonate) {
            fwLohn[i] = (fwLohn[i] ?? 0) + lohnJahr / 12;
            fwErwMonate[i] = (fwErwMonate[i] ?? 0) + 1;
          }
        }

        const bezug = (betrag: number) => {
          kapital[i] = (kapital[i] ?? 0) + betrag;
          if (imAusland) kapitalAusland[i] = (kapitalAusland[i] ?? 0) + betrag;
        };

        // Barauszahlung beim Wegzug (Austrittsleistung, 3a) – vor dem ordentlichen Bezug
        if (idx >= pl.barPkIdx || idx >= pl.barFzIdx || idx >= pl.barS3aIdx) {
          const bar = pl.info.barauszahlung ?? {
            monat: ausMonatIndex(idx),
            pk: 0,
            pkGesperrt: 0,
            anteilObligatorium: 0,
            freizuegigkeit: 0,
            saeule3a: 0,
            euEfta: pl.land?.euEfta ?? false,
            voll: pl.barVoll,
          };
          let geaendert = false;
          if (!pl.pkBezogen && idx >= pl.barPkIdx) {
            const anteil = pl.barVoll ? 0 : obligatoriumsAnteilBei(p, regeln, opt.start, jahr, a.inflation);
            const gesperrt = pl.t.pk * anteil;
            const frei = pl.t.pk - gesperrt;
            bezug(frei);
            if (gesperrt > 0) {
              if (pl.fzBezogen) bezug(gesperrt);
              else pl.t.freizuegigkeit += gesperrt;
            }
            bar.pk = frei;
            bar.pkGesperrt = gesperrt;
            bar.anteilObligatorium = anteil;
            pl.info.pkKapital = frei;
            pl.t.pk = 0;
            pl.pkBezogen = true;
            geaendert = true;
          }
          if (!pl.fzBezogen && idx >= pl.barFzIdx) {
            bar.freizuegigkeit = pl.t.freizuegigkeit;
            pl.info.freizuegigkeitKapital = pl.t.freizuegigkeit;
            bezug(pl.t.freizuegigkeit);
            pl.t.freizuegigkeit = 0;
            pl.fzBezogen = true;
            geaendert = true;
          }
          if (!pl.s3aBezogen && idx >= pl.barS3aIdx) {
            bar.saeule3a = pl.t.saeule3a;
            pl.info.saeule3aKapital = pl.t.saeule3a;
            bezug(pl.t.saeule3a);
            pl.t.saeule3a = 0;
            pl.s3aBezogen = true;
            geaendert = true;
          }
          if (geaendert) pl.info.barauszahlung = bar;
        }

        // Pensionskasse: gesperrt bis zum Bezugsalter; dann Rente/Kapital/Mix
        if (!pl.pkBezogen && idx >= pl.pkStartIdx) {
          const l = pkLeistung(pl.t.pk, p.pk.umwandlungssatz, p.pk.kapitalanteil);
          bezug(l.kapital);
          pl.pkRenteNominal = l.renteJahr * deflator;
          pl.info.pkRenteJahr = l.renteJahr;
          pl.info.pkKapital = l.kapital;
          pl.t.pk = 0;
          pl.pkBezogen = true;
        }
        if (!pl.pkBezogen) {
          pl.t.pk *= (1 + real(p.pk.zins)) ** (1 / 12);
          if (erwerb) {
            const beitrag =
              p.pk.beitragModus === 'eingabe'
                ? (Math.max(0, p.pk.sparbeitragJahr) * (1 + p.lohnwachstumReal) ** t) / 12
                : bvgAltersgutschrift(lohnJahr, jahr - p.geburtsjahr, Math.floor(pl.raMonate / 12), regeln.bvg) / 12;
            pl.t.pk += beitrag;
            pkBeitragAN[i] = (pkBeitragAN[i] ?? 0) + beitrag * p.pk.anteilArbeitnehmer;
          }
        }
        if (pl.pkBezogen) {
          pkRente[i] = (pkRente[i] ?? 0) + pl.pkRenteNominal / deflator / 12;
          renteMonat[i] = (renteMonat[i] ?? 0) + pl.pkRenteNominal / deflator / 12;
        }

        // Freizügigkeit: gesperrt bis RA−5 (bzw. Erwerbsaufgabe), Bezug als Kapital
        if (!pl.fzBezogen && idx >= pl.fzStartIdx) {
          bezug(pl.t.freizuegigkeit);
          pl.info.freizuegigkeitKapital = pl.t.freizuegigkeit;
          pl.t.freizuegigkeit = 0;
          pl.fzBezogen = true;
        }
        if (!pl.fzBezogen) pl.t.freizuegigkeit *= (1 + real(p.freizuegigkeit.zins)) ** (1 / 12);

        // Säule 3a: gesperrt bis RA−5 (bzw. Erwerbsaufgabe), spätestens RA (+5 bei Erwerb)
        if (!pl.s3aBezogen && idx >= pl.s3aStartIdx) {
          bezug(pl.t.saeule3a);
          pl.info.saeule3aKapital = pl.t.saeule3a;
          pl.t.saeule3a = 0;
          pl.s3aBezogen = true;
        }
        if (!pl.s3aBezogen) {
          pl.t.saeule3a *= (1 + real(p.saeule3a.rendite)) ** (1 / 12);
          if (erwerb) {
            const c = Math.min(Math.max(0, p.saeule3a.beitragJahr), pl.s3aMax) / 12;
            pl.t.saeule3a += c;
            s3aBeitrag[i] = (s3aBeitrag[i] ?? 0) + c;
          }
        }

        // AHV
        const basis = basen[i] ?? 0;
        if (basis > 0) {
          const ahvMonat = basis * pl.ahvFaktor * ahvIndex;
          ahv[i] = (ahv[i] ?? 0) + ahvMonat;
          zuschlag[i] = (zuschlag[i] ?? 0) + pl.zuschlagNominal / deflator;
          // AHV-Rente (inkl. anteilige 13. Rente und Rentenzuschlag) zählt zum Renteneinkommen (MB 2.03 Ziff. 6)
          renteMonat[i] =
            (renteMonat[i] ?? 0) + ahvMonat + ahv13(ahvMonat, jahr, regeln.ahv) + pl.zuschlagNominal / deflator;
        }

        // Ausländische Renten
        p.auslandRenten.forEach((r, k) => {
          if (idx >= (pl.auslandStartIdx[k] ?? Number.POSITIVE_INFINITY)) {
            const v = auslandRenteRealJahr(r, t, deflator) / 12;
            ausland[i] = (ausland[i] ?? 0) + auslandRenteNetto(v, r);
            renteMonat[i] = (renteMonat[i] ?? 0) + v;
            if (r.steuerbarInCh) auslandSteuerbar[i] = (auslandSteuerbar[i] ?? 0) + v;
          }
        });

        // NE-Beitragspflicht: nach Erwerbsaufgabe bis Ende des Monats, in dem das RA erreicht wird.
        // Wohnsitz CH: obligatorisch; im Ausland nur mit freiwilliger AHV (sonst Beitragslücke).
        if (!erwerb && alterM >= 240 && alterM <= pl.raMonate) {
          if (!imAusland) {
            neMonate[i] = (neMonate[i] ?? 0) + 1;
            pflicht[i] = 1;
          } else if (pl.fwAktiv) {
            fwNeMonate[i] = (fwNeMonate[i] ?? 0) + 1;
            pflicht[i] = 2;
          }
        }
      });
      // Massgebendes Renteneinkommen der beitragspflichtigen Monate (Ehepaare: beide Ehegatten;
      // freiwillige AHV: zusätzlich Erwerbseinkommen des nicht versicherten Ehegatten, WFV Rz 4026)
      plaene.forEach((_pl, i) => {
        if (!pflicht[i]) return;
        let r = renteMonat[i] ?? 0;
        if (verheiratet) {
          r = sum(renteMonat);
          if (pflicht[i] === 2)
            plaene.forEach((pj, j) => {
              if (j !== i && idx >= pj.wegIdx && !pj.fwAktiv) r += lohnMonat[j] ?? 0;
            });
        }
        renteInPflicht[i] = (renteInPflicht[i] ?? 0) + r;
      });

      // Weitere wiederkehrende Posten
      for (const po of posten) {
        const p = h.personen[po.person] ?? ref;
        const alterM = idx - geburtIndex(p);
        const endeM = po.endAlter === null ? Number.POSITIVE_INFINITY : Math.round(po.endAlter * 12);
        if (alterM < Math.round(po.startAlter * 12) || alterM >= endeM) continue;
        const v = realerBetrag(Math.max(0, po.betragJahr), po.indexierung, t, deflator) / 12;
        if (po.art === 'einnahme') {
          weitereEinnahmen += v;
          if (po.steuerbar) weitereEinnahmenSteuerbar += v;
        } else weitereAusgaben += v;
      }
      // Einmalige Ereignisse
      ereignisse.forEach((e, k) => {
        if (ereignisIdx[k] === idx) einmalig += e.betrag;
      });
    }

    // Lohnbeiträge nur bei Wohnsitz/Erwerb in der Schweiz
    const sozial = lohnCh.map(
      (l) => l * beitr.ahvIvEoSatzArbeitnehmer + Math.min(l, beitr.alvHoechstlohn) * beitr.alvSatzArbeitnehmer,
    );
    const ahv13Betrag = ahv.map((x) => ahv13(x, jahr, regeln.ahv));
    const ertrag = Math.max(0, finanzStart - fehlbetrag) * a.steuerbarerErtrag;

    // Steuerbares Einkommen pro Person (vereinfachte Abzüge)
    const steuerbar = plaene.map(
      (_, i) =>
        (lohn[i] ?? 0) -
        (sozial[i] ?? 0) -
        (pkBeitragAN[i] ?? 0) -
        (s3aBeitrag[i] ?? 0) +
        ((ahv[i] ?? 0) + (ahv13Betrag[i] ?? 0) + (zuschlag[i] ?? 0) + (pkRente[i] ?? 0)) *
          regeln.steuern.rentenSteuerbarAnteil +
        (auslandSteuerbar[i] ?? 0) +
        (ertrag + weitereEinnahmenSteuerbar) / n,
    );
    let steuernEinkommen = 0;
    let steuernKapital = 0;
    const kapitalTotal = sum(kapital);
    // Kapitalleistungen vor dem Wegzug: ordentliche Kapitalleistungssteuer (Wohnkanton)
    const kapitalCh = kapital.map((k, i) => Math.max(0, k - (kapitalAusland[i] ?? 0)));
    const zs = verheiratet ? 'verheiratet' : 'alleinstehend';
    if (verheiratet) {
      const s = Math.max(0, sum(steuerbar));
      steuernEinkommen = dbgEinkommen(s, 'verheiratet', regeln.steuern) + kanton.einkommenssteuer(s, 'verheiratet');
      const kCh = sum(kapitalCh);
      if (kCh > 0)
        steuernKapital =
          dbgKapital(kCh, 'verheiratet', regeln.steuern) + kanton.kapitalleistungssteuer(kCh, 'verheiratet');
    } else {
      steuerbar.forEach((s0, i) => {
        const s = Math.max(0, s0);
        steuernEinkommen +=
          dbgEinkommen(s, 'alleinstehend', regeln.steuern) + kanton.einkommenssteuer(s, 'alleinstehend');
        const k = kapitalCh[i] ?? 0;
        if (k > 0)
          steuernKapital +=
            dbgKapital(k, 'alleinstehend', regeln.steuern) + kanton.kapitalleistungssteuer(k, 'alleinstehend');
      });
    }
    // Kapitalleistungen nach dem Wegzug: Schweizer Quellensteuer je Empfänger (Sitzkanton der Einrichtung)
    plaene.forEach((pl, i) => {
      const k = kapitalAusland[i] ?? 0;
      if (!(k > 0)) return;
      const q = quellensteuerKapital(k, zs, sitz[i] ?? '', regeln, sitzModell[i]);
      steuernKapital += q.total;
      pl.info.quellensteuerKapital += q.total;
      if (!qstNaeherungGemeldet[i]) {
        qstNaeherungGemeldet[i] = true;
        const kName = q.kantonCode || 'unbekannt';
        pl.info.hinweise.push(
          `Kapitalleistungen nach dem Wegzug: Schweizer Quellensteuer (Bund nach Art. 95/96 DBG und QStV-Tarif + Sitzkanton ${kName} der Vorsorgeeinrichtung${q.naeherung ? ', Kantonsteil als Näherung' : ''}) statt der Kapitalleistungssteuer des Wohnkantons.${pl.land?.pkKapitalCh ? ` ${pl.land.name}: ${pl.land.pkKapitalCh} (ESTV 2-217, Stand 1.1.2026).` : ''} Eine Rückforderung gemäss DBA und Steuern im Wohnsitzstaat sind nicht abgebildet.`,
        );
      }
    });
    // Vermögenssteuer auf dem verfügbaren Vermögen inkl. Nettowert Wohneigentum (Verkehrswert).
    // TODO(kantone): kantonaler Steuerwert der Liegenschaft (meist unter Verkehrswert) und
    // Schuldenabzug gemäss Kantonsmodell, sobald tarifbasierte Kantonsdaten vorliegen.
    const steuernVermoegen =
      (kanton.vermoegenssteuer(Math.max(0, verfuegbarStart), verheiratet ? 'verheiratet' : 'alleinstehend') * nMonate) /
      12;

    // Ausgaben nach Alter der Referenzperson
    const refAlter = jahr - ref.geburtsjahr;
    const faktor = refAlter >= 85 ? h.ausgaben.faktorAb85 : refAlter >= 75 ? h.ausgaben.faktorAb75 : 1;
    const lebenshaltung = (Math.max(0, h.ausgaben.lebenshaltung) * faktor * nMonate) / 12;
    const ausgaben = lebenshaltung + weitereAusgaben;

    const lohnTotal = sum(lohn);
    const ahvTotal = sum(ahv) + sum(ahv13Betrag) + sum(zuschlag);
    const sozialTotal = sum(sozial);
    const vorsorgeBeitraege = sum(pkBeitragAN) + sum(s3aBeitrag);
    const einnahmen =
      lohnTotal - sozialTotal - vorsorgeBeitraege + ahvTotal + sum(pkRente) + sum(ausland) + weitereEinnahmen;
    const saldoOhneAhvBeitraege =
      einnahmen - (steuernEinkommen + steuernKapital + steuernVermoegen + ausgaben) + einmalig;

    // Rendite auf den Anfangsbeständen der verfügbaren Töpfe
    for (const pl of plaene) {
      pl.t.bargeld *= wachstum(rBar);
      pl.t.wertschriften *= wachstum(rWert);
      pl.t.wohneigentum *= pl.t.wohneigentum > 0 ? wachstum(rWert) : 1;
      pl.t.sonstiges *= wachstum(real(pl.p.sonstiges.rendite));
    }
    // Kapitalbezüge fliessen in die Wertschriften der jeweiligen Person
    plaene.forEach((pl, i) => {
      pl.t.wertschriften += kapital[i] ?? 0;
    });

    // AHV-Beiträge als Nichterwerbstätige (obligatorisch bzw. freiwillig) und freiwillige
    // Beiträge Erwerbstätiger. Vermögen: Schätzung für den 31.12. – verfügbare Töpfe nach
    // Rendite und Kapitalbezügen des Jahres zuzüglich Jahressaldo (ohne diese Beiträge);
    // noch gesperrte PK/FZ/3a zählen nicht (MB 2.03 Ziff. 5). Ehepaare: eheliches Vermögen.
    const vermoegenStichtag = Math.max(
      0,
      sum(plaene.map((pl) => verfuegbar(pl.t))) + saldoOhneAhvBeitraege - fehlbetrag,
    );
    let neBeitraege = 0;
    let fwBeitraege = 0;
    plaene.forEach((pl, i) => {
      const mNe = neMonate[i] ?? 0;
      const mFw = fwNeMonate[i] ?? 0;
      let neI = 0;
      let fwI = 0;
      if (mNe + mFw > 0) {
        let befreitNe = false;
        let befreitFw = false;
        if (verheiratet) {
          const j = plaene.findIndex((_, k) => k !== i);
          const obligatorischEhegatte = (lohnCh[j] ?? 0) * beitr.ahvIvEoSatzTotal;
          befreitNe = neBefreitDurchEhegatte(lohnCh[j] ?? 0, beitr.ahvIvEoSatzTotal, ne);
          befreitFw = fwBefreitDurchEhegatte((fwLohn[j] ?? 0) * fw.satzErwerbstaetige, obligatorischEhegatte, fw);
        }
        // Renteneinkommen der beitragspflichtigen Monate; bei Pflicht unter einem Jahr aufs Jahr umgerechnet (Art. 29 AHVV)
        const rentenJahr = ((renteInPflicht[i] ?? 0) * 12) / (mNe + mFw);
        if (mNe > 0 && !befreitNe)
          neI = (neBeitrag(vermoegenStichtag, rentenJahr, verheiratet, a.neVerwaltungskosten, ne) * mNe) / 12;
        if (mFw > 0 && !befreitFw)
          fwI = (fwBeitragNichterwerbstaetig(vermoegenStichtag, rentenJahr, verheiratet, fw) * mFw) / 12;
      }
      const mErw = fwErwMonate[i] ?? 0;
      if (mErw > 0) fwI += (fwBeitragErwerbstaetig(((fwLohn[i] ?? 0) * 12) / mErw, fw) * mErw) / 12;
      if (neI > 0) pl.info.neBeitraegeJahre.push({ jahr, betrag: neI });
      if (fwI > 0) pl.info.freiwilligeAhvJahre.push({ jahr, betrag: fwI });
      neBeitraege += neI;
      fwBeitraege += fwI;
    });
    const saldo = saldoOhneAhvBeitraege - neBeitraege - fwBeitraege;

    // Saldo: Überschuss tilgt zuerst einen Fehlbetrag und wird dann angelegt; Defizit aus verfügbaren Töpfen
    let angetastet = false;
    const toepfe = plaene.map((pl) => pl.t);
    if (saldo >= 0) {
      const tilgung = Math.min(fehlbetrag, saldo);
      fehlbetrag -= tilgung;
      const rest = saldo - tilgung;
      for (const pl of plaene) pl.t.wertschriften += rest / n;
    } else {
      const r = entnehme(toepfe, -saldo);
      angetastet = r.wohneigentum;
      fehlbetrag += r.rest;
    }
    // Fehlbetrag aus nachträglich verfügbaren Mitteln (z.B. Kapitalbezug) decken
    if (fehlbetrag > 0) {
      const r = entnehme(toepfe, fehlbetrag);
      angetastet = angetastet || r.wohneigentum;
      fehlbetrag = r.rest;
    }
    if (angetastet && wohneigentumAngetastetJahr === null) wohneigentumAngetastetJahr = jahr;

    const proPerson = plaene.map((pl) => ({ ...pl.t }));
    const summe = summeToepfe(proPerson);
    const verf = verfuegbar(summe);
    const geb = gebunden(summe);
    const luecke = fehlbetrag > 0.5 && geb > 0;
    if (fehlbetrag > 0.5 && ruinJahr === null) ruinJahr = jahr;
    if (luecke) liquiditaetsluecken.push(jahr);

    zeilen.push({
      jahr,
      alter: h.personen.map((p) => jahr - p.geburtsjahr),
      lohn: lohnTotal,
      ahv: ahvTotal,
      pkRente: sum(pkRente),
      auslandRenten: sum(ausland),
      weitereEinnahmen,
      einmalig,
      kapitalBezuege: kapitalTotal,
      sozialabgaben: sozialTotal,
      neBeitraege,
      freiwilligeAhv: fwBeitraege,
      steuernEinkommen,
      steuernKapital,
      steuernVermoegen,
      ausgaben,
      sparbeitraegeVorsorge: vorsorgeBeitraege,
      saldo,
      toepfe: summe,
      toepfeProPerson: proPerson,
      verfuegbar: verf,
      gebunden: geb,
      fehlbetrag,
      vermoegen: verf - fehlbetrag,
      total: verf + geb - fehlbetrag,
      liquiditaetsluecke: luecke,
      wohneigentumAngetastet: angetastet,
      pkGuthaben: summe.pk,
      saeule3aGuthaben: summe.saeule3a,
    });
    deflator *= 1 + inflation;
  }

  const letzte = zeilen.at(-1);
  return {
    zeilen,
    erfolg: ruinJahr === null,
    ruinJahr,
    ruinAlter: ruinJahr === null ? null : ruinJahr - ref.geburtsjahr,
    endVermoegen: letzte ? letzte.vermoegen : startvermoegen(h),
    liquiditaetsluecken,
    wohneigentumAngetastetJahr,
    personen: plaene.map((pl) => pl.info),
  };
}
