# Ruhestandsrechner Schweiz

> **Reicht mein Vermögen für den Ruhestand?**

Statische Web-App (GitHub Pages) für Einzelpersonen und Ehepaare in der Schweiz: AHV, Pensionskasse, Säule 3a,
ausländische Renten, freies Vermögen, Ausgaben und Steuern werden Jahr für Jahr in heutigen Franken simuliert. Der
Rechner sucht das **früheste Rücktrittsalter**, bei dem das Vermögen bis zum gewählten Planungsalter reicht.

**Live:** https://patrickstubner.github.io/Swiss-Retirement-Calculator/

Alle Berechnungen laufen ausschliesslich im Browser. Es gibt keinen Server, keine Cookies und kein Tracking.

**Speichern:** Ganz oben in der App steht der Schalter «Eingaben im Browser speichern» (Standard: an). Ist er an, wird
der ganze App-Zustand als ein JSON-Objekt unter dem Schlüssel `ruhestandsrechner:v1` im `localStorage` gespeichert
(mit Versionsnummer, entprellt 300 ms) und beim nächsten Besuch wiederhergestellt. Beim Ausschalten werden dieser und
alle früher verwendeten Schlüssel (`ruhestandsrechner:zustand`, `ruhestandsrechner:speichern`) sofort gelöscht; übrig
bleibt nur das Merkmal `ruhestandsrechner:speichern-aus` = `1` (ohne Finanzdaten). **Teilen:** «Link erstellen» packt
die Eingaben ins URL-Fragment (`#s=…`, wird nicht an den Server gesendet). Ein geöffneter Link hat Vorrang vor den
gespeicherten Eingaben; diese werden erst überschrieben, wenn man den Link übernimmt oder etwas ändert.

## Wichtiger Hinweis

Dieser Rechner dient ausschliesslich der unverbindlichen Information und Orientierung. Er **ersetzt keine persönliche
Finanz-, Steuer-, Rechts- oder Vorsorgeberatung**. Massgebend sind allein die Verfügungen und Auskünfte der zuständigen
Ausgleichskasse, Ihrer Pensionskasse (Reglement und Vorsorgeausweis), der Steuerbehörden sowie die geltenden Gesetze.
Die Berechnungen beruhen auf vereinfachten Modellen, auf Ihren Eingaben und auf den gesetzlichen Werten mit Stand 2026.
Gesetze, Renten, Steuertarife und Zinsen können sich ändern. Für die Richtigkeit, Vollständigkeit und Aktualität der
Ergebnisse wird keine Haftung übernommen. Nicht-kommerzielles Projekt.

## Funktionsumfang (Version 1.1)

Aktuelle Version: **1.1.1** (siehe [CHANGELOG](CHANGELOG.md); Versionsregel in [CONTRIBUTING](CONTRIBUTING.md)).

- **Neutrale Standardwerte:** Alle Beträge sind anfangs leer (0) und frei editierbar – keine Beispielvermögen.
  Gesetzliche Werte (z.B. BVG-Mindestzins) und Annahmen (Standard: 7 % Rendite nominal, 2 % Teuerung; eine Annahme, keine Garantie) sind vorbelegt und anpassbar. Der Schnellmodus rechnet mit denselben Annahmen wie «Detailliert» und zeigt sie sichtbar an.
- **Vorlesen (Sprachausgabe im Browser):** «Ganze Seite vorlesen» oben, dazu je Abschnitt «▶ Vorlesen» und «ab hier».
  Beim Lesen wird der aktuelle Satz (und, wo der Browser Wortgrenzen meldet, das Wort) hervorgehoben und die Seite
  scrollt mit (bei «reduzierte Bewegung» ohne Animation). Die Leiste unten bietet Pause/Weiter, Stopp, 10 Sekunden
  zurück/vor sowie Tempo und Stimme (Esc beendet das Vorlesen). **«10 Sekunden» ist geschätzt:** Die Sprachausgabe
  kann nicht zeitgenau springen; die Dauer wird aus der Textlänge und der Messung schon gelesener Sätze geschätzt, gesprungen
  wird zum Satzanfang. Gelesen werden nur Erklär-, Hinweis- und Ergebnistexte, nie Eingabefelder, Beschriftungen,
  Tabellen oder versteckte Inhalte. Abkürzungen und Zahlen werden für die Aussprache aufbereitet (CHF, AHV, BVG, %,
  Tausenderapostroph, «Säule 3a», Jahreszahlen). Es werden nur **lokale** deutsche Stimmen des Geräts verwendet
  (de-CH bevorzugt); Online-Stimmen werden aus Datenschutzgründen nie angeboten. Fehlt die Sprachausgabe oder eine
  deutsche Stimme, werden die Knöpfe ausgeblendet (mit Hinweis). Tempo und Stimme werden nur gespeichert, wenn
  «Eingaben im Browser speichern» an ist. Technik und Grenzen: `docs/vorlesen.md`; Screenshots `screenshots/120-…` bis `125-…`.
