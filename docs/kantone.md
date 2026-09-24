# Kantonssteuern 2026 – Datenquellen, Tarife ZH/AG, Methoden aller Kantone

Stand: 25.9.2026 · Steuerjahr 2026 · Maschinenlesbar: `data/kantone-2026.json` (ZH und AG vollständig inkl. aller Gemeindesteuerfüsse; übrige Kantone: Methode, Status, Hauptort-Steuerfüsse, ESTV-Referenzwerte).

## 1. Ergebnis in Kürze
- **Zürich und Aargau: exakt.** Tarife 2026, Kapitalleistungsregel, Kantons-, Gemeinde- und Kirchensteuerfüsse stammen aus amtlichen Quellen. Die Werte wurden an Testfällen mit dem ESTV-Steuerrechner 2026 nachgerechnet und stimmen **frankengenau** überein (siehe Abschnitte 3 und 4).
- **Übrige 24 Kantone: Näherung** (Status `naeherung`), jeweils klar gekennzeichnet.
  - In 11 Kantonen ist die **einfache Steuer auf Kapitalleistungen exakt**, weil das Gesetz feste Sätze oder Stufen vorgibt (`exakt_einfache_steuer`): BE, LU, UR, GL, FR, BS, BL, AR, SG, TG, JU. Die Gesamtsteuer ergibt sich dann exakt mit den Steuerfüssen der Wohngemeinde.
  - Für Einkommen und Vermögen liefert der MVP **effektive Referenzsätze für den Kantonshauptort** (ESTV-Rechner 2026, Raster), interpoliert.
- **Ausbau auf „exakt“ ist machbar.** Die ESTV stellt für 2026 die **Tarife aller Kantone** (Tarifexport) und die **Steuerfüsse aller rund 2'110 Gemeinden** als Daten bereit. Offen bleiben kantonsspezifische Abzüge und Sonderregeln (Splittingfaktoren, Quotient familial VD, Rabais GE, Formeltarife BL/FR/VS, Rentenumwandlung TI/VS).

## 2. Datenquellen und Machbarkeit

| Quelle | Inhalt | Eignung | URL | Stand |
|---|---|---|---|---|
| ESTV-Kantonsblätter (26) | Gesetzestexte zu Tarif, Abzügen und Kapitalleistungen je Kanton | amtlich, Methodik; teils Tarif nur als Verweis | https://www.estv2.admin.ch/stp/kb/{kt}-{de,fr,it}.pdf (lokal: /workspace/research/kb/) | Februar 2026 |
| ESTV-Steuerrechner | Einkommen/Vermögen, Kapitalleistungen, alle Gemeinden, Steuerjahre 2010–2026 | Referenz und Validierung | https://swisstaxcalculator.estv.admin.ch | Datenstand 2026 |
| ESTV-Rechner, Tarifexport (`API_exportManyTaxScales`) | Einkommens- und Vermögenstarife 2026 je Kanton (Tabellentypen ZUERICH, BUND, FLATTAX, FREIBURG, FORMEL; Splittingfaktoren) | exakte Tarifdaten; lokal gespeichert unter /workspace/research/estv-scales-2026/ | POST …/lg-proxy/operation/c3b67379_ESTV/API_exportManyTaxScales | abgerufen 24.9.2026 |
| ESTV-Rechner, Steuerfüsse (`API_exportManySimpleRates`) | Kantons-, Gemeinde- und Kirchensteuerfüsse 2026, 2'110 Gemeinden | exakt; lokal: /workspace/research/estv-steuerfuesse-2026-ch.json | POST …/API_exportManySimpleRates | abgerufen 24.9.2026 |
| ESTV-Erläuterungen | Berechnung unverbindlich, ohne Gewähr; Personal-/Kopfsteuern enthalten, Gebühren nicht | Rechtliches | https://www.estv.admin.ch/dam/de/sd-web/4wCmxZ0qNcsD/Erlaeuterungen-Steuerberechnungen_de-fr-it-en.pdf | – |
| Nutzungsbedingungen der Rechner-API | **nicht gefunden** (API ist undokumentiert, ohne Schlüssel). Empfehlung: nur zur Build-Zeit für Referenzdaten und Tests nutzen, keine Laufzeitabfragen aus der App, Quelle angeben | **OFFEN** | – | – |
| Kanton ZH: Steuerbuch ZStB 48.1 | Tarife und Abzüge ab 1.1.2026 (Ausgleich kalte Progression) | amtlich | https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/vertreter/steuerbuch/zstb-nr-48-1/zstb-nr-48-1.pdf | 1.1.2026 |
| Kanton ZH: Steuerfüsse OGD | alle 160 Gemeinden, ohne Kirche und mit ref./kath./christkath. Kirche | amtlich, CSV | https://www.web.statistik.zh.ch/ogd/data/steuerfuesse/kanton_zuerich_stf_aktuell.csv | 24.3.2026 |
| Kanton AG: Steuerfussliste | 196 Gemeinden, Kirchensteuerfüsse | amtlich | https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/steuerberechnung-tarife-natuerliche-personen/gemeinde-und-kirchensteuerf-sse-2026-v5.pdf | 16.6.2026 |
| ESTV-Steuermäppchen Kapitalleistungen | Vergleich aller Kantone | nur StP 2024 → veraltet (z.B. LU, SZ geändert) | https://www.estv2.admin.ch/stp/sm/2024/kapitalleistungen-saeulen-de-fr.pdf | 1.4.2025 |

