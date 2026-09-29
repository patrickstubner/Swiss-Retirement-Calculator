/**
 * Nicht erwerbstätige Person (z.B. Familienarbeit): welche AHV-Regeln gelten – als Klartext für die
 * Oberfläche. Rechnen tun `schaetzwerte.ts` (Rente) und `simulation.ts` (NE-Beiträge, Befreiung).
 *
 * Quellen (rules/2026.json): Art. 3 Abs. 3 und 4 AHVG, Art. 29ter Abs. 2 lit. b AHVG, MB 2.03 Ziff. 3
 * (Befreiung durch den Ehegatten ab doppeltem Mindestbeitrag 1'060); Art. 29quinquies Abs. 3 AHVG,
 * MB 3.01 (Splitting); Art. 29sexies/29septies AHVG, MB 1.07/1.03 (Erziehungs-/Betreuungsgutschriften);
 * Art. 35 AHVG, MB 3.01 (Plafonierung 150 %).
 */
import type { Regeln } from '../rules';
import { ahvReferenzalter, inMonaten } from './ahv';
import { istNichtErwerbstaetig, lohnFuerBefreiung } from './schaetzwerte';
import type { Person, PersonInfo } from './typen';
import { stoppAlterMonate } from './zeitpunkt';

export type BefreiungDurchEhegatte = 'ja' | 'bisRuecktritt' | 'nein';

export interface NichtErwerbAnnahmen {
  befreiung: BefreiungDurchEhegatte;
  /** Letztes Kalenderjahr, in dem der Ehegatte noch arbeitet (bei 'bisRuecktritt') */
  ruecktrittJahrEhegatte: number | null;
  /** Summe der eigenen NE-Beiträge laut Simulation (heutige CHF) */
  eigeneBeitraege: number;
  /** Jahre mit eigenen NE-Beiträgen laut Simulation */
  jahreEigeneBeitraege: number[];
  /** Jahre mit Befreiung laut Simulation */
  jahreBefreit: number[];
  punkte: string[];
  warnung: string | null;
}

/** Wie fmtChf der Oberfläche (Tausendertrennzeichen ’), ohne Abhängigkeit von Intl. */
const chf = (x: number): string => `CHF ${String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '’')}`;

function spanne(jahre: number[]): string {
  if (jahre.length === 0) return '';
  const a = Math.min(...jahre);
  const b = Math.max(...jahre);
  return a === b ? String(a) : `${a}–${b}`;
}

