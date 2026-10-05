/**
 * Anzeige von Zeitpunkt und Alter beim AHV-Bezug.
 *
 * Rentenbeginn wie `ahvRentenbeginn`: der 1. des Monats nach dem Monat, in dem das
 * massgebende Alter erreicht ist (Referenzalter plus Vorbezug oder Aufschub).
 * Das Alter im Startmonat ist deshalb um einen Monat höher als das erreichte Alter.
 * Referenzalter inklusive Übergang AHV 21 (Frauen) kommt aus `ahvReferenzalter`.
 */
import {
  type AlterJM,
  ahvMaxVorbezugMonate,
  ahvReferenzalter,
  ahvRentenbeginn,
  inMonaten,
  monatBeiAlter,
} from '../core/ahv';
import type { Geschlecht, Monat } from '../core/typen';
import type { Regeln } from '../rules';
import { fmtMonat } from './format';

type AhvRegeln = Regeln['ahv'];

export type AhvBezugArt = 'referenzalter' | 'vorbezug' | 'aufschub';

export interface AhvBezugZeitpunkt {
  art: AhvBezugArt;
  referenzalter: AlterJM;
  /** Gesetzliches Referenzalter in Monaten. */
  referenzalterMonate: number;
  /** Negativ = Vorbezug, positiv = Aufschub, 0 = Referenzalter. */
  verschiebungMonate: number;
  /** Monat, in dem das massgebende Alter erreicht ist. */
  erreicht: Monat;
  /** Alter in diesem Monat, in Monaten (Referenzalter + Verschiebung). */
  alterErreichtMonate: number;
  /** Erster Monat der Rente. */
  beginn: Monat;
  /** Alter im Monat des Rentenbeginns, in Monaten. */
  alterBeiBeginnMonate: number;
}

export function ahvBezugArt(verschiebungMonate: number): AhvBezugArt {
  if (verschiebungMonate < 0) return 'vorbezug';
  if (verschiebungMonate > 0) return 'aufschub';
  return 'referenzalter';
}

/** «65 Jahre», «1 Jahr und 1 Monat», «64 Jahre und 3 Monate». */
export function fmtJahreMonate(monate: number): string {
  const n = Math.abs(Math.trunc(monate));
  const jahre = Math.floor(n / 12);
  const rest = n - jahre * 12;
  const teile: string[] = [];
  if (jahre === 1) teile.push('1 Jahr');
  else if (jahre > 1) teile.push(`${jahre} Jahre`);
  if (rest === 1) teile.push('1 Monat');
  else if (rest > 1) teile.push(`${rest} Monate`);
  return teile.length > 0 ? teile.join(' und ') : '0 Monate';
}

/** «1 Monat» oder «24 Monate». */
export function fmtMonatszahl(monate: number): string {
  const n = Math.abs(Math.trunc(monate));
  return n === 1 ? '1 Monat' : `${n} Monate`;
}

export function ahvBezugZeitpunkt(
  geburtsjahr: number,
  geburtsmonat: number,
  geschlecht: Geschlecht,
  verschiebungMonate: number,
  ahv: AhvRegeln,
): AhvBezugZeitpunkt {
  const referenzalter = ahvReferenzalter(geburtsjahr, geschlecht, ahv);
  const referenzalterMonate = inMonaten(referenzalter);
  const alterErreichtMonate = referenzalterMonate + verschiebungMonate;
  const alterBeiBeginnMonate = alterErreichtMonate + 1;
  return {
    art: ahvBezugArt(verschiebungMonate),
    referenzalter,
    referenzalterMonate,
    verschiebungMonate,
    erreicht: monatBeiAlter(geburtsjahr, geburtsmonat, alterErreichtMonate),
    alterErreichtMonate,
    beginn: ahvRentenbeginn(geburtsjahr, geburtsmonat, referenzalterMonate, verschiebungMonate),
    alterBeiBeginnMonate,
  };
}

