# Schnell vs. Detailliert – gemessene Abweichung

Erzeugt mit `src/core/schnellVergleich.test.ts` (Stand 25.9.2026, Regeln 2026).

- **«Detailliert»**: alle Werte wie auf Vorsorgeausweis bzw. Rentenvorausberechnung (illustrative Beispielwerte,
  keine realen Personen).
- **«Schnell»**: nur die Schnell-Eingaben; Bargeld wird dem übrigen Vermögen zugeschlagen. **UWS** = optionales
  Schnell-Feld «Umwandlungssatz laut Vorsorgeausweis». **Ohne UWS** rechnet «Schnell» neu mit der aufgeteilten
  Schätzung: 6,8% (Art. 14 BVG) auf den geschätzten obligatorischen Teil, 5,17% (durchschnittlicher Umwandlungssatz
  der Pensionskassen, OAK BV, Bericht zur finanziellen Lage 2025, Stand 31.12.2025) auf den Rest (bis PR #3: 6,8% auf
  dem ganzen Guthaben).
- Δ = Schnell − Detail. Δ Alter > 0: «Schnell» pessimistischer. Das Vermögen mit 85 ist real (jüngere Person).

| Haushalt | Variante | Frühestes Alter (Detail) | Δ Alter | Δ Vermögen mit 85 (CHF) | in % Vermögen 85 (Detail) | in % Gesamtvermögen heute |
|---|---|---|---|---|---|---|
| BVG-nah | Schnell mit PK-Guthaben, ohne UWS | 64 J. 8 Mt. | -7 Mt. | +45k | +26.5% | +9.0% |
| BVG-nah | Schnell ohne PK-Guthaben/UWS | 64 J. 8 Mt. | +9 Mt. | -43k | -25.3% | -8.6% |
| BVG-nah | Schnell mit PK-Guthaben + UWS | 64 J. 8 Mt. | -6 Mt. | +41k | +24.0% | +8.1% |
| Umhüllend | Schnell mit PK-Guthaben, ohne UWS | 57 J. 10 Mt. | -4 Mt. | +12k | +0.6% | +0.5% |
| Umhüllend | Schnell ohne PK-Guthaben/UWS | 57 J. 10 Mt. | +34 Mt. | -464k | -24.9% | -21.3% |
| Umhüllend | Schnell mit PK-Guthaben + UWS | 57 J. 10 Mt. | +3 Mt. | -89k | -4.8% | -4.1% |
| Paar BR | Schnell mit PK-Guthaben, ohne UWS, mit CH seit | 63 J. 4 Mt. | +1 Mt. | -13k | -1.8% | -1.8% |
| Paar BR | Schnell mit PK-Guthaben, ohne UWS, ohne CH seit | 63 J. 4 Mt. | -2 Mt. | +10k | +1.4% | +1.4% |
| Paar BR | Schnell ohne PK-Guthaben/UWS, mit CH seit | 63 J. 4 Mt. | +30 Mt. | -294k | -39.8% | -39.0% |
| Paar BR | Schnell mit PK-Guthaben + UWS + CH seit | 63 J. 4 Mt. | +3 Mt. | -40k | -5.4% | -5.3% |
| Frühpension | Schnell mit PK-Guthaben, ohne UWS | 61 J. 10 Mt. | -6 Mt. | -22k | -57.6% | -1.5% |
| Frühpension | Schnell ohne PK-Guthaben/UWS | 61 J. 10 Mt. | +62 Mt. | -589k | -1549.3% | -41.2% |
| Frühpension | Schnell mit PK-Guthaben + UWS | 61 J. 10 Mt. | +7 Mt. | -156k | -409.8% | -10.9% |

### Veränderung gegenüber der bisherigen Schätzung 6,8% (Zeilen «mit PK-Guthaben, ohne UWS»)

| Haushalt | Δ Alter bisher (6,8%) | Δ Alter neu | in % Gesamtvermögen heute bisher | neu |
|---|---|---|---|---|
| BVG-nah | -11 Mt. | -7 Mt. | +14.2% | +9.0% |
| Umhüllend | -13 Mt. | -4 Mt. | +7.0% | +0.5% |
| Paar BR, mit CH seit | -7 Mt. | +1 Mt. | +9.5% | -1.8% |
| Paar BR, ohne CH seit | -9 Mt. | -2 Mt. | +12.6% | +1.4% |
| Frühpension | -22 Mt. | -6 Mt. | +10.3% | -1.5% |

Die Zeilen «ohne PK-Guthaben» ändern sich nicht: das dann geschätzte Guthaben besteht nur aus
BVG-Mindestgutschriften, ist also ganz obligatorisch → 6,8%.

### Geschätzter Umwandlungssatz (Schnell mit PK-Guthaben, ohne UWS)

| Person | Anteil Obligatorium (geschätzt, im Referenzalter) | UWS geschätzt | UWS laut Vorsorgeausweis (Detail) |
|---|---|---|---|
| BVG-nah (A) | 79% | 6.46% | 6.40% |
| Umhüllend (B) | 42% | 5.86% | 5.20% |
| Paar BR (Marco) | 69% | 6.29% | 6.00% |
| Paar BR (Ana) | 26% | 5.60% | 6.50% |
| Frühpension (C) | 38% | 5.79% | 5.00% |

## Einordnung

- **Mit PK-Guthaben und Umwandlungssatz** liegt «Schnell» bei ±3 bis 7 Monaten bzw. −4 bis +8% des heutigen
  Gesamtvermögens (Frühpension −10,9%: im Detail PK-Bezug ab 58 laut Reglement und höhere Sparbeiträge).
- **Ohne Umwandlungssatz** (aufgeteilte Schätzung) liegt «Schnell» neu bei −7 bis +1 Monaten (bisher mit 6,8%
  −7 bis −22 Monate) und ist nicht mehr systematisch zu optimistisch. Der geschätzte Satz liegt bei BVG-nahen
  Kassen nahe am Vorsorgeausweis; bei stark umhüllenden Kassen eher etwas zu hoch (+0,7 bis +0,8 Pp), weil der
  OAK-Durchschnitt in den Kassen fürs ganze Guthaben gilt, hier aber nur für den Rest verwendet wird; bei kleinen
  obligatorischen Guthaben (Teilzeit, tiefer Lohn, z.B. Ana) kann er auch zu tief sein. Dass die Abweichung im
  Ergebnis kleiner ist als mit eingegebenem UWS, ist teilweise Zufall (gegenläufige Effekte: im Detail höhere
  Sparbeiträge, frühere PK-Bezüge). Die App empfiehlt darum weiterhin, den Satz vom Vorsorgeausweis einzutragen.
- **Ohne PK-Guthaben** (Schätzung aus BVG-Mindestgutschriften) ist «Schnell» deutlich zu pessimistisch.
- **«In der Schweiz seit»** wirkt im Paar-Beispiel schwach, weil die Ehepaar-Plafonierung einen Teil der Lücke
  auffängt (Plafond bei Teilrenten vereinfacht, siehe OFFEN in docs/quellen.md).
- Prozent bezogen auf das Vermögen mit 85 sind bei fast aufgebrauchtem Vermögen nicht aussagekräftig
  (Frühpension); darum zusätzlich der Bezug auf das heutige Gesamtvermögen.
- Rechenzeit (Node, Standardhaushalt mit PK-Guthaben): Schätzung 0,02 ms, eine Simulation ca. 1 ms, Suche nach dem
  frühesten Alter ca. 0,7 ms, Sensitivität ca. 6 ms – kein Anlass für eine Beschleunigung.