## 3. Zürich – exakt (Steuerperiode 2026)

**Grundformel:** Steuer = einfache Staatssteuer × (Staatssteuerfuss + Gemeindesteuerfuss [+ Kirchensteuerfuss]) / 100, dazu die Personalsteuer.

| Element | Wert 2026 | Quelle | Stand |
|---|---|---|---|
| Staatssteuerfuss | **95%** (2024/25: 98%) | KR-Beschluss 15.12.2025, LS 631.21: https://www.zh.ch/de/politik-staat/gesetze-beschluesse/gesetzessammlung/zhlex-ls/erlass-631_21-2025_12_15-2026_01_01-132.html | 2026/27 |
| Gemeindesteuerfüsse | 160 Gemeinden, z.B. Zürich 119 (+10 ref./kath.), Winterthur 125, Zumikon 71 | OGD-CSV (s. oben) | 24.3.2026 |
| Personalsteuer | CHF 24 pro Person (ESTV-Rechner: 24 ledig / 48 Ehepaar) | ESTV-Rechner; gesetzliche Grundlage nicht separat geprüft | 2026 |

**§ 35 StG Einkommenssteuer (einfache Staatssteuer)**, gültig ab Steuerperiode 2026:

| Satz | Grundtarif: Bandbreite CHF | Verheiratetentarif: Bandbreite CHF |
|---|---|---|
| 0% | erste 7'000 | erste 14'100 |
| 2% | weitere 5'000 | weitere 6'400 |
| 3% | weitere 4'800 | weitere 8'100 |
| 4% | weitere 8'000 | weitere 9'800 |
| 5% | weitere 9'700 | weitere 11'200 |
| 6% | weitere 11'200 | weitere 14'500 |
| 7% | weitere 13'100 | weitere 32'200 |
| 8% | weitere 17'600 | weitere 32'400 |
| 9% | weitere 34'000 | weitere 48'500 |
| 10% | weitere 33'700 | weitere 57'900 |
| 11% | weitere 53'300 | weitere 62'900 |
| 12% | weitere 69'300 | weitere 72'600 |
| 13% | über 266'700 | über 370'600 |

Der Verheiratetentarif gilt auch für Alleinstehende, die mit Kindern zusammenleben (§ 35 Abs. 2).

**§ 47 StG Vermögenssteuer (einfache Staatssteuer)**, gültig ab Steuerperiode 2026:

