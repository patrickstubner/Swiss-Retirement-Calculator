# Ruhestandsrechner Schweiz

> **Wann kann ich aufhören zu arbeiten – und reicht mein Vermögen?**

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

## Funktionsumfang (Version 0.1)

- **Neutrale Standardwerte:** Alle Beträge sind anfangs leer (0) und frei editierbar – keine Beispielvermögen.
  Gesetzliche Werte (z.B. BVG-Mindestzins) und vorsichtige Annahmen (Rendite, Teuerung) sind vorbelegt und anpassbar.
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
  («Pensionskasse: frühester Bezug laut Reglement (58–70)»).
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
  3a immer ganz (Auslegung, OFFEN). Liegt der Wegzug nach dem PK-Bezugsalter, gilt der ordentliche Bezug.
  Besteuerung ab dem Wegzug mit der **Schweizer Quellensteuer** (Bund nach QStV-Tarif + Sitzkanton der
  Vorsorgeeinrichtung, ESTV-Übersicht 2026) statt der Kapitalleistungssteuer des Wohnkantons; DBA-Rückforderung nur
  als Hinweis. Die Wegzug-Angaben stehen im Schritt «Einkommen & Vorsorge» in einer eigenen Karte **vor** der
  Pensionskasse (gleicher Zustand wie im Schritt «Personen») und im Modus «Schnell» direkt bei jeder Person.
- **Vermögenstöpfe pro Person** mit eigener Rendite und Zugriffsregel:
  - verfügbar: Bargeld/Konten (Zins Bargeld), Wertschriften (Börsenrendite), Sonstiges (eigene Rendite),
    Wohneigentum (Nettowert = Verkehrswert − optionale Hypothek, wie Börsenkapital verzinst);
  - gesperrt: **Pensionskasse** bis zum frühesten Bezugsalter gemäss Reglement (Standard 63, gesetzlich 58–70),
    **Freizügigkeit** und **Säule 3a** frühestens 5 Jahre vor dem Referenzalter, spätestens im Referenzalter
    (bei Weiterarbeit bis 5 Jahre später). Der Wohnkanton beeinflusst nur die Kapitalbezugssteuer.
  - Entnahmen in der Reihenfolge Bargeld → Wertschriften → Sonstiges → Wohneigentum (zuletzt, mit Warnung).
    Kapitalbezüge fliessen in die Wertschriften der Person.
  - **Liquiditätslücke:** Warnung mit Jahren, wenn verfügbares Geld fehlt, obwohl noch gesperrte Vorsorgegelder
    vorhanden sind.
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
- Ausländische Renten pro Person (z.B. Brasilien, Felder gemäss `docs/brasilien.md` §6): Betrag, Währung,
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

Vereinfachungen: Wohneigentum wird wie Börsenkapital behandelt (ohne Eigenmietwert, Unterhalt, Verkaufskosten);
Vermögenssteuer auf dem Verkehrswert (effektiver Satz). Barauszahlung wegen Selbstständigkeit ist nicht abgebildet;
nach dem Wegzug gelten für Einkommen und Vermögen weiterhin Schweizer Steuern (Näherung).

Geplant: exakte Tarife weiterer Kantone, Steuern bei Wegzug ins Ausland (DBA-Rückforderung, Renten, Wohnsitzstaat), historische Krisenszenarien, Monte Carlo,
Sterbetafeln. Siehe `docs/konzept.md`.

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
```

Technik: Rsbuild, React, TypeScript (strict), uPlot (Diagramm), lz-string (URL-Zustand), Vitest, Biome.
Deployment: GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`, Basis-Pfad `/Swiss-Retirement-Calculator/`).

### Struktur

```
src/core/    reine Rechenfunktionen (AHV, BVG, Steuern, NE-Beiträge, Simulation, Solver) + Tests
src/rules/   versionierte Regelwerte (2026.json) mit Quelle/Stand/Status, Loader und Schema-Prüfung
src/data/    Standardwerte, Kantonsdaten-Anbindung (data/kantone-2026.json)
data/        recherchierte Kantons- und Länderdaten 2026 (JSON)
src/ui/      React-Oberfläche (mobile-first)
docs/        Konzept und Quellen
```

## Lizenz

MIT – siehe [LICENSE](LICENSE). Historische Marktdaten (JST Macrohistory, CC BY-NC-SA 4.0) sind noch nicht enthalten.