- **Beträge mit Tausendertrennzeichen:** Alle Betragsfelder (CHF und Fremdwährungen) zeigen schon beim Tippen das
  Schweizer Format mit Apostroph (1’250’000, Zeichen ’ app-weit einheitlich, auch in den Ergebnissen). Einfügen von
  «1 250 000» oder «1,250,000» funktioniert, der Cursor bleibt an seiner Stelle. Jahre, Alter, Prozente und Anzahlen
  werden nicht gruppiert.
- **Modus «Schnell» / «Detailliert»** (Umschalter oben; beim ersten Start ohne gespeicherten Zustand standardmässig
  «Schnell»; ein gespeicherter Modus bleibt, ein geteilter Link mit Detailwerten öffnet «Detailliert»):
  «Schnell» fragt pro Person nur Jahrgang/Monat, Geschlecht, Bruttoeinkommen, Erwerbsaufgabe, optional
  PK-Guthaben und «Umwandlungssatz laut Vorsorgeausweis» (derselbe Wert wie im Detail-Feld; ohne Angabe die
  aufgeteilte Schätzung, siehe unten, mit Empfehlung, den Satz vom Vorsorgeausweis einzutragen), 3a-Guthaben, übriges Vermögen, Wohneigentum (Verkehrswert) und optional «in der Schweiz seit»
  sowie für den Haushalt Ausgaben, Kanton/Gemeinde, Zivilstand und Planungsalter ab. Alles andere kommt aus
  dokumentierten Schätzwerten (`src/core/schaetzwerte.ts`): AHV nach Skala 44 (Einkommen = heutiger Lohn, keine
  Lücken ausser Zuzug, Splitting/Plafonierung bei Ehepaaren), PK-Guthaben aus BVG-Altersgutschriften und
  Mindestzins, Sparbeitrag BVG-Minimum, Bezug als Rente. **Umwandlungssatz (falls leer)**: 6,8% (BVG-Minimum,
  Art. 14 BVG) auf den obligatorischen Teil, **5,17%** auf den Rest – durchschnittlicher Umwandlungssatz der
  Pensionskassen mit 65 laut OAK BV (Bericht zur finanziellen Lage 2025, Stand 31.12.2025; ein umhüllender Satz,
  hier nur fürs Überobligatorium verwendet). Der obligatorische Anteil wird aus BVG-Mindestgutschriften geschätzt
  (Näherung; im Modus «Detailliert» optional «Davon BVG-Altersguthaben» laut Vorsorgeausweis) und bis zum
  Referenzalter hochgerechnet; die Oberfläche zeigt z.B. «6,8% auf den obligatorischen Teil (ca. 42%), 5,17% auf den
  Rest, ergibt ca. 5,9%». Werte und Quellen: `src/rules/2026.json` (`bvg.umwandlungssatzUmhuellendDurchschnitt`),
  `docs/quellen.md`. In «Detailliert» zeigen diese
  Felder den Schätzwert mit Badge «geschätzt»; eine eigene Eingabe überschreibt ihn («Zurücksetzen auf
  Schätzung»). Der Moduswechsel verliert keine Daten; «Schnell» rechnet mit gesetzten Detailwerten und zeigt deren
  Anzahl. Das Ergebnis nennt die geschätzten Werte, weist auf AHV-Lücken durch späten Zuzug hin und zeigt «Wo sich
  Genauigkeit lohnt» (Wirkung von −5 AHV-Beitragsjahren, −20% PK-Guthaben, −1 Pp Umwandlungssatz, −1 Pp Rendite,
  +10% Ausgaben auf das früheste Alter und das Vermögen mit 85). Gemessene Abweichung Schnell vs. Detailliert für
  Musterhaushalte: [docs/schnell-vergleich.md](docs/schnell-vergleich.md).
- Haushalt: Einzelperson oder Ehepaar; Planungshorizont (Lebensende) Standard **120**, frei wählbar bis 999.
- Jede Person mit vollständig eigenen Angaben: Geburtsjahr/-monat, Geschlecht, Lohn, Erwerbsaufgabe, AHV, PK,
  Freizügigkeit, 3a, ausländische Renten und eigene **Vermögenstöpfe**.
- **Erwerbsaufgabe als Alter oder Datum:** Alter (Jahre + Monate) oder «per Ende» Monat + Jahr (z.B. November 2027);
  beim Datum zeigt die App das resultierende Alter. Der gewählte Modus wird gespeichert.
- **Frühester AHV-Bezug** wird aus Jahrgang und Geschlecht abgeleitet und nur angezeigt (Vorbezug ab 63; Frauen der
  Jahrgänge 1961–1969 ab 62). Das früheste PK-Bezugsalter ist ein eigenes, klar beschriftetes Feld
  («Pensionskasse: frühester Bezug laut Reglement (58–70)») mit kurzem Hilfetext (Vorsorgeausweis/Reglement,
  «vorzeitige Pensionierung ab …») und einer **Statuszeile pro Person**, die aus den aktuellen Eingaben sagt, welcher
  Fall eintritt: Barauszahlung beim Wegzug (vor dem Reglementsalter; EU/EFTA nur Überobligatorium), Pensionierung mit
  Rente/Kapital nach Reglement (Wegzug ab dem Reglementsalter, Art. 2 Abs. 1bis FZG) oder ordentlicher Bezug ohne
  Wegzug. Spielt das Feld nachweislich keine Rolle (Wegzug mit Barauszahlung vor 58 bzw. vor der Erwerbsaufgabe), wird
  es ausgegraut und nur lesbar angezeigt statt versteckt. Bei «Nicht erwerbstätig» ist die ganze PK-Karte ausgeblendet.