| Satz | Grundtarif CHF | Verheiratetentarif CHF |
|---|---|---|
| 0‰ | erste 81'000 | erste 161'000 |
| 0,5‰ | weitere 241'000 | weitere 242'000 |
| 1‰ | weitere 404'000 | weitere 402'000 |
| 1,5‰ | weitere 645'000 | weitere 646'000 |
| 2‰ | weitere 968'000 | weitere 967'000 |
| 2,5‰ | weitere 965'000 | weitere 967'000 |
| 3‰ | über 3'304'000 | über 3'385'000 |

**§ 37 StG Kapitalleistungen aus Vorsorge:** Die Leistung wird gesondert besteuert, zum Satz, der sich für **1/20 der Leistung** nach dem massgebenden Tarif (Grund- oder Verheiratetentarif) ergäbe. Die einfache Staatssteuer beträgt **mindestens 2%**. Es wird stets eine volle Jahressteuer erhoben, ohne Sozialabzüge. Danach wird mit Staats-, Gemeinde- und Kirchensteuerfuss multipliziert.

Formel: `satz = max(T(K/20) / (K/20), 2%)`; `einfache Steuer = K × satz`.

Ausgewählte Abzüge 2026 (Kantonsblatt): Kinderabzug 9'400; Versicherungsprämien 5'800 (Ehepaar) bzw. 2'900 (übrige), +50% ohne Beiträge an Säule 2/3a, +1'300 je Kind.

**Validierung** mit dem ESTV-Rechner 2026, Stadt Zürich, ohne Kirche:
- Steuerbares Einkommen 100'000, verheiratet: einfache Steuer 4'743 → Staat 4'506, Gemeinde 5'644
- Steuerbares Vermögen 500'000, verheiratet: einfache Steuer 218
- Kapital 500'000, verheiratet: 2%-Minimum → Staat 9'500, Gemeinde 11'900
- Kapital 2 Mio., verheiratet: Satz 4,743% → Staat 90'117, Gemeinde 112'883

Alle Werte stimmen überein.

## 4. Aargau – exakt (Steuerperiode 2026)

**Grundformel:** Steuer = einfache Kantonssteuer × (103 + Gemeindesteuerfuss [+ Kirchensteuerfuss]) / 100.

| Element | Wert 2026 | Quelle | Stand |
|---|---|---|---|
| Kantonssteuerfuss natürliche Personen | **103%** = ordentliche Kantonssteuer 100% (Grosser Rat, Budget 2026; 2025: 108%) + Zuschlag 3% nach § 57a StG | ag.ch Steuern berechnen; Kopfzeile der AG-Steuerfussliste 2026; ESTV-Steuerfüsse 2026 (103); derfreiaemter.ch *(sekundär)* | 2026 |
| Gemeindesteuerfüsse | 196 Gemeinden, 48 (Oberwil-Lieli) bis 127 (Ammerswil, Mellikon); Durchschnitt 101 (Statistik AG) | AG-Steuerfussliste Version 16.6.2026 | 2026 |
| Kirchensteuer | Kirchgemeinde-Steuerfüsse ref./röm.-kath./christkath. (z.B. Aarau 15/19/25) in % der einfachen Kantonssteuer; Zusatzkirchen je Gemeinde | wie oben | 2026 |
| Personalsteuer | keine (ESTV-Rechner Aarau: 0) | ESTV-Rechner | 2026 |
| Versicherungsabzug | 7'600 (verheiratet) / 3'800 (übrige) | AG-Medienmitteilung „Rechtsänderungen per 1.1.2026“ | 2026 |

**§ 43 StG Einkommenssteuer**, Tarif A (Progressionsverordnung 2025). Für 2026 wurde keine neue Progressionsverordnung publiziert; der ESTV-Tarifexport 2026 ist identisch. Bandbreiten: 0% 4'300 · 1% 3'800 · 2% 3'900 · 3% 4'200 · 4% 4'300 · 5% 5'200 · 6% 7'400 · 7% 8'600 · 8% 9'600 · 8,5% 11'800 · 9% 11'700 · 9,5% 35'300 · 10% 66'300 · 10,5% 176'300 · 11% über 352'700.

