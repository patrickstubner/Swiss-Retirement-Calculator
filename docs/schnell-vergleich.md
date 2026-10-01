# Schnell vs. Detailliert – gemessene Abweichung

Erzeugt mit `src/core/schnellVergleich.test.ts` (Stand 25.9.2026, Regeln 2026).

- **«Detailliert»**: alle Werte wie auf Vorsorgeausweis bzw. Rentenvorausberechnung (illustrative Beispielwerte,
  keine realen Personen).
- **«Schnell»**: nur die Schnell-Eingaben; Bargeld wird dem übrigen Vermögen zugeschlagen. **UWS** = optionales
  Schnell-Feld «Umwandlungssatz laut Vorsorgeausweis». **Ohne UWS** rechnet «Schnell» neu mit der aufgeteilten
  Schätzung: 6,8% (Art. 14 BVG) auf den geschätzten obligatorischen Teil, 5,17% (durchschnittlicher Umwandlungssatz
  der Pensionskassen, OAK BV, Bericht zur finanziellen Lage 2025, Stand 31.12.2025) auf den Rest (bis PR #3: 6,8% auf
  dem ganzen Guthaben).
- Annahmen: «Schnell» und «Detailliert» teilen `haushalt.annahmen`; die Messwerte unten entstanden am 25.9.2026 mit dem damaligen Standard (4 % / 1 %). Seit 2.10.2026 ist der Standard 7 % / 2 %; die Abweichungen Schnell − Detail beruhen auf den Eingaben, nicht auf der Rendite, die absoluten Vermögenswerte wären aber höher. Die Tabelle wurde nicht neu erzeugt.
- Δ = Schnell − Detail. Δ Alter > 0: «Schnell» pessimistischer. Das Vermögen mit 85 ist real (jüngere Person).

| Haushalt | Variante | Frühestes Alter (Detail) | Δ Alter | Δ Vermögen mit 85 (CHF) | in % Vermögen 85 (Detail) | in % Gesamtvermögen heute |
|---|---|---|---|---|---|---|
| BVG-nah | Schnell mit PK-Guthaben, ohne UWS | 64 J. 9 Mt. | -8 Mt. | +45k | +27.0% | +9.0% |
| BVG-nah | Schnell ohne PK-Guthaben/UWS | 64 J. 9 Mt. | +9 Mt. | -43k | -25.9% | -8.6% |
| BVG-nah | Schnell mit PK-Guthaben + UWS | 64 J. 9 Mt. | -7 Mt. | +41k | +24.4% | +8.1% |
| Umhüllend | Schnell mit PK-Guthaben, ohne UWS | 57 J. 6 Mt. | -4 Mt. | +3k | +0.2% | +0.2% |
| Umhüllend | Schnell ohne PK-Guthaben/UWS | 57 J. 6 Mt. | +35 Mt. | -485k | -25.0% | -22.2% |
| Umhüllend | Schnell mit PK-Guthaben + UWS | 57 J. 6 Mt. | +3 Mt. | -97k | -5.0% | -4.4% |
| Paar Ausland | Schnell mit PK-Guthaben, ohne UWS, mit CH seit | 57 J. 9 Mt. | +6 Mt. | -213k | -14.1% | -28.2% |
| Paar Ausland | Schnell mit PK-Guthaben, ohne UWS, ohne CH seit | 57 J. 9 Mt. | +5 Mt. | -202k | -13.4% | -26.8% |
| Paar Ausland | Schnell ohne PK-Guthaben/UWS, mit CH seit | 57 J. 9 Mt. | +43 Mt. | -618k | -41.0% | -81.9% |
| Paar Ausland | Schnell mit PK-Guthaben + UWS + CH seit | 57 J. 9 Mt. | +5 Mt. | -201k | -13.4% | -26.7% |
| Frühpension | Schnell mit PK-Guthaben, ohne UWS | 61 J. 10 Mt. | -5 Mt. | -22k | -70.5% | -1.6% |
| Frühpension | Schnell ohne PK-Guthaben/UWS | 61 J. 10 Mt. | +63 Mt. | -589k | -1861.7% | -41.2% |
| Frühpension | Schnell mit PK-Guthaben + UWS | 61 J. 10 Mt. | +7 Mt. | -156k | -493.3% | -10.9% |

### Veränderung gegenüber der bisherigen Schätzung 6,8% (Zeilen «mit PK-Guthaben, ohne UWS»)

