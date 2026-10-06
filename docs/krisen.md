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
(Modus «Individuell», höchstens 8; bei Überschneidung gilt die später beginnende).

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
  «Individuell» kein Ausgleich.

### Individuell

Ersetzt die frühere Auswahl «Krise testen» (inklusive Datenreihe CH/USA/JP). Beginn als **Kalenderjahr** (nur
innerhalb des Planungshorizonts, vom Startjahr bis zum Jahr, in dem die jüngste Person das Planungsalter erreicht;
das Alter am Jahresende steht als Hilfe daneben), **im Alter** einer Person oder **X Jahre nach dem Rücktritt**.
Liegt der aufgelöste Beginn ausserhalb des Horizonts, weist die App darauf hin; diese Jahre fliessen nicht in die
Rechnung ein. Kein Ausgleich der übrigen Jahre: Die Liste ist ein Stresstest («was, wenn zusätzlich zu meinen
Annahmen diese Krise kommt?»). Bisherige Links/Speicherstände (Schema 5) mit eingeschalteter Krise werden als
«Individuell» mit derselben Liste übernommen, sonst «Keine Krise». Schema 13: Fehlt die Liste, bleibt sie leer
(kein Absturz, keine neue Standardkrise). Einträge ohne `eigen` sind Katalogkrisen.

- **Liste:** Hinzufügen, Bearbeiten, Entfernen. Höchstens 8 Einträge (Oberfläche und Speicher; aus einem
  manipulierten Stand werden höchstens 8 gültige Einträge übernommen). Wechsel auf «Individuell» bei leerer Liste
  setzt eine Finanzkrise mit Startjahr 2036, sofern das im Horizont liegt.
- **Überschneidung:** Jedes Kalenderjahr hat genau eine Rendite. Es gilt die später beginnende Krise, bei gleichem
  Beginn der Eintrag weiter unten. Die App nennt die verdrängte Krise. Die Jahre werden nicht addiert.
- **Kennzahlen** am Eintrag (Aktien real, 100 %, gewählte Datenreihe): Stand 1 am Jahresende vor `von`, Tiefpunkt
  nur in den Katalogjahren `von`…`bis`, Dauer = Jahre bis dorthin, Erholung = Jahre vom Tiefpunkt bis der Index
  wieder mindestens 1 ist (die Reihe darf dafür über `bis` hinausgehen, höchstens 80 Jahre ab `von`; sonst «nicht
  erreicht»). Teuerung = Produkt über `von`…`bis`. Gerechnet aus `data/krisen-historisch.json` (`aktienKennzahl`),
  nicht aus einer gerundeten Ersatztabelle. Zusätzlich der reale Rückgang des eigenen Aktienmix über dieselben
  Katalogjahre.
- **Eigene Krise** (`id` `eigen`): Modellannahme, keine historische Reihe. Realer Rückgang des ganzen
  Wertschriftenportfolios (−80 % bis −5 %, Standard −30 %) gleichmässig über 1–8 Jahre, danach reale Erholung auf
  den Stand vor der Krise über 0–15 Jahre (0 = der Stand bleibt unten). Aktien und Obligationen erhalten dieselbe
  nominale Rendite, damit der Aktienanteil das Ergebnis nicht verschiebt. Teuerung, Bargeld und Hauspreise bleiben
  die Annahmen; Anlagekosten werden wie sonst abgezogen. Bezeichnung höchstens 40 Zeichen, ohne Steuerzeichen und
  ohne spitze Klammern. Am Band steht diese Bezeichnung.

### Darstellung

Krisenjahre sind im Vermögensverlauf (Ergebnis), im Diagramm «Was wäre, wenn …?» und im Diagramm «Szenarien im
Vergleich» farbig hinterlegt und mit dem Kurznamen beschriftet (senkrecht, wenn der Bereich schmal ist), darunter als
Text mit Jahren und Alter (auch für Screenreader). Ein Punkt zeigt das Vermögen am Jahresende; ein Krisenjahr J liegt
zwischen den Punkten J−1 und J. Kontraste: Beschriftung hell 6,8–8,0:1, dunkel 8,6–10,8:1 (auf eigenem Hintergrund),
Rand der Fläche hell 3,7:1, dunkel 3,6:1.

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
