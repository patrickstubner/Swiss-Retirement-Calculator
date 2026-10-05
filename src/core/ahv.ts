/**
 * AHV-Regelfunktionen (reine Funktionen). Alle Werte aus rules/<jahr>.json.
 * Renten in CHF/Monat, Sätze als Dezimalzahl.
 */
import type { Regeln } from '../rules';
import type { Geschlecht, Monat } from './typen';
import { endlich } from './zahlen';

type AhvRegeln = Regeln['ahv'];

export interface AlterJM {
  jahre: number;
  monate: number;
}

export const inMonaten = (a: AlterJM): number => a.jahre * 12 + a.monate;

/** Referenzalter nach Jahrgang und Geschlecht (AHV 21, Übergang Frauen 1961–1963). */
export function ahvReferenzalter(geburtsjahr: number, geschlecht: Geschlecht, r: AhvRegeln): AlterJM {
  if (!Number.isFinite(geburtsjahr)) throw new RangeError('Geburtsjahr muss eine endliche Zahl sein');
  const ra = r.referenzalter;
  if (geschlecht === 'm') return { jahre: ra.maenner.jahre, monate: ra.maenner.monate };
  const stufe = ra.frauen.find((s) => geburtsjahr <= s.bisJahrgang);
  if (!stufe) throw new RangeError(`Kein Referenzalter für Jahrgang ${geburtsjahr}`);
  return { jahre: stufe.jahre, monate: stufe.monate };
}

/** Laufende Monatsnummer (für Vergleiche): Jahr*12 + (Monat−1). */
export const monatIndex = (m: Monat): number => m.jahr * 12 + (m.monat - 1);
export const ausMonatIndex = (i: number): Monat => ({ jahr: Math.floor(i / 12), monat: (i % 12) + 1 });

/**
 * Monat, in dem ein Alter (in Monaten) erreicht wird (Geburtstagsmonat bzw. Monat des
 * Erreichens).
 */
export function monatBeiAlter(geburtsjahr: number, geburtsmonat: number, alterMonate: number): Monat {
  if (![geburtsjahr, geburtsmonat, alterMonate].every(Number.isFinite))
    throw new RangeError('Geburtsjahr, Geburtsmonat und Alter müssen endliche Zahlen sein');
  return ausMonatIndex(geburtsjahr * 12 + (geburtsmonat - 1) + alterMonate);
}

/**
 * Rentenbeginn: 1. des Monats nach Erreichen des RA, verschoben um Vorbezug (negativ)
 * bzw. Aufschub (positiv) in Monaten.
 */
export function ahvRentenbeginn(
  geburtsjahr: number,
  geburtsmonat: number,
  referenzalterMonate: number,
  verschiebungMonate = 0,
): Monat {
  return monatBeiAlter(geburtsjahr, geburtsmonat, referenzalterMonate + 1 + verschiebungMonate);
}

/** mdJE auf Tabellenstufe runden (gemäss Regel `mdjeRundung`). */
export function mdjeTabellenwert(mdjeRoh: number, r: AhvRegeln): number {
  const mdje = endlich(mdjeRoh);
  const f = r.rentenformel;
  if (mdje <= f.mdjeMinimum) return f.mdjeMinimum;
  if (mdje >= f.mdjeMaximum) return f.mdjeMaximum;
  const stufen = (mdje - f.mdjeMinimum) / r.rententabelleStufe;
  const n = r.mdjeRundung === 'aufrunden' ? Math.ceil(stufen - 1e-9) : Math.round(stufen);
  return Math.min(f.mdjeMaximum, f.mdjeMinimum + n * r.rententabelleStufe);
}

/**
 * Volle Altersrente Skala 44 nach Art. 34 AHVG (CHF/Monat, auf Franken gerundet).
 * @param tabellenStufen mdJE vorher auf die Stufe der Rententabelle runden
 */
export function ahvRenteSkala44(mdjeRoh: number, r: AhvRegeln, tabellenStufen = true): number {
  const mdje = endlich(mdjeRoh);
  const f = r.rentenformel;
  const min = r.minimalrenteMonat;
  const x = tabellenStufen ? mdjeTabellenwert(mdje, r) : Math.min(Math.max(mdje, f.mdjeMinimum), f.mdjeMaximum);
  const knick = f.knickFaktorMinimalrente * min;
  const rente =
    x <= knick
      ? f.untenFaktorMin * min + (f.untenSatzZaehler / f.satzNenner) * x
      : f.obenFaktorMin * min + (f.obenSatzZaehler / f.satzNenner) * x;
  return Math.round(Math.min(Math.max(rente, min), r.maximalrenteMonat));
}

/** Umkehrung der Rentenformel: geschätztes mdJE aus einer vollen Monatsrente. */
export function ahvMdjeAusRente(renteMonatRoh: number, r: AhvRegeln): number {
  const renteMonat = endlich(renteMonatRoh);
  const f = r.rentenformel;
  const min = r.minimalrenteMonat;
  if (renteMonat <= min) return f.mdjeMinimum;
  if (renteMonat >= r.maximalrenteMonat) return f.mdjeMaximum;
  const knick = f.knickFaktorMinimalrente * min;
  const unten = ((renteMonat - f.untenFaktorMin * min) * f.satzNenner) / f.untenSatzZaehler;
  if (unten <= knick) return unten;
  return ((renteMonat - f.obenFaktorMin * min) * f.satzNenner) / f.obenSatzZaehler;
}