/** Sichtbare Bezeichnung der Auswahl (Monat, Datum, Alter). */
export function ahvBezugOptionLabel(z: AhvBezugZeitpunkt): string {
  const ab = `ab 1. ${fmtMonat(z.beginn)}`;
  const alter = `Alter ${fmtJahreMonate(z.alterBeiBeginnMonate)}`;
  if (z.art === 'referenzalter') {
    return `Im Referenzalter (${fmtJahreMonate(z.referenzalterMonate)}, ${ab}, ${alter})`;
  }
  if (z.art === 'vorbezug') {
    return `Vorbezug (${fmtMonatszahl(-z.verschiebungMonate)} früher, ${ab}, ${alter})`;
  }
  return `Aufschub (${fmtMonatszahl(z.verschiebungMonate)} später, ${ab}, ${alter})`;
}

/**
 * Satz für eine Variante. `hinweis` ergänzt die Voreinstellung:
 * frühestmöglicher Vorbezug bzw. Mindestaufschub.
 */
export function ahvBezugSatz(z: AhvBezugZeitpunkt, hinweis?: 'fruehest' | 'minimum'): string {
  const beginn = `Die Rente beginnt am 1. ${fmtMonat(z.beginn)}. Sie sind dann ${fmtJahreMonate(z.alterBeiBeginnMonate)} alt.`;
  if (z.art === 'referenzalter') {
    return `Referenzalter: ${fmtJahreMonate(z.referenzalterMonate)}, erreicht im ${fmtMonat(z.erreicht)}. ${beginn}`;
  }
  const zusatz = hinweis === 'fruehest' ? ' (frühestmöglich)' : hinweis === 'minimum' ? ' (mindestens)' : '';
  const alter = `Alter ${fmtJahreMonate(z.alterErreichtMonate)}, erreicht im ${fmtMonat(z.erreicht)}`;
  if (z.art === 'vorbezug') {
    return `Vorbezug: ${fmtMonatszahl(-z.verschiebungMonate)} früher${zusatz}. ${alter}. ${beginn}`;
  }
  return `Aufschub: ${fmtMonatszahl(z.verschiebungMonate)} später${zusatz}. ${alter}. ${beginn}`;
}

export interface AhvBezugAnzeigen {
  art: AhvBezugArt;
  referenzalter: AhvBezugZeitpunkt;
  /** Gewählter Vorbezug oder, sonst, der frühestmögliche. */
  vorbezug: AhvBezugZeitpunkt;
  /** Gewählter Aufschub oder, sonst, der Mindestaufschub. */
  aufschub: AhvBezugZeitpunkt;
  saetze: Record<AhvBezugArt, string>;
}

/**
 * Texte für alle drei Varianten. Ist Vorbezug oder Aufschub gewählt, gelten die
 * eingegebenen Monate; sonst die Voreinstellung der Auswahl (Maximum bzw. Minimum).
 */
export function ahvBezugAnzeigen(
  geburtsjahr: number,
  geburtsmonat: number,
  geschlecht: Geschlecht,
  verschiebungMonate: number,
  ahv: AhvRegeln,
): AhvBezugAnzeigen {
  const art = ahvBezugArt(verschiebungMonate);
  const maxVorbezug = ahvMaxVorbezugMonate(geburtsjahr, geschlecht, ahv);
  const minAufschub = ahv.aufschub.minMonate;
  const referenzalter = ahvBezugZeitpunkt(geburtsjahr, geburtsmonat, geschlecht, 0, ahv);
  const vorbezug = ahvBezugZeitpunkt(
    geburtsjahr,
    geburtsmonat,
    geschlecht,
    art === 'vorbezug' ? verschiebungMonate : -maxVorbezug,
    ahv,
  );
  const aufschub = ahvBezugZeitpunkt(
    geburtsjahr,
    geburtsmonat,
    geschlecht,
    art === 'aufschub' ? verschiebungMonate : minAufschub,
    ahv,
  );
  return {
    art,
    referenzalter,
    vorbezug,
    aufschub,
    saetze: {
      referenzalter: ahvBezugSatz(referenzalter),
      vorbezug: ahvBezugSatz(vorbezug, -vorbezug.verschiebungMonate === maxVorbezug ? 'fruehest' : undefined),
      aufschub: ahvBezugSatz(aufschub, aufschub.verschiebungMonate === minAufschub ? 'minimum' : undefined),
    },
  };
}
