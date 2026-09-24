/**
 * AHV-Schätzhilfe: grobe Schätzung der monatlichen Altersrente (Skala 44 bzw. Teilrente)
 * nach der Rentenformel Art. 34 AHVG und der Berechnungsweise im Merkblatt 3.01
 * (Durchschnitt der Erwerbseinkommen + Durchschnitt der Erziehungsgutschriften,
 * aufgerundet auf den Tabellenwert).
 *
 * Grobe Schätzung, keine verbindliche Auskunft. Nicht abgebildet (Regel-Status «offen»):
 * exakte Rentenskalen 1–43 (Art. 52 AHVV), Jugendjahre, beitragslose Ehejahre vor 1997,
 * Aufwertungsfaktoren (Eingabe in heutigen Franken), Betreuungsgutschriften,
 * tiefere Plafonierungsgrenze bei Teilrenten.
 *
 * Die 150%-Plafonierung für Ehepaare und die 13. AHV-Rente werden in der Hauptsimulation
 * angewendet, nicht hier.
 */

import type { Regeln } from '../rules';
import { ahvReferenzalter, ahvRenteSkala44, inMonaten, mdjeTabellenwert } from './ahv';
import type { AhvSchaetzhilfeEingabe, Geschlecht } from './typen';

export interface AhvSchaetzungEingabe extends AhvSchaetzhilfeEingabe {
  geburtsjahr: number;
  /** 1–12 */
  geburtsmonat: number;
  geschlecht: Geschlecht;
}

export interface AhvSchaetzungErgebnis {
  /** Volle Beitragsdauer des Jahrgangs (1.1. nach dem 20. Geburtstag bis 31.12. vor dem RA) */
  vollDauer: number;
  /** Angerechnete Beitragsjahre in der Schweiz */
  beitragsjahre: number;
  fehlendeJahre: number;
  /** Durchschnitt der Erwerbseinkommen (nach Splitting) */
  durchschnittErwerb: number;
  /** Durchschnitt der Erziehungsgutschriften */
  durchschnittErziehung: number;
  /** massgebendes durchschnittliches Jahreseinkommen (vor Rundung) */
  mdje: number;
  /** mdJE aufgerundet auf den Tabellenwert */
  mdjeTabelle: number;
  /** volle Rente Skala 44 (CHF/Monat) */
  vollrente: number;
  /** Anteil der Vollrente (Beitragsjahre ÷ volle Beitragsdauer) */
  teilrenteFaktor: number;
  /** geschätzte Monatsrente (CHF, auf Franken gerundet, ohne 13. Rente, ohne Plafonierung) */
  renteMonat: number;
  /** Beitragsjahre umgerechnet auf die Skala 44 (für das Feld `ahv.beitragsjahre`) */
  beitragsjahreSkala44: number;
  hinweise: string[];
}

const nichtNeg = (x: number): number => (Number.isFinite(x) ? Math.max(0, x) : 0);

/** Volle Beitragsdauer eines Jahrgangs in Jahren. */
export function ahvVolleBeitragsdauer(
  geburtsjahr: number,
  geburtsmonat: number,
  geschlecht: Geschlecht,
  regeln: Regeln,
): number {
  const ra = inMonaten(ahvReferenzalter(geburtsjahr, geschlecht, regeln.ahv));
  const raJahr = Math.floor((geburtsjahr * 12 + (geburtsmonat - 1) + ra) / 12);
  const beginn = geburtsjahr + regeln.ahv.schaetzhilfe.beitragsdauerBeginnAlter;
  return Math.max(1, raJahr - beginn);
}

