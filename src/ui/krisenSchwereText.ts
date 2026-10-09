/**
 * Texte der Krisenauswahl. Die Zahlen kommen aus `krisenSchwere` (Jahresreihe), nicht aus
 * einer eingetippten Tabelle. Eigene Krisen sind eine Annahme und stehen immer am Schluss.
 */
import { EIGENE_KRISE_ID, type Krise } from '../core/krisen';
import { AUTO_KRISEN_IDS, KRISEN, type KrisenSchwere, krisenNachSchwere, krisenSchwere } from '../data/krisen';
import { fmtProzent } from './format';

const AUTO_IDS: readonly string[] = AUTO_KRISEN_IDS;

function jahreWort(n: number, kurz = false): string {
  if (kurz) return `${n} J.`;
  return n === 1 ? '1 Jahr' : `${n} Jahre`;
}

/**
 * Kompakte Optionszeile. Der Rückgang steht vorn, damit er im schmalen Feld sichtbar bleibt.
 * Der volle Name und «nach ca.» stehen in der Infozeile darunter.
 */
export function krisenOptionLabel(krise: Krise, s: KrisenSchwere): string {
  const name = `${krise.kurz} ${krise.von}`;
  const teile: string[] = [];
  if (s.jahreBisTiefpunkt !== null && s.maxRueckgang < 0) {
    teile.push(fmtProzent(s.maxRueckgang, 1));
    teile.push(name);
    teile.push(`Tiefpunkt nach ca. ${s.jahreBisTiefpunkt} J.`);
  } else {
    teile.push(name);
  }
  teile.push(`Dauer ${jahreWort(s.dauerJahre, true)}`);
  if (s.endeteImPlus) teile.push(`endete im Plus: +${fmtProzent(s.endeKumuliert, 1)}`);
  if (!AUTO_IDS.includes(krise.id)) teile.push('extrem');
  return teile.join(' · ');
}

/** Dauer so, wie die Infozeile sie zeigt. */
export function krisenDauerText(s: KrisenSchwere): string {
  const dauer = jahreWort(s.dauerJahre);
  if (s.dauerArt === 'erholt') {
    const phase = s.dauerJahre === s.phasenJahre ? '' : ` (Katalogphase ${jahreWort(s.phasenJahre)})`;
    return `${dauer} bis zum Vorkrisenniveau${phase}`;
  }
  if (s.dauerArt === 'offen') return `${dauer}, Vorkrisenniveau nicht wieder erreicht`;
  return `${dauer} (Katalogphase, kein Einbruch unter dem Vorkrisenstand)`;
}

/** Tiefpunkt so, wie die Infozeile ihn zeigt. */
export function krisenTiefpunktText(s: KrisenSchwere): string {
  if (s.jahreBisTiefpunkt === null) {
    return 'keiner (der Jahresendstand fiel nicht unter einen vorherigen Höchststand)';
  }
  const wort = s.jahreBisTiefpunkt === 1 ? 'Jahr' : 'Jahren';
  return `nach ca. ${s.jahreBisTiefpunkt} ${wort}`;
}

export interface KrisenWahlOption {
  value: string;
  label: string;
}

/**
 * Optionen der Krisenauswahl: Katalog nach Schwere, eigene Krise am Ende.
 * Die Beschriftung nutzt die Standard-Datenreihe der Krise. Die Id bleibt der Wert.
 */
export function krisenKatalogOptionen(krisen: readonly Krise[] = KRISEN): KrisenWahlOption[] {
  const katalog: KrisenWahlOption[] = [];
  for (const krise of krisenNachSchwere(krisen)) {
    const s = krisenSchwere(krise, krise.land);
    if (!s) continue;
    katalog.push({ value: krise.id, label: krisenOptionLabel(krise, s) });
  }
  katalog.push({ value: EIGENE_KRISE_ID, label: 'Eigene Krise (Annahme)' });
  return katalog;
}
