# Schnell vs. Detailliert – gemessene Abweichung

Erzeugt mit `src/core/schnellVergleich.test.ts` (Stand 25.9.2026, Regeln 2026).

- **«Detailliert»**: alle Werte wie auf Vorsorgeausweis bzw. Rentenvorausberechnung (illustrative Beispielwerte,
  keine realen Personen).
- **«Schnell»**: nur die Schnell-Eingaben; Bargeld wird dem übrigen Vermögen zugeschlagen. **UWS** = optionales
  Schnell-Feld «Umwandlungssatz laut Vorsorgeausweis»; ohne UWS rechnet «Schnell» mit 6,8%.
- Δ = Schnell − Detail. Δ Alter > 0: «Schnell» pessimistischer. Das Vermögen mit 85 ist real (jüngere Person).

| Haushalt | Variante | Frühestes Alter (Detail) | Δ Alter | Δ Vermögen mit 85 (CHF) | in % Vermögen 85 (Detail) | in % Gesamtvermögen heute |
|---|---|---|---|---|---|---|
| BVG-nah | Schnell mit PK-Guthaben, ohne UWS | 64 J. 8 Mt. | -11 Mt. | +71k | +41.9% | +14.2% |
| BVG-nah | Schnell ohne PK-Guthaben/UWS | 64 J. 8 Mt. | +9 Mt. | -43k | -25.3% | -8.6% |
| BVG-nah | Schnell mit PK-Guthaben + UWS | 64 J. 8 Mt. | -6 Mt. | +41k | +24.0% | +8.1% |
| Umhüllend | Schnell mit PK-Guthaben, ohne UWS | 57 J. 10 Mt. | -13 Mt. | +152k | +8.2% | +7.0% |
| Umhüllend | Schnell ohne PK-Guthaben/UWS | 57 J. 10 Mt. | +34 Mt. | -464k | -24.9% | -21.3% |
| Umhüllend | Schnell mit PK-Guthaben + UWS | 57 J. 10 Mt. | +3 Mt. | -89k | -4.8% | -4.1% |
| Paar BR | Schnell mit PK-Guthaben, ohne UWS, mit CH seit | 63 J. 4 Mt. | -7 Mt. | +72k | +9.7% | +9.5% |
| Paar BR | Schnell mit PK-Guthaben, ohne UWS, ohne CH seit | 63 J. 4 Mt. | -9 Mt. | +95k | +12.8% | +12.6% |
| Paar BR | Schnell ohne PK-Guthaben/UWS, mit CH seit | 63 J. 4 Mt. | +30 Mt. | -294k | -39.8% | -39.0% |
| Paar BR | Schnell mit PK-Guthaben + UWS + CH seit | 63 J. 4 Mt. | +3 Mt. | -40k | -5.4% | -5.3% |
| Frühpension | Schnell mit PK-Guthaben, ohne UWS | 61 J. 10 Mt. | -22 Mt. | +148k | +388.7% | +10.3% |
| Frühpension | Schnell ohne PK-Guthaben/UWS | 61 J. 10 Mt. | +62 Mt. | -589k | -1549.3% | -41.2% |
| Frühpension | Schnell mit PK-Guthaben + UWS | 61 J. 10 Mt. | +7 Mt. | -156k | -409.8% | -10.9% |

## Einordnung

- **Mit PK-Guthaben und Umwandlungssatz** liegt «Schnell» bei ±3 bis 7 Monaten bzw. −4 bis +8% des heutigen
  Gesamtvermögens (Frühpension −10,9%: im Detail PK-Bezug ab 58 laut Reglement und höhere Sparbeiträge).
- **Ohne Umwandlungssatz** (Schätzung 6,8%) ist «Schnell» systematisch zu optimistisch (−7 bis −22 Monate), weil
  die meisten Kassen auf dem ganzen Guthaben einen tieferen Satz anwenden. Die App zeigt dann einen Hinweis.
- **Ohne PK-Guthaben** (Schätzung aus BVG-Mindestgutschriften) ist «Schnell» deutlich zu pessimistisch.
- **«In der Schweiz seit»** wirkt im Paar-Beispiel schwach, weil die Ehepaar-Plafonierung einen Teil der Lücke
  auffängt (Plafond bei Teilrenten vereinfacht, siehe OFFEN in docs/quellen.md).
- Prozent bezogen auf das Vermögen mit 85 sind bei fast aufgebrauchtem Vermögen nicht aussagekräftig
  (Frühpension); darum zusätzlich der Bezug auf das heutige Gesamtvermögen.