**Tarif B** (Verheiratete, Alleinerziehende) = Satz des **halben** steuerbaren Einkommens (§ 43 Abs. 2). Die einfache Kantonssteuer wird auf ganze Franken abgerundet (§ 29 StGV).

**§ 55 StG Vermögenssteuer** (Änderung vom 3.12.2024, ab 2025; 2026 unverändert laut ESTV-Export): 0,7‰ erste 107'000 · 1,0‰ weitere 107'000 · 1,2‰ weitere 107'000 · 1,4‰ weitere 107'000 · 1,6‰ über 428'000. Der Tarif gilt für das steuerbare Vermögen **nach Freibeträgen** (§ 54): 260'000 (verheiratet), 130'000 (übrige), +16'000 je Kind.

**§ 45 StG Kapitalleistungen (2. Säule, 3a):** getrennte Jahressteuer zu **30% des Tarifs** (Tarif A bzw. B, angewendet auf die ganze Leistung), **mindestens 1%**. Alle Kapitalleistungen des Jahres, auch beider Ehegatten, werden zusammengerechnet; keine Abzüge. Der 3%-Zuschlag gilt auch hier (ESTV-Rechner).

**Validierung** mit dem ESTV-Rechner 2026, Aarau:
- Steuerbares Einkommen 100'000, verheiratet, reformiert: einfache Steuer 4'768 → Kanton 4'911, Gemeinde 4'577, Kirche 715
- Steuerbares Einkommen 80'000, ledig: einfache Steuer 5'038
- Kapital 500'000, verheiratet: 30% × Tarif B = 13'353 → Kanton 13'754
- Kapital 500'000, ledig: 30% × Tarif A = 14'773

Alle Werte stimmen überein.

**Abweichungen der Steuerfüsse:** Die ESTV-Daten weichen bei 5 AG-Gemeinden von der neueren kantonalen Liste ab (Büttikon, Döttingen, Leimbach, Mumpf, Othmarsingen). Massgebend ist die kantonale Liste. In ZH weicht Wettswil a.A. ab (kath.; OGD massgebend).

## 5. Alle Kantone – Kapitalleistungsmethode und Status

Spalten:
- **Einkommen/Vermögen:** exakt oder Näherung.
- **Kapital:** `exakt` / `exakt_einfache_steuer` (Satz exakt aus dem Gesetz, Gesamtsteuer mit Gemeindesteuerfuss) / `naeherung`.
- **Steuerfüsse Hauptort:** Kanton / Gemeinde (ESTV 2026).
- **ESTV-Referenz:** effektiver Satz Kanton + Gemeinde (ohne Kirche, ohne Bund) auf Kapitalleistungen am Hauptort, verheiratet bei 100k / 500k / 1 Mio., ledig bei 500k, in %.