/** Teilrente vereinfacht linear: Rente × Beitragsjahre / 44. */
export function ahvTeilrente(renteMonat: number, beitragsjahre: number, r: AhvRegeln): number {
  const voll = r.vollrenteBeitragsjahre;
  const j = Math.min(Math.max(endlich(beitragsjahre), 0), voll);
  return (endlich(renteMonat) * j) / voll;
}

export function istUebergangsFrau(geburtsjahr: number, geschlecht: Geschlecht, r: AhvRegeln): boolean {
  const v = r.vorbezug;
  return geschlecht === 'w' && geburtsjahr >= v.uebergangJahrgangVon && geburtsjahr <= v.uebergangJahrgangBis;
}

/**
 * Frühestes AHV-Bezugsalter (Vorbezug) in Jahren, abgeleitet aus Jahrgang und Geschlecht:
 * 63, Frauen der Übergangsgeneration (Jg. 1961–1969) 62 (MB 3.04). Keine Eingabe –
 * gilt nur für die AHV, nicht für die Pensionskasse.
 */
export function ahvFruehestesBezugsalter(geburtsjahr: number, geschlecht: Geschlecht, r: AhvRegeln): number {
  return istUebergangsFrau(geburtsjahr, geschlecht, r)
    ? r.vorbezug.fruehestesAlterUebergangFrauen
    : r.vorbezug.fruehestesAlter;
}

/** Maximal zulässiger Vorbezug in Monaten (ab 63, Frauen Jg. 1961–1969 ab 62). */
export function ahvMaxVorbezugMonate(geburtsjahr: number, geschlecht: Geschlecht, r: AhvRegeln): number {
  const ra = inMonaten(ahvReferenzalter(geburtsjahr, geschlecht, r));
  if (istUebergangsFrau(geburtsjahr, geschlecht, r)) {
    return Math.max(0, ra - r.vorbezug.fruehestesAlterUebergangFrauen * 12);
  }
  return Math.max(0, Math.min(r.vorbezug.maxMonateOrdentlich, ra - r.vorbezug.fruehestesAlter * 12));
}

/**
 * Weitester Vorbezug in Monaten, den die Regeln für irgendeinen Jahrgang zulassen:
 * höchstes Referenzalter minus frühestes Übergangsalter (× 12). Für die Speichergrenze,
 * nicht für die Prüfung einer einzelnen Person.
 */
export function ahvWeitesterVorbezugMonate(r: AhvRegeln): number {
  const ra = r.referenzalter;
  const maxRa = Math.max(inMonaten(ra.maenner), ...ra.frauen.map((s) => inMonaten(s)));
  return Math.max(0, maxRa - r.vorbezug.fruehestesAlterUebergangFrauen * 12);
}

function stufeNachMdje<T extends { mdjeBis: number | null }>(stufen: readonly T[], mdjeRoh: number): T {
  const mdje = endlich(mdjeRoh);
  const s = stufen.find((x) => x.mdjeBis === null || mdje <= x.mdjeBis);
  if (!s) throw new RangeError('Keine mdJE-Stufe gefunden');
  return s;
}

/**
 * Kürzungssatz bei Vorbezug (0–1). Ordentliche Tabelle bzw. reduzierte Sätze für Frauen
 * der Übergangsgeneration (Jahreswerte verifiziert, Monatswerte linear interpoliert).
 */
export function ahvVorbezugKuerzung(
  monate: number,
  geburtsjahr: number,
  geschlecht: Geschlecht,
  mdje: number,
  r: AhvRegeln,
): number {
  if (!Number.isInteger(monate) || monate < 0) throw new RangeError('Vorbezugsmonate müssen ganzzahlig ≥ 0 sein');
  if (monate === 0) return 0;
  const max = ahvMaxVorbezugMonate(geburtsjahr, geschlecht, r);
  if (monate > max) throw new RangeError(`Vorbezug von ${monate} Monaten nicht zulässig (max. ${max})`);
  if (istUebergangsFrau(geburtsjahr, geschlecht, r)) {
    const saetze = [0, ...stufeNachMdje(r.uebergangKuerzung, mdje).saetzeProJahr];
    const j = Math.floor(monate / 12);
    const rest = monate % 12;
    const a = saetze[j] ?? 0;
    const b = saetze[Math.min(j + 1, saetze.length - 1)] ?? a;
    return a + ((b - a) * rest) / 12;
  }
  const satz = r.vorbezugKuerzung[monate - 1];
  if (satz === undefined) throw new RangeError(`Kein Kürzungssatz für ${monate} Monate`);
  return satz;
}

