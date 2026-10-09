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

/**
 * Hauspreise in der Auswahl erst ab diesem realen Peak-to-Trough.
 * Kleiner (Dotcom etwa -0.1 %) gilt als Rauschen und wird wie «kein Rückgang» gezeigt.
 * -0.01 = −1 Prozentpunkt.
 */
export const HAUSPREIS_ANZEIGE_AB = -0.01;

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

/** Ein Zusatz in der Optionszeile. Der Rest steht im Kasten unter der Auswahl. */
function krisenOptionZusatz(krise: Krise, s: KrisenSchwere): string | null {
  if (!AUTO_IDS.includes(krise.id)) return 'extrem';
  if (s.dauerArt === 'offen') return 'nicht erholt';
  if (s.hauspreise && s.hauspreise.maxRueckgang <= HAUSPREIS_ANZEIGE_AB) {
    return `Häuser ${fmtProzent(s.hauspreise.maxRueckgang, 1)}`;
  }
  return null;
}

/**
 * Kurze Optionszeile: Rückgang, Name und höchstens ein Zusatz.
 * Reihenfolge des Zusatzes: «extrem», dann «nicht erholt», dann «Häuser -x%»
 * (nur ab `HAUSPREIS_ANZEIGE_AB`). Katalogphase, Erholung, Phasenende und der
 * Aktien-Tiefpunkt stehen nur im Kasten darunter.
 */
export function krisenOptionLabel(krise: Krise, s: KrisenSchwere): string {
  const name = `${krise.kurz} ${krise.von}`;
  const teile: string[] = [];
  if (s.jahreBisTiefpunkt !== null && s.maxRueckgang < 0) teile.push(fmtProzent(s.maxRueckgang, 1));
  teile.push(name);
  const zusatz = krisenOptionZusatz(krise, s);
  if (zusatz) teile.push(zusatz);
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
 * Hauspreise im Kasten. Eine Lücke nennt die fehlenden Jahre: die Simulation setzt dann
 * `renditeNominal` ein (bei Ausgleich die normale Hauspreisrendite), nicht eine eigene
 * Wohneigentumsrendite. Rückgänge flacher als `HAUSPREIS_ANZEIGE_AB` gelten als kein Rückgang.
 */
export function krisenHauspreisText(s: KrisenSchwere): string | null {
  if (s.hauspreisJahreOhneDaten.length > 0) {
    const jahre = s.hauspreisJahreOhneDaten.join(', ');
    return `keine Jahresdaten ${jahre}; die Rechnung nutzt Ihre Renditeannahme.`;
  }
  if (!s.hauspreise) return null;
  if (s.hauspreise.maxRueckgang <= HAUSPREIS_ANZEIGE_AB) {
    return `real max. ${fmtProzent(s.hauspreise.maxRueckgang, 1)} (Peak-to-Trough)`;
  }
  return 'kein Rückgang in den Jahreswerten';
}

/** «extrem» im Kasten, auch wenn die Zeile einen anderen Zusatz trägt. */
export function krisenExtremText(kriseId: string): string | null {
  if (AUTO_IDS.includes(kriseId)) return null;
  return 'extrem (nicht in «Automatisch»)';
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