export function nichtErwerbAnnahmen(
  p: Person,
  partner: Person | null,
  verheiratet: boolean,
  regeln: Regeln,
  info: PersonInfo | null,
): NichtErwerbAnnahmen {
  const ne = regeln.beitraege.nichterwerbstaetige;
  const grenze = lohnFuerBefreiung(regeln);
  const ehe = verheiratet && partner !== null;
  const partnerName = partner?.name || 'Ihr Ehegatte';
  const partnerZahlt = ehe && partner !== null && !istNichtErwerbstaetig(partner) && partner.lohn >= grenze;
  const raJahr =
    p.geburtsjahr +
    Math.floor((p.geburtsmonat - 1 + inMonaten(ahvReferenzalter(p.geburtsjahr, p.geschlecht, regeln.ahv))) / 12);
  let befreiung: BefreiungDurchEhegatte = 'nein';
  let ruecktrittJahrEhegatte: number | null = null;
  if (partnerZahlt && partner) {
    const stopp = stoppAlterMonate(partner);
    const letzterMonatIdx = partner.geburtsjahr * 12 + (partner.geburtsmonat - 1) + stopp - 1;
    ruecktrittJahrEhegatte = Math.floor(letzterMonatIdx / 12);
    befreiung = ruecktrittJahrEhegatte >= raJahr ? 'ja' : 'bisRuecktritt';
  }
  const jahreEigeneBeitraege = (info?.neBeitraegeJahre ?? []).map((x) => x.jahr);
  const eigeneBeitraege = (info?.neBeitraegeJahre ?? []).reduce((s, x) => s + x.betrag, 0);
  const jahreBefreit = info?.neBefreitJahre ?? [];

  const punkte: string[] = [];
  punkte.push(
    'AHV-pflichtig sind Sie auch ohne Erwerb: ab dem 1. Januar nach dem 20. Geburtstag bis zum Referenzalter (Merkblatt 2.03). Diese Jahre zählen als volle Beitragsjahre, wenn Beiträge bezahlt sind oder als bezahlt gelten.',
  );
  let warnung: string | null = null;
  if (befreiung !== 'nein') {
    punkte.push(
      `Ihre eigenen Beiträge gelten als bezahlt, solange ${partnerName} im Sinne der AHV erwerbstätig ist und mindestens ${chf(ne.befreiungEhegatteMindestbeitrag)} AHV/IV/EO-Beiträge pro Jahr zahlt (doppelter Mindestbeitrag, bei ${Math.round(regeln.beitraege.ahvIvEoSatzTotal * 1000) / 10} % ab ca. ${chf(grenze)} Lohn; Art. 3 Abs. 3 AHVG). Die Jahre zählen als Beitragsjahre (Art. 29ter Abs. 2 lit. b AHVG).${jahreBefreit.length > 0 ? ` Im Rechner: ${spanne(jahreBefreit)}.` : ''}`,
    );
    if (befreiung === 'bisRuecktritt') {
      punkte.push(
        `Nach dem Rücktritt von ${partnerName} (letztes Arbeitsjahr ${ruecktrittJahrEhegatte}) zahlen Sie bis zu Ihrem Referenzalter eigene Beiträge als Nichterwerbstätige – berechnet aus dem halben ehelichen Vermögen und dem 20-fachen halben Renteneinkommen, mindestens ${chf(ne.tabelle.minimalbeitrag)} pro Jahr.${eigeneBeitraege > 0 ? ` Im Rechner: ${spanne(jahreEigeneBeitraege)}, total ca. ${chf(eigeneBeitraege)} (heutige Franken).` : ''}`,
      );
    }
  } else {
    const grund = !ehe
      ? 'Ohne erwerbstätigen Ehegatten'
      : partner && istNichtErwerbstaetig(partner)
        ? `${partnerName} ist ebenfalls nicht erwerbstätig – daher`
        : `${partnerName} erreicht mit dem angegebenen Lohn den doppelten Mindestbeitrag (${chf(ne.befreiungEhegatteMindestbeitrag)}, Lohn ab ca. ${chf(grenze)}) nicht – daher`;
    warnung = `${grund} müssen Sie eigene AHV-Beiträge als Nichterwerbstätige zahlen (nach Vermögen und Renteneinkommen, mindestens ${chf(ne.tabelle.minimalbeitrag)} pro Jahr, bei der Ausgleichskasse des Wohnkantons anmelden). Fehlende Beiträge führen zu Beitragslücken (pro Jahr etwa 1/44 weniger Rente).${eigeneBeitraege > 0 ? ` Im Rechner: total ca. ${chf(eigeneBeitraege)} (heutige Franken).` : ''}`;
  }
  if (ehe) {
    punkte.push(
      'Einkommensteilung (Splitting): Die Einkommen beider Ehegatten aus den Ehejahren werden je zur Hälfte angerechnet (Art. 29quinquies Abs. 3 AHVG) – so erhält auch der nicht erwerbstätige Ehegatte eine Rente aus dem Einkommen des Partners. Annahme: verheiratet während der ganzen Beitragsdauer.',
    );
  }
  const ez = p.ahvSchaetzhilfe.erziehungsJahre;
  const bt = p.ahvSchaetzhilfe.betreuungsJahre;
  if (ez > 0 || bt > 0 || (ehe && partner && partner.ahvSchaetzhilfe.erziehungsJahre > 0)) {
    const ezEff = Math.max(ez, ehe && partner ? partner.ahvSchaetzhilfe.erziehungsJahre : 0);
    punkte.push(
      `Gutschriften: ${ezEff} Jahre Erziehungsgutschriften${bt > 0 ? ` und ${bt} Jahre Betreuungsgutschriften` : ''} (je 3 × jährliche Minimalrente, während der Ehe hälftig geteilt; nicht kumulierbar; Art. 29sexies/29septies AHVG).`,
    );
  } else {
    punkte.push(
      'Erziehungsgutschriften: Für jedes Jahr mit einem Kind unter 16 gibt es eine Gutschrift von 3 × der jährlichen Minimalrente (während der Ehe hälftig). Jahre unten eintragen – sonst rechnet der Rechner ohne (eher zu tief).',
    );
  }
  if (p.inChSeit > 0 && p.inChSeit > p.geburtsjahr + 20) {
    punkte.push(
      `Jahre vor dem Zuzug (${p.inChSeit}) fehlen in der Schweizer AHV (Beitragslücken). Beitragsjahre im Ausland ergeben allenfalls eine Rente des anderen Staates (z.B. über ein Sozialversicherungsabkommen) – im Modus «Detailliert» unter «Ausländische Renten» erfassen.`,
    );
  }
  if (ehe) {
    punkte.push(
      `Plafonierung: Die beiden Renten eines Ehepaars zusammen betragen höchstens 150 % der Maximalrente (${chf(regeln.ahv.plafondEhepaarFaktor * regeln.ahv.maximalrenteMonat)} pro Monat, Art. 35 AHVG) – die Simulation kürzt beide Renten anteilig.`,
    );
  }
  return {
    befreiung,
    ruecktrittJahrEhegatte,
    eigeneBeitraege,
    jahreEigeneBeitraege,
    jahreBefreit,
    punkte,
    warnung,
  };
}