/** Aufschubzuschlag (0–1) für 12–60 Monate Aufschub. */
export function ahvAufschubZuschlag(monate: number, r: AhvRegeln): number {
  if (monate === 0) return 0;
  const { minMonate, maxMonate } = r.aufschub;
  if (!Number.isInteger(monate) || monate < minMonate || monate > maxMonate) {
    throw new RangeError(`Aufschub nur ${minMonate}–${maxMonate} Monate möglich`);
  }
  const jahre = Math.floor(monate / 12);
  const gruppe = Math.floor((monate % 12) / 3);
  const satz = r.aufschubZuschlag[jahre - 1]?.[gruppe];
  if (satz === undefined) throw new RangeError(`Kein Zuschlag für ${monate} Monate`);
  return satz;
}

/** Prüft eine Bezugsverschiebung; gibt eine Fehlermeldung oder null zurück. */
export function pruefeAhvVerschiebung(
  verschiebungMonate: number,
  geburtsjahr: number,
  geschlecht: Geschlecht,
  r: AhvRegeln,
): string | null {
  if (!Number.isInteger(verschiebungMonate)) return 'Bitte ganze Monate angeben.';
  if (verschiebungMonate < 0) {
    const max = ahvMaxVorbezugMonate(geburtsjahr, geschlecht, r);
    if (-verschiebungMonate > max) return `Vorbezug höchstens ${max} Monate.`;
  } else if (verschiebungMonate > 0) {
    const { minMonate, maxMonate } = r.aufschub;
    if (verschiebungMonate < minMonate || verschiebungMonate > maxMonate)
      return `Aufschub nur ${minMonate}–${maxMonate} Monate.`;
  }
  return null;
}

/** Multiplikativer Faktor auf die Rente: 1 − Kürzung bzw. 1 + Zuschlag. */
export function ahvBezugFaktor(
  verschiebungMonate: number,
  geburtsjahr: number,
  geschlecht: Geschlecht,
  mdje: number,
  r: AhvRegeln,
): number {
  if (verschiebungMonate < 0) return 1 - ahvVorbezugKuerzung(-verschiebungMonate, geburtsjahr, geschlecht, mdje, r);
  if (verschiebungMonate > 0) return 1 + ahvAufschubZuschlag(verschiebungMonate, r);
  return 1;
}

/**
 * Rentenzuschlag Übergangsgeneration (CHF/Monat, nominal fix): nur Frauen Jg. 1961–1969
 * ohne Vorbezug; bei Teilrente anteilig. Bei unvollständiger Beitragsdauer wird der Betrag auf den nächsthöheren
 * ganzen Franken AUFGERUNDET. Quelle: KS-R AHV 21 (BSV 318.303.05, Stand 01.01.2026), Rz 5007, Beispiel
 * «Fr. 160 x Skala 35 / Skala 44 = Fr. 128 (aufgerundet auf den nächst höheren Franken)»
 * (https://sozialversicherungen.admin.ch/de/d/20135/download).
 * OFFEN: Das Kreisschreiben nennt das Aufrunden nur für die Skalenkürzung (Beispiel mit 100 % Jahrgangsanteil);
 * die Reihenfolge bei zusätzlich gestuftem Jahrgangsanteil (< 100 %) ist dort nicht ausgeführt. Hier wird der
 * Endbetrag aufgerundet; bei voller Beitragsdauer bleibt der Betrag unverändert (keine Rundung belegt).
 */
export function ahvRentenzuschlag(
  geburtsjahr: number,
  geschlecht: Geschlecht,
  mdje: number,
  verschiebungMonate: number,
  beitragsjahre: number,
  r: AhvRegeln,
): number {
  if (!istUebergangsFrau(geburtsjahr, geschlecht, r) || verschiebungMonate < 0) return 0;
  const z = r.rentenzuschlagUebergang;
  const anteil = z.jahrgangsanteil.find(([j]) => j === geburtsjahr)?.[1] ?? 0;
  const betrag = stufeNachMdje(z.stufen, mdje).betragMonat;
  const jahre = Math.min(Math.max(endlich(beitragsjahre), 0), r.vollrenteBeitragsjahre);
  const skala = jahre / r.vollrenteBeitragsjahre;
  const zuschlag = betrag * anteil * skala;
  return jahre < r.vollrenteBeitragsjahre ? Math.max(0, Math.ceil(zuschlag - 1e-9)) : zuschlag;
}

/**
 * Plafonierung Ehepaar: Summe beider Renten höchstens 150% der Maximalrente,
 * proportional gekürzt.
 */
export function ahvPlafonierung(rente1Roh: number, rente2Roh: number, r: AhvRegeln): [number, number] {
  const rente1 = endlich(rente1Roh);
  const rente2 = endlich(rente2Roh);
  const plafond = r.plafondEhepaarFaktor * r.maximalrenteMonat;
  const summe = rente1 + rente2;
  if (summe <= plafond || summe <= 0) return [rente1, rente2];
  const f = plafond / summe;
  return [rente1 * f, rente2 * f];
}

/** 13. AHV-Rente: 1/12 der im Jahr ausbezahlten Altersrenten (ab 2026). */
export function ahv13(jahresrente: number, jahr: number, r: AhvRegeln): number {
  const d = r.dreizehnteRente;
  return endlich(jahr, 0) >= d.abJahr ? endlich(jahresrente) / d.divisor : 0;
}