| Kt | Kapitalleistung (Kantonsblatt Feb. 2026) | Eink./Verm. | Kapital | Steuerfüsse Hauptort | ESTV-Ref. verh. % | ledig 500k % |
|---|---|---|---|---|---|---|
| AG | § 45 StG AG: Jahressteuer zu 30% des Tarifs (Tarif A bzw. Tarif B = Satz des halben Betrags) auf die ganze Leistung, mindestens 1%; alle Vorsorgekapitalien des Jahres (auch beider Ehegatten) zusammengerechnet; × Kantonssteuerfuss 103% (inkl. Zuschlag § 57a) + Gemeinde + Kirche | exakt | exakt | Aarau: 103 / 96 | 2.846 / 5.315 / 5.88 | 5.88 |
| AI | Art. 40 StG AI: 1/4 des Satzes gemäss Art. 38, mindestens 0,5% | naeherung | naeherung | Appenzell: 96 / 56 | 2.22 / 3.04 / 3.04 | 3.04 |
| AR | Art. 41 StG AR: Verheiratetentarif 0,75% bis 417200, 1,0% darüber; übrige 1,0% / 1,3333% | naeherung | exakt_einfache_steuer | Herisau: 330 / 410 | 5.55 / 5.856 / 6.628 | 7.808 |
| BE | Art. 44 StG BE: Spezialtarif (einfache Steuer in %), Stufen ab 2026 indexiert; Leistungen unter 5300 steuerfrei; × Steueranlage Kanton + Gemeinde (+ Kirche) | naeherung | exakt_einfache_steuer | Bern: 297.5 / 154 | 3.438 / 5.497 / 6.79 | 6.152 |
| BL | § 36 StG BL: 2% bis 400000, 6% darüber, insgesamt max. 4,5%; keine Zusammenrechnung unter Ehegatten; zzgl. Gemeindesteuer in % der Staatssteuer | naeherung | exakt_einfache_steuer | Liestal: 100 / 65 | 3.3 / 4.62 / 7.26 | 4.62 |
| BS | § 39 StG BS: 3% erste 25000, 4% nächste 25000, 6% nächste 50000, 8% darüber; ohne Zusammenrechnung unter Ehegatten; Satz ist Gesamtsatz (keine Gemeindesteuerfüsse in Basel) | naeherung | exakt_einfache_steuer | Basel: 50 / 50 | 4.75 / 7.35 / 7.675 | 7.35 |
| FR | Art. 39 LICD FR: 1%/2%/3%/4% je 50000, darüber 5%; Abzug 10000 für Verheiratete/Alleinerziehende; Jahrestotal unter 10000 steuerfrei; ESTV-Rechner rechnet mit Kantonskoeffizient 100% (nicht 96% wie beim Einkommen) + Gemeinde | naeherung | exakt_einfache_steuer | Fribourg: 96 / 80 | 2.34 / 7.02 / 8.01 | 7.2 |
| GE | Art. 45 LIPP GE: 1/5 des Tarifs von Art. 41 (Splitting für Ehegatten vorbehalten) | naeherung | naeherung | Genève: 147.5 / 45.49 | 2.365 / 4.66 / 5.31 | 5.31 |
| GL | Art. 36 StG GL: Einfache Steuer 4%; × Steuerfüsse | naeherung | exakt_einfache_steuer | Glarus: 59.7 / 61 | 4.828 / 4.828 / 4.828 | 4.828 |
| GR | Art. 40a StG GR: Satzbestimmung 1/15; Satz mindestens 1,5%, Maximalbelastung 2%; Leistungen unter 6200 steuerfrei | naeherung | naeherung | Chur: 92 / 88 | 2.7 / 2.7 / 3.6 | 3.6 |
| JU | Art. 37 LI JU; ADLI 2026: Verheiratete/Alleinerziehende 0,9% / 1,1% / 1,3%, übrige 1,1% / 1,3% / 1,7%; Stufen 56700 (2026 unverändert) | naeherung | exakt_einfache_steuer | Delémont: 285 / 190 | 4.687 / 5.852 / 6.013 | 7.536 |
| LU | § 58 und § 259f StG LU: Steuer je Einheit 0,5% auf den ersten 40000 und (Übergangsrecht § 259f, drei Steuerjahre nach Inkrafttreten der Änderung vom 18.3.2024) 1,4% darüber (ordentlich 1%); × Steuereinheiten Kanton + Gemeinde (+ Kirche) | naeherung | exakt_einfache_steuer | Luzern: 145 / 145 | 3.016 / 3.851 / 3.956 | 3.851 |
| NE | Art. 42 LCdir NE: 1/4 des Einkommenstarifs, Satz der einfachen Steuer mindestens 2,5% | naeherung | naeherung | Neuchâtel: 124 / 65 | 4.725 / 6.267 / 6.362 | 6.355 |
| NW | Art. 42 StG NW: 1/4 der Steuersätze nach Art. 40; Satz mindestens 0,5% | naeherung | naeherung | Stans: 261 / 235 | 2.48 / 3.408 / 3.409 | 3.409 |
| OW | Art. 40 StG OW: 2/5 des Tarifs, der für ein Einkommen in Höhe der Kapitalleistung gilt (OW: Einheitssatz/Flat-Rate-Tarif) | naeherung | naeherung | Sarnen: 325 / 386 | 5.119 / 5.119 / 5.119 | 5.119 |
| SG | Art. 52 StG SG: Einfache Steuer 2,0% (Ehegatten/Alleinerziehende) bzw. 2,2% (übrige) | naeherung | exakt_einfache_steuer | St. Gallen: 105 / 138 | 4.86 / 4.86 / 4.86 | 5.346 |
| SH | Art. 40 StG SH: 1/5 des Tarifs nach Art. 38 | naeherung | naeherung | Schaffhausen: 76 / 83 | 1.81 / 3.148 / 3.148 | 3.148 |
| SO | § 47 StG SO: 1/4 der nach § 44 (Einkommenstarif) berechneten Steuer | naeherung | naeherung | Solothurn: 104 / 112 | 3.442 / 5.554 / 5.67 | 5.67 |
| SZ | § 38 StG SZ (Fassung ab 2026): Satzbestimmung 1/25 der Leistung; einfache Steuer maximal 1,5% (ab Steuerperiode 2026, bisher 2,5%) | naeherung | naeherung | Schwyz: 110 / 175 | 0.917 / 3.4 / 4.275 | 4.275 |
| TG | § 39 StG TG: Einfache Steuer 2,0% (Verheiratete) bzw. 2,4% (übrige) | naeherung | exakt_einfache_steuer | Frauenfeld: 109 / 142 | 5.02 / 5.02 / 5.02 | 6.024 |
| TI | Art. 38 LT TI; Circolare 3/2009: Rentenumwandlung: Satz, der für eine entsprechende jährliche Leistung gälte (Umrechnung gemäss kantonaler Praxis), mindestens 3% | naeherung | naeherung | Bellinzona: 100 / 93 | 3.86 / 3.86 / 5.402 | 4.968 |
| UR | Art. 45 StG UR: Einfache Steuer 1,9% Kanton, 1,9% Einwohnergemeinde, 0,5% Kirche; × jeweiliger Steuerfuss | naeherung | exakt_einfache_steuer | Altdorf (UR): 100 / 95 | 3.705 / 3.705 / 3.705 | 3.705 |
| VD | Art. 49 LI VD: 1/5 der Sätze von Art. 47; Ehegatten: Quotient familial des Ehepaars ohne Kinder | naeherung | naeherung | Lausanne: 155 / 78.5 | 3.281 / 5.541 / 6.384 | 6.289 |
| VS | Art. 33b LF VS: Rentenumwandlung (Satz für periodische Leistung), mindestens Minimalsatz, höchstens 4%; Verheiratete: Reduktion 2%, max. 2450 | naeherung | naeherung | Sion: 100 / 110 | 4.116 / 6.55 / 7.84 | 6.684 |
| ZG | § 37 StG ZG: 30% des massgebenden Tarifs für die ersten 230400, 40% darüber; einfache Kantonssteuer mindestens 1% | naeherung | naeherung | Zug: 78 / 52 | 1.558 / 3.441 / 3.8 | 3.55 |
| ZH | § 37 StG ZH: Satzbestimmung: Satz für 1/20 der Leistung nach dem Einkommenstarif (Grund- bzw. Verheiratetentarif) auf die ganze Leistung; einfache Staatssteuer mindestens 2%; × Staats-, Gemeinde- und Kirchensteuerfuss | exakt | exakt | Zürich: 95 / 119 | 4.28 / 4.28 / 5.765 | 4.913 |
Anmerkungen:
- **LU:** Kapitalleistungen seit der Änderung vom 18.3.2024 mit 0,5%/1% je Einheit; in den drei Übergangsjahren (§ 259f) gelten 1,4% über 40'000. Der ESTV-Rechner 2026 bestätigt 1,4%.
- **SZ:** Ab 2026 beträgt die einfache Steuer maximal **1,5%** (bisher 2,5%) für Leistungen, die nach dem 31.12.2025 fällig werden (§ 250j).
- **BS, BL:** keine Zusammenrechnung unter Ehegatten. In BS ist der Satz der Gesamtsatz.
- **FR:** Für Kapitalleistungen rechnet der ESTV-Rechner mit Kantonskoeffizient 100% (nicht 96%).
- **TI, VS:** Rentenumwandlung nach kantonaler Praxis (TI: Circolare 3/2009, mindestens 3%) → Näherung über ESTV-Referenzsätze.
- **VD, GE, NE, SO, SH, AI, NW, OW, SZ, ZG, GR:** Der Kapitalsatz hängt vom vollen Einkommenstarif ab (Bruchteil oder Satzbestimmung). Exakt wird er erst, wenn der Tarif aus dem ESTV-Export implementiert ist.
- Die Tarifdaten der Kantonsblätter beziehen sich teils noch auf 2025, mit Hinweisen „gültig ab 2026“. Für 2026 gilt der ESTV-Tarifexport (Steuerjahr 2026) als Referenz.

