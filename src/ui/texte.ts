/** Texte (de-CH). Später in eine Übersetzungsdatei auslagerbar. */

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
  'Kein Wegzug ins Ausland und keine PK-Einkäufe (folgen). Einmalereignisse und wiederkehrende Posten in heutigen Franken.',
  'Das Planungsalter gilt für die jüngere Person; beide Personen werden als lebend bis zum Planungshorizont angenommen.',
];
