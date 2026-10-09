# Krisenszenarien und Krisenhäufigkeit

Stand: 27.9.2026. Umsetzung: `src/core/krisen.ts` (Replay), `src/core/montecarlo.ts` (Monte Carlo),
`src/data/krisen.ts` (Katalog, Datenanbindung), UI `src/ui/components/Krisen.tsx`. Daten: `data/krisen-historisch.json`
und `data/krisen-haeufigkeit.json`, erzeugt mit `scripts/krisen-daten.py` (reproduzierbar).

## 1. Datenquellen und Lizenzen

| Quelle | Verwendung | Lizenz / Nutzung | Stand |
|---|---|---|---|
| Jordà-Schularick-Taylor Macrohistory Database, Release 6 (JST R6), https://www.macrohistory.net/database/ | Jahreswerte 1871–2020 für Schweiz, USA, Japan: `eq_tr` (Aktien-Gesamtrendite), `bond_tr` (Staatsanleihen-Gesamtrendite), `bill_rate` (Geldmarkt), `cpi` (Teuerung = Veränderung), `hpnom` (Hauspreise, Veränderung); `crisisJST` (Bankenkrisen) aller 18 Länder für die Auszählung | CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/): nicht kommerziell, Namensnennung, Weitergabe unter gleicher Lizenz. Die abgeleiteten Dateien `data/krisen-*.json` stehen deshalb unter CC BY-NC-SA 4.0 (nicht MIT). Zitierpflicht: Jordà, Schularick, Taylor (2017), «Macrofinancial History and the New Business Cycle Facts», NBER Macroeconomics Annual 2016, Bd. 31; für die Renditen Jordà, Knoll, Kuvshinov, Schularick, Taylor (2019), «The Rate of Return on Everything, 1870–2015», Quarterly Journal of Economics 134(3). | R6, Download 27.9.2026 |
| SNB-Datenportal, https://data.snb.ch: Cube `capchstocki` (SPI Gesamtindex GDR, letzter Handelstag des Jahres), `rendoblim` (Kassazinssätze Eidg. Obligationen 9 und 10 Jahre, Dezember), `zimoma` (SARON, Mittel der Monatswerte) | Verlängerung Schweiz 2021–2024 (Aktien, Obligationen, Geldmarkt) | «für nicht kommerzielle Zwecke … unter Quellenangabe … weiterverwendet» (https://www.snb.ch/de/srv/disclaimer_copyright). Der SPI ist ein Index der SIX Swiss Exchange; gespeichert sind nur vier daraus abgeleitete Jahresrenditen. | Abruf 27.9.2026 (rendoblim publiziert 1.9.2025, reicht bis 7/2025; deshalb Verlängerung nur bis 2024) |
| BFS, Landesindex der Konsumentenpreise, durchschnittliche Jahresteuerung: 2021 +0,6 % (https://www.bfs.admin.ch/news/de/2022-0003), 2022 +2,8 % (https://www.bfs.admin.ch/news/de/2023-0009), 2023 +2,1 % (https://www.bfs.admin.ch/asset/de/30225916), 2024 +1,1 % (https://www.bfs.admin.ch/news/de/2025-0003) | Teuerung Schweiz 2021–2024 | Freie Nutzung, Quellenangabe ist Pflicht («OPEN BY», https://www.bfs.admin.ch/bfs/en/home/fso/swiss-federal-statistical-office/terms-of-use.html; seit 15.7.2026 auch kommerziell frei) | Medienmitteilungen Jan. 2022–2025 |
| Pictet Wealth Management, «The long-term performance of Swiss equities and bonds (1900–2025)», Feb. 2026, https://www.pictet.com/ch/en/insights/historical-performance-swiss-equities-bonds | Nur Plausibilitätskontrolle (nicht gespeichert): Die Pictet-Unterlage verbietet Vervielfältigung ohne Zustimmung. | – | Feb. 2026 |
| Shiller-Daten (Yale) | nicht verwendet (USA ist in JST enthalten) | – | – |

**Methode Obligationen 2021–2024 (Näherung):** 10-jährige Eidgenössische Anleihe, Coupon = 10-Jahres-Rendite am
Vorjahresende, am Jahresende mit der 9-Jahres-Rendite bewertet (Coupon + Kursänderung). Ergebnis: 2021 −3,8 %,
2022 −14,1 %, 2023 +9,4 %, 2024 +3,9 %. Kontrolle 2016–2024 gegen die Jahreswerte der Pictet-Studie: Abweichung höchstens rund
2 Prozentpunkte (2022 zeigt Pictet einen etwas kleineren Verlust). Kontrolle Aktien:
SPI-Jahresrenditen aus dem SNB-Datenportal weichen 2016–2020 höchstens 0,7 Prozentpunkte von JST ab.
Immobilien 2021–2024: keine Daten (es gilt die Annahme des Nutzers).

## 2. Krisenkatalog

| Krise | Jahre | Standard-Datenreihe | Bemerkung |
|---|---|---|---|
| Grosse Depression | 1929–1932 | USA | real etwa −50 % Aktien, Deflation |
| Ölkrise | 1973–1974 | Schweiz | Aktien −20 % / −33 % nominal, hohe Teuerung |
| Stagflation | 1973–1981 | USA | lange hohe Teuerung |
| Schwarzer Montag | 1987 | Schweiz | Aktien −28 % im Kalenderjahr |
| Japan ab 1990 | 1990–2003 | Japan | lange Stagnation |
| Schweizer Immobilienkrise | 1990–1997 | Schweiz | sinkende Hauspreise, Bankenkrise 1991 (JST) |
| Dotcom | 2000–2002 | Schweiz | |
| Finanz- und Immobilienkrise | 2007–2009 | Schweiz | Aktien 2008 −34 % |
| Eurokrise | 2011 | Schweiz | Aktien −8 % |
| Covid | 2020 | Schweiz | in Jahresdaten kaum sichtbar (+4 %) |
| Inflations- und Zinsschock | 2022 | Schweiz (SNB/BFS) | Aktien −16 %, Obligationen −14 % (Näherung) |

Die Datenreihe ist je Krise wählbar (nur Reihen mit vollständigen Daten). Mehrere Krisen sind kombinierbar
(Modus «Individuell», höchstens 120; bei Überschneidung gilt die später beginnende).

## 2a. Krisenmodus in drei Stufen (Schema 6)

| Modus | Was gerechnet wird | Zweck |
|---|---|---|
| **Keine Krise** | jedes Jahr die Renditeannahme | glatter Verlauf (eher zu schön) |
| **Automatisch** (Standard) | feste Abfolge der «normalen» historischen Krisen, Abstand gemäss Häufigkeit, normale Jahre ausgeglichen | realistisches Bild, langfristiger Durchschnitt = Annahme |
| **Individuell** | eigene Liste: welche Krise (auch extreme) in welchem Jahr beginnt (Kalenderjahr, Alter einer Person oder X Jahre nach dem Rücktritt), Datenreihe CH/USA/JP wählbar | Stresstest |

Monte Carlo bleibt eine eigene Bandbreiten-Auswertung (Karte «Wiederkehrende Krisen» und Band in «Was wäre, wenn …?»).

**Standard:** Beim ersten Start (keine gespeicherten Daten, kein Share-Link) und nach «Alle Eingaben zurücksetzen» ist
«Automatisch» voreingestellt (`neueKrisenEinstellungen` in `src/data/defaults.ts`, seit 27.9.2026; vorher «Keine
Krise»). Gespeicherte Stände und Share-Links behalten den gewählten Modus. Stände ohne `krisen.modus` (Schema ≤ 5)
werden nicht mit dem neuen Standard aufgefüllt: Schema 5 mit eingeschalteter Krise → «Individuell», sonst – auch
Schema ≤ 4 ohne Krisenfeld – «Keine Krise», damit sich alte Ergebnisse beim Öffnen nicht ändern. Technisch sauber,
weil `normalisiere` den Modus aus den Rohdaten ableitet statt aus dem Standard (Test in `src/ui/state.test.ts`).

### Automatisch

- **Liste (Reihenfolge, rotierend):** Ölkrise 1973–74, Schwarzer Montag 1987, Schweizer Immobilienkrise 1990–97,
  Dotcom 2000–02, Finanzkrise 2007–09, Eurokrise 2011, Covid 2020, Zinsschock 2022 – danach wieder die Ölkrise.
  Jeweils mit der Standard-Datenreihe (alle Schweiz). **Nicht** dabei, weil extrem: Grosse Depression 1929–32,
  Stagflation 1973–81, Japan ab 1990 (nur «Individuell»). `src/data/krisen.ts` (`AUTO_KRISEN_IDS`).
- **Abstand:** 10 / Häufigkeit Jahre; Standard 0,74 pro Dekade (Schweiz, realer Aktienrückgang ≥ 20 %, 1900–2020,
  Abschnitt 4) → im Schnitt 13,5 Jahre. Beginn der k-ten Krise = erste Krise + round(k × 13,5) (ohne Rundungsdrift):
  0, 14, 27, 41, 54, 68, 81, 95, 108 … Einstellbar 0,1 bis 5 pro Dekade.
- **Erste Krise – Standard 2036:** letzte Krise der Liste (Zinsschock 2022) plus ein mittlerer Abstand, gerundet
  (2022 + 14 = 2036; bei anderer Häufigkeit entsprechend). Begründung: Die Abfolge setzt den historischen Rhythmus
  fort und ist unabhängig davon, wann jemand in Rente geht. Eine Krise gezielt ins Rücktrittsjahr zu legen wäre ein
  Stresstest (ungünstigster Zeitpunkt, Reihenfolgerisiko) und würde das «realistische» Bild systematisch
  verschlechtern; das bleibt als Option («Erste Krise: nach dem Rücktritt») bzw. im Modus «Individuell». Da nach dem
  Zinsschock 2022 die Liste von vorne beginnt, ist die erste automatische Krise die Ölkrise. Einstellbar:
  Kalenderjahr oder X Jahre nach dem Rücktritt.
- **Ersetzen statt Addieren (keine Doppelzählung):** In Krisenjahren gelten die historischen Werte (Wertschriften,
  Geldmarkt, Hauspreise, Teuerung) *anstelle* der Annahme – es wird nichts zur Renditeannahme dazugerechnet. Weil die
  Renditeannahme ein langfristiger Durchschnitt ist, der Krisen schon enthält, würde ein reines Ersetzen den
  Durchschnitt trotzdem senken (Krisen doppelt gezählt). Deshalb werden die **normalen Jahre** so erhöht, dass die
  reale geometrische Durchschnittsrendite über den **eigenen Planungszeitraum** (vom Startmonat bis zum Jahr, in dem
  die ältere bzw. letzte Person das Planungsalter erreicht; erstes Jahr anteilig) **genau** der Annahme entspricht,
  getrennt für Wertschriften und Hauspreise (`ausgleichHorizont` in `src/core/krisen.ts`, seit Schema 7). Fallen
  wenige Krisen in den Zeitraum, sind die normalen Jahre nur wenig erhöht; bei vielen Krisen mehr. Beispiel aus
  Screenshot 81 (damals explizit gesetzt: 4 % nominal, 1 % Teuerung, 50 % Aktien, Planungszeitraum 2026–2086): normale Jahre 4,79 %
  (Wertschriften) und 5,56 % (Hauspreise). Der Standard für neue Eingaben ist seit 2.10.2026 7 % nominal und 2 % Teuerung (`ANNAHMEN_STANDARD`); die Tests, die diese Regeln prüfen, setzen 4 %/1 % ausdrücklich. Bis Schema 6 galt der Ausgleich über einen ganzen Umlauf der Liste
  (8 Krisen, 108 Jahre; `ausgleichZyklus`: 4,84 % bei 50 % Aktien, Wohneigentum 4,78 %); die App zeigt diesen Wert
  zum Vergleich. Nach einem Verkauf der Liegenschaft zählen die Hauspreise weiterhin über den ganzen Zeitraum
  (vereinfacht). Krisenjahre ohne Daten für
  einen Kanal (z.B. Hauspreise 2022) rechnen mit der normalen Rendite und der historischen Teuerung; das ist im
  Ausgleich berücksichtigt. Die App zeigt die erhöhte Rendite der normalen Jahre an.
- Geprüft in `src/core/krisenAuto.test.ts`: Platzierung (2036, 2050, 2063 …), Rotation, einstellbare Häufigkeit und
  erste Krise, Krisenjahre = historische Werte, Durchschnitt über den Planungszeitraum = Annahme (auch mit
  angebrochenem erstem Jahr und am Ende abgeschnittener Krise), Umlauf-Ausgleich weiterhin als Referenz, bei
  «Individuell» kein Ausgleich, ausser der Schalter «Normale Jahre ausgleichen» ist ein (Schema 14, nach der
  Übernahme der automatischen Krisen). Unter 3 normalen Jahren im Horizont entfällt der Ausgleich (die
  Normalrendite würde sonst absurd). Liegt sie ausserhalb −20 %…30 % (dieselbe Spanne wie die Renditeannahme),
  wird sie gedeckelt. Die App weist darauf hin. «Automatisch» und «Individuell» nutzen dieselbe Rechnung.

### Individuell

Ersetzt die frühere Auswahl «Krise testen» (inklusive Datenreihe CH/USA/JP). Beginn als **Kalenderjahr** (vom
Startjahr bis zum Jahr, in dem die jüngste Person das Planungsalter erreicht; ein Beginn bis zu 30 Jahre davor
bleibt editierbar, damit eine Krise, die vor dem Horizont anfängt und noch hineinreicht, nicht verschoben wird;
das Alter am Jahresende steht als Hilfe daneben), **im Alter** einer Person oder **X Jahre nach dem Rücktritt**.
Zusätzlich der **Monat** im aufgelösten Kalenderjahr (Standard Januar, Schema 15). Januar rechnet das ganze
Jahr wie bisher. Ein späterer Monat ist eine Annäherung: die historischen Daten sind Jahresrenditen, die App
verteilt sie geometrisch auf die Monate (`(1 + Rendite) ^ Anteil`, Teuerung analog). Der kumulierte
Gesamtrückgang bleibt erhalten, er verteilt sich auf das Startjahr und das Folgejahr. Am Horizontende zählt
nur der Bruchteil, der noch im letzten Jahr liegt; der Rest im Folgejahr entfällt. Der Monat beim Alter und
nach dem Rücktritt ist der Monat in diesem Kalenderjahr, nicht die Monate seit dem Geburtstag oder dem
Rücktrittsdatum: sonst würde schon «0 Monate» vom Januar abweichen und «Automatisch» nicht mehr treffen.
Im Diagramm beginnt das Band am gewählten Monat. Fällt der Krisenbeginn in dasselbe Kalenderjahr wie der
Simulationsstart und dieser liegt nach Januar, skaliert die Simulation die schon gemischte Jahresrendite
noch einmal mit dem Anteil der simulierten Monate. Das ist eine zweite, gröbere Annäherung; Januar bleibt exakt.
Liegt kein Jahr der Krise im Horizont, weist die App darauf hin; diese Jahre fliessen nicht in die Rechnung ein.
Ohne Ausgleich ist die Liste ein Stresstest («was, wenn zusätzlich zu meinen Annahmen diese Krise kommt?»).
Der Schalter «Normale Jahre ausgleichen (wie Automatisch)» setzt denselben Ausgleich über den Planungshorizont
(`ausgleichHorizont`, Schema 14). Bisherige Links/Speicherstände (Schema 5) mit eingeschalteter Krise werden als
«Individuell» mit derselben Liste übernommen, sonst «Keine Krise». Schema 13: Fehlt die Liste, bleibt sie leer
(kein Absturz, keine neue Standardkrise). Einträge ohne `eigen` sind Katalogkrisen. Fehlt `ausgleich`, bleibt der
Stresstest.

- **Liste:** Hinzufügen, Bearbeiten, Entfernen. Höchstens 120 Einträge (Oberfläche und Speicher; Rohdaten vorher
  auf 240 gekürzt, danach höchstens 120 gültige Einträge). Die Grenze 8 hätte die automatische Folge bei hoher
  Häufigkeit abgeschnitten (höchstens 101 Beginne: 5 pro Dekade über 200 Jahre). «Automatische Krisen übernehmen»
  schreibt bei Beginn im Kalenderjahr die Krisen, deren Jahre den Horizont schneiden, als Kalenderjahr in die
  Liste und schaltet den Ausgleich ein. Beginnt «Automatisch» nach dem Rücktritt, übernimmt die App die ganze Folge
  als Abstand zum Rücktritt (auch Beginne, die beim aktuellen Rücktritt ausserhalb des Horizonts liegen). Die Krisen
  wandern damit mit, auch in der Suche nach dem frühesten Rücktrittsalter. Ist die Liste gefüllt, fragt die App nach
  Ersetzen oder Anhängen. Wechsel auf «Individuell» bei leerer Liste übernimmt die automatischen Krisen sofort
  (Ausgleich ein). Ist die Liste schon gefüllt, bleibt sie. Eine leere Liste zeigt «Krise hinzufügen» und
  «Automatische Krisen übernehmen», nicht nur einen Hinweis. Der einzige Editor sitzt in «Was wäre, wenn …?»,
  direkt unter dem Umschalter Keine / Automatisch / Individuell. Eine eigene Karte «Krisen» gibt es nicht.
  Ist in der Umkehrrechnung «Individuell» gewählt, gilt dieselbe Liste aus dem Haushalt. Ist sie leer, rechnet
  die Umkehr weiterhin die Finanzkrise ab nächstem Jahr, bis die Liste Einträge hat.
- **Überschneidung:** Pro Monat gilt die später beginnende Krise, bei gleichem Beginn der Eintrag weiter unten.
  Ein Kalenderjahr hat genau eine Rendite (bei einem Monatsbeginn geometrisch gemischt). Läuft die frühere Krise
  danach weiter, nennt die App die Reihenfolge (z.B. «Covid bis März, danach Finanzkrise») und nicht dieselbe Krise
  als verdrängt. Die Jahre werden nicht addiert.
- **Kennzahlen** an der gewählten Krise: siehe Abschnitt 2b (`krisenSchwere`). Zusätzlich, einmal unter den
  Feldern, der reale Rückgang des eigenen Aktienmix über dieselben Katalogjahre. `aktienKennzahl` bleibt die ältere
  Zerlegung (Rückgang vom Vorkrisenstand, Jahre bis zu diesem Minimum, Erholung ab dort, Teuerung) und fliesst nicht
  in die Simulation.
- **Eigene Krise** (`id` `eigen`): Modellannahme, keine historische Reihe. Realer Rückgang des ganzen
  Wertschriftenportfolios (−80 % bis −5 %, Standard −30 %) gleichmässig über 1–8 Jahre, danach reale Erholung auf
  den Stand vor der Krise über 0–15 Jahre (0 = der Stand bleibt unten). Aktien und Obligationen erhalten dieselbe
  nominale Rendite, damit der Aktienanteil das Ergebnis nicht verschiebt. Teuerung, Bargeld und Hauspreise bleiben
  die Annahmen; Anlagekosten werden wie sonst abgezogen. Ist «Normale Jahre ausgleichen» ein, zählt die synthetische
  reale Wertschriftenrendite im Ausgleich mit (Hauspreise bleiben die Annahme, diese Jahre sind dafür keine
  Krisenjahre). Bezeichnung höchstens 40 Zeichen, ohne Steuerzeichen und
  ohne spitze Klammern und ohne unsichtbare Zeichen (Format-, Privat- und Nichtzeichen, U+2028/U+2029). Am Band steht diese Bezeichnung.

### Darstellung

Krisenjahre sind im Vermögensverlauf (Ergebnis), im Diagramm «Was wäre, wenn …?» und im Diagramm «Szenarien im
Vergleich» farbig hinterlegt und mit dem Kurznamen beschriftet (senkrecht, wenn der Bereich schmal ist), darunter als
Text mit Jahren und Alter (auch für Screenreader). Ein Punkt zeigt das Vermögen am Jahresende; ein Krisenjahr J liegt
zwischen den Punkten J−1 und J. Kontraste: Beschriftung hell 6,8–8,0:1, dunkel 8,6–10,8:1 (auf eigenem Hintergrund),
Rand der Fläche hell 3,7:1, dunkel 3,6:1.

## 2b. Kennzahlen in der Krisenauswahl (ab 1.3.5)

Die Auswahl im Modus «Individuell» zeigt pro Katalogkrise, wie schwer sie in den Jahresdaten war. Die Zahlen werden zur
Laufzeit aus `data/krisen-historisch.json` gerechnet (`krisenSchwere` in `src/data/krisen.ts`). Es gibt keine
eingetippte Ersatztabelle. Tests in `src/data/krisenSchwere.test.ts` rechnen dieselben Grössen noch einmal aus der Datei
und vergleichen.

**Messgrösse:** realer Aktien-Gesamtertrag, 100 % Aktien, auf der Standard-Datenreihe der Krise (wählbar bleibt die
Reihe darunter; weicht sie ab, sagt die Infozeile das). Nominal ist das `eq_tr` (Dividenden reinvestiert). Real heisst
deflationiert mit der Teuerung desselben Jahres: Index neu = Index alt × (1 + `eq_tr`) / (1 + Teuerung). Dieselbe
Aktienreihe verwendet die Simulation. Der Aktienanteil des Haushalts mischt Obligationen bei und steht einmal unter den
Feldern («Ihr Mix»); er ändert weder die Kennzahl noch die Sortierung.

**Vorkrisenstand:** Index = 1 am Jahresende vor `von`.

**Maximaler Rückgang (Peak-to-Trough, kumuliert):** vom jeweiligen Höchststand innerhalb des Pfads (Start bei 1) zum
späteren Tiefstand, nur in den Katalogjahren `von`…`bis`. Der Rückgang ist Tiefstand / Höchststand − 1, also der
kumulierte Faktor, nicht die Summe der Jahresrenditen. Liegt der Höchststand am Jahresende vor `von`, fällt die Krise
ab dem Start. Steigt der Index in einem Katalogjahr zuerst, wandert der Höchststand (Dotcom: Ende 2000, weil 2000 real
noch positiv war). Das ist dieselbe Rechnung wie `maxRealerRueckgang` auf dem 100-%-Aktienpfad.

**Zeit bis zum Tiefpunkt:** Anzahl Jahre vom Jahresende des Höchststands bis zum Jahresende des Tiefpunkts. Die Anzeige
sagt «nach ca. N Jahren». Fiel der Jahresendstand nie unter einen vorherigen Höchststand, gibt es keinen Tiefpunkt.
Ein Monat innerhalb des Jahres ist in den Daten nicht sichtbar (Jahreswerte).

**Katalogphase:** `bis − von + 1` Jahre. Nur diese Jahre spielt die Simulation ab. Danach gilt die eigene Renditeannahme
(gegebenenfalls mit Ausgleich der normalen Jahre). Die Infozeile sagt das ausdrücklich:
«Die App spielt nur die Katalogphase (x Jahre) ab, danach gilt Ihre Renditeannahme (x%).» Mit Ausgleich heisst es
«danach gelten die ausgeglichenen Renditen (Wertschriften x%, Hauspreise y%).»

**Historische Erholung:** Jahre vom Startjahr `von` bis und mit dem Jahresende, an dem der reale Aktienindex wieder
mindestens den Vorkrisenstand erreicht. Die Suche darf über `bis` hinausgehen, höchstens 80 Jahre ab `von` (gleiche
Grenze wie `aktienKennzahl`). Das ist nicht die Simulationslänge. Liegt die Rückkehr nach `bis`, sagt die Infozeile,
dass sie nicht abgespielt wird (Ölkrise: Katalogphase 2 Jahre, Rückkehr auf den realen Aktienstand erst 1985, also
nach 13 Jahren). Wird das Niveau in der Datenreihe nicht erreicht (Japan ab 1990, Zinsschock 2022), steht
«nicht erholt». Fiel der Index nie unter den Vorkrisenstand, steht «kein Einbruch unter dem Vorkrisenstand».

**Aktien-Tiefpunkt:** Jahre vom Jahresende des Höchststands bis zum Jahresende des Tiefpunkts. Steht nur im Kasten,
Anzeige «nach ca. N Jahren». Der Name sagt, dass es der Aktienindex ist, nicht die Hauspreise.

**Aktien am Phasenende:** der kumulierte reale Aktien-Gesamtertrag am Jahresende `bis` (Index − 1). Steht nur im Kasten,
zum Beispiel «+181.7%». Das Plus bildet keine eigene Gruppe und keinen Zusatz in der Menüzeile.

**Hauspreise:** wo jedes Katalogjahr `hpnom` und Teuerung hat, der maximale reale Hauspreis-Rückgang, dieselbe
Peak-to-Trough-Rechnung (Jahresende, Index = 1 am Jahresende vor `von`, real = nominal / Teuerung). Angezeigt wird er
erst ab 1 Prozentpunkt (`HAUSPREIS_ANZEIGE_AB` = −0.01 in `src/ui/krisenSchwereText.ts`). Flacher, zum Beispiel Dotcom
rund −0.1 %, steht nicht in der Menüzeile. In der Menüzeile heisst der Zusatz «Häuser -31.8%» und steht direkt nach dem Aktienrückgang, und nur wenn die Krise
weder «extrem» noch «nicht erholt» ist. Im Kasten steht «real max. -31.8% (Peak-to-Trough)». Ein Rückgang unter 1 %
(Dotcom) heisst im Kasten «kein Rückgang über 1 %»; genau 0 bleibt «kein Rückgang in den Jahreswerten». Fehlt `hpnom`
(Zinsschock, Schweiz 2022; Aktien, Obligationen, Geldmarkt und Teuerung sind vorhanden), nennt der Kasten den Satz,
den `jahresRenditen` einsetzt: ohne Ausgleich «Ihre Renditeannahme (x%)», mit Ausgleich «die ausgeglichene
Hauspreisrendite (y%)». x% ist die Rendite dieser Auswertung: der Regler «Rendite Börse (nominal)» in
«Was wäre, wenn», sonst die Eingabe. y% ist der ausgeglichene Satz derselben Rechnung. Das ist
`wohneigentumNominal`, falls der Ausgleich einen Satz gesetzt hat, sonst `annahmen.renditeNominal`. Ein eigenes Feld für eine Wohneigentumsrendite gibt es nicht. Die Teuerung 2022 bleibt
die historische Zahl. Die Katalogphase sagt dasselbe für die Zeit nach der Phase: die Renditeannahme oder die
ausgeglichenen Renditen von Wertschriften und Hauspreisen. Die Kennzahl sortiert nicht.

**Menüzeile (ab 1.3.6):** Rückgang, dann höchstens ein Zusatz, dann der Name. Der Zusatz steht vor dem Namen, weil bei
360 px Breite nur der vordere Teil der Zeile sichtbar ist. Reihenfolge des Zusatzes: «extrem», dann «nicht erholt»,
dann «Häuser» ab der Schwelle. Alles andere steht im Kasten direkt unter der Auswahl.

**Sortierung:** nur nach dem maximalen realen Aktienrückgang, grösster zuerst, dann «Eigene Krise (Annahme)». Ein Plus
am Phasenende schiebt die Krise nicht nach hinten. Die eigene Krise ist ein Modell, keine historische Kennzahl; ihre
Bezeichnung bleibt im Textfeld, nicht in der Liste. Gespeichert wird die Id. Die Optionszeilen werden einmal beim Laden
berechnet (`KRISEN_KATALOG_OPTIONEN`). `KRISEN` und der Modus «Automatisch» bleiben in der historischen Reihenfolge,
weil dort die Abfolge gerechnet wird, nicht die Schwere.

Gerundet wie in der App (`fmtProzent`, de-CH, Dezimalpunkt, kein Leerzeichen vor %), Stand der Reihe 27.9.2026
(JST R6, Schweiz ab 2021 SNB und BFS):

| Krise | Start | Maximaler Rückgang | Aktien-Tiefpunkt | Katalogphase | Historische Erholung | Aktien am Phasenende | Hauspreise real | Menüzeile |
|---|---|---|---|---|---|---|---|
| Japan ab 1990 (extrem) | 1990 | -62.7% | nach ca. 14 Jahren | 14 Jahre | nicht erholt | -62.7% | -32.9% | `-62.7% · extrem · Japan-Krise 1990` |
| Ölkrise | 1973 | -55.2% | nach ca. 2 Jahren | 2 Jahre | nach 13 Jahren (wird nicht abgespielt) | -55.2% | -10% | `-55.2% · Häuser -10% · Ölkrise 1973` |
| Grosse Depression (extrem) | 1929 | -51.9% | nach ca. 4 Jahren | 4 Jahre | nach 7 Jahren (wird nicht abgespielt) | -51.9% | -24.6% | `-51.9% · extrem · Grosse Depression 1929` |
| Stagflation (extrem) | 1973 | -47.2% | nach ca. 2 Jahren | 9 Jahre | nach 11 Jahren (wird nicht abgespielt) | -23.3% | -6.9% | `-47.2% · extrem · Stagflation 1973` |
| Dotcom | 2000 | -43.2% | nach ca. 2 Jahren | 3 Jahre | nach 6 Jahren (wird nicht abgespielt) | -37.4% | kein Rückgang über 1 % | `-43.2% · Dotcom 2000` |
| Finanz- und Immobilienkrise | 2007 | -36.1% | nach ca. 2 Jahren | 3 Jahre | nach 7 Jahren (wird nicht abgespielt) | -20.9% | kein Rückgang | `-36.1% · Finanzkrise 2007` |
| Schwarzer Montag | 1987 | -28.5% | nach ca. 1 Jahr | 1 Jahr | nach 3 Jahren (wird nicht abgespielt) | -28.5% | kein Rückgang | `-28.5% · Schwarzer Montag 1987` |
| Schweizer Immobilienkrise | 1990 | -23.5% | nach ca. 1 Jahr | 8 Jahre | nach 4 Jahren (innerhalb der Phase) | +181.7% | -31.8% | `-23.5% · Häuser -31.8% · Immobilienkrise CH 1990` |
| Inflations- und Zinsschock | 2022 | -18.8% | nach ca. 1 Jahr | 1 Jahr | nicht erholt | -18.8% | keine Jahresdaten 2022 | `-18.8% · nicht erholt · Zinsschock 2022` |
| Eurokrise | 2011 | -7.9% | nach ca. 1 Jahr | 1 Jahr | nach 2 Jahren (wird nicht abgespielt) | -7.9% | kein Rückgang | `-7.9% · Eurokrise 2011` |
| Covid | 2020 | keiner unter dem Vorkrisenstand | keiner | 1 Jahr | kein Einbruch unter dem Vorkrisenstand | +4.8% | kein Rückgang | `Covid 2020` |

Die Schweizer Immobilienkrise endet bei den Aktien im Plus und steht trotzdem über dem Zinsschock, weil der maximale
Aktienrückgang -23.5% tiefer ist als -18.8%. Die Hauspreise derselben Phase fielen real um -31.8% (Jahresende 1997);
die Menüzeile nennt das als «Häuser -31.8%». Aktien Schweiz 1990–1997 fielen nur 1990 real und lagen 1997 weit über
dem Stand von 1989. Covid 2020 ist im Jahresendstand positiv; der Einbruch im März fehlt in den Jahreswerten. Beim
Zinsschock 2022 fehlt `hpnom`; die Teuerung ist vorhanden.

## 3. Rechenweise

- Krisenjahr: Wertschriften = Aktienanteil × `eq_tr` + (1 − Aktienanteil) × `bond_tr`; Bargeld = `bill_rate`;
  Wohneigentum = Veränderung `hpnom` (fehlt: Annahme); Teuerung = Veränderung `cpi`. Anlagekosten wie sonst.
  Übrige Jahre: Annahmen des Nutzers. Renditen in Landeswährung, ohne Wechselkurseffekt.
- Der Aktienanteil (`annahmen.aktienanteil`, Standard 50 %) ist eine Annahme des Nutzers, kein Regelwert.
- «X Jahre nach dem Rücktritt»: bezogen auf das Stopp-Alter der ersten erwerbstätigen Person in der jeweiligen
  Simulation (im Solver also auf das jeweils geprüfte Rücktrittsalter).
- Die Simulation rechnet real: Ausgaben steigen mit der Krisenteuerung, PK-Renten (nominal fix) verlieren real an Wert,
  AHV-Renten werden vereinfacht sofort voll angepasst (in Wirklichkeit Mischindex, in der Regel alle zwei Jahre).
- Monte Carlo «Ihre Annahmen + Krisen»: jedes normale Jahr beginnt mit Wahrscheinlichkeit (Krisen pro Dekade)/10
  eine zufällig gezogene Krise aus dem Pool. Pool seit Schema 6 = dieselben «normalen» Krisen wie bei «Automatisch»
  (vorher: Katalogkrisen mit realem Aktienrückgang ≥ 20 %, inkl. Depression, Stagflation, Japan). Standard 0,74 pro
  Dekade (Schweiz, real ≥ 20 %, siehe unten). Die Krisenjahre ersetzen die Annahme; die normalen Jahre werden **im
  Erwartungswert über den Planungszeitraum** ausgeglichen (`ausgleichErwartetHorizont`, seit Schema 7): exakte
  Rekursion über die Jahre des Horizonts, eine Krise, die über das Horizontende hinausreicht, wird abgeschnitten;
  die normale Rendite wird so gewählt, dass die erwartete reale (log-)Rendite über den Zeitraum der Annahme
  entspricht, getrennt für Wertschriften und Hauspreise. Vorher (`ausgleichErwartet`, unendlicher Horizont):
  Beispiel 4 %/1 %/50 % Aktien 4,74 %. Die Zahl der Krisen pro Lauf bleibt zufällig; Test: 200'000
  simulierte Jahre treffen die Annahme auf 3 Stellen. Vorher kamen die Krisen zur Annahme dazu (eher vorsichtig).
- Monte Carlo «Nur Geschichte Schweiz»: Block-Bootstrap (Standard 5 Jahre) aus den vollständigen Schweizer Jahren
  1900–2024; Renditen und Teuerung desselben Jahres werden gemeinsam gezogen. Ihre Renditeannahme gilt dann nicht.
- 300 Läufe mit festem Startwert (reproduzierbar); Ergebnis: Erfolgswahrscheinlichkeit, Alter, bis zu dem das
  Vermögen in 90 % der Läufe reicht, Fächer 10./25./50./75./90. Perzentil (real oder nominal, nominal pro Lauf mit dessen Teuerung umgerechnet); «mit 90 % / 75 % / 50 % Wahrscheinlichkeit reicht das Geld bis Alter …» aus den sortierten Ruin-Altern.

## 4. Wie viele Krisen gab es pro Dekade?

Definitionen (Auszählung `scripts/krisen-daten.py` auf JST R6):

- **Aktien real ≥ 20 % / ≥ 30 %:** Der reale Aktien-Gesamtertragsindex (Dividenden reinvestiert, mit `cpi`
  deflationiert, Jahresendwerte) fällt um mindestens 20 % bzw. 30 % unter den letzten Höchststand. Eine Episode
  endet erst mit einem neuen Höchststand (deshalb zählen z.B. in den USA 2000–2002 und 2008 als eine Episode).
  Gezählt wird das Beginnjahr (Jahr nach dem Höchststand). Pro Dekade = Anzahl ÷ Jahre mit Daten × 10.
- **Aktien nominal ≥ 20 %:** gleich, ohne Teuerung (Annäherung an einen «Bärenmarkt» mit Jahresdaten; die übliche
  Definition mit Tageskursen ergibt mehr Bärenmärkte).
- **Bankenkrisen:** Beginnjahre systemischer Bankenkrisen nach JST (`crisisJST` = 1), Jahre 1870–2020.
- **Weltweit:** (a) Durchschnitt der 18 JST-Länder (Australien, Belgien, Dänemark, Deutschland, Finnland, Frankreich,
  Grossbritannien, Irland, Italien, Japan, Kanada, Niederlande, Norwegen, Portugal, Schweden, Schweiz, Spanien, USA);
  (b) gleichgewichteter Welt-Index = Mittel der realen Landesrenditen (Jahre mit mindestens 10 Ländern);
  (c) «Bankenkrisen-Wellen» = Jahre, in denen in mindestens 3 der 18 Länder eine Bankenkrise beginnt.
- Jahresdaten zeigen kurze Einbrüche innerhalb eines Jahres nicht (Oktober 1987 in den USA, März 2020). Die Zahlen
  sind deshalb eher Untergrenzen. Aktien Schweiz in JST erst ab 1900 (121 Jahre mit Daten).

**Zeitraum 1871–2020** (pro Dekade; in Klammern Anzahl Episoden / Jahre mit Daten)

| Gebiet | Aktien real ≥ 20 % | Aktien real ≥ 30 % | Aktien nominal ≥ 20 % | Bankenkrisen (JST) |
|---|---|---|---|---|
| Schweiz | 0,74 (9/121) | 0,50 (6/121) | 0,58 (7/121) | 0,27 (4/150) |
| USA | 0,47 (7/149) | 0,40 (6/149) | 0,47 (7/149) | 0,40 (6/150) |
| Japan | 0,75 (10/133) | 0,45 (6/133) | 0,38 (5/133) | 0,47 (7/150) |
| Ø 18 JST-Länder | 0,50 | 0,36 | 0,48 | 0,32 |
| Welt-Index gleichgewichtet (18 Länder) | 0,41 (6/148) | 0,27 (4/148) | – | Wellen ≥ 3 Länder: 0,67 (1873, 1890, 1893, 1907, 1920, 1921, 1930, 1931, 1991, 2008) |

**Zeitraum 1950–2020** (pro Dekade; in Klammern Anzahl Episoden / Jahre mit Daten)

| Gebiet | Aktien real ≥ 20 % | Aktien real ≥ 30 % | Aktien nominal ≥ 20 % | Bankenkrisen (JST) |
|---|---|---|---|---|
| Schweiz | 0,85 (6/71) | 0,56 (4/71) | 0,70 (5/71) | 0,28 (2/71) |
| USA | 0,28 (2/71) | 0,28 (2/71) | 0,42 (3/71) | 0,28 (2/71) |
| Japan | 0,56 (4/71) | 0,28 (2/71) | 0,28 (2/71) | 0,14 (1/71) |
| Ø 18 JST-Länder | 0,61 | 0,45 | 0,57 | 0,19 |
| Welt-Index gleichgewichtet (18 Länder) | 0,42 (3/71) | 0,42 (3/71) | – | Wellen ≥ 3 Länder: 0,28 (1991, 2008) |

Episoden (Beginn–Tiefpunkt, realer Rückgang):

- Schweiz (real ≥ 20 %): 1915–1921 (-63 %); 1929–1931 (-34 %); 1939–1940 (-22 %); 1962–1966 (-48 %); 1973–1974 (-55 %); 1987–1987 (-28 %); 1990–1990 (-24 %); 2001–2002 (-43 %); 2007–2008 (-36 %). Bankenkrisen: 1910, 1931, 1991, 2008.
- USA (real ≥ 20 %): 1907–1907 (-32 %); 1917–1920 (-49 %); 1929–1932 (-52 %); 1937–1941 (-35 %); 1946–1948 (-23 %); 1973–1974 (-47 %); 2000–2008 (-44 %). Bankenkrisen: 1873, 1893, 1907, 1930, 1984, 2007.
- Japan (real ≥ 20 %): 1890–1890 (-24 %); 1897–1901 (-60 %); 1907–1908 (-46 %); 1917–1922 (-40 %); 1929–1930 (-26 %); 1938–1945 (-93 %); 1950–1950 (-22 %); 1962–1965 (-22 %); 1974–1975 (-34 %); 1990–2012 (-63 %). Bankenkrisen: 1871, 1890, 1901, 1907, 1920, 1927, 1997.
- Welt-Index gleichgewichtet (real ≥ 20 %): 1917–1920 (-44 %); 1929–1931 (-30 %); 1944–1948 (-25 %); 1974–1977 (-38 %); 2000–2002 (-40 %); 2008–2008 (-45 %).

**Kurz:** Ein realer Aktieneinbruch von 20 % oder mehr kam in der Schweiz etwa 0,7- bis 0,85-mal pro Dekade vor
(etwa alle 12–14 Jahre), in den USA 0,3- bis 0,5-mal, im Durchschnitt der 18 Länder 0,5- bis 0,6-mal. Einbrüche von
30 % oder mehr: Schweiz etwa 0,5-mal pro Dekade, Durchschnitt 0,36 bis 0,45. Bankenkrisen: Schweiz etwa 0,3 pro
Dekade, USA 0,3 bis 0,4, Durchschnitt 0,2 bis 0,3. Die Antwort auf «0,5, 1 oder 2 pro Dekade?» lautet also: eher 0,5
bis 1 grosse Aktienkrise pro Dekade, nicht 2.

## 5. OFFEN

- Planungsalter-Regler: Obergrenze ist der technische Höchstwert der App (Eingabe + 20); eine fachliche Obergrenze
  (z.B. höchstes beobachtetes Alter) ist nicht hinterlegt.
- Rücktritts-Regler: frühestens heute, spätestens 70 (AHV-Aufschub höchstens 5 Jahre, Art. 39 AHVG; PK-Aufschub bei
  Weiterarbeit höchstens bis 70, Art. 13 BVG, Regelwert `bvg.bezugsalter.aufschubBis`). Einen früheren Rücktritt
  begrenzt das Gesetz nicht (PK-Guthaben vor dem frühesten Bezugsalter auf Freizügigkeit); reglementarische
  Grenzen der eigenen Kasse sind nicht abgebildet.
- «Automatisch» gleicht seit Schema 7 über den eigenen Planungszeitraum aus: der Durchschnitt entspricht der Annahme,
  die Reihenfolge (frühe oder späte Krisen) wirkt aber weiterhin (gewollt). Der Hauspreis-Ausgleich gilt über den
  ganzen Planungszeitraum, auch wenn die Liegenschaft vorher verkauft wird (vereinfacht).
- Hauspreise wirken seit Schema 7 auf den ganzen Verkehrswert; die Hypothek bleibt stehen (nominal fix bei
  «Wohnkosten separat», sonst pauschal mit der Renditeannahme, nicht mit der ausgeglichenen Rendite der normalen Jahre). Eine Hauspreiskrise trifft den Nettowert deshalb
  mit Hebel (z.B. −20 % auf 1 Mio. mit 0,4 Mio. Hypothek = −33 % auf dem Nettowert).

- Laeven-Valencia (IMF Systemic Banking Crises Database) und Reinhart-Rogoff nicht ausgezählt (nur JST).
- Obligationen Schweiz 2021–2024 sind eine Näherung aus Renditen (kein Gesamtertragsindex frei verfügbar).
- Schweiz 2025: SNB-Renditen im Portal (Stand Abruf) nur bis 7/2025; nicht enthalten.
- Keine Wechselkurseffekte bei USA/Japan-Reihen (Renditen in Landeswährung).
- AHV-Anpassung in Krisen vereinfacht (sofort volle Teuerung).
- SIX-Rechte am SPI: nur abgeleitete Jahresrenditen gespeichert, Nutzung nicht kommerziell; ausdrückliche Zustimmung
  nicht eingeholt.
