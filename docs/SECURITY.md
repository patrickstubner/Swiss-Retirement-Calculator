# Sicherheit

Stand: 30.9.2026 · Quelle: eigene Prüfung (Audit-Bericht vom 27.9.2026, Umsetzung in den PRs zu Datenschutz und Sicherheit); Prüfstand jeweils im Protokoll unten.

## Bedrohungsmodell

Statische Seite auf GitHub Pages. Die Berechnung läuft nur im Browser. Kein Server, keine Cookies, kein Tracking, keine Fremdressourcen. Daten liegen nur im `localStorage` (Schlüssel `ruhestandsrechner:v1`, **unverschlüsselt**) oder im Teilen-Link (`#s=`, das Fragment wird nie an einen Server gesendet). Die Seite läuft auf dem Origin `https://<konto>.github.io`, den sich alle Pages-Projekte des Kontos teilen: ein Skript eines anderen Projekts desselben Kontos könnte den `localStorage` lesen. Deshalb ist der Hinweis im Speicherschalter sichtbar («unverschlüsselt», «auf gemeinsam genutzten Geräten ausschalten»).

## Angriffsflächen

| Fläche | Schutz |
|---|---|
| `#s=`-Link | Länge ≤ 20'000 Zeichen, entpackt ≤ 1 MB, danach zentrale Validierung (`src/ui/validierung.ts`) |
| JSON-Import (Versionen A/B) | Datei ≤ 1 MB, Typ- und App-Kennung, Validierung wie beim Link, Rückfrage vor dem Ersetzen |
| `localStorage` | dieselbe Validierung; defekte Einträge werden ignoriert; Notfall-Reset bei Absturz |
| CSV-/JSON-Export | Formel-Zeichen am Zellanfang werden entschärft; Download-URL wird verzögert widerrufen |
| Build-Skripte (`scripts/`) | nur lokal/CI; kein `exec`; Netzzugriffe nur auf feste Quellen-URLs |
| GitHub-Actions-Lieferkette | Aktionen per Commit-SHA gepinnt, Dependabot, minimale Rechte |
| Vorlesen (`src/ui/vorlesen/`) | Sprachausgabe nur über `speechSynthesis` des Browsers (kein Netzwerk, kein Cloud-TTS; nur Stimmen mit `localService !== false`). Seitentext geht nur an die Sprachausgabe, nie ins DOM; Hervorhebung nur über `Range`/`CSS.highlights` bzw. ein Attribut, kein `innerHTML`. Formularfelder, Beschriftungen, Tabellen und Verstecktes werden nie gelesen. `localStorage` (`ruhestandsrechner:vorlesen`): nur Tempo (feste Liste) und Stimmen-Kennung (≤ 200 Zeichen), nur bei aktivem Speichern, Ausschalten löscht. Grenzen: ≤ 4000 Sätze / 300'000 Zeichen; Regeln zur Aufbereitung ohne Backtracking-Fallen (Test mit 100'000 Ziffern und Fuzz, je < 4 s) |
| Browser (CSP) | Meta-CSP: nur eigene Skripte/Worker, `connect-src 'none'`, kein `eval`, keine Fremdquellen; Referrer `no-referrer` |

Grenze der Meta-CSP: `frame-ancestors` und Header wie `X-Frame-Options` lassen sich über `<meta>` nicht setzen (GitHub Pages erlaubt keine eigenen Header). `style-src 'self'` genügt (uPlot und React setzen Stile über das DOM, nicht über Inline-`<style>`); im Browser getestet.

## Regel: Sicherheitsprüfung nach jeder Änderung

1. **Eingabevalidierung**: Bereiche, Längen, Typen; Link, Import, `localStorage` (neue Felder in `GRENZEN` eintragen, ein Test schlägt sonst fehl)
2. **Injection/XSS**: kein `innerHTML`, `eval`, `new Function`, `fetch` (Test `src/sicherheit.test.ts`); CSV entschärft Formeln
3. **Geheimnisse**: `scripts/secret-scan.mjs`, GitHub Secret Scanning mit Push Protection; nichts aus `lokal/` committen (`.gitignore`, Guard)
4. **Berechtigungen**: Workflow-Rechte minimal, Schreibrechte nur im Deploy-Job; Ruleset für `main`
5. **Abhängigkeiten**: `npm audit`, Dependabot, Lockfile, `npm ci --ignore-scripts`
6. **Fehlermeldungen**: ohne Eingabewerte und ohne Stacktraces (Fehlerseite nennt keine Details)
7. **Angriffsflächen**: neue Ein- oder Ausgänge in dieser Datei ergänzen

Funde werden mit Schweregrad und Fix-Vorschlag gemeldet, bevor weitergebaut wird.

## Datenschutz

Kein Tracking, keine Cookies. Speichern im Browser ist **standardmässig an (Opt-out)**, klar beschriftet und mit einem Schalter jederzeit abschaltbar; Ausschalten löscht sofort alle gespeicherten Daten. Export nur lokal (Download). Das Repo enthält nur erfundene Beispielwerte; `scripts/datenschutz-guard.mjs` prüft in CI auf getrackte lokale Daten und (über Hashes) auf verbotene Wörter.

## Meldeweg

GitHub «Private vulnerability reporting» (Security → Report a vulnerability) im Repository.

## Prüfprotokoll

