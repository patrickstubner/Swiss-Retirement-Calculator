/**
 * Texte der Krisenauswahl. Die Zahlen kommen aus `krisenSchwere` (Jahresreihe), nicht aus
 * einer eingetippten Tabelle. Eigene Krisen sind eine Annahme und stehen immer am Schluss.
 * «Katalogphase» ist die Länge, die die Simulation abspielt. Die historische Erholung
 * danach ist eine andere Angabe und heisst nicht Dauer.
 */
import { EIGENE_KRISE_ID, type Krise } from '../core/krisen';
import { AUTO_KRISEN_IDS, KRISEN, type KrisenSchwere, krisenNachSchwere, krisenSchwere } from '../data/krisen';
import { fmtProzent } from './format';

const AUTO_IDS: readonly string[] = AUTO_KRISEN_IDS;

function jahreWort(n: number, kurz = false): string {
  if (kurz) return `${n} J.`;
  return n === 1 ? '1 Jahr' : `${n} Jahre`;
}

/** «nach 1 Jahr» / «nach 13 Jahren». */
function jahreNach(n: number): string {
  return n === 1 ? '1 Jahr' : `${n} Jahren`;
}

/** Vorzeichen so, wie die App Prozente schreibt: «-62.7%» oder «+181.7%». */
export function krisenVorzeichenProzent(x: number, plus: boolean): string {
  const text = fmtProzent(x, 1);
  return plus ? `+${text}` : text;
}

/**
 * Kompakte Optionszeile. Der Aktienrückgang steht vorn, damit er im schmalen Feld sichtbar bleibt.
 * Die Katalogphase ist die abgespielte Länge. «nicht erholt» heisst: der Vorkrisenstand kam in
 * der Datenreihe nicht zurück. Ein Plus und ein Hauspreis-Rückgang sind Zusätze, keine eigene Gruppe.
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
  teile.push(`Katalogphase ${jahreWort(s.phasenJahre, true)}`);
  if (s.dauerArt === 'offen') teile.push('nicht erholt');
  else if (s.dauerArt === 'erholt' && s.dauerJahre > s.phasenJahre) {
    teile.push(`Aktien historisch nach ${s.dauerJahre} J. erholt`);
  }
  if (s.endeteImPlus) teile.push(`Aktien am Phasenende ${krisenVorzeichenProzent(s.endeKumuliert, true)}`);
  if (s.hauspreise && s.hauspreise.maxRueckgang < 0) {
    teile.push(`Hauspreise real max. ${fmtProzent(s.hauspreise.maxRueckgang, 1)}`);
  }
  if (!AUTO_IDS.includes(krise.id)) teile.push('extrem');
  return teile.join(' · ');
}

/** Katalogphase so, wie die Infozeile sie zeigt. Das ist die abgespielte Länge. */
export function krisenPhasenText(s: KrisenSchwere): string {
  return `Die App spielt nur die Katalogphase (${jahreWort(s.phasenJahre)}) ab, danach gilt Ihre Renditeannahme.`;
}

/** Historische Rückkehr auf den Vorkrisenstand. Nicht die Simulationslänge. */
export function krisenErholungText(s: KrisenSchwere): string {
  if (s.dauerArt === 'offen') return 'nicht erholt';
  if (s.dauerArt === 'phase') return 'kein Einbruch unter dem Vorkrisenstand';
  const nach = jahreNach(s.dauerJahre);
  if (s.dauerJahre > s.phasenJahre) {
    return `nach ${nach} wieder auf dem Vorkrisenniveau (liegt nach der Katalogphase und wird nicht abgespielt)`;
  }
  return `nach ${nach} wieder auf dem Vorkrisenniveau (innerhalb der Katalogphase)`;
}

/** Tiefpunkt so, wie die Infozeile ihn zeigt. */
export function krisenTiefpunktText(s: KrisenSchwere): string {
  if (s.jahreBisTiefpunkt === null) {
    return 'keiner (der Jahresendstand fiel nicht unter einen vorherigen Höchststand)';
  }
  const wort = s.jahreBisTiefpunkt === 1 ? 'Jahr' : 'Jahren';
  return `nach ca. ${s.jahreBisTiefpunkt} ${wort}`;
}

/** Aktienstand am Jahresende `bis`. */
export function krisenAktienEndeText(s: KrisenSchwere): string {
  return krisenVorzeichenProzent(s.endeKumuliert, s.endeteImPlus);
}

/**
 * Hauspreise der Katalogphase. null, wenn die Reihe lückenhaft ist.
 * Ein Rückgang von 0 ist «kein Rückgang», kein eingetippter Ersatzwert.
 */
export function krisenHauspreisText(s: KrisenSchwere): string | null {
  if (!s.hauspreise) return null;
  if (s.hauspreise.maxRueckgang < 0) return `real max. ${fmtProzent(s.hauspreise.maxRueckgang, 1)} (Peak-to-Trough)`;
  return 'kein Rückgang in den Jahreswerten';
}

export interface KrisenWahlOption {
  value: string;
  label: string;
}

/**
 * Optionen der Krisenauswahl: Katalog nach maximalem Aktienrückgang, eigene Krise am Ende.
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

/** Einmal berechnet. Die Jahresreihen sind statisch, die Liste wird nicht pro Zeile neu sortiert. */
export const KRISEN_KATALOG_OPTIONEN: readonly KrisenWahlOption[] = Object.freeze(krisenKatalogOptionen());
