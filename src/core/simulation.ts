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
 *   ist im neuen Land nicht obligatorisch versichert (Liechtenstein: immer gesperrt, Art. 25f Abs. 1
 *   lit. c FZG); Freizügigkeitsguthaben bleibt dann ganz gesperrt (Anteil unbekannt).
 *   Kapitalleistungen nach dem Wegzug: Schweizer Quellensteuer (Bund + Sitzkanton der
 *   Vorsorgeeinrichtung, core/quellensteuer.ts) statt der ordentlichen Kapitalleistungssteuer;
 *   optional Rückforderung gemäss DBA mit Steuer im Zielland.
 * - Steuern nach dem Wegzug: Schweizer Einkommens- und Vermögenssteuer nur für die Monate mit
 *   Wohnsitz CH (Paare: solange eine Person in der Schweiz wohnt); danach Steuern des Ziellands
 *   (core/zielland.ts, data/laender-2026.json) bzw. ein eigener effektiver Satz, plus Schweizer
 *   Quellensteuer auf PK-Renten, wo ESTV 2-217 sie vorsieht. Ohne Steuermodell und ohne eigenen
 *   Satz wird weiter mit Schweizer Steuern gerechnet (Näherung). Im Wegzugsjahr anteilig nach Monaten.
 *   Eine Liegenschaft in der Schweiz bleibt im Kanton steuerpflichtig (Art. 4 Abs. 1 StHG; § 4 Abs. 1
 *   lit. b, §§ 5–6 StG ZH): Vermögenssteuer auf dem Nettowert zum Satz des gesamten Vermögens.
 * - Wohneigentum (Schema 7): Verkehrswert und Hypothek getrennt; die Wertänderung wirkt auf den
 *   Verkehrswert (Hebel). Ohne separate Wohnkosten wächst die Hypothek mit der normalen Wohnrendite
 *   (pauschale Finanzierungskosten, ohne Krise identisch zur früheren Rechnung Nettowert × Rendite).
 *   Mit separaten Wohnkosten: Hypothek nominal fix, Hypothekarzins und Unterhalt als Ausgaben, Miete
 *   (Mieter bzw. nach dem Verkauf, bis zum Wegzug), Eigenmietwert bis Ende 2028, Vermietung nach dem
 *   Wegzug. Verkauf mit Grundstückgewinnsteuer (core/grundstueckgewinn.ts) am Ende des Verkaufsjahres.
 * - Erstes Jahr ab dem Startmonat (Teiljahr): Einkommenssteuern (Schweiz und Zielland) nach dem Tarif
 *   des auf zwölf Monate hochgerechneten Einkommens, davon der Anteil der simulierten Monate;
 *   Vermögensertrag und Vermögenssteuer ebenfalls nur für diese Monate.
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
import { lebenshaltungImJahr } from './ausgaben';
import { auslandRenteNetto, auslandRenteRealJahr } from './auslandRenten';
import { bvgAltersgutschrift, pkLeistung } from './bvg';
import {
  fwBefreitDurchEhegatte,
  fwBeitragErwerbstaetig,
  fwBeitragNichterwerbstaetig,
  pruefeFreiwilligeAhv,
} from './freiwilligeAhv';
import { grundstueckgewinnsteuer } from './grundstueckgewinn';
import { realerBetrag } from './indexierung';
import { ausgleichHorizont, type KrisenOptionen, krisenModell, krisenPlan } from './krisen';
import { neBefreitDurchEhegatte, neBeitrag } from './neBeitrag';
import { quellensteuerKapital, quellensteuerRenteSatz } from './quellensteuer';
import { deterministisch, type RenditeModell } from './renditen';
import { obligatoriumsAnteilBei } from './schaetzwerte';
import { dbgEinkommen, dbgKapital } from './steuern';
import {
  ahvHinterlassenenAnspruch,
  bvgEhegattenAnspruch,
  hinterlassenenrenteHoeher,
  mitVerwitwetenzuschlag,
  pkEhegattenrenteJahr,
  pkInvalidenrenteJahr,
  todeszeitpunkt,
  witwenrenteMonat,
} from './todesfall';
import type {
  Haushalt,
  JahresZeile,
  Monat,
  Person,
  PersonInfo,
  PkWegzugStatus,
  SimulationsErgebnis,
  Staffelung,
  Todesfall,
  TodesfallInfo,
  Toepfe,
} from './typen';
import { geburtIndex, stoppAlterMonate, wegzugIndex } from './zeitpunkt';
import { type ZiellandEinkommen, ziellandKurz, ziellandSteuer } from './zielland';

export { geburtIndex } from './zeitpunkt';