| Datum | Stand (main davor) | Ergebnis | Funde (Schweregrad) | Fix |
|---|---|---|---|---|
| 27.9.2026 | `1ac1bed` | Audit (nur lesend) | S-01…S-03, S-09…S-15 mittel; S-04…S-08, S-16…S-18 tief/Info | siehe Bericht |
| 29.9.2026 | `1ac1bed` → PR Datenschutz | ok | S-11 (lokale Daten nur in `.git/info/exclude`), S-12 (persönliche Bezüge in Docs) | `.gitignore`, Guard, Bereinigung |
| 29.9.2026 | `1db885a` → PR Sicherheit | ok, `npm audit` 0, Tests 698 | S-01, S-02, S-03, S-04, S-05, S-06, S-08, S-09, S-10 (Hinweis), S-14, S-15 (Dependabot, Security-Workflow), S-17 | Validierungsschema mit Fuzz-Tests, FehlerGrenze, Guard in `simuliere`, CSP, SHA-Pins, Deploy-Rechte, `security.yml` |
| 29.9.2026 | `d96c0a9` → PR Rechenfehler | ok, `npm audit` 0, Tests 711 (+1 übersprungen: Jahreswechsel-Wächter läuft im Workflow `regeljahr.yml`) | keine neuen Funde; neue Eingänge: keine; neuer Workflow `regeljahr.yml` (SHA-gepinnt, nur Lesen); Banner-Text enthält nur Jahreszahlen aus der Systemuhr | K-01, K-02, K-07 (Hinweis), K-10 (Hinweis), K-11 (Banner) |
| 30.9.2026 | Neustart (ein Initial-Commit) | ok, `npm audit` 0, Tests 711 (+1 übersprungen), Guard und Geheimnis-Scan ok | keine neuen Funde; Umbenennung des Produkts in «CH-Rentenrechner» (nur Texte, Repo-Name und Basis-Pfad unverändert) | – |
| 30.9.2026 | `6e7c0d1` → PR Vorlesen | ok, `npm audit` 0, Tests 792 (+1 übersprungen), Browsertest (gemockte Sprachausgabe) bestanden, Guard/Geheimnis-Scan ok | keine Schwachstellen. Neue Eingänge: Einstellungs-Schlüssel im `localStorage` (Whitelist-Validierung); Hinweise: (V-01, Info) Ob eine als lokal gemeldete Stimme wirklich offline arbeitet, entscheidet das Betriebssystem/der Browser; (V-02, Info) ReDoS-Risiko der Aufbereitungs-Regeln wurde beim Test gefunden (Prozent-Regel, quadratisch bei sehr langen Ziffernfolgen) und behoben (Lookbehind, Längenlimits, Zeittest); (V-03, Info) Lookbehind-Regeln werden zur Laufzeit gebaut, damit ältere Safari-Versionen die Seite trotzdem laden | Prüfung: Eingabevalidierung (Einstellungen bereinigt, Längen begrenzt), XSS (Test `src/ui/vorlesen/sicherheit.test.ts` verbietet `innerHTML`, `eval`, `fetch` u. a.; Text nur an `SpeechSynthesisUtterance`), Geheimnisse, Rechte (keine neuen), Abhängigkeiten (keine neuen), Fehlermeldungen (ohne Text und Stimmennamen), CSP unverändert (`style.setProperty` per CSSOM ist mit `style-src 'self'` erlaubt). Quelle: eigene Prüfung, Stand 30.9.2026 |
| 2.10.2026 | `377ef67` → PR Zu-/Abflüsse | ok, `npm audit` 0 (mit und ohne `--omit=dev`), Tests 820 (+1 übersprungen), Guard und Geheimnis-Scan ok | keine Schwachstellen; neue Eingänge: keine (alle Anzeigen lesen bestehende, validierte Felder; Rendite-Regler bis 10 % ist nur die Oberfläche der «Was wäre, wenn»-Rechnung, `GRENZEN` in `validierung.ts` unverändert). Hinweis (F-01, Info): neuer Standard 7 % / 2 % gilt nur für neue Nutzer, gespeicherte Eingaben im `localStorage` bleiben unverändert (Test in `state.test.ts`) | Prüfung: Eingabevalidierung (keine neuen Felder), XSS (neue Grafik und Tabellen nur aus React-Text und SVG-Elementen, kein `innerHTML`; `src/sicherheit.test.ts` grün), Geheimnisse, Rechte (keine Änderung), Abhängigkeiten (keine neuen), Fehlermeldungen (unverändert), Angriffsflächen (keine neuen Ein-/Ausgänge). Quelle: eigene Prüfung, Stand 2.10.2026 |

### Offene Punkte

- **S-10**: Standard bleibt «Speichern an»; Wechsel zu Opt-in wäre eine Verhaltensänderung (Eingaben gingen beim Neuladen verloren). Entscheid beim Eigentümer.
- **S-16**: Monte Carlo im Hauptthread (Läufe bis 2000, Planungsalter bis 999): mögliche kurze Blockade bei Extremwerten; nur der eigene Tab betroffen.
- **Repo-Einstellungen (29.9.2026):** Dependabot-Alerts aktiviert; Ruleset «main-schutz» auf `main` (Pull Request Pflicht, 0 Reviews, Pflicht-Checks «build» und «security», Force-Push und Löschen verboten, keine Bypass-Akteure).
- Kein `frame-ancestors`/`X-Frame-Options` möglich (GitHub Pages).