| Haushalt | Δ Alter bisher (6,8%) | Δ Alter neu | in % Gesamtvermögen heute bisher | neu |
|---|---|---|---|---|
| BVG-nah | -11 Mt. | -8 Mt. | +14.2% | +9.0% |
| Umhüllend | -13 Mt. | -4 Mt. | +7.0% | +0.2% |
| Frühpension | -22 Mt. | -5 Mt. | +10.3% | -1.6% |

Der Beispielhaushalt «Paar Ausland» wurde am 30.9.2026 durch eine neue, erfundene Beispielperson B (Jahrgang 1985, seit 2014 in der Schweiz) ersetzt; ein Vergleich mit der früheren 6,8%-Schätzung liegt dafür nicht vor.

Die Zeilen «ohne PK-Guthaben» ändern sich nicht: das dann geschätzte Guthaben besteht nur aus
BVG-Mindestgutschriften, ist also ganz obligatorisch → 6,8%.

### Geschätzter Umwandlungssatz (Schnell mit PK-Guthaben, ohne UWS)

| Person | Anteil Obligatorium (geschätzt, im RA) | UWS geschätzt | UWS laut Vorsorgeausweis (Detail) |
|---|---|---|---|
| BVG-nah (A) | 79% | 6.46% | 6.40% |
| Umhüllend (B) | 42% | 5.85% | 5.20% |
| Paar Ausland (Person A) | 51% | 6.01% | 6.00% |
| Paar Ausland (Person B) | 25% | 5.57% | 6.50% |
| Frühpension (C) | 38% | 5.79% | 5.00% |

## Einordnung

- **Mit PK-Guthaben und Umwandlungssatz** liegt «Schnell» bei −7 bis +7 Monaten bzw. −4 bis +8% des heutigen
  Gesamtvermögens (Frühpension −10,9%: im Detail PK-Bezug ab 58 laut Reglement und höhere Sparbeiträge). Beim
  jüngeren Haushalt «Paar Ausland» (Person B mit Zuzug 2014, viele Beitragslücken, Auslandsrente) ist «Schnell» mit
  +5 Monaten bzw. −27% des heutigen Gesamtvermögens deutlich pessimistischer: Die Schnell-Schätzung bildet
  Auslandsrente und Detailwerte der Vorausberechnung nur grob ab.
- **Ohne Umwandlungssatz** (aufgeteilte Schätzung) liegt «Schnell» neu bei −8 bis +6 Monaten (bisher mit 6,8%
  −7 bis −22 Monate; Haushalt «Paar Ausland» nicht mehr vergleichbar, siehe oben) und ist nicht mehr systematisch zu optimistisch. Der geschätzte Satz liegt bei BVG-nahen
  Kassen nahe am Vorsorgeausweis; bei stark umhüllenden Kassen eher etwas zu hoch (+0,7 bis +0,8 Pp), weil der
  OAK-Durchschnitt in den Kassen fürs ganze Guthaben gilt, hier aber nur für den Rest verwendet wird; bei kleinen
  obligatorischen Guthaben (Teilzeit, tiefer Lohn, z.B. Person B im Haushalt «Paar Ausland») kann er auch zu tief sein. Dass die Abweichung im
  Ergebnis kleiner ist als mit eingegebenem UWS, ist teilweise Zufall (gegenläufige Effekte: im Detail höhere
  Sparbeiträge, frühere PK-Bezüge). Die App empfiehlt darum weiterhin, den Satz vom Vorsorgeausweis einzutragen.
- **Ohne PK-Guthaben** (Schätzung aus BVG-Mindestgutschriften) ist «Schnell» deutlich zu pessimistisch.
- **«In der Schweiz seit»** wirkt im Paar-Beispiel schwach (Δ Alter +6 statt +5 Monate), weil die Ehepaar-Plafonierung einen Teil der Lücke
  auffängt (Plafond bei Teilrenten vereinfacht, siehe OFFEN in docs/quellen.md).
- Prozent bezogen auf das Vermögen mit 85 sind bei fast aufgebrauchtem Vermögen nicht aussagekräftig
  (Frühpension); darum zusätzlich der Bezug auf das heutige Gesamtvermögen.
- Rechenzeit (Node, Standardhaushalt mit PK-Guthaben): Schätzung 0,02 ms, eine Simulation ca. 1 ms, Suche nach dem
  frühesten Alter ca. 0,7 ms, Sensitivität ca. 6 ms – kein Anlass für eine Beschleunigung.
