/**
 * Freiwillige AHV/IV für Personen mit Wohnsitz ausserhalb der EU/EFTA (Art. 2 AHVG, VFV
 * SR 831.111, Merkblatt 10.02, Wegleitung WFV). Reine Funktionen; alle Werte aus
 * rules/<jahr>.json → beitraege.freiwilligeAhv.
 */
import { wegzugsLand } from '../data/laender';
import type { Regeln } from '../rules';
import { ahvReferenzalter, inMonaten } from './ahv';
import { beitragAusTabelle } from './neBeitrag';
import type { Person } from './typen';
import { geburtIndex, wegzugIndex } from './zeitpunkt';

type FwRegeln = Regeln['beitraege']['freiwilligeAhv'];

export interface FwPruefung {
  /** Beitritt nach den erfassten Angaben möglich */
  berechtigt: boolean;
  /** Gründe, warum kein Beitritt möglich ist (leer = berechtigt) */
  gruende: string[];
  /** Weitere Hinweise (Fristen, Ehegatten, Ausschluss) */
  hinweise: string[];
  /** Wohnsitzland liegt in der EU/EFTA (null = kein Land gewählt) */
  landEuEfta: boolean | null;
  /** Wegzug vor Erreichen des Referenzalters */
  vorReferenzalter: boolean;
}

/** Prüft die Beitrittsvoraussetzungen (Art. 2 Abs. 1 AHVG, Art. 7–8 VFV) für eine Person. */
export function pruefeFreiwilligeAhv(p: Person, regeln: Regeln): FwPruefung {
  const w = p.wohnsitzAusland;
  const fw = regeln.beitraege.freiwilligeAhv;
  const gruende: string[] = [];
  const hinweise: string[] = [];
  const land = wegzugsLand(w.land);
  const landEuEfta = land ? land.euEfta : null;
  const weg = wegzugIndex(p);
  const raMonate = inMonaten(ahvReferenzalter(p.geburtsjahr, p.geschlecht, regeln.ahv));
  const vorReferenzalter = weg !== null && weg - geburtIndex(p) < raMonate;

  if (!w.aktiv || weg === null) {
    return { berechtigt: false, gruende: ['Kein Wegzug erfasst.'], hinweise, landEuEfta, vorReferenzalter: false };
  }
  if (!vorReferenzalter) {
    gruende.push(
      'Wegzug nach dem AHV-Referenzalter: Es besteht keine Beitragspflicht mehr, die freiwillige AHV ist nicht nötig (und nicht möglich).',
    );
  }
  if (w.nationalitaet === 'andere') {
    gruende.push(
      'Nur Schweizer Bürgerinnen und Bürger sowie Staatsangehörige eines EU- oder EFTA-Staates können beitreten (Art. 2 Abs. 1 AHVG).',
    );
  }
  if (landEuEfta === null) {
    gruende.push('Bitte das Wohnsitzland wählen.');
  } else if (landEuEfta) {
    gruende.push(
      'Wohnsitz in einem EU/EFTA-Staat: Ein Beitritt ist nicht möglich. Dort gilt die Sozialversicherung des Wohnsitz- bzw. Beschäftigungsstaates; diese Zeiten erhöhen die Schweizer AHV-Rente nicht.',
    );
  }
  if (!w.vorherVersichert5Jahre) {
    gruende.push(
      `Voraussetzung: unmittelbar vor dem Wegzug mindestens ${fw.voraussetzungen.mindestVersicherungsjahreVorher} aufeinanderfolgende volle Jahre in der AHV versichert (Beitragszahlung nicht nötig).`,
    );
  }
  const berechtigt = gruende.length === 0;
  if (berechtigt) {
    hinweise.push(
      `Beitritt innert ${fw.beitrittsfrist.jahreNachAusscheiden} Jahr nach dem Wegzug bei der Schweizerischen Ausgleichskasse SAK (Genf) erklären – danach ist kein Beitritt mehr möglich (Art. 8 VFV).`,
      'Ehegatten müssen je einzeln beitreten. Die Beiträge gelten als bezahlt, wenn der erwerbstätige Ehegatte mindestens den doppelten Mindestbeitrag bezahlt.',
      'Die Beiträge eines Jahres müssen bis 31. Dezember des Folgejahres bezahlt sein, sonst folgt der Ausschluss (Art. 13 VFV). Rücktritt jederzeit auf Ende eines Quartals.',
      'Die Versicherung endet automatisch im Referenzalter.',
    );
  }
  return { berechtigt, gruende, hinweise, landEuEfta, vorReferenzalter };
}

/** Bemessung: Vermögen + 20 × Renteneinkommen, Verheiratete je die Hälfte (Art. 28 AHVV i.V.m. Art. 25 VFV). */
export function fwBemessung(
  vermoegen: number,
  renteneinkommenJahr: number,
  verheiratet: boolean,
  fw: FwRegeln,
): number {
  const basis = Math.max(0, vermoegen) + fw.bemessung.rentenFaktor * Math.max(0, renteneinkommenJahr);
  return verheiratet && fw.bemessung.verheirateteHaelftig ? basis / 2 : basis;
}

/** Jahresbeitrag Nichterwerbstätige ohne Verwaltungskosten (Art. 13b Abs. 2 VFV). */
export function fwBeitragTabelle(bemessung: number, fw: FwRegeln): number {
  return beitragAusTabelle(bemessung, fw.tabelleNichterwerbstaetige);
}

/** Jahresbeitrag Nichterwerbstätige inkl. Verwaltungskosten (5%, Art. 18a VFV). */
export function fwBeitragNichterwerbstaetig(
  vermoegen: number,
  renteneinkommenJahr: number,
  verheiratet: boolean,
  fw: FwRegeln,
): number {
  return (
    fwBeitragTabelle(fwBemessung(vermoegen, renteneinkommenJahr, verheiratet, fw), fw) * (1 + fw.verwaltungskosten)
  );
}

/** Jahresbeitrag Erwerbstätige inkl. Verwaltungskosten: 10,1% des Erwerbseinkommens, mind. 1'010 (Art. 13b Abs. 1 VFV). */
export function fwBeitragErwerbstaetig(erwerbseinkommenJahr: number, fw: FwRegeln): number {
  const b = Math.max(fw.satzErwerbstaetige * Math.max(0, erwerbseinkommenJahr), fw.mindestbeitrag);
  return b * (1 + fw.verwaltungskosten);
}

/**
 * Beiträge eines nichterwerbstätigen, freiwillig versicherten Ehegatten gelten als bezahlt,
 * wenn der erwerbstätige Ehegatte freiwillig mind. 2'020 bzw. obligatorisch mind. 1'060
 * bezahlt (Art. 13a Abs. 3 VFV, WFV Rz 4003/4003.1).
 */
export function fwBefreitDurchEhegatte(
  beitragEhegatteFreiwillig: number,
  beitragEhegatteObligatorisch: number,
  fw: FwRegeln,
): boolean {
  return (
    beitragEhegatteFreiwillig >= fw.befreiungEhegatte.freiwilligErwerbstaetig ||
    beitragEhegatteObligatorisch >= fw.befreiungEhegatte.obligatorischErwerbstaetig
  );
}