- **Wohnsitz im Ausland und freiwillige AHV/IV** pro Person: Wegzug ab Alter oder Datum, Land (EU/EFTA oder nicht,
  aus `data/laender-2026.json`), Staatsangehörigkeit, Prüfung der Beitrittsvoraussetzungen (Art. 2 AHVG, VFV).
  Mit freiwilliger AHV: Jahresbeitrag aus Vermögen am 31.12. + 20× Renteneinkommen (Tabelle 1'010–25'250 plus 5%
  Verwaltungskosten), bis zum Referenzalter als Ausgabe; die Jahre zählen als Beitragsjahre. Ohne: keine
  NE-Beiträge mehr, dafür Beitragslücken (AHV-Rente vereinfacht linear gekürzt).
- **Barauszahlung bei endgültigem Wegzug** (Art. 5 Abs. 1 lit. a FZG, Art. 25f FZG, Art. 3 Abs. 2 lit. d BVV 3):
  Mit Wegzug (Datum/Alter + Zielland) und Option «Barauszahlung bei Wegzug» pro Person werden PK, Freizügigkeit und
  3a ab dem Wegzugsmonat frei – **in jedem Alter**, unabhängig vom PK-Bezugsalter laut Reglement, als Kapital (keine
  PK-Rente). Ausserhalb EU/EFTA ganz; in der EU/EFTA nur das Überobligatorium, der geschätzte obligatorische Teil
  bleibt als Freizügigkeitsguthaben gesperrt (Schalter «im neuen Land nicht obligatorisch versichert» → Vollbezug);
  3a immer ganz (BSV-Mitteilungen Nr. 96 Rz 567); Liechtenstein: Obligatorium immer gesperrt (Art. 25f Abs. 1
  lit. c FZG). Liegt der Wegzug nach dem PK-Bezugsalter, gilt der ordentliche Bezug.
  Besteuerung ab dem Wegzug mit der **Schweizer Quellensteuer** (Bund nach QStV-Tarif + Sitzkanton der
  Vorsorgeeinrichtung; AG, BL, GE, JU, NE, SO, VS, VD mit den exakten ESTV-Tariftabellen 2026) statt der
  Kapitalleistungssteuer des Wohnkantons; DBA-Rückforderung optional (Schalter). Die Wegzug-Angaben stehen im Schritt «Einkommen & Vorsorge» in einer eigenen Karte **vor** der
  Pensionskasse (gleicher Zustand wie im Schritt «Personen») und im Modus «Schnell» direkt bei jeder Person.
- **Steuern nach dem Wegzug:** Schweizer Einkommens- und Vermögenssteuer nur bis zum Wegzug (anteilig), danach das
  vereinfachte Steuermodell des Ziellandes aus `data/laender-2026.json` (Renten, Kapitalerträge, Vermögen; Regime wie
  Italien 7 %, Zypern 5 %, Azoren −30 % wählbar) oder ein eigener effektiver Satz. Schweizer Quellensteuer auf
  PK-Renten, wo das DBA sie vorsieht (ESTV RS 2-217). Eine Liegenschaft in der Schweiz bleibt im Kanton
  steuerpflichtig: Vermögenssteuer des Wohnkantons auf dem Nettowert, zum Satz des gesamten Vermögens (§§ 4–6 StG ZH,
  Art. 4 StHG). Quellen und OFFEN-Punkte: `docs/laender.md` Abschnitt 6.