export function ahvSchaetzung(e: AhvSchaetzungEingabe, regeln: Regeln): AhvSchaetzungErgebnis {
  const r = regeln.ahv;
  const sh = r.schaetzhilfe;
  const hinweise: string[] = [];
  const vollDauer = ahvVolleBeitragsdauer(e.geburtsjahr, e.geburtsmonat, e.geschlecht, regeln);
  const auslandJahre = e.ausland ? Math.round(nichtNeg(e.auslandJahre)) : 0;

  // Beitragsjahre in der Schweiz. Auslandsjahre erhöhen die Schweizer Rente nicht.
  let beitragsjahre: number;
  if (e.beitragsModus === 'jahreCh') {
    beitragsjahre = Math.min(vollDauer, Math.round(nichtNeg(e.jahreCh)));
  } else {
    beitragsjahre = Math.max(0, vollDauer - Math.round(nichtNeg(e.luecken)) - auslandJahre);
  }
  const fehlendeJahre = vollDauer - beitragsjahre;
  if (auslandJahre > 0) {
    hinweise.push(
      'Auslandsjahre erhöhen die Schweizer AHV-Rente nicht (sie gelten als Beitragslücken). Eine ausländische Rente – z.B. aufgrund eines Sozialversicherungsabkommens – bitte separat unter «Ausländische Renten» erfassen.',
    );
  }
  if (beitragsjahre === 0) {
    hinweise.push('Ohne Beitragsjahre in der Schweiz besteht kein Anspruch auf eine AHV-Altersrente.');
  }

  // Durchschnitt der Erwerbseinkommen mit Splitting während der Ehejahre (je hälftig)
  const eigen = nichtNeg(e.einkommen);
  const partner = nichtNeg(e.einkommenEhepartner);
  const ehe = Math.min(beitragsjahre, Math.round(nichtNeg(e.ehejahre)));
  const durchschnittErwerb =
    beitragsjahre > 0
      ? ((beitragsjahre - ehe) * eigen + ehe * (sh.splittingAnteil * eigen + (1 - sh.splittingAnteil) * partner)) /
        beitragsjahre
      : 0;
  if (ehe > 0) {
    hinweise.push(
      'Splitting: Die Einkommen der Ehejahre werden je hälftig angerechnet, sobald beide Ehepartner rentenberechtigt sind. Bis dahin rechnet die AHV mit dem ungeteilten eigenen Einkommen.',
    );
  }

  // Erziehungsgutschriften: 3 × jährliche Minimalrente pro Jahr, während der Ehe hälftig,
  // Durchschnitt = Summe ÷ Beitragsdauer. Annahme: Erziehungsjahre fallen zuerst in die Ehejahre.
  const gutschrift = r.erziehungsgutschriftFaktorMinimalrente * r.minimalrenteMonat * 12;
  const ezJahre = Math.min(beitragsjahre, Math.round(nichtNeg(e.erziehungsJahre)));
  const ezInEhe = Math.min(ezJahre, ehe);
  const ezSumme = ezInEhe * gutschrift * sh.erziehungsgutschriftTeilungVerheiratet + (ezJahre - ezInEhe) * gutschrift;
  const durchschnittErziehung = beitragsjahre > 0 ? ezSumme / beitragsjahre : 0;

  const mdje = durchschnittErwerb + durchschnittErziehung;
  const mdjeTabelle = mdjeTabellenwert(mdje, r);
  const vollrente = ahvRenteSkala44(mdje, r);
  const teilrenteFaktor = beitragsjahre / vollDauer;
  const renteMonat = beitragsjahre > 0 ? Math.round(vollrente * teilrenteFaktor) : 0;
  if (fehlendeJahre > 0 && beitragsjahre > 0) {
    hinweise.push(
      `Teilrente: ${fehlendeJahre} fehlende Beitragsjahre ergeben vereinfacht eine Kürzung um je 1/${vollDauer} (gemäss Merkblatt 3.01 mindestens 1/44 pro Jahr). Jugendjahre oder freiwillige Beiträge können Lücken schliessen.`,
    );
  }

  return {
    vollDauer,
    beitragsjahre,
    fehlendeJahre,
    durchschnittErwerb,
    durchschnittErziehung,
    mdje,
    mdjeTabelle,
    vollrente,
    teilrenteFaktor,
    renteMonat,
    beitragsjahreSkala44: Math.round(r.vollrenteBeitragsjahre * teilrenteFaktor),
    hinweise,
  };
}

/** Offizielle Links (geprüft 25.09.2026). */
export const AHV_LINKS = {
  escal: 'https://www.ahv-iv.ch/de/Formulare/Online-Rentensch%C3%A4tzung-ESCAL',
  rentenvorausberechnung:
    'https://www.ahv-iv.ch/de/Sozialversicherungen/Alters-und-Hinterlassenenversicherung-AHV/Rentenvorausberechnung',
  formular318282: 'https://www.ahv-iv.ch/p/318.282.d',
  merkblatt306: 'https://www.ahv-iv.ch/p/3.06.d',
  merkblatt301: 'https://www.ahv-iv.ch/p/3.01.d',
} as const;
