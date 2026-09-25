/** Texte (de-CH). Später in eine Übersetzungsdatei auslagerbar. */
import type { UmwandlungssatzSchaetzung } from '../core/schaetzwerte';
import { fmtProzent } from './format';

export const DISCLAIMER_KURZ =
  'Unverbindliche Orientierung – ersetzt keine Finanz-, Steuer-, Rechts- oder Vorsorgeberatung.';

/** Entwurf aus docs/konzept.md, Abschnitt (e). */
export const DISCLAIMER_ABSAETZE: readonly string[] = [
  'Dieser Rechner dient ausschliesslich der unverbindlichen Information und Orientierung. Er ersetzt keine persönliche Finanz-, Steuer-, Rechts- oder Vorsorgeberatung. Massgebend sind allein die Verfügungen und Auskünfte der zuständigen Ausgleichskasse, Ihrer Pensionskasse (Reglement und Vorsorgeausweis), der Steuerbehörden sowie die geltenden Gesetze.',
  'Die Berechnungen beruhen auf vereinfachten Modellen, auf den von Ihnen eingegebenen Daten und auf den gesetzlichen Werten mit Stand 2026 (siehe Quellenverzeichnis). Gesetze, Renten, Steuertarife und Zinsen können sich ändern. Historische Renditen und Szenarien sind keine Prognose für die Zukunft; auch Ergebnisse mit hoher «Erfolgswahrscheinlichkeit» bieten keine Garantie.',
  'Ihre Eingaben werden nur in Ihrem Browser verarbeitet und nicht an uns oder Dritte übermittelt. Für die Richtigkeit, Vollständigkeit und Aktualität der Ergebnisse wird keine Haftung übernommen.',
  'Datenquellen: Bundesamt für Sozialversicherungen, Informationsstelle AHV/IV, ESTV, BFS, Jordà-Schularick-Taylor Macrohistory Database (CC BY-NC-SA 4.0) u.a. – siehe Quellen.',
];

export const VEREINFACHUNG_WOHNEIGENTUM =
  'Vereinfachung: Wohneigentum wird wie an der Börse angelegtes Kapital behandelt; Eigenmietwert, Unterhalt und Verkaufskosten sind nicht berücksichtigt.';

export const VEREINFACHUNG_BOERSE =
  'Annahme: Jeder Vermögenstopf hat eine konstante Rendite (Bargeld: Zins Bargeld; Wertschriften und Nettowert Wohneigentum: Börsenrendite; Sonstiges: eigene Rendite). Entnahmen: Bargeld → Wertschriften → Sonstiges → Wohneigentum.';

/** Hilfetext zum Umwandlungssatz (Modus «Schnell» und «Detailliert»). */
export const UWS_HILFE = (mindest: string) =>
  `Der gesetzliche Satz von ${mindest} gilt nur für den obligatorischen Teil des Guthabens. Die meisten Pensionskassen wenden auf das ganze Guthaben einen tieferen eigenen Satz an. Er steht auf dem jährlichen Vorsorgeausweis.`;

/** Hinweis, wenn der Umwandlungssatz nur geschätzt ist (PK-Guthaben vorhanden). */
export const UWS_GESCHAETZT =
  'Der Umwandlungssatz ist nur geschätzt – Ihre Pensionskasse kann deutlich abweichen. Tragen Sie den Satz laut Vorsorgeausweis ein; er hat immer Vorrang.';

/** Aufteilung der Umwandlungssatz-Schätzung, z.B. für den Hinweis beim leeren Feld. */
export function uwsSchaetzungText(u: UmwandlungssatzSchaetzung): string {
  const anteil = Math.round(u.anteilObligatorium * 100);
  const basis = u.bvgGuthabenEingegeben
    ? 'BVG-Altersguthaben laut Vorsorgeausweis'
    : 'geschätzt aus BVG-Mindestgutschriften';
  if (u.anteilObligatorium >= 0.995)
    return `Schätzung: ${fmtProzent(u.satzObligatorium)} – das Guthaben ist voraussichtlich ganz obligatorisch (${basis}).`;
  return `Schätzung: ${fmtProzent(u.satzObligatorium)} auf den obligatorischen Teil (ca. ${anteil}%, ${basis}), ${fmtProzent(u.satzUeberobligatorium, 2)} auf den Rest, ergibt ca. ${fmtProzent(u.satz)}.`;
}

/** Kurzform für die Liste der Schätzwerte (Karte «Genauigkeit»). */
export function uwsKurz(satz: number, u: UmwandlungssatzSchaetzung | undefined): string {
  if (!u || u.anteilObligatorium >= 0.995) return fmtProzent(satz);
  return `ca. ${fmtProzent(satz)} (${fmtProzent(u.satzObligatorium)} auf ca. ${Math.round(u.anteilObligatorium * 100)}% obligatorischen Teil, ${fmtProzent(u.satzUeberobligatorium, 2)} auf den Rest)`;
}

/** Quelle der Umwandlungssatz-Schätzung (kurz, für die Oberfläche). */
export const UWS_QUELLE = (u: UmwandlungssatzSchaetzung) =>
  `${fmtProzent(u.satzObligatorium)}: gesetzliches Minimum fürs Obligatorium (Art. 14 BVG). ${fmtProzent(u.satzUeberobligatorium, 2)}: durchschnittlicher Umwandlungssatz der Pensionskassen mit 65 (OAK BV, Bericht zur finanziellen Lage 2025, Stand 31.12.2025) – ein umhüllender Satz, den die Kassen aufs ganze Guthaben anwenden; hier nur für den überobligatorischen Rest verwendet.`;