## 6. Empfohlene Näherung für die 24 übrigen Kantone (MVP)
1. **Einkommen/Vermögen:** Die Referenztabelle `referenzEstv2026.raster` in `kantone-2026.json` enthält pro Kanton für den Hauptort, ledig und verheiratet, die Punkte 50k/250k, 100k/500k, 150k/1 Mio., 250k/2 Mio. und 500k/5 Mio. (steuerbares Einkommen/Vermögen). Dazwischen wird der effektive Satz linear interpoliert. Für eine andere Gemeinde wird skaliert: `Steuer ≈ Steuer_Hauptort × (Kantonsfuss + Gemeindefuss_Wohnort) / (Kantonsfuss + Gemeindefuss_Hauptort)`. Das ist bei rein proportionalen Steuerfuss-Systemen genau, sonst eine Näherung. Kantonale Abzüge sind **nicht** enthalten. In den Kantonen mit Vermögensfreibeträgen (z.B. AG) ist „steuerbar“ als Wert nach den Freibeträgen zu verstehen.
2. **Kapitalleistungen:**
   - Kantone mit `exakt_einfache_steuer`: Formel aus `parameter` × Steuerfüsse.
   - Übrige: effektive Referenzsätze `kapitalleistungSatzPct` (100k–2 Mio.) interpolieren und mit dem Steuerfuss-Verhältnis skalieren.
3. In der App jede Näherung sichtbar kennzeichnen: „Näherung, basierend auf ESTV-Steuerrechner 2026, Hauptort“.
4. **Ausbaupfad „exakt“:** Tarife aus `/workspace/research/estv-scales-2026/*.json` übernehmen (Tabellentypen: ZUERICH = Bandbreiten, BUND = Schwellen mit Sockelsteuer, FLATTAX, FREIBURG/FORMEL = Formeln) sowie kantonale Abzüge und Sonderregeln ergänzen. Anschliessend gegen den ESTV-Rechner testen.

## 7. OFFEN
- Nutzungsbedingungen der ESTV-Rechner-Schnittstelle (für Laufzeitnutzung); bis zur Klärung nur Build-Zeit-Referenz
- ZH: Rundungsregeln im Detail (steuerbares Einkommen/Vermögen); gesetzliche Grundlage der Personalsteuer nicht separat geprüft
- TI, VS: Umrechnungstabellen für die Rentenumwandlung
- Kantonale Abzüge der 24 übrigen Kantone (nicht erhoben)
- Kirchensteuer in Kantonen mit eigenem Kirchentarif (z.B. UR Kapital 0,5%): im Referenzraster nicht enthalten