- **Nicht erwerbstätige Person (z.B. Familienarbeit):** Erwerbsstatus pro Person in beiden Modi. Bei «nicht
  erwerbstätig» verschwinden Lohn-, PK- und 3a-Einzahlungsfelder; optional frühere Erwerbstätigkeit in der Schweiz,
  Freizügigkeitsguthaben, Jahre mit Kindern unter 16 (Erziehungsgutschriften) und Betreuungsjahre. Die App zeigt die
  geltenden AHV-Regeln: Beiträge gelten als bezahlt, wenn der erwerbstätige Ehegatte mind. den doppelten
  Mindestbeitrag (1'060) zahlt (Art. 3 Abs. 3 AHVG), sonst eigene NE-Beiträge (gerechnet); Splitting, Gutschriften,
  Lücken bei Auslandsjahren, Plafonierung. Quellen: `docs/quellen.md` Abschnitt 12.
- **Vermögenstöpfe pro Person** mit eigener Rendite und Zugriffsregel:
  - verfügbar: Bargeld/Konten (Zins Bargeld), Wertschriften (Börsenrendite), Sonstiges (eigene Rendite),
    Wohneigentum (Verkehrswert mit Wertentwicklung wie die Börsenrendite bzw. in Krisenjahren wie die historischen
    Hauspreise; die Hypothek bleibt stehen, dadurch wirkt der Hebel auf den Nettowert);
  - gesperrt: **Pensionskasse** bis zum frühesten Bezugsalter gemäss Reglement (Standard 63, gesetzlich 58–70),
    **Freizügigkeit** und **Säule 3a** frühestens 5 Jahre vor dem Referenzalter, spätestens im Referenzalter
    (bei Weiterarbeit bis 5 Jahre später). Der Wohnkanton beeinflusst nur die Kapitalbezugssteuer.
  - Entnahmen in der Reihenfolge Bargeld → Wertschriften → Sonstiges → Wohneigentum (zuletzt, mit Warnung).
    Kapitalbezüge fliessen in die Wertschriften der Person.
  - **Liquiditätslücke:** Warnung mit Jahren, wenn verfügbares Geld fehlt, obwohl noch gesperrte Vorsorgegelder
    vorhanden sind.
- **Ausgaben in Phasen** (Detailmodus): Grundbetrag pro Jahr (mit Faktoren ab 75/85) plus optionale Phasen «von … bis …»
  (beide inklusive; Kalenderjahr oder Alter einer wählbaren Person, Betrag pro Jahr oder pro Monat) und
  Einzeljahr-Abweichungen (ersetzen die Lebenshaltung eines Kalenderjahres). Vorrang: Einzeljahr → erste passende Phase →
  Grundbetrag. Vorschau pro Jahr (heute und hochgerechnet). Ohne Phasen gilt der bisherige Einzelbetrag.
- **Heutige Franken:** Alle Ausgaben, Posten (Indexierung «wie Teuerung»), Einmalereignisse und Vermögenswerte sind in
  heutigen Franken (Kaufkraft heute). Die App rechnet sie mit der erwarteten Teuerung (Annahmen) auf das jeweilige Jahr
  hoch; weil die Simulation real rechnet, zeigen Ergebnis und Tabelle ebenfalls heutige Franken. Nominal fixe Beträge
  sind ausdrücklich beschriftet: Posten mit Indexierung «Keine (nominal fix)», PK-Renten und der AHV-Rentenzuschlag
  (verlieren real an Wert); ausländische Renten werden als heutiger Betrag in der Fremdwährung erfasst und entwickeln
  sich gemäss Indexierung und Wechselkursänderung.
- **Wiederkehrende Posten** (Einnahmen wie Mieteinnahmen, Ausgaben wie Krankenkasse oder Wohnen) mit Start-/Endalter,
  Indexierung und Steuerbarkeit; **Einmalereignisse** (z.B. Erbschaft +, Autokauf −) in einem bestimmten Alter.
- AHV: Referenzalter nach Jahrgang/Geschlecht (inkl. Übergang Frauen 1961–1963), Eingabe der Rente aus der
  Rentenvorausberechnung, Vorbezug/Aufschub (Tabellen MB 3.04, reduzierte Sätze der Übergangsgeneration),
  Rentenzuschlag, Plafonierung 150% für Ehepaare, 13. AHV-Rente.
- **AHV-Schätzhilfe pro Person** (grobe Schätzung, keine verbindliche Auskunft): Jahrgang, Geschlecht, fehlende
  Beitragsjahre bzw. Jahre in der Schweiz, durchschnittliches AHV-Einkommen (heutige CHF), Ehejahre für das Splitting
  (50/50), Jahre mit Erziehungsgutschriften (3 × jährliche Minimalrente, in der Ehe hälftig), Auslandsjahre (erhöhen
  die Schweizer Rente nicht → ausländische Rente separat erfassen). Rentenformel Art. 34 AHVG / Rententabelle Skala 44
  (mdJE auf Tabellenwert aufgerundet), Teilrente vereinfacht linear. Übernahme mit einem Klick ins AHV-Feld, das
  editierbar bleibt. Links zur offiziellen
  [Online-Rentenschätzung ESCAL](https://www.ahv-iv.ch/de/Formulare/Online-Rentensch%C3%A4tzung-ESCAL) und zur
  [individuellen Rentenvorausberechnung](https://www.ahv-iv.ch/de/Sozialversicherungen/Alters-und-Hinterlassenenversicherung-AHV/Rentenvorausberechnung)
  ([Formular 318.282](https://www.ahv-iv.ch/p/318.282.d)). Tests gegen alle 51 Stufen der offiziellen Rententabelle
  und die Berechnungsbeispiele im Merkblatt 3.01.
- AHV-Beiträge für Nichterwerbstätige nach Tabelle 2026 (bei Frühpensionierung bis zum Referenzalter, nur bei
  Wohnsitz in der Schweiz): Vermögen am 31.12. inkl. im Jahr bezogener Kapitalien (noch gesperrte PK/FZ/3a nicht)
  + 20× Renteneinkommen inkl. AHV (auch Vorbezug) und PK-Renten; Ehepaare je hälftig; Befreiung, wenn der
  erwerbstätige Ehegatte genug bezahlt.
- Pensionskasse (Werte manuell aus dem Vorsorgeausweis): Altersguthaben, Sparbeiträge, Verzinsung,
  Umwandlungssatz, Kapital/Rente-Mix, frühestes Bezugsalter gemäss Reglement.
- Säule 3a und Freizügigkeit: Guthaben, Rendite, Einzahlungen (3a-Maximum 2026).
- Ausländische Renten pro Person (z.B. Rente aus einem Abkommensstaat; Beispiel-Felder in `docs/auslandsszenarien.md` §4): Betrag, Währung,
  Zahlungen/Jahr, Wechselkurs mit realer Auf-/Abwertung pro Jahr, Startalter, Indexierung, Steuer im Quellenstaat,
  in der Schweiz steuerbar ja/nein.
- Steuern: **direkte Bundessteuer exakt nach Tarif 2026** (Einkommen und Kapitalleistungen zu 1/5).
  Kantons- und Gemeindesteuern aus `data/kantone-2026.json` (Recherche: `docs/kantone.md`):
  - **Zürich und Aargau exakt**: Einkommens-, Vermögens- und Kapitalleistungstarif 2026, Auswahl aller Gemeinden
    (ZH 160, AG 196) und der Kirchensteuer; Unit-Tests gegen die ESTV-Steuerrechner-Referenzfälle (frankengenau).
  - **Übrige 24 Kantone: Näherung** (sichtbares Badge) über effektive Sätze des Kantonshauptorts
    (ESTV-Steuerrechner 2026), interpoliert, ohne Kirchensteuer und kantonale Abzüge.
  - Optional eigene effektive Sätze statt der Kantonsdaten.
- Ergebnis: frühestes Rücktrittsalter (Einzelperson, Ehepaar gemeinsam oder nur eine Person), **gestapeltes
  Diagramm nach Vermögenstopf** (verfügbar/gesperrt, Fehlbetrag), Jahrestabelle (verfügbar, gesperrt, total, Lücke),
  Warnungen (Liquiditätslücke, Wohneigentum angetastet, fehlende Eingaben), Renten- und Kapitalübersicht,
  Quellenliste mit Status jedes Regelwerts.

- **Wohneigentum und Wohnkosten (Schema 7):** optional «Wohnkosten separat rechnen» (Standard aus, damit bestehende
  Stände unverändert rechnen; dann die Wohnkosten aus den Lebenshaltungskosten herausnehmen, sonst zählen sie
  doppelt). Eigentümer: Hypothekarzins (Vorschlag BWO-Durchschnittszinssatz 1,31 %, Stand 30.6.2026), Unterhalt in %
  des Werts oder CHF pro Jahr, Eigenmietwert bis Ende 2028 (danach abgeschafft; Schuldzinsen und Unterhalt bei
  Selbstnutzung ab 2029 nicht mehr abziehbar). Mieter bzw. nach dem Verkauf: Miete pro Monat in heutigen Franken
  (teuerungsbereinigt), solange der Haushalt in der Schweiz wohnt. Nach dem Wegzug: Liegenschaft leer oder vermietet
  (Mieteinnahmen, in der Schweiz steuerbar nach Abzug von Unterhalt und Zins, vereinfacht).
- **Verkauf der Liegenschaft:** beim Rücktritt, beim Wegzug oder per Monat/Jahr, mit Anlagekosten, Kaufdatum
  (Besitzdauer) und Verkaufskosten. Grundstückgewinnsteuer ZH nach §§ 219–225 StG ZH (Tarif, Zuschlag bei kurzer
  Besitzdauer, Ermässigung ab 5 Jahren, Freigrenze 5'000; ZStB 225.1), AG nach § 109 StG AG (Satz nach Besitzjahren),
  übrige Kantone als gekennzeichnete Näherung mit dem ZH-Tarif oder eigenem Satz. Hypothek wird zurückgezahlt, der
  Erlös fliesst in die Wertschriften. Die Steuer fällt am Ort der Liegenschaft an, auch nach einem Wegzug.
  Ersatzbeschaffung (Aufschub) nur als Hinweis. Quellen: `docs/quellen.md` Abschnitt 4.

Vereinfachungen: Ohne «Wohnkosten separat» kein Eigenmietwert, Zins und Unterhalt (stecken in den Ausgaben); Verkauf
am Ende des Verkaufsjahres; Hypothek ohne Amortisation; Vermögenssteuer auf dem Verkehrswert (effektiver Satz). Barauszahlung wegen Selbstständigkeit ist nicht abgebildet;
Steuermodelle der Zielländer sind Näherungen (bei Ländern ohne Modell wird weiter mit Schweizer Steuern gerechnet oder ein eigener Satz verwendet).

- **Was wäre, wenn …?** (oben im Ergebnis): Regler für Rücktrittsalter (Mitte = Eingabe, ±10 Jahre, frühestens heute,
  spätestens 70; bei Paaren gemeinsam oder pro Person), Planungsalter (±20 Jahre), Ausgaben, Rendite, Teuerung und
  Krisenmodus mit sofortiger Neuberechnung (Eingaben bleiben unverändert bis «Übernehmen»); Kennzahlen «Geld reicht bis Alter»,
  Erfolgswahrscheinlichkeit mit wiederkehrenden Krisen, frühestes Rücktrittsalter, Vermögen am Ende;
  Vermögensverlauf als Monte-Carlo-Fächer (10., 25., 50., 75., 90. Perzentil) mit Erfolgsquote und «Mit 90 % / 75 % /
  50 % Wahrscheinlichkeit reicht das Geld bis Alter …»; «Varianten Ihres Plans im Vergleich» (Grafik 2: Ihr Plan mit
  genau einer Änderung – Krise ja/nein, PK ganz als Kapital bzw. Rente –, deterministisch, ohne Wahrscheinlichkeiten).
  Gerechnet wird mit denselben Funktionen wie im übrigen Ergebnis.
- **Wie viel kann ich ausgeben? (Umkehrrechnung)** im Ergebnis: höchste nachhaltige Lebenshaltung pro Jahr und Monat
  in heutigen Franken, konstant oder nach empirischer Kurve Go-go (bis 74: 100 %) / Slow-go (75–84: 85 %) / No-go
  (ab 85: 75 %) mit optionaler Pflegeheim-Reserve (2 Jahre × CHF 81'000, eine Person; Eintrittsalter wählbar). Ziel am
  Planungsalter: Restbetrag in heutigen Franken oder «Kaufkraft erhalten ± X % pro Jahr real» (0 % = verfügbares
  Vermögen von heute real erhalten). Rechnung ohne Krise, mit Krisen (Automatisch/Individuell) oder Monte Carlo mit
  Mindest-Erfolgsquote (z.B. 90 %). Ergebnis pro Phase; «Als Ausgabenphasen übernehmen». Vorlage Go-go / Slow-go /
  No-go auch direkt bei den Ausgabenphasen. Kurve und Quellen: `data/ausgabenkurve-2026.json`, `docs/quellen.md`
  Abschnitt 14. Screenshots `screenshots/89-…` bis `91-…`.
- **Todesfall-Szenario** im Ergebnis (nur Ehepaare, «Was passiert, wenn eine Person stirbt?»): Wahl der Person und des
  Zeitpunkts (Alter oder Jahr). Gerechnet werden AHV-Witwen-/Witwerrente (80 %, mit dem Rentenvergleich zur eigenen
  Altersrente und Verwitwetenzuschlag), Wegfall der Plafonierung, PK-Ehegattenrente (60 %) bzw. Abfindung, Übergang von
  Freizügigkeit und 3a, Ausgaben der überlebenden Person (Faktor 0,67, editierbar, OFFEN), Steuern (Todesjahr gemeinsam,
  dann Alleinstehende) und Wegzug (AHV-Rente ins Ausland zahlbar, EL nicht). Ergebnis: Vergleich mit dem Plan ohne
  Todesfall (Grafik, Geld reicht bis Alter, Endvermögen, Einkommen vor/nach dem Tod), Jahrestabelle mit †, Monte Carlo
  und Matrix «Wer stirbt zuerst und wann?». Modell, keine Beratung. Quellen: `docs/quellen.md` Abschnitt 15.
  Screenshots `screenshots/96-…` ff. (Schema 9).
- **Kapitalbezug in den 26 Kantonen** (Ergebnis-Karte): wählbarer Betrag (Standard 1 Mio.), Steuer auf PK-/Freizügigkeits-/
  3a-Kapital in allen Kantonen, getrennt nach (a) Wohnsitz in der Schweiz (Wohnkanton zählt, **nicht** der Sitz der
  Stiftung; Art. 4b StHG) und (b) Wohnsitz im Ausland (Quellensteuer nach dem Sitzkanton der Einrichtung), mit
  Plausibilitätsprüfung und Strategiekarte «Freizügigkeit in Tiefsteuerkanton» (ZG/SZ/NW). Sitzkanton je Vorsorgeform
  (PK, Freizügigkeit, 3a) beim Wegzug wählbar (Schema 10). Werte: ESTV-Steuerrechner 2026 (Hauptort, ohne Kirchensteuer).
  Quellen: `docs/quellen.md` Abschnitt 16. Screenshots `screenshots/102-…` ff.
- **Wegzug-Vergleich PK/3a** (Ergebnis-Karte): Wohnsitz bleibt in der Schweiz gegen Wegzug in ein Nicht-EU/EFTA-Land
  (Standard Thailand) und in ein EU/EFTA-Land (Standard Spanien): Kapital je Quelle, gesperrtes Obligatorium
  (Art. 25f FZG), Quellensteuer am Sitzkanton, Rückforderung nach DBA nur mit Schalter (z.B. VAE: definitiv; ES: möglich),
  Netto-Kapital, Endvermögen. Zielland-Steuer auf Vorsorgekapital OFFEN. Quellen: `docs/quellen.md` Abschnitt 17.
  Screenshots `screenshots/107-…` bis `109-…`.
- **Kapitalbezüge staffeln und Steuer-Tipps** (Ergebnis-Karte, Schema 11): 3a, Freizügigkeit und (auf Wunsch) PK-Kapital in
  2–10 Jahren beziehen; Vergleich 1–5 Jahre mit Steuerersparnis und Endvermögen; Steuer-Tipps nur, wo sie zum Fall passen
  (kein Staffeln bei Wegzug, Ehegatten-Bezüge gegeneinander verschieben, Sperrfrist nach Einkauf). Quellen:
  `docs/quellen.md` Abschnitt 18. Screenshots `screenshots/110-…` ff.
- **Szenario-Vergleich A/B** (Auftrag V): «Version B anlegen» kopiert die Eingaben; danach zwei Spalten mit denselben
  Formularen (Desktop nebeneinander, 360 px untereinander), oben die Karte «Vergleich der Versionen»: Endvermögen,
  Steuern total, verfügbar pro Jahr im Ruhestand, Erfolgsquote (Monte Carlo) und «Geld reicht bis» mit Differenz und
  «besser». A blau ausgezogen (Kreis), B orange gestrichelt (Quadrat), gemeinsames Diagramm. Umbenennen, tauschen,
  kopieren, löschen, Export/Import als JSON-Datei. Monte Carlo läuft in einem Web-Worker. Gespeichert wird B nur mit dem
  Schalter «Eingaben im Browser speichern» (Speicher-Version 2, Haushalt-Schema unverändert). Keine neuen Regelwerte.
  Screenshots `screenshots/113-…` bis `116-…`.
- **Vermögen und geplante Ausgaben** (Karte «Vermögensverlauf» und Ergebnis der Umkehrrechnung): Grafik mit dem
  Vermögen am Jahresende auf der linken und den geplanten Ausgaben (Ausgabenkurve, gestrichelt alle Ausgaben inkl.
  Wohnkosten) auf der rechten Achse; darunter die **Jahrestabelle** mit Alter(n), Vermögen Ende Jahr, gesperrter
  Vorsorge, geplanten und weiteren Ausgaben, Beiträgen, Einnahmen aufgeschlüsselt (Erwerb, AHV, PK-Rente, Kapital
  PK/FZ/3a, ausländische Renten, weitere Einnahmen, Mieteinnahmen, Vermögenserträge, Verkaufserlös, Einmaliges) und
  Steuern (Einkommen, Kapital, Vermögen, Grundstückgewinn, total). Mobil horizontal scrollbar mit fixer erster Spalte,
  leere Spalten ausgeblendet, **CSV-Export** (Semikolon, ganze Franken, UTF-8 mit BOM, alle Spalten). Folgt dem
  Umschalter heutige Kaufkraft / nominal. Screenshots `screenshots/92-…` bis `95-…`.
- **Heutige Kaufkraft / Nominal** (Umschalter oben im Ergebnis, im Link und im Speicher, Schema 8): alle Beträge,
  Grafiken, Tabellen und Kennzahlen wahlweise «in heutigen Franken» (Standard) oder «in Franken des jeweiligen
  Jahres». Nominal = real × kumulierte Teuerung des tatsächlich gerechneten Pfads (in Krisenjahren die historische
  Teuerung, im Monte Carlo die jedes Laufs; die Perzentile werden pro Lauf umgerechnet und erst dann gebildet).
  Flüsse mit dem Index zu Jahresbeginn, Bestände am Jahresende; das angebrochene Startjahr zählt wie in der Rechnung
  als ganzes Teuerungsjahr. Screenshots `screenshots/84-…` bis `88-…`.
- Erscheinungsbild: ruhigeres Design mit Karten, klarer Typografie, Diagrammfarben aus CSS-Variablen und **dunklem
  Modus** gemäss Systemeinstellung; Kontraste nach WCAG AA (Text ≥ 4.5:1).
- **Krisen** (im Ergebnis), drei Stufen (beim ersten Start ist *Automatisch* voreingestellt; gespeicherte Stände und
  Links behalten ihren Modus): *Keine Krise*; *Automatisch* – die «normalen» historischen Krisen (Ölkrise
  1973/74, Schwarzer Montag 1987, Schweizer Immobilienkrise, Dotcom, Finanzkrise 2008, Eurokrise 2011, Covid 2020,
  Zinsschock 2022) rotierend im Abstand gemäss Häufigkeit (Standard 0,74 pro Dekade, etwa alle 13,5 Jahre), erste
  Krise standardmässig 2036 (Zinsschock 2022 + mittlerer Abstand); die Krisenjahre ersetzen die Annahme und die
  normalen Jahre werden so ausgeglichen, dass der reale Durchschnitt über den eigenen Planungszeitraum (heute bis
  Planungsalter, Wertschriften und Hauspreise getrennt) der Annahme entspricht; *Individuell* –
  eigene Liste mit allen Krisen inkl. der extremen (Grosse Depression, Stagflation 1973–81, Japan ab 1990), Beginn im
  Kalenderjahr, im Alter oder X Jahre nach dem Rücktritt, Datenreihe CH/USA/JP (Stresstest ohne Ausgleich). Echte
  Jahresrenditen von Aktien und Obligationen (gemäss Aktienanteil), Geldmarkt, Hauspreise und Teuerung. Krisenjahre
  farbig hinterlegt und beschriftet im Vermögensverlauf, in «Was wäre, wenn …?» und in «Varianten Ihres Plans im Vergleich».
  Daten: JST Macrohistory R6, SNB, BFS (`docs/krisen.md`).
- **Wiederkehrende Krisen (Monte Carlo):** die normalen Krisen zufällig mit der historischen Häufigkeit (Standard 0,74
  pro Dekade, normale Jahre im Erwartungswert über den Planungszeitraum ausgeglichen, Krisen am Horizontende
  abgeschnitten) oder Block-Bootstrap aus der Schweizer Geschichte
  1900–2024; Erfolgswahrscheinlichkeit und Fächer (10./25./50./75./90. Perzentil) mit «reicht bis Alter» für 90 %,
  75 % und 50 %.
- Historische Krisenhäufigkeit pro Dekade (Schweiz, USA, 18 Länder) mit Definitionen in der App und in
  `docs/krisen.md`.

Geplant: exakte Tarife weiterer Kantone, genauere Zielland-Steuermodelle, Sterbetafeln. Siehe `docs/konzept.md`.

## Quellen

Alle gesetzlichen Werte stehen versioniert in `src/rules/2026.json` – jeder Wert mit `value`, `source`, `stand` und
`status` (`verifiziert` oder `offen`). Die Recherche mit URLs ist in `docs/quellen.md` dokumentiert. Wichtigste
Quellen: BSV «Beträge gültig ab 1.1.2026», Merkblätter der Informationsstelle AHV/IV (3.01, 3.04, 2.03, 10.02),
Wegleitung freiwillige Versicherung (WFV), AHVG/VFV/BVG/DBG
(fedlex), ESTV (Tarife direkte Bundessteuer 2026, RS 2-216/2-217), BFS.

## Entwicklung

Voraussetzung: Node.js ≥ 22.12 (siehe `.nvmrc`).

```bash
npm ci            # Abhängigkeiten installieren
npm run dev       # Entwicklungsserver: http://localhost:3000/Swiss-Retirement-Calculator/
npm test          # Unit-Tests (Vitest)
npm run build     # Produktions-Build nach dist/
npm run preview   # Build lokal ansehen
npm run lint      # Biome (Lint + Format-Prüfung)
npm run typecheck # TypeScript strict
npm run screenshots -- http://localhost:4173/Swiss-Retirement-Calculator/  # Mobile-Screenshots (Playwright)
node scripts/vorlesen-browsertest.mjs   # Browsertest «Vorlesen» mit gemocktem speechSynthesis (Preview muss laufen; --screenshots)
```

Technik: Rsbuild, React, TypeScript (strict), uPlot (Diagramm), lz-string (URL-Zustand), Vitest, Biome.
Deployment: GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`, Basis-Pfad `/Swiss-Retirement-Calculator/`).

### Struktur

```
src/core/    reine Rechenfunktionen (AHV, BVG, Steuern, NE-Beiträge, Simulation, Solver, Krisen, Monte Carlo) + Tests
src/rules/   versionierte Regelwerte (2026.json) mit Quelle/Stand/Status, Loader und Schema-Prüfung
src/data/    Standardwerte, Kantonsdaten-Anbindung (data/kantone-2026.json)
data/        recherchierte Kantons- und Länderdaten 2026, historische Krisendaten (JSON)
src/ui/      React-Oberfläche (mobile-first)
docs/        Konzept, Quellen und Sicherheit (docs/SECURITY.md)
```

### Sicherheit

Die Berechnung läuft nur im Browser; Eingaben aus Link, Import und Speicher werden zentral validiert (`src/ui/validierung.ts`), eine Content-Security-Policy sperrt Fremdquellen und Netzverbindungen. Bedrohungsmodell, Regeln für jede Änderung und Prüfprotokoll: [docs/SECURITY.md](docs/SECURITY.md).

**Datenschutz-Guard und Wortliste:** `node scripts/datenschutz-guard.mjs [dist]` prüft, dass keine lokalen Daten getrackt sind
und keine verbotenen Wörter vorkommen. Die Wortliste (gesalzene Hashes) liegt **nicht im Repo**: lokal in der ungetrackten
Datei `lokal/datenschutz-woerter.json` oder in der Umgebungsvariable `DATENSCHUTZ_LISTE` (Format: `scripts/datenschutz-woerter.beispiel.json`).
Ohne Liste meldet der Guard «Wortliste nicht vorhanden, übersprungen» (Exit 0) und prüft nur die Pfade; die CI läuft auch so grün.

## Lizenz

MIT – siehe [LICENSE](LICENSE). Ausnahme: `data/krisen-historisch.json` und `data/krisen-haeufigkeit.json` enthalten
aus der Jordà-Schularick-Taylor Macrohistory Database (R6) abgeleitete Daten und stehen unter
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) (**nicht kommerziell**). Zitat: Jordà, Schularick,
Taylor (2017), NBER Macroeconomics Annual 2016; Jordà, Knoll, Kuvshinov, Schularick, Taylor (2019), QJE 134(3).
Schweiz 2021–2024: SNB-Datenportal (nicht kommerziell, mit Quellenangabe) und BFS.
Quellen, Änderungen und Nutzungsbedingungen im Detail: [NOTICE](NOTICE).