export const VEREINFACHUNGEN: readonly string[] = [
  VEREINFACHUNG_BOERSE,
  VEREINFACHUNG_WOHNEIGENTUM,
  'Alle Beträge in heutigen Franken (real). Steuertarife und Grenzbeträge werden als an die Teuerung angepasst angenommen.',
  'Rendite und Inflation sind konstant (deterministisch). Historische Krisenszenarien folgen.',
  'Kantons- und Gemeindesteuern: ZH und AG exakt nach Tarif 2026 mit Gemeinde- und Kirchensteuerfuss (validiert mit dem ESTV-Steuerrechner); übrige 24 Kantone als Näherung über effektive Sätze des Hauptorts (ESTV-Steuerrechner 2026), ohne Kirchensteuer. Kantonale Abzüge nicht berücksichtigt. Direkte Bundessteuer exakt nach Tarif 2026.',
  'Steuerbares Einkommen vereinfacht: Lohn abzüglich AHV/ALV- und Vorsorgebeiträgen, Renten zu 100%, pauschaler Vermögensertrag; keine weiteren Abzüge.',
  'Vorsorgegelder sind gesperrt: PK bis zum frühesten Bezugsalter gemäss Reglement (Standard 63), Freizügigkeit und 3a bis 5 Jahre vor dem Referenzalter. Fehlt vorher Geld, wird eine Liquiditätslücke ausgewiesen. Barauszahlung vor 58 (Wegzug, Selbstständigkeit) nicht abgebildet.',
  'AHV-Schätzhilfe: grobe Schätzung (Skala 44, Teilrente linear, ohne Aufwertungsfaktoren/Jugendjahre). Verbindlich ist nur die Rentenvorausberechnung der Ausgleichskasse.',
  'AHV-Teilrente linear (Beitragsjahre/44); Plafonierung auf den ungekürzten Renten, danach Vorbezug/Aufschub. Kein Todesfall-/Verwitwetenszenario.',
  'Reduzierte Vorbezugssätze der Übergangsgeneration: Jahreswerte verifiziert, Monatswerte linear interpoliert.',
  'PK- und Rentenzuschlag nominal fix (verlieren real an Wert). PK-Bezug bei Erwerbsaufgabe, frühestens gemäss Reglement.',
  'Ausländische Renten: Wechselkurs mit optionaler realer Auf-/Abwertung pro Jahr; Quellensteuer im Ausland als Satz, ohne Anrechnung in der Schweiz.',
  'Vermögenssteuer auf dem Anlagevermögen inkl. Nettowert Wohneigentum zum Verkehrswert (kantonaler Steuerwert folgt).',
  'Wegzug ins Ausland: bildet nur die AHV ab (Ende der NE-Beiträge bzw. freiwillige AHV und Beitragslücken). Steuern und Sozialversicherung im Ausland, PK-Barauszahlung und Quellensteuer auf Vorsorgekapital sind nicht abgebildet; Schweizer Steuern werden weiter gerechnet.',
  'AHV-Beitragslücken durch Auslandwohnsitz: Rente vereinfacht linear gekürzt (fehlende Jahre / Beitragsjahre), ohne Einfluss auf das massgebende durchschnittliche Jahreseinkommen.',
  'AHV-Beiträge als Nichterwerbstätige (in der Schweiz und freiwillige AHV): Vermögen am 31.12. (ohne noch gesperrte PK/FZ/3a, bezogene Kapitalien ab dem Bezugsjahr) + 20× Renteneinkommen inkl. AHV und PK; Ehepaare je hälftig. Tabellengrenzen real konstant. Vergleich mit Erwerbsbeiträgen bei Teilzeit nicht abgebildet.',
  'Keine PK-Einkäufe (folgen). Einmalereignisse und wiederkehrende Posten in heutigen Franken.',
  'Schätzwerte (Modus «Schnell» und leere Detailfelder, Badge «geschätzt»): AHV-Rente nach Skala 44 mit heutigem Lohn als Durchschnittseinkommen, ohne Lücken (ausser Zuzug nach dem 20. Altersjahr) und ohne Erziehungsgutschriften, Ehepaare mit Splitting über die ganze Beitragsdauer; PK-Guthaben aus BVG-Mindestgutschriften und BVG-Mindestzins (bei umhüllenden Kassen meist zu tief), Sparbeitrag BVG-Minimum, Umwandlungssatz ohne Angabe aufgeteilt: 6,8% (BVG-Minimum) auf den geschätzten obligatorischen Teil, der durchschnittliche Umwandlungssatz der Pensionskassen (OAK BV, siehe Quellen) auf den Rest – Anteil des Obligatoriums aus BVG-Mindestgutschriften geschätzt (oder BVG-Altersguthaben laut Vorsorgeausweis), Bezug als Rente, keine 3a-Einzahlungen.',
  'Das Planungsalter gilt für die jüngere Person; beide Personen werden als lebend bis zum Planungshorizont angenommen.',
];