export interface SimOptionen {
  /** Erster simulierter Monat (z.B. aktueller Monat) */
  start: Monat;
  renditeModell?: RenditeModell;
  /**
   * Krisenszenario (hat Vorrang vor `renditeModell`): «X Jahre nach dem Rücktritt» bezieht sich
   * auf das Stopp-Alter der ersten erwerbstätigen Person in dieser Simulation (auch im Solver).
   */
  krisen?: KrisenOptionen;
  /** Überschreibt das Stopp-Alter pro Person (in Monaten), z.B. für den Solver */
  stoppAlterMonate?: readonly (number | undefined)[];
  /**
   * Todesfall-Szenario (Schema 9): Eine Person eines Ehepaars stirbt. Wirkt nur, wenn hier übergeben
   * (die Einstellung im Haushalt allein ändert keine Rechnung). Siehe core/todesfall.ts.
   */
  todesfall?: Todesfall;
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
  /** Wohneigentum: Verkaufsmonat (Infinity = kein Verkauf), Beginn der Besitzdauer */
  verkaufIdx: number;
  kaufIdx: number;
  // laufender Zustand
  t: Toepfe;
  /** Verkehrswert und Hypothek (reale CHF); Nettowert = t.wohneigentum */
  wWert: number;
  hypo: number;
  pkBezogen: boolean;
  pkRenteNominal: number;
  /** PK-Ehegattenrente aus dem Todesfall der Partnerin/des Partners (nominal pro Jahr, fix) */
  pkHinterNominal: number;
  /** Todesfall: AHV-Witwen-/Witwerrente (Monat, vor Indexierung; 0 = kein Anspruch) und Altersrente nach dem Tod (Basis) */
  witweMonat: number;
  alterNachTodBasis: number;
  s3aBezogen: boolean;
  fzBezogen: boolean;
  /** Staffelung (Schema 11): Anzahl Bezüge und bisher erfolgte Bezüge je Quelle; 1 = ein einziger Bezug */
  s3aSchritte: number;
  s3aSchritt: number;
  fzSchritte: number;
  fzSchritt: number;
  pkSchritte: number;
  pkSchritt: number;
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
 * Nettowert Wohneigentum (Verkehrswert − Hypothek).
 */
export function startvermoegen(h: Haushalt): number {
  return h.personen.reduce((s, p) => s + verfuegbar(startToepfe(p)), 0);
}

/** Töpfe aller Personen zu Beginn der Rechnung (Startbestand für die Aufstellung der Zu- und Abflüsse). */
export function startToepfeHaushalt(h: Haushalt): Toepfe {
  return summeToepfe(h.personen.map(startToepfe));
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
 * PK und Wegzug: Welcher Fall tritt ein (gleiche Entscheidung wie in der Simulation)? Barauszahlung der
 * Austrittsleistung nur, wenn der Wegzug (frühestens heute) vor dem PK-Bezugsalter liegt; sonst Altersleistung
 * nach Reglement (Art. 2 Abs. 1bis FZG). EU/EFTA: nur das Überobligatorium bar, ausser nicht obligatorisch versichert
 * (Art. 25f FZG); Länder mit `obligatoriumImmerGesperrt` (z.B. Liechtenstein) immer nur das Überobligatorium.
 */
export function pkWegzugStatus(p: Person, stoppMonate: number, regeln: Regeln, startIdx: number): PkWegzugStatus {
  const b = regeln.bvg.bezugsalter;
  const geburtIdx = geburtIndex(p);
  const weg = wegzugIndex(p);
  const land = weg !== null ? wegzugsLand(p.wohnsitzAusland.land) : undefined;
  const bezugMonate = pkBezugMonate(p, stoppMonate, regeln);
  const wegzugMonate = weg === null ? null : Math.max(weg, startIdx) - geburtIdx;
  const barVoll =
    land !== undefined &&
    !land.obligatoriumImmerGesperrt &&
    (!land.euEfta || p.wohnsitzAusland.nichtObligatorischVersichert);
  let fall: PkWegzugStatus['fall'];
  if (wegzugMonate === null) fall = 'ohneWegzug';
  else if (!p.wohnsitzAusland.barauszahlung) fall = 'ohneBarauszahlung';
  else if (!land) fall = 'landFehlt';
  else fall = wegzugMonate < bezugMonate ? 'barauszahlung' : 'pensionierung';
  // Mit dem tiefsten erlaubten Reglementsalter ist das PK-Bezugsalter am tiefsten: Liegt der Wegzug auch dann
  // davor, erfolgt die Barauszahlung bei jedem Reglementsalter.
  const tiefsterBezug = pkBezugMonate(
    { ...p, pk: { ...p.pk, fruehestesAlter: b.reglementFruehestens } },
    stoppMonate,
    regeln,
  );
  const feldOhneWirkung = fall === 'barauszahlung' && wegzugMonate !== null && wegzugMonate < tiefsterBezug;
  return {
    fall,
    stoppMonate,
    fruehestesMonate: Math.min(Math.max(p.pk.fruehestesAlter, b.reglementFruehestens), b.aufschubBis) * 12,
    bezugMonate,
    wegzugMonate,
    barVoll,
    euEfta: land?.euEfta ?? false,
    feldOhneWirkung,
    grenzeReglementsalter: wegzugMonate === null ? b.reglementFruehestens : Math.floor(wegzugMonate / 12),
  };
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

/**
 * Zeitplan einer gestaffelten Auszahlung (Monate ab Geburt): bis zu `n` Bezüge im Abstand von 12 Monaten ab dem ersten
 * Bezug. Der ordentliche Bezugszeitpunkt `s0` bleibt der erste Bezug, soweit das Fenster nach hinten (bis `spaet`)
 * reicht; fehlt dort der Platz, beginnt die Staffelung früher (frühestens `frueh` und nicht vor `minErster`).
 * Der erste Bezug wird nach Möglichkeit in ein Jahr gelegt, in dem keine andere Kapitalleistung anfällt (`besetzt`), weil
 * Leistungen desselben Jahres zusammengerechnet werden. Gibt Anzahl und ersten Monat zurück; bei `n` ≤ 1 ein einziger
 * Bezug bei `s0`.
 */
export function staffelZeitplan(
  s0: number,
  frueh: number,
  spaet: number,
  n: number,
  minErster = Number.NEGATIVE_INFINITY,
  /** Kalenderjahre, in denen schon andere Kapitalleistungen anfallen (nach Möglichkeit meiden) */
  besetzt: readonly number[] = [],
  geburtIdx = 0,
): { anzahl: number; erster: number } {
  if (!(n > 1)) return { anzahl: 1, erster: s0 };
  // zuerst nach hinten (später bezahlen, Geld bleibt gebunden und wächst), dann nach vorne im erlaubten Fenster
  const vor = Math.min(n - 1, Math.max(0, Math.floor((spaet - s0) / 12)));
  const zurueck = Math.min(n - 1 - vor, Math.max(0, Math.floor((s0 - Math.max(frueh, minErster)) / 12)));
  const anzahl = 1 + vor + zurueck;
  let erster = s0 - 12 * zurueck;
  // Erster Bezug nicht im Jahr einer anderen grossen Kapitalleistung, wenn dahinter noch Platz ist
  while (besetzt.includes(Math.floor((geburtIdx + erster) / 12)) && erster + 12 * anzahl <= spaet) erster += 12;
  return { anzahl, erster };
}

function planePerson(p: Person, regeln: Regeln, stoppMonate: number, startIdx: number, stf?: Staffelung): PersonPlan {
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
        'Staatsangehörigkeit «andere»: Ob die AHV-Rente bei Wohnsitz im Ausland ausbezahlt wird, hängt vom Heimatstaat ab. Für Staatsangehörige eines Staates mit Sozialversicherungsabkommen (z.B. Brasilien, USA, Türkiye; Liste der ZAS) gilt das Abkommen, bei den übrigen Staaten kann anstelle der Rente die Rückvergütung der Beiträge treten. Die Rechnung geht von der Auszahlung aus. Bitte bei der Zentralen Ausgleichsstelle (zas.admin.ch) prüfen.',
      );
    if (stoppMonate > wegIdx - geburtIdx)
      hinweise.push(
        'Erwerbstätigkeit nach dem Wegzug: keine Schweizer Lohnabzüge mehr; ausländische Sozialabgaben sind nicht abgebildet.',
      );
    const lw = wegzugsLand(p.wohnsitzAusland.land);
    const eigener = p.wohnsitzAusland.steuerSatzZielland;
    const ausserHaus = wohneigentumNetto(p) > 0 ? ' (ausser auf der Liegenschaft in der Schweiz)' : '';
    if (eigener !== null)
      hinweise.push(
        `Steuern nach dem Wegzug: eigener effektiver Satz von ${Math.round(eigener * 1000) / 10}% auf alle Einkünfte im Zielland (ersetzt das Ländermodell); keine Schweizer Einkommens- und Vermögenssteuer mehr${ausserHaus}.`,
      );
    else if (lw?.steuern)
      hinweise.push(
        `Steuern nach dem Wegzug: keine Schweizer Einkommens- und Vermögenssteuer mehr${ausserHaus}; ${lw.name}: ${ziellandKurz(lw.steuern)}${lw.steuern.status === 'verifiziert' ? '' : ' (Näherung, Details und Quellen unter «Wegzug»)'}.`,
      );
    if ((eigener !== null || lw?.steuern) && wohneigentumNetto(p) > 0)
      hinweise.push(
        'Liegenschaft in der Schweiz nach dem Wegzug: Sie bleibt im Kanton steuerpflichtig (Art. 4 Abs. 1 StHG; § 4 Abs. 1 lit. b, § 5 Abs. 2 StG ZH). Gerechnet wird die Vermögenssteuer des Wohnkantons auf dem Nettowert, zum Satz des gesamten Vermögens (§ 6 StG ZH). Mieteinnahmen nur mit «Wohnkosten separat rechnen» und «vermietet». Nicht abgebildet: Steuerwert unter dem Verkehrswert, Aufteilung der Schulden nach Lage der Aktiven, eine allfällige Steuer im Zielland auf der Liegenschaft.',
      );
    if (eigener === null && !lw?.steuern)
      hinweise.push(
        'Steuern nach dem Wegzug: Für dieses Land ist kein Steuermodell hinterlegt – es wird weiterhin mit Schweizer Steuern gerechnet (Näherung). Besser: einen eigenen effektiven Steuersatz im Zielland erfassen.',
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
  // Staffelung der Kapitalbezüge (Schema 11): nur ohne Wegzug (mit Wegzug gilt die Quellensteuer)
  let s3aSchritte = 1;
  let fzSchritte = 1;
  let pkSchritte = 1;
  let s3aErster = s3aStartMonate;
  let fzErster = fzStartMonate;
  if (stf && wegzugIndex(p) === null) {
    const n = Math.min(10, Math.max(1, Math.round(stf.jahre)));
    const jetzt = startIdx - geburtIndex(p);
    // Jahr eines einmaligen PK-Kapitalbezugs (ohne eigene Staffelung des PK-Kapitals)
    const pkKapitalJahr =
      p.pk.guthaben > 0 && p.pk.kapitalanteil > 0 && !stf.pk ? [Math.floor((geburtIdx + pkStartMonate) / 12)] : [];
    if (stf.s3a && (p.saeule3a.guthaben > 0 || p.saeule3a.beitragJahr > 0)) {
      const z = staffelZeitplan(
        s3aStartMonate,
        raMonate - b3a.fruehestensJahreVorRA * 12,
        raMonate + (stoppMonate > raMonate ? Math.min(stoppMonate - raMonate, b3a.aufschubJahreNachRA * 12) : 0),
        n,
        jetzt,
        pkKapitalJahr,
        geburtIdx,
      );
      s3aSchritte = z.anzahl;
      s3aErster = z.erster;
      if (z.anzahl < n)
        hinweise.push(
          `Staffelung 3a: Im zulässigen Bezugsfenster (5 Jahre vor bis zum Referenzalter, mit Erwerbstätigkeit bis 5 Jahre danach) haben nur ${z.anzahl} jährliche Bezüge Platz statt ${n}.`,
        );
    }
    if (stf.fz && p.freizuegigkeit.guthaben > 0) {
      const nFz = Math.min(n, regeln.bvg.freizuegigkeitMaxEinrichtungen);
      const z = staffelZeitplan(
        fzStartMonate,
        raMonate - bfz.fruehestensJahreVorRA * 12,
        raMonate + (stoppMonate > raMonate ? Math.min(stoppMonate - raMonate, bfz.aufschubJahreNachRA * 12) : 0),
        nFz,
        jetzt,
        [...pkKapitalJahr, ...(s3aSchritte > 1 ? [Math.floor((geburtIdx + s3aErster) / 12)] : [])],
        geburtIdx,
      );
      fzSchritte = z.anzahl;
      fzErster = z.erster;
      if (n > nFz)
        hinweise.push(
          `Staffelung Freizügigkeit: höchstens ${nFz} Einrichtungen (Art. 12 Abs. 1 FZV), daher höchstens ${nFz} Bezüge.`,
        );
    }
    if (stf.pk && p.pk.kapitalanteil > 0) {
      pkSchritte = Math.min(n, regeln.bvg.teilbezugMaxSchritte);
      if (n > pkSchritte)
        hinweise.push(
          `Staffelung PK: Kapital in höchstens ${pkSchritte} Schritten (Art. 13a Abs. 2 BVG); ein Schritt = alle Kapitalbezüge eines Kalenderjahres.`,
        );
      if (pkSchritte > 1)
        hinweise.push(
          'Staffelung PK-Kapital (Teilpensionierung, Art. 13a/13b BVG): Die Steuerbehörden erkennen getrennte Bezüge nur an, wenn der Lohn dauerhaft reduziert wird, zwischen den Schritten mindestens ein Jahr liegt und der erste Schritt mindestens 20 % beträgt (z.B. Kanton Bern, Basel-Landschaft); ohne Lohnreduktion droht die Zusammenrechnung als Steuerumgehung. Dieser Teil ist im Plan nur so gerechnet, wie es das Reglement der Pensionskasse zulässt (bitte prüfen).',
        );
    }
    if (s3aSchritte > 1)
      hinweise.push(
        `Staffelung 3a: ${s3aSchritte} jährliche Bezüge setzen mindestens ${s3aSchritte} getrennte 3a-Konten oder -Depots voraus; jedes Konto wird ganz aufgelöst, ein nachträgliches Aufteilen ist nicht zulässig (StB SG 52 Nr. 3). Einzelne Kantone können die Staffelung im Einzelfall als Steuerumgehung würdigen.`,
      );
    if (fzSchritte > 1)
      hinweise.push(
        `Staffelung Freizügigkeit: ${fzSchritte} Konten oder Policen bei verschiedenen Einrichtungen sind nötig; der Bezug ist frühestens 5 Jahre vor dem Referenzalter möglich (Art. 16 FZV).`,
      );
  }
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
  const pkWegzug = pkWegzugStatus(p, stoppMonate, regeln, startIdx);
  const barVoll = pkWegzug.barVoll;
  const hatPk = p.pk.guthaben > 0 || p.pk.sparbeitragJahr > 0 || p.pk.beitragModus === 'bvgMinimum';
  if (weg !== null && p.wohnsitzAusland.barauszahlung) {
    const bIdx = Math.max(weg, startIdx);
    if (pkWegzug.fall === 'landFehlt')
      hinweise.push(
        'Barauszahlung beim Wegzug: bitte das Land wählen (EU/EFTA oder nicht) – bis dahin nicht gerechnet.',
      );
    else {
      if (pkWegzug.fall === 'barauszahlung') barPkIdx = bIdx;
      else if (hatPk)
        hinweise.push(
          'Wegzug erst ab dem PK-Bezugsalter: keine Barauszahlung der Austrittsleistung, sondern Altersleistung gemäss Reglement (Art. 2 Abs. 1bis FZG).',
        );
      if (bIdx < geburtIdx + fzStartMonate && barVoll) barFzIdx = bIdx;
      if (bIdx < geburtIdx + s3aStartMonate) barS3aIdx = bIdx;
    }
  }
  // Verkauf der Liegenschaft (Schema 7)
  const we = p.wohneigentum;
  let verkaufIdx = Number.POSITIVE_INFINITY;
  const vk = we.verkauf as Person['wohneigentum']['verkauf'] | undefined;
  if (we.vorhanden && vk?.aktiv) {
    const v = vk;
    const roh =
      v.zeitpunkt === 'ruecktritt' ? geburtIdx + stoppMonate : v.zeitpunkt === 'wegzug' ? wegIdx : monatIndex(v.datum);
    if (Number.isFinite(roh)) verkaufIdx = Math.max(roh, startIdx);
    else
      hinweise.push(
        'Verkauf der Liegenschaft «beim Wegzug»: Es ist kein Wegzug erfasst – die Liegenschaft wird nicht verkauft.',
      );
    if (!(v.anlagekosten > 0))
      hinweise.push(
        'Verkauf der Liegenschaft: Anlagekosten (Kaufpreis inkl. wertvermehrender Investitionen) fehlen – der ganze Verkaufspreis gilt als Gewinn. Bitte erfassen.',
      );
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
    s3aStartIdx: geburtIdx + s3aErster,
    fzStartIdx: geburtIdx + fzErster,
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
      saeule3aStart: ausMonatIndex(geburtIdx + s3aErster),
      saeule3aKapital: 0,
      freizuegigkeitStart: ausMonatIndex(geburtIdx + fzErster),
      freizuegigkeitKapital: 0,
      wegzug: weg === null ? null : ausMonatIndex(weg),
      freiwilligeAhvAktiv: fwAktiv,
      ahvLueckenAusland: lueckenAusland,
      ahvLueckenFaktor: lueckenFaktor,
      freiwilligeAhvJahre: [],
      neBeitraegeJahre: [],
      neBefreitJahre: [],
      barauszahlung: null,
      pkWegzug,
      quellensteuerKapital: 0,
      quellensteuerKapitalRueckforderung: 0,
      kapitalSteuerZielland: 0,
      quellensteuerRente: 0,
      zielland: null,
      verkauf: null,
      ...(s3aSchritte > 1 || fzSchritte > 1 || pkSchritte > 1
        ? { schritte: { pk: pkSchritte, fz: fzSchritte, s3a: s3aSchritte } }
        : {}),
      hinweise,
    },
    verkaufIdx,
    kaufIdx: vk ? monatIndex(vk.kauf) : 0,
    t: startToepfe(p),
    wWert: we.vorhanden ? Math.max(0, we.verkehrswert) : 0,
    hypo: we.vorhanden ? Math.max(0, we.hypothek) : 0,
    pkBezogen: false,
    pkRenteNominal: 0,
    pkHinterNominal: 0,
    witweMonat: 0,
    alterNachTodBasis: 0,
    s3aBezogen: false,
    fzBezogen: false,
    s3aSchritte,
    s3aSchritt: 0,
    fzSchritte,
    fzSchritt: 0,
    pkSchritte,
    pkSchritt: 0,
  };
}

/** Geplante Kapitalbezüge einer Person: erstes Kalenderjahr, Anzahl jährlicher Bezüge (Staffelung, Schema 11). */
export interface BezugsTermine {
  pk: { jahr: number; schritte: number } | null;
  fz: { jahr: number; schritte: number } | null;
  s3a: { jahr: number; schritte: number } | null;
  /** Wegzug erfasst: Bezug nach Wegzug-Regeln (Quellensteuer), keine Staffelung */
  wegzug: boolean;
}

/**
 * Wann werden PK-Kapital, Freizügigkeit und 3a je Person bezogen (nach den Regeln der Simulation, ohne Rechnung)?
 * Nur ordentliche Bezüge; mit Wegzug gelten die Barauszahlungsregeln (`wegzug: true`).
 */
export function bezugsTermine(h: Haushalt, regeln: Regeln, heute: Monat): BezugsTermine[] {
  const startIdx = monatIndex(heute);
  return h.personen.map((p) => {
    const stopp = p.erwerbsstatus === 'nichtErwerbstaetig' ? 0 : stoppAlterMonate(p);
    const pl = planePerson(p, regeln, stopp, startIdx, h.staffelung?.aktiv ? h.staffelung : undefined);
    const jahr = (idx: number) => Math.floor(Math.max(idx, startIdx) / 12);
    const hatPk = p.pk.guthaben > 0 && p.pk.kapitalanteil > 0;
    return {
      pk: hatPk ? { jahr: jahr(pl.pkStartIdx), schritte: pl.pkSchritte } : null,
      fz: p.freizuegigkeit.guthaben > 0 ? { jahr: jahr(pl.fzStartIdx), schritte: pl.fzSchritte } : null,
      s3a: p.saeule3a.guthaben > 0 ? { jahr: jahr(pl.s3aStartIdx), schritte: pl.s3aSchritte } : null,
      wegzug: pl.wegIdx !== Number.POSITIVE_INFINITY,
    };
  });
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

/** Höchste Anzahl simulierter Jahre (Geburtsjahr ≥ 1900 und Planungsalter ≤ 999 ergeben rund 900). */
export const MAX_SIMULATIONSJAHRE = 1200;

export function simuliere(h: Haushalt, regeln: Regeln, opt: SimOptionen): SimulationsErgebnis {
  if (h.personen.length === 0) throw new Error('Mindestens eine Person erforderlich');
  const verheiratetPlan = h.zivilstand === 'verheiratet' && h.personen.length >= 2;
  const a = h.annahmen;
  let modell = opt.renditeModell ?? deterministisch(a.renditeNominal, a.inflation);
  const kanton = kantonsModellFuer(h.steuern);
  /** Sitzkanton der Vorsorgeeinrichtung je Person (Quellensteuer) und dessen ordentliches Modell (Näherung) */
  const sitz = h.personen.map((p) => p.wohnsitzAusland.sitzkantonVorsorge || h.steuern.kanton);
  const modellFuerSitz = (k: string) =>
    k === h.steuern.kanton
      ? kanton
      : kantonsModellFuer({ ...h.steuern, kanton: k, gemeinde: '', kirche: 'keine', eigeneSaetze: false });
  /** Sitzkanton je Quelle (PK, Freizügigkeit, 3a): leer = wie der PK-Sitz (Schema 10) */
  const sitzFz = h.personen.map((p, i) => p.wohnsitzAusland.sitzkantonFz || (sitz[i] as string));
  const sitz3a = h.personen.map((p, i) => p.wohnsitzAusland.sitzkanton3a || (sitz[i] as string));
  const qstNaeherungGemeldet = h.personen.map(() => false);
  const startIdx = monatIndex(opt.start);
  const plaene = h.personen.map((p, i) =>
    planePerson(
      p,
      regeln,
      // Nicht erwerbstätig: kein Erwerb (auch nicht bei Vorgaben des Solvers)
      p.erwerbsstatus === 'nichtErwerbstaetig' ? 0 : (opt.stoppAlterMonate?.[i] ?? stoppAlterMonate(p)),
      startIdx,
      h.staffelung?.aktiv ? h.staffelung : undefined,
    ),
  );
  const refIdx = referenzPerson(h.personen);
  const ref = h.personen[refIdx] as Person;
  // Todesfall-Szenario (Schema 9, core/todesfall.ts); ohne Option bleibt die Rechnung unverändert
  const tf = opt.todesfall;
  const tod = tf ? todeszeitpunkt(h, tf, startIdx) : null;
  const todIdx = tod ? tod.idx : Number.POSITIVE_INFINITY;
  const todJahr = Number.isFinite(todIdx) ? Math.floor((todIdx - 1) / 12) : Number.POSITIVE_INFINITY;
  const totI = tod ? tod.tot : -1;
  const lebtI = tod ? tod.lebt : -1;
  let todesInfo: TodesfallInfo | null = null;
  const endJahr = ref.geburtsjahr + Math.max(0, Math.floor(h.planungsalter));
  // Schutz vor absurden Laufzeiten (Audit S-01/A2): nicht endliche oder extrem lange Zeiträume abweisen
  if (!Number.isFinite(endJahr) || !Number.isFinite(opt.start.jahr) || endJahr - opt.start.jahr > MAX_SIMULATIONSJAHRE)
    throw new Error('Eingaben ausserhalb des zulässigen Bereichs (Zeitraum zu lang)');
  let krisenNormal: { wertschriften: number; wohneigentum: number } | null = null;
  if (opt.krisen && opt.krisen.wahl.length > 0) {
    const erwIdx = Math.max(
      0,
      h.personen.findIndex((p) => p.erwerbsstatus !== 'nichtErwerbstaetig'),
    );
    const pl = plaene[erwIdx] as PersonPlan;
    const ruecktrittJahr = Math.floor((pl.geburtIdx + Math.max(0, pl.stoppMonate)) / 12);
    const plan = krisenPlan(
      opt.krisen.wahl,
      ruecktrittJahr,
      h.personen.map((p) => p.geburtsjahr),
    );
    let normal = opt.krisen.normal;
    if (opt.krisen.ausgleichHorizont) {
      // Ausgleich über den eigenen Planungshorizont (erstes Jahr anteilig nach Monaten)
      const jahre: { jahr: number; gewicht: number }[] = [];
      for (let j = opt.start.jahr; j <= endJahr; j++)
        jahre.push({ jahr: j, gewicht: j === opt.start.jahr ? (13 - opt.start.monat) / 12 : 1 });
      normal = ausgleichHorizont(
        { renditeNominal: a.renditeNominal, renditeBargeld: a.renditeBargeld, inflation: a.inflation },
        opt.krisen.aktienanteil,
        plan,
        jahre,
        opt.krisen.daten,
      );
    }
    krisenNormal = normal ?? null;
    modell = krisenModell(
      {
        renditeNominal: normal ? normal.wertschriften : a.renditeNominal,
        renditeBargeld: a.renditeBargeld,
        inflation: a.inflation,
        ...(normal ? { wohneigentumNominal: normal.wohneigentum } : {}),
      },
      opt.krisen.aktienanteil,
      plan,
      opt.krisen.daten,
      opt.start.jahr,
    );
  }
  const krisenJahre: { jahr: number; land: string; histJahr: number; krise: string }[] = [];
  // Wohnkosten (Schema 7): separat gerechnet oder in den Ausgaben enthalten (Standard, bisherige Rechnung)
  const wohnen = h.wohnen;
  const separat = wohnen?.separat === true;
  const reform = regeln.wohneigentum.reformWohneigentumsbesteuerung.abJahr;
  /** Letzter Monat mit Wohnsitz CH im Haushalt (Paare: solange eine Person in der Schweiz wohnt) */
  const chBisIdx = Math.max(...plaene.map((pl, i) => (i === totI ? Math.min(pl.wegIdx, todIdx) : pl.wegIdx)));
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
    /** Verheiratetentarif: im Todesjahr noch gemeinsam veranlagt (Art. 42 Abs. 3 DBG), ab dem Folgejahr alleinstehend */
    const verheiratet = verheiratetPlan && jahr <= todJahr;
    const nachTod = tod !== null && jahr > todJahr;
    /** Anzahl Personen, auf die Vermögensertrag und übrige Einkünfte entfallen */
    const nSteuer = nachTod ? 1 : n;
    const inflation = modell.inflation(t);
    const rNom = modell.renditeNominal(t);
    const real = (nominal: number) => (1 + nominal) / (1 + inflation) - 1;
    const rWert = real(rNom - a.kosten);
    const rWohn = modell.wohneigentum ? real(modell.wohneigentum(t) - a.kosten) : rWert;
    const rBar = real(modell.bargeld ? modell.bargeld(t) : a.renditeBargeld);
    const hist = modell.historisch?.(t) ?? null;
    if (hist) krisenJahre.push({ jahr, land: hist.land, histJahr: hist.jahr, krise: hist.krise });
    const ersterMonat = jahr === opt.start.jahr ? opt.start.monat : 1;
    const nMonate = 13 - ersterMonat;
    const wachstum = (r: number) => (1 + r) ** (nMonate / 12);

    // Anfangsbestände (für Vermögenssteuer und Vermögensertrag)
    const verfuegbarStart = sum(plaene.map((pl) => verfuegbar(pl.t))) - fehlbetrag;
    const finanzStart = sum(plaene.map((pl) => pl.t.bargeld + pl.t.wertschriften + pl.t.sonstiges));
    const wohnStart = sum(plaene.map((pl) => pl.t.wohneigentum));
    // Teiljahr (erstes Jahr ab Startmonat): Einkommenssteuern nach dem Tarif des auf zwölf Monate
    // hochgerechneten Einkommens, davon der Anteil der simulierten Monate
    const teil = nMonate / 12;

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
    const kapAuslQuelle = { pk: neu(), fz: neu(), s3a: neu() }; // dasselbe je auszahlende Einrichtung
    const kapQuelle = { pk: 0, fz: 0, s3a: 0, tod: 0 }; // Kapitalzuflüsse des Jahres je Quelle (Aufstellung)
    const auslandMonate = neu(); // Monate mit Wohnsitz im Ausland
    const pkRenteAusland = neu(); // PK-Rente in diesen Monaten (Quellensteuer auf Renten)
    const auslandBrutto = neu(); // ausländische Renten brutto (Steuern im Zielland)
    let weitereEinnahmen = 0;
    let weitereEinnahmenSteuerbar = 0;
    let wohnkosten = 0;
    let mieteinnahmen = 0;
    /** Steuerbares Liegenschaftseinkommen je Person (Eigenmietwert bis 2028 bzw. Vermietung, netto) */
    const liegSteuerbar = neu();
    const finanzJahr = finanzStart;
    let weitereAusgaben = 0;
    let ausgabenGesundheit = 0; // Posten der Kategorie «Gesundheit» (in weitereAusgaben enthalten)
    let ausgabenWohnenPosten = 0; // Posten der Kategorie «Wohnen» (in weitereAusgaben enthalten)
    let einmalig = 0;
    const ahvIndex = (1 + a.ahvAnpassungReal) ** t;
    /** AHV-Witwen-/Witwerrente je Person (12 Zahlungen, keine 13. Rente) */
    const ahvHinter = neu();
    let monateNachTod = 0;

    /**
     * Todesfall im ersten Monat ohne die verstorbene Person: Ansprüche der überlebenden Person festlegen
     * (AHV, PK-Ehegattenrente bzw. Abfindung) und Freizügigkeit/3a der verstorbenen Person als Kapital übertragen.
     */
    const todesereignis = (idx: number, tfx: Todesfall): { info: TodesfallInfo; kapital: number } => {
      const dead = plaene[totI] as PersonPlan;
      const lebt = plaene[lebtI] as PersonPlan;
      const alterTot = (idx - dead.geburtIdx) / 12;
      const alterLebt = (idx - lebt.geburtIdx) / 12;
      const ehejahre = Math.max(0, tfx.ehejahre) + Math.max(0, idx - startIdx) / 12;
      const hw: string[] = [];
      // AHV: Witwen-/Witwerrente (80 %) und Altersrente ohne Plafonierung + Verwitwetenzuschlag
      const ahvAnspruch = ahvHinterlassenenAnspruch(lebt.p, Math.floor(alterLebt), ehejahre, tfx.kinder, regeln);
      lebt.witweMonat = ahvAnspruch ? witwenrenteMonat(dead.ahvBasisMonat, regeln) : 0;
      const eigeneBasis = tfx.splitting ? (lebt.ahvBasisMonat + dead.ahvBasisMonat) / 2 : lebt.ahvBasisMonat;
      lebt.alterNachTodBasis = mitVerwitwetenzuschlag(
        eigeneBasis * lebt.ahvFaktor,
        regeln.ahv.maximalrenteMonat,
        regeln,
      );
      if (!ahvAnspruch)
        hw.push(
          lebt.p.geschlecht === 'w'
            ? 'Kein Anspruch auf AHV-Witwenrente: Es braucht Kinder oder mindestens 45 Jahre Alter und 5 Ehejahre (MB 3.03 Ziff. 1). Gerechnet wird die eigene Altersrente ohne Plafonierung mit 20 % Verwitwetenzuschlag.'
            : 'Kein Anspruch auf AHV-Witwerrente ohne Kinder (MB 3.03 Ziff. 3). Gerechnet wird die eigene Altersrente ohne Plafonierung mit 20 % Verwitwetenzuschlag.',
        );
      if (idx >= lebt.wegIdx) {
        hw.push(
          'Ergänzungsleistungen für Hinterlassene gibt es nur bei Wohnsitz in der Schweiz (MB 3.03 Ziff. 22); sie sind nicht gerechnet.',
        );
        if (lebt.p.wohnsitzAusland.nationalitaet === 'andere')
          hw.push(
            'AHV-Renten im Ausland: Für Staatsangehörige «andere» hängt die Auszahlung vom Heimatstaat ab (Abkommensstaaten: Abkommen, übrige Staaten nur unter Voraussetzungen; ZAS, siehe Regel todesfall.ahvHinterlassenenrenteAusland). Bitte prüfen; gerechnet wird mit Auszahlung.',
          );
      }
      // PK: Ehegattenrente 60 % (Art. 19, 21 BVG) bzw. Abfindung (drei Jahresrenten)
      let basisRenteJahr = 0; // real, pro Jahr
      if (dead.pkBezogen) basisRenteJahr = dead.pkRenteNominal / deflator;
      else if (dead.t.pk > 0) {
        const alterM = idx - dead.geburtIdx;
        const jahreBeitrag =
          alterM < dead.stoppMonate ? Math.max(0, Math.min(dead.stoppMonate, dead.raMonate) - alterM) / 12 : 0;
        const lohnJ = Math.max(0, dead.p.lohn) * (1 + dead.p.lohnwachstumReal) ** t;
        const beitrag =
          dead.p.pk.beitragModus === 'eingabe'
            ? Math.max(0, dead.p.pk.sparbeitragJahr) * (1 + dead.p.lohnwachstumReal) ** t
            : bvgAltersgutschrift(lohnJ, jahr - dead.p.geburtsjahr, Math.floor(dead.raMonate / 12), regeln.bvg);
        basisRenteJahr = pkInvalidenrenteJahr(dead.t.pk, beitrag, jahreBeitrag, dead.p.pk.umwandlungssatz);
      }
      const pkAnspruch = bvgEhegattenAnspruch(Math.floor(alterLebt), ehejahre, tfx.kinder, regeln);
      const ehegattenrente = pkEhegattenrenteJahr(basisRenteJahr, regeln);
      let pkAbfindung = 0;
      if (ehegattenrente > 0) {
        if (pkAnspruch) lebt.pkHinterNominal = ehegattenrente * deflator;
        else {
          pkAbfindung = ehegattenrente * regeln.todesfall.bvgEhegattenrente.abfindungJahresrenten;
          hw.push(
            'Kein Anspruch auf PK-Ehegattenrente (Art. 19 BVG: Kinder oder 45 Jahre und 5 Ehejahre): einmalige Abfindung von drei Jahresrenten, als Kapital besteuert.',
          );
        }
      }
      dead.pkRenteNominal = 0;
      dead.t.pk = 0;
      dead.pkBezogen = true;
      // Freizügigkeit und 3a: Kapital an die überlebende Person (Art. 15 FZV, Art. 2 BVV 3)
      let kapFz3a = 0;
      if (!dead.fzBezogen) {
        kapFz3a += dead.t.freizuegigkeit;
        dead.t.freizuegigkeit = 0;
        dead.fzBezogen = true;
      }
      if (!dead.s3aBezogen) {
        kapFz3a += dead.t.saeule3a;
        dead.t.saeule3a = 0;
        dead.s3aBezogen = true;
      }
      dead.barPkIdx = Number.POSITIVE_INFINITY;
      dead.barFzIdx = Number.POSITIVE_INFINITY;
      dead.barS3aIdx = Number.POSITIVE_INFINITY;
      return {
        kapital: kapFz3a + pkAbfindung,
        info: {
          verstorben: totI,
          ueberlebend: lebtI,
          ab: ausMonatIndex(idx),
          jahr: Math.floor(idx / 12),
          alterVerstorben: Math.floor(alterTot),
          alterUeberlebend: Math.floor(alterLebt),
          ahvAnspruch,
          ahvWitwenrenteMonat: lebt.witweMonat,
          ahvAltersrenteMonat: lebt.alterNachTodBasis,
          pkAnspruch,
          pkEhegattenrenteJahr: ehegattenrente,
          pkAbfindung,
          kapitalFzUnd3a: kapFz3a,
          hinweise: hw,
        },
      };
    };

    for (let m = ersterMonat; m <= 12; m++) {
      const idx = jahr * 12 + (m - 1);
      if (idx < startIdx) continue;
      if (tf && tod && idx === todIdx) {
        const ev = todesereignis(idx, tf);
        todesInfo = ev.info;
        if (ev.kapital > 0) {
          kapital[lebtI] = (kapital[lebtI] ?? 0) + ev.kapital;
          kapQuelle.tod += ev.kapital;
          if (idx >= (plaene[lebtI] as PersonPlan).wegIdx) {
            kapitalAusland[lebtI] = (kapitalAusland[lebtI] ?? 0) + ev.kapital;
            kapAuslQuelle.pk[lebtI] = (kapAuslQuelle.pk[lebtI] ?? 0) + ev.kapital;
          }
        }
      }
      if (idx >= todIdx) monateNachTod++;
      let basen = plaene.map((pl, i) =>
        idx >= pl.ahvStartIdx && !(i === totI && idx >= todIdx) ? pl.ahvBasisMonat : 0,
      );
      if (verheiratetPlan && idx < todIdx && basen.length >= 2 && (basen[0] ?? 0) > 0 && (basen[1] ?? 0) > 0) {
        const [r1, r2] = ahvPlafonierung(basen[0] ?? 0, basen[1] ?? 0, regeln.ahv);
        basen = [r1, r2, ...basen.slice(2)];
      }
      const renteMonat = neu(); // Renteneinkommen dieses Monats (alle Renten ausser IV)
      const lohnMonat = neu();
      const pflicht = neu(); // 1 = NE obligatorisch, 2 = NE freiwillig
      plaene.forEach((pl, i) => {
        // Todesfall: Die verstorbene Person hat ab dem Folgemonat keine Einnahmen mehr; für die Steuern zählt
        // der Wohnsitz der überlebenden Person
        if (i === totI && idx >= todIdx) {
          if (idx >= (plaene[lebtI] as PersonPlan).wegIdx) auslandMonate[i] = (auslandMonate[i] ?? 0) + 1;
          return;
        }
        const p = pl.p;
        const alterM = idx - pl.geburtIdx;
        const erwerb = alterM >= 0 && alterM < pl.stoppMonate;
        const imAusland = idx >= pl.wegIdx;
        if (imAusland) auslandMonate[i] = (auslandMonate[i] ?? 0) + 1;
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

        const bezug = (betrag: number, quelle: 'pk' | 'fz' | 's3a') => {
          kapital[i] = (kapital[i] ?? 0) + betrag;
          kapQuelle[quelle] += betrag;
          if (imAusland) {
            kapitalAusland[i] = (kapitalAusland[i] ?? 0) + betrag;
            kapAuslQuelle[quelle][i] = (kapAuslQuelle[quelle][i] ?? 0) + betrag;
          }
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
            bezug(frei, 'pk');
            if (gesperrt > 0) {
              if (pl.fzBezogen) bezug(gesperrt, 'fz');
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
            bezug(pl.t.freizuegigkeit, 'fz');
            pl.t.freizuegigkeit = 0;
            pl.fzBezogen = true;
            geaendert = true;
          }
          if (!pl.s3aBezogen && idx >= pl.barS3aIdx) {
            bar.saeule3a = pl.t.saeule3a;
            pl.info.saeule3aKapital = pl.t.saeule3a;
            bezug(pl.t.saeule3a, 's3a');
            pl.t.saeule3a = 0;
            pl.s3aBezogen = true;
            geaendert = true;
          }
          if (geaendert) pl.info.barauszahlung = bar;
        }

        // Pensionskasse: gesperrt bis zum Bezugsalter; dann Rente/Kapital/Mix
        if (!pl.pkBezogen && idx >= pl.pkStartIdx + 12 * pl.pkSchritt) {
          // Ein Schritt (bei Staffelung Teilpensionierung, Art. 13a BVG): gleicher Anteil des Restguthabens
          const anteil = 1 / (pl.pkSchritte - pl.pkSchritt);
          const l = pkLeistung(pl.t.pk * anteil, p.pk.umwandlungssatz, p.pk.kapitalanteil);
          bezug(l.kapital, 'pk');
          pl.pkRenteNominal += l.renteJahr * deflator;
          pl.info.pkRenteJahr += l.renteJahr;
          pl.info.pkKapital += l.kapital;
          pl.t.pk -= pl.t.pk * anteil;
          pl.pkSchritt++;
          if (pl.pkSchritt >= pl.pkSchritte) {
            pl.t.pk = 0;
            pl.pkBezogen = true;
          }
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
        if (pl.pkBezogen || pl.pkSchritt > 0) {
          pkRente[i] = (pkRente[i] ?? 0) + pl.pkRenteNominal / deflator / 12;
          if (imAusland) pkRenteAusland[i] = (pkRenteAusland[i] ?? 0) + pl.pkRenteNominal / deflator / 12;
          renteMonat[i] = (renteMonat[i] ?? 0) + pl.pkRenteNominal / deflator / 12;
        }
        // PK-Ehegattenrente (60 %, Art. 21 BVG): nominal fix wie jede PK-Rente
        if (pl.pkHinterNominal > 0) {
          const v = pl.pkHinterNominal / deflator / 12;
          pkRente[i] = (pkRente[i] ?? 0) + v;
          if (imAusland) pkRenteAusland[i] = (pkRenteAusland[i] ?? 0) + v;
          renteMonat[i] = (renteMonat[i] ?? 0) + v;
        }

        // Freizügigkeit: gesperrt bis RA−5 (bzw. Erwerbsaufgabe), Bezug als Kapital
        if (!pl.fzBezogen && idx >= pl.fzStartIdx + 12 * pl.fzSchritt) {
          const teil = pl.t.freizuegigkeit / (pl.fzSchritte - pl.fzSchritt);
          bezug(teil, 'fz');
          pl.info.freizuegigkeitKapital += teil;
          pl.t.freizuegigkeit -= teil;
          pl.fzSchritt++;
          if (pl.fzSchritt >= pl.fzSchritte) {
            pl.t.freizuegigkeit = 0;
            pl.fzBezogen = true;
          }
        }
        if (!pl.fzBezogen) pl.t.freizuegigkeit *= (1 + real(p.freizuegigkeit.zins)) ** (1 / 12);

        // Säule 3a: gesperrt bis RA−5 (bzw. Erwerbsaufgabe), spätestens RA (+5 bei Erwerb)
        if (!pl.s3aBezogen && idx >= pl.s3aStartIdx + 12 * pl.s3aSchritt) {
          const teil = pl.t.saeule3a / (pl.s3aSchritte - pl.s3aSchritt);
          bezug(teil, 's3a');
          pl.info.saeule3aKapital += teil;
          pl.t.saeule3a -= teil;
          pl.s3aSchritt++;
          if (pl.s3aSchritt >= pl.s3aSchritte) {
            pl.t.saeule3a = 0;
            pl.s3aBezogen = true;
          }
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
        if (i === lebtI && idx >= todIdx) {
          // Überlebende Person: die höhere Jahresleistung zählt (Art. 24b AHVG); Altersrente ohne Plafonierung
          // mit Verwitwetenzuschlag, Witwen-/Witwerrente ohne 13. Zahlung
          const eigen = idx >= pl.ahvStartIdx ? pl.alterNachTodBasis : 0;
          const zuschlagM = pl.zuschlagNominal / deflator;
          const wit = pl.witweMonat;
          if (
            wit > 0 &&
            (eigen <= 0 || hinterlassenenrenteHoeher(eigen * ahvIndex, zuschlagM, wit * ahvIndex, regeln))
          ) {
            ahvHinter[i] = (ahvHinter[i] ?? 0) + wit * ahvIndex;
            renteMonat[i] = (renteMonat[i] ?? 0) + wit * ahvIndex;
          } else if (eigen > 0) {
            const ahvMonat = eigen * ahvIndex;
            ahv[i] = (ahv[i] ?? 0) + ahvMonat;
            zuschlag[i] = (zuschlag[i] ?? 0) + zuschlagM;
            renteMonat[i] = (renteMonat[i] ?? 0) + ahvMonat + ahv13(ahvMonat, jahr, regeln.ahv) + zuschlagM;
          }
        } else if (basis > 0) {
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
            auslandBrutto[i] = (auslandBrutto[i] ?? 0) + v;
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
        // Todesfall: persönliche Einnahmen der verstorbenen Person entfallen (Mieten bleiben, sie gehören zum Vermögen)
        if (po.art === 'einnahme' && po.person === totI && idx >= todIdx && po.kategorie !== 'mieteinnahmen') continue;
        const v = realerBetrag(Math.max(0, po.betragJahr), po.indexierung, t, deflator) / 12;
        if (po.art === 'einnahme') {
          weitereEinnahmen += v;
          if (po.steuerbar) weitereEinnahmenSteuerbar += v;
        } else {
          weitereAusgaben += v;
          if (po.kategorie === 'gesundheit') ausgabenGesundheit += v;
          else if (po.kategorie === 'wohnen') ausgabenWohnenPosten += v;
        }
      }
      // Einmalige Ereignisse
      ereignisse.forEach((e, k) => {
        if (ereignisIdx[k] === idx) einmalig += e.betrag;
      });

      // Wohnkosten (nur separat): Hypothekarzins, Unterhalt, Mieteinnahmen, Miete
      if (separat) {
        let wohntImEigentum = false;
        plaene.forEach((pl, i) => {
          const w = pl.p.wohneigentum;
          if (!w.vorhanden || idx >= pl.verkaufIdx) return;
          const imAusland = idx >= (i === totI && idx >= todIdx ? (plaene[lebtI] as PersonPlan).wegIdx : pl.wegIdx);
          if (!imAusland) wohntImEigentum = true;
          const zins = (pl.hypo * Math.max(0, w.hypothekarzins ?? 0)) / 12;
          const unterhalt =
            (w.unterhaltArt === 'chf'
              ? Math.max(0, w.unterhaltChf ?? 0)
              : Math.max(0, pl.wWert) * Math.max(0, w.unterhaltProzent ?? 0)) / 12;
          wohnkosten += zins + unterhalt;
          if (imAusland && w.nachWegzug === 'vermietet') {
            const miete = Math.max(0, w.mieteinnahmenMonat ?? 0);
            mieteinnahmen += miete;
            // Ab der Reform: Schuldzinsen nur im Verhältnis vermietete Liegenschaft / gesamtes Vermögen
            const anteil = jahr >= reform ? pl.wWert / Math.max(1, pl.wWert + Math.max(0, finanzJahr)) : 1;
            liegSteuerbar[i] = (liegSteuerbar[i] ?? 0) + miete - unterhalt - zins * anteil;
          } else if (jahr < reform && (w.eigenmietwert ?? 0) > 0) {
            // Bis Ende 2028: Eigenmietwert minus Schuldzinsen und Unterhalt (selbst genutzt bzw. zur Verfügung)
            liegSteuerbar[i] = (liegSteuerbar[i] ?? 0) + (w.eigenmietwert ?? 0) / 12 - zins - unterhalt;
          }
        });
        if (!wohntImEigentum && idx < chBisIdx) wohnkosten += Math.max(0, wohnen.mieteMonat);
      }
    }

    // Lohnbeiträge nur bei Wohnsitz/Erwerb in der Schweiz
    const sozial = lohnCh.map(
      (l) => l * beitr.ahvIvEoSatzArbeitnehmer + Math.min(l, beitr.alvHoechstlohn) * beitr.alvSatzArbeitnehmer,
    );
    const ahv13Betrag = ahv.map((x) => ahv13(x, jahr, regeln.ahv));
    const ertrag = Math.max(0, finanzStart - fehlbetrag) * a.steuerbarerErtrag * teil;

    // Steuerbares Einkommen pro Person (vereinfachte Abzüge)
    const steuerbar = plaene.map(
      (_, i) =>
        (lohn[i] ?? 0) -
        (sozial[i] ?? 0) -
        (pkBeitragAN[i] ?? 0) -
        (s3aBeitrag[i] ?? 0) +
        ((ahv[i] ?? 0) + (ahvHinter[i] ?? 0) + (ahv13Betrag[i] ?? 0) + (zuschlag[i] ?? 0) + (pkRente[i] ?? 0)) *
          regeln.steuern.rentenSteuerbarAnteil +
        (auslandSteuerbar[i] ?? 0) +
        (liegSteuerbar[i] ?? 0) +
        (nachTod && i === totI ? 0 : (ertrag + weitereEinnahmenSteuerbar) / nSteuer),
    );
    let steuernEinkommen = 0;
    let steuernKapital = 0;
    const kapitalTotal = sum(kapital);
    // Kapitalleistungen vor dem Wegzug: ordentliche Kapitalleistungssteuer (Wohnkanton)
    const kapitalCh = kapital.map((k, i) => Math.max(0, k - (kapitalAusland[i] ?? 0)));
    const zs = verheiratet ? 'verheiratet' : 'alleinstehend';
    if (verheiratet) {
      const s = Math.max(0, sum(steuerbar)) / teil;
      steuernEinkommen =
        (dbgEinkommen(s, 'verheiratet', regeln.steuern) + kanton.einkommenssteuer(s, 'verheiratet')) * teil;
      const kCh = sum(kapitalCh);
      if (kCh > 0)
        steuernKapital =
          dbgKapital(kCh, 'verheiratet', regeln.steuern) + kanton.kapitalleistungssteuer(kCh, 'verheiratet');
    } else {
      steuerbar.forEach((s0, i) => {
        if (nachTod && i === totI) return;
        const s = Math.max(0, s0) / teil;
        steuernEinkommen +=
          (dbgEinkommen(s, 'alleinstehend', regeln.steuern) + kanton.einkommenssteuer(s, 'alleinstehend')) * teil;
        const k = kapitalCh[i] ?? 0;
        if (k > 0)
          steuernKapital +=
            dbgKapital(k, 'alleinstehend', regeln.steuern) + kanton.kapitalleistungssteuer(k, 'alleinstehend');
      });
    }
    // Kapitalleistungen nach dem Wegzug: Schweizer Quellensteuer je Empfänger (Sitzkanton der Einrichtung),
    // optional Rückforderung gemäss DBA (ESTV 2-217) gegen die Steuer im Zielland
    plaene.forEach((pl, i) => {
      const k = kapitalAusland[i] ?? 0;
      if (!(k > 0)) return;
      // Je auszahlende Einrichtung der Tarif ihres Sitzkantons; gleiche Sitzkantone werden zusammengefasst
      const seatPk = sitz[i] ?? '';
      const seatFz = sitzFz[i] ?? '';
      const seat3a = sitz3a[i] ?? '';
      const teile: [number, string][] =
        seatPk === seatFz && seatPk === seat3a
          ? [[k, seatPk]]
          : [
              [kapAuslQuelle.pk[i] ?? 0, seatPk],
              [kapAuslQuelle.fz[i] ?? 0, seatFz],
              [kapAuslQuelle.s3a[i] ?? 0, seat3a],
            ];
      const qTeile = teile
        .filter(([kk]) => kk > 0)
        .map(([kk, seat]) => quellensteuerKapital(kk, zs, seat, regeln, modellFuerSitz(seat)));
      const q = {
        total: qTeile.reduce((a, x) => a + x.total, 0),
        naeherung: qTeile.some((x) => x.naeherung),
        kantonCode: [...new Set(qTeile.map((x) => x.kantonCode))].join('/'),
      };
      const w = pl.p.wohnsitzAusland;
      const m = pl.land?.steuern;
      const satzZiel = w.steuerSatzKapitalZielland ?? m?.kapitalVorsorgeSatz;
      const rueckMoeglich = w.qstKapitalRueckforderung && m?.kapitalRueckforderbar === true;
      // Rückforderbarer Anteil: PK und Freizügigkeit (Säule 2) nach «Kapitalleistungen Säule 2», 3a nach der
      // eigenen 2-217-Spalte (Säule 3a); fehlt die 3a-Angabe, gilt dieselbe Regel wie für Säule 2
      const rueck3a = m?.kapital3aRueckforderbar ?? m?.kapitalRueckforderbar === true;
      const kRueck =
        (kapAuslQuelle.pk[i] ?? 0) + (kapAuslQuelle.fz[i] ?? 0) + (rueck3a ? (kapAuslQuelle.s3a[i] ?? 0) : 0);
      const anteilRueck = rueckMoeglich && k > 0 ? Math.min(1, kRueck / k) : 0;
      if (rueckMoeglich && satzZiel !== undefined && anteilRueck > 0) {
        const ziel = kRueck * Math.max(0, satzZiel);
        const qRueck = q.total * anteilRueck;
        steuernKapital += ziel + (q.total - qRueck);
        pl.info.quellensteuerKapitalRueckforderung += qRueck;
        pl.info.quellensteuerKapital += q.total - qRueck;
        pl.info.kapitalSteuerZielland += ziel;
      } else {
        steuernKapital += q.total;
        pl.info.quellensteuerKapital += q.total;
      }
      if (!qstNaeherungGemeldet[i]) {
        qstNaeherungGemeldet[i] = true;
        const kName = q.kantonCode || 'unbekannt';
        const rueckText =
          rueckMoeglich && satzZiel !== undefined
            ? ` Rückforderung gemäss DBA angenommen (Antrag innert 3 Jahren mit Bestätigung der Steuerbehörde des Wohnsitzstaats); stattdessen ${Math.round(satzZiel * 1000) / 10}% Steuer im Zielland${w.steuerSatzKapitalZielland !== null ? ' (eigener Satz)' : ''}.`
            : rueckMoeglich
              ? ' Rückforderung nicht gerechnet: Die Steuer auf Vorsorgekapital im Zielland ist nicht bekannt (OFFEN) – dafür einen eigenen Satz erfassen.'
              : w.qstKapitalRueckforderung
                ? ' Eine Rückforderung ist laut ESTV 2-217 für dieses Land nicht möglich (oder Land unbekannt).'
                : ' Eine allfällige Rückforderung gemäss DBA ist nicht gerechnet.';
        if (q.kantonCode === 'TI')
          pl.info.hinweise.push(
            'Sitzkanton Tessin (OFFEN): Der Kantonssatz 3,58 % stammt aus der ESTV-Tarifdatei 2026; die ESTV-Übersicht nennt für TI einen progressiven Tarif von 2 bis 3 %. Die Abweichung ist ungeklärt, gerechnet wird der höhere Wert. Bitte bei der Steuerverwaltung Tessin prüfen.',
          );
        pl.info.hinweise.push(
          `Kapitalleistungen nach dem Wegzug: Schweizer Quellensteuer (Bund nach Art. 95/96 DBG und QStV-Tarif + Sitzkanton ${kName} der Vorsorgeeinrichtung${q.naeherung ? ', Kantonsteil als Näherung' : ''}) statt der Kapitalleistungssteuer des Wohnkantons.${pl.land?.pkKapitalCh ? ` ${pl.land.name}: ${pl.land.pkKapitalCh} (ESTV 2-217, Stand 1.1.2026).` : ''}${rueckText}`,
        );
      }
    });
    // Vermögenssteuer auf dem verfügbaren Vermögen inkl. Nettowert Wohneigentum (Verkehrswert).
    // TODO(kantone): kantonaler Steuerwert der Liegenschaft (meist unter Verkehrswert) und
    // Schuldenabzug gemäss Kantonsmodell, sobald tarifbasierte Kantonsdaten vorliegen.
    let steuernVermoegen =
      (kanton.vermoegenssteuer(Math.max(0, verfuegbarStart), verheiratet ? 'verheiratet' : 'alleinstehend') * nMonate) /
      12;

    // Wohnsitz im Ausland: Schweizer Einkommens-/Vermögenssteuer nur, solange (mind.) eine Person in der
    // Schweiz wohnt; danach Steuern des Ziellands (core/zielland.ts) bzw. eigener Satz. Ohne Modell und
    // ohne eigenen Satz bleibt es bei Schweizer Steuern (Näherung, Hinweis in planePerson).
    const fAusland = plaene.map((pl, i) => {
      const aktiv = pl.p.wohnsitzAusland.steuerSatzZielland !== null || pl.land?.steuern !== undefined;
      return aktiv ? Math.min(1, (auslandMonate[i] ?? 0) / nMonate) : 0;
    });
    // Nach dem Tod zählt nur der Wohnsitz der überlebenden Person
    if (nachTod) fAusland[totI] = fAusland[lebtI] ?? 0;
    // Paare mit unterschiedlichem Wegzug: bis beide im Ausland wohnen, Schweizer Steuern auf allem (Näherung)
    const fCh = 1 - Math.min(...fAusland);
    const fZiel = 1 - fCh;
    if (fCh < 1) {
      steuernEinkommen *= fCh;
      steuernVermoegen *= fCh;
      // Liegenschaft in der Schweiz: beschränkte Steuerpflicht aus wirtschaftlicher Zugehörigkeit
      // (Art. 4 Abs. 1 StHG; § 4 Abs. 1 lit. b, § 5 Abs. 2 StG ZH), Vermögenssteuer auf dem Nettowert
      // zum Satz des gesamten Vermögens, mindestens zum Satz des Schweizer Teils (§ 6 StG ZH)
      if (wohnStart > 0) {
        const zv = verheiratet ? 'verheiratet' : 'alleinstehend';
        const total = Math.max(0, verfuegbarStart);
        const satzGesamt = total > 0 ? kanton.vermoegenssteuer(total, zv) / total : 0;
        const satzCh = kanton.vermoegenssteuer(wohnStart, zv) / wohnStart;
        steuernVermoegen += Math.max(satzGesamt, satzCh) * wohnStart * teil * fZiel;
      }
    }
    // Einkünfte aus der Schweizer Liegenschaft nach dem Wegzug: beschränkte Steuerpflicht (Art. 4 Abs. 1
    // lit. c, Art. 7 Abs. 1 DBG; § 4 Abs. 1 lit. b, § 6 StG ZH) zum Satz des gesamten Einkommens, mindestens
    // zum Satz der Schweizer Einkünfte. Vereinfachung: Satz aus dem Schweizer Tarif auf dem hier gerechneten
    // steuerbaren Einkommen; keine Steuer im Zielland (OFFEN).
    const liegTotal = sum(liegSteuerbar);
    if (fZiel > 0 && liegTotal > 0) {
      const zv = verheiratet ? 'verheiratet' : 'alleinstehend';
      const tarif = (x: number) => (x > 0 ? dbgEinkommen(x, zv, regeln.steuern) + kanton.einkommenssteuer(x, zv) : 0);
      const gesamt = Math.max(liegTotal, sum(steuerbar)) / teil / (verheiratet ? 1 : nSteuer);
      const ch = liegTotal / teil / (verheiratet ? 1 : nSteuer);
      const satz = Math.max(tarif(gesamt) / gesamt, tarif(ch) / ch);
      steuernEinkommen += satz * liegTotal * fZiel;
    }
    // Jahreswerte (im Teiljahr hochgerechnet); die Steuer wird danach mit `teil` gewichtet
    const einkommenZiel = (i: number): ZiellandEinkommen => ({
      ahv: ((ahv[i] ?? 0) + (ahvHinter[i] ?? 0) + (ahv13Betrag[i] ?? 0) + (zuschlag[i] ?? 0)) / teil,
      pkRente: (pkRente[i] ?? 0) / teil,
      auslandRenten: (auslandBrutto[i] ?? 0) / teil,
      lohn: (lohn[i] ?? 0) / teil,
      uebrige: weitereEinnahmenSteuerbar / nSteuer / teil,
      kapitalertrag: ertrag / nSteuer / teil,
      vermoegen: Math.max(0, verfuegbarStart) / nSteuer,
      personen: 1,
    });
    const zielAnteil = neu();
    const [p0, p1] = plaene;
    const gemeinsam =
      verheiratet &&
      p0 !== undefined &&
      p1 !== undefined &&
      (fAusland[0] ?? 0) > 0 &&
      (fAusland[1] ?? 0) > 0 &&
      p0.land?.code === p1.land?.code &&
      p0.land?.steuern?.tarifVerheiratet !== undefined &&
      p0.p.wohnsitzAusland.steuerSatzZielland === null &&
      p1.p.wohnsitzAusland.steuerSatzZielland === null;
    if (gemeinsam && p0) {
      const e0 = einkommenZiel(0);
      const e1 = einkommenZiel(1);
      const summe: ZiellandEinkommen = {
        ahv: e0.ahv + e1.ahv,
        pkRente: e0.pkRente + e1.pkRente,
        auslandRenten: e0.auslandRenten + e1.auslandRenten,
        lohn: e0.lohn + e1.lohn,
        uebrige: e0.uebrige + e1.uebrige,
        kapitalertrag: e0.kapitalertrag + e1.kapitalertrag,
        vermoegen: e0.vermoegen + e1.vermoegen,
        personen: 2,
      };
      const s = ziellandSteuer(p0.land?.steuern, summe, {
        gemeinsam: true,
        option: p0.p.wohnsitzAusland.steuerOption,
        eigenerSatz: null,
      });
      const f = fZiel * teil;
      zielAnteil[0] = ((s.einkommen + s.kapitalertrag) * f) / 2;
      zielAnteil[1] = ((s.einkommen + s.kapitalertrag) * f) / 2;
      steuernVermoegen += s.vermoegen * f;
    } else
      plaene.forEach((pl, i) => {
        const f = fZiel * teil;
        if (!(f > 0) || (nachTod && i === totI)) return;
        const w = pl.p.wohnsitzAusland;
        const s = ziellandSteuer(pl.land?.steuern, einkommenZiel(i), {
          gemeinsam: false,
          option: w.steuerOption,
          eigenerSatz: w.steuerSatzZielland,
        });
        zielAnteil[i] = (s.einkommen + s.kapitalertrag) * f;
        steuernVermoegen += s.vermoegen * f;
      });
    // Schweizer Quellensteuer auf PK-Renten an Personen im Ausland (Art. 96 DBG), wo ESTV 2-217 sie vorsieht
    const qstRente = neu();
    plaene.forEach((pl, i) => {
      const r = pkRenteAusland[i] ?? 0;
      const art = pl.land?.steuern?.chQstPkRente;
      if (!(r > 0) || !art || art === 'nein') return;
      if (art === 'rueckforderbar') {
        if (!pl.info.hinweise.some((x) => x.startsWith('PK-Rente nach dem Wegzug')))
          pl.info.hinweise.push(
            `PK-Rente nach dem Wegzug: Die Schweizer Quellensteuer wird abgezogen, ist aber gemäss DBA rückforderbar (ESTV 2-217${pl.land?.code === 'CY' ? ', nur mit Nachweis der Besteuerung in Zypern' : ', mit Ansässigkeitsbescheinigung'}). Der Rechner nimmt die Rückerstattung an.`,
          );
        return;
      }
      const monate = Math.max(1, auslandMonate[i] ?? 0);
      const satz = quellensteuerRenteSatz(regeln, sitz[i] ?? '', (r * 12) / monate) ?? 0;
      qstRente[i] = r * satz;
      pl.info.quellensteuerRente += r * satz;
      if (!pl.info.hinweise.some((x) => x.startsWith('PK-Rente nach dem Wegzug')))
        pl.info.hinweise.push(
          `PK-Rente nach dem Wegzug: Schweizer Quellensteuer von ${Math.round(satz * 1000) / 10}% (Sitzkanton ${sitz[i] || 'unbekannt'}, inkl. 1% direkte Bundessteuer; ESTV-Übersicht 2026), definitiv laut ESTV 2-217${pl.land ? ` für ${pl.land.name}` : ''}.`,
        );
    });
    steuernEinkommen += sum(zielAnteil) + sum(qstRente);
    plaene.forEach((pl, i) => {
      if (pl.info.zielland !== null || nMonate !== 12 || (auslandMonate[i] ?? 0) < 12) return;
      const e = einkommenZiel(i);
      pl.info.zielland = {
        jahr,
        steuer: zielAnteil[i] ?? 0,
        quellensteuerRente: qstRente[i] ?? 0,
        einkommen: e.ahv + e.pkRente + e.auslandRenten + e.lohn + e.uebrige + e.kapitalertrag,
        chSteuernWeiter: fZiel === 0,
        eigenerSatz: pl.p.wohnsitzAusland.steuerSatzZielland !== null,
      };
    });

    // Ausgaben nach Alter der Referenzperson
    const refAlter = jahr - ref.geburtsjahr;
    // Lebenshaltung in heutigen Franken (real): Grundbetrag, Phase oder Einzeljahr (core/ausgaben.ts)
    // Nach dem Todesfall: Lebenshaltung × Faktor Einpersonenhaushalt (editierbare Annahme, OFFEN)
    const ausgFaktor = tf && tod ? Math.min(1.5, Math.max(0, tf.ausgabenFaktor)) : 1;
    const lebenshaltung =
      (lebenshaltungImJahr(h.ausgaben, jahr, h.personen, refAlter).betrag *
        (nMonate - monateNachTod + monateNachTod * ausgFaktor)) /
      12;
    const ausgaben = lebenshaltung + weitereAusgaben + wohnkosten;

    const lohnTotal = sum(lohn);
    const ahvTotal = sum(ahv) + sum(ahvHinter) + sum(ahv13Betrag) + sum(zuschlag);
    const sozialTotal = sum(sozial);
    const vorsorgeBeitraege = sum(pkBeitragAN) + sum(s3aBeitrag);
    const einnahmen =
      lohnTotal -
      sozialTotal -
      vorsorgeBeitraege +
      ahvTotal +
      sum(pkRente) +
      sum(ausland) +
      weitereEinnahmen +
      mieteinnahmen;
    const saldoOhneAhvBeitraege =
      einnahmen - (steuernEinkommen + steuernKapital + steuernVermoegen + ausgaben) + einmalig;

    // Rendite auf den Anfangsbeständen der verfügbaren Töpfe
    // Wohneigentum (Schema 7): Die Wertänderung wirkt auf den ganzen Verkehrswert, die Hypothek bleibt
    // stehen (Hebel). Mit separaten Wohnkosten ist die Hypothek nominal fix (Zins als Ausgabe); ohne
    // wächst sie rechnerisch mit der Renditeannahme des Nutzers (pauschale Finanzierungskosten, wie bisher:
    // ohne Krise unverändert Nettowert × Rendite). Bewusst nicht mit der im Krisenmodus erhöhten Rendite der
    // normalen Jahre: sonst wüchse die Schuld schneller als der Hauspreis im Durchschnitt.
    const rHypoPauschal = real(a.renditeNominal - a.kosten);
    const finanz = () => plaene.reduce((x, pl) => x + pl.t.bargeld + pl.t.wertschriften + pl.t.sonstiges, 0);
    const ertragsBasis = finanz();
    const wohnVorher = plaene.reduce((x, pl) => x + pl.t.wohneigentum, 0);
    for (const pl of plaene) {
      pl.t.bargeld *= wachstum(rBar);
      pl.t.wertschriften *= wachstum(rWert);
      pl.t.sonstiges *= wachstum(real(pl.p.sonstiges.rendite));
      if (pl.wWert > 0 || pl.hypo > 0) {
        if (separat) {
          pl.wWert *= wachstum(rWohn);
          pl.hypo /= 1 + inflation;
        } else if (pl.t.wohneigentum > 0) {
          pl.wWert *= wachstum(rWohn);
          pl.hypo *= wachstum(rHypoPauschal);
        }
        pl.t.wohneigentum = pl.wWert - pl.hypo;
      } else pl.t.wohneigentum *= pl.t.wohneigentum > 0 ? wachstum(rWohn) : 1;
    }
    const ertraege = finanz() - ertragsBasis;
    const wohnwertaenderung = plaene.reduce((x, pl) => x + pl.t.wohneigentum, 0) - wohnVorher;
    // Verkauf der Liegenschaft (am Ende des Verkaufsjahres verbucht): Grundstückgewinnsteuer nach Tarif
    // des Kantons (nominal), Verkaufskosten, Rückzahlung der Hypothek; der Nettoerlös fliesst in die
    // Wertschriften. Wohnkosten und Miete wechseln bereits im Verkaufsmonat.
    let ggstJahr = 0;
    let verkaufserloes = 0;
    let verkaufskosten = 0;
    plaene.forEach((pl) => {
      const w = pl.p.wohneigentum;
      if (!w.vorhanden || pl.info.verkauf || Math.floor(pl.verkaufIdx / 12) !== jahr) return;
      const defl = deflator * (1 + inflation);
      const preis = Math.max(0, pl.wWert);
      const preisNom = preis * defl;
      const kostenNom = preisNom * Math.max(0, w.verkauf.verkaufskostenAnteil);
      const gewinnNom = preisNom - kostenNom - Math.max(0, w.verkauf.anlagekosten);
      const g = grundstueckgewinnsteuer(
        gewinnNom,
        pl.kaufIdx,
        pl.verkaufIdx,
        h.steuern.kanton,
        w.verkauf.eigenerSatz,
        regeln,
      );
      const steuer = g.steuer / defl;
      const erloes = preis - kostenNom / defl - steuer - pl.hypo;
      pl.info.verkauf = {
        monat: ausMonatIndex(pl.verkaufIdx),
        besitzjahre: Math.max(0, Math.floor((pl.verkaufIdx - pl.kaufIdx) / 12)),
        preisNominal: preisNom,
        verkaufskostenNominal: kostenNom,
        gewinnNominal: gewinnNom,
        steuerNominal: g.steuer,
        steuerSatz: gewinnNom > 0 ? g.steuer / gewinnNom : 0,
        steuerArt: g.art,
        preis,
        hypothek: pl.hypo,
        steuer,
        erloes,
      };
      if (g.art === 'naeherungZH')
        pl.info.hinweise.push(
          `Grundstückgewinnsteuer: Für den Kanton ${h.steuern.kanton || '(nicht gewählt)'} ist kein Tarif hinterlegt – Näherung mit dem Tarif des Kantons Zürich (OFFEN). Besser: eigenen effektiven Satz erfassen.`,
        );
      pl.t.wertschriften += erloes;
      pl.wWert = 0;
      pl.hypo = 0;
      pl.t.wohneigentum = 0;
      ggstJahr += steuer;
      verkaufserloes += erloes;
      verkaufskosten += kostenNom / defl;
    });
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
      let neBefreit = false;
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
        neBefreit = mNe > 0 && befreitNe;
        if (mNe > 0 && !befreitNe)
          neI = (neBeitrag(vermoegenStichtag, rentenJahr, verheiratet, a.neVerwaltungskosten, ne) * mNe) / 12;
        if (mFw > 0 && !befreitFw)
          fwI = (fwBeitragNichterwerbstaetig(vermoegenStichtag, rentenJahr, verheiratet, fw) * mFw) / 12;
      }
      const mErw = fwErwMonate[i] ?? 0;
      if (mErw > 0) fwI += (fwBeitragErwerbstaetig(((fwLohn[i] ?? 0) * 12) / mErw, fw) * mErw) / 12;
      if (neI > 0) pl.info.neBeitraegeJahre.push({ jahr, betrag: neI });
      if (neBefreit) pl.info.neBefreitJahre.push(jahr);
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
    // Entnahmen aus dem Wohneigentum senken den Verkehrswert (Teilverkauf bzw. Aufstockung, vereinfacht)
    for (const pl of plaene) if (pl.wWert > 0 || pl.hypo > 0) pl.wWert = pl.t.wohneigentum + pl.hypo;

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
      lebenshaltung,
      ertraege,
      ertragsBasis,
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
      wohnkosten,
      mieteinnahmen,
      grundstueckgewinnsteuer: ggstJahr,
      verkaufserloes,
      verkaufskosten,
      wohnwertaenderung,
      kapitalPk: kapQuelle.pk,
      kapitalFz: kapQuelle.fz,
      kapital3a: kapQuelle.s3a,
      kapitalTod: kapQuelle.tod,
      ausgabenGesundheit,
      ausgabenWohnenPosten,
      indexBeginn: deflator,
      indexEnde: deflator * (1 + inflation),
      ...(tod ? { todesjahr: jahr === todJahr } : {}),
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
    krisenJahre,
    krisenNormal,
    personen: plaene.map((pl) => pl.info),
    ...(tf ? { todesfall: todesInfo } : {}),
  };
}
