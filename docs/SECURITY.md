# Sicherheit

Stand: 30.9.2026 · Quelle: eigene Prüfung (Sicherheits- und Datenschutz-Audit vom 27.9.2026, Umsetzung in den PRs, siehe Protokoll unten); Prüfstand jeweils im Protokoll unten.

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
| Datenschutz-Guard (`scripts/datenschutz-guard.mjs`) | Wortliste nur lokal (`lokal/datenschutz-woerter.json`, ungetrackt) oder per Umgebungsvariable; Format streng geprüft (nur 64-stellige Hex-Hashes, ≤ 5000 Einträge, ≤ 200'000 Zeichen); ungültige Liste → Exit 2 ohne Inhalt in der Meldung; kein `exec` ausser `git ls-files`; ohne Liste nur Pfadprüfung (Exit 0) |
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

**Wortliste des Guards (nicht im Repo):** Die gesalzenen Hashes stehen nicht mehr im Repo, weil auch Hashes kurzer Namen durch Ausprobieren erratbar sind. Sie liegen lokal in `lokal/datenschutz-woerter.json` (ungetrackt, durch `.gitignore` und den Guard selbst gegen Einchecken geschützt) oder in der Umgebungsvariable `DATENSCHUTZ_LISTE` (JSON, Vorlage mit erfundenen Platzhaltern: `scripts/datenschutz-woerter.beispiel.json`; Hash eines Worts: `node scripts/datenschutz-guard.mjs --hash <wort> [--salt <salt>]`). Ohne Liste gibt der Guard «Wortliste nicht vorhanden, übersprungen» aus und endet mit Exit 0 (nur Pfadprüfung); eine vorhandene, aber ungültige Liste ist ein Fehler (Exit 2, ohne Inhalt der Liste in der Meldung). Die Liste wird geprüft (nur 64-stellige Hex-Hashes, ≤ 5000 Einträge, ≤ 200'000 Zeichen). Tests laufen mit erfundenen Wörtern (`src/datenschutzGuard.test.ts`).

**Optional in der CI (Secrets legt die Repo-Verwaltung selbst an):** Ein Repository-Secret `DATENSCHUTZ_LISTE` mit dem JSON-Inhalt der lokalen Datei; die Workflows reichen es an den Guard-Schritt (`env: DATENSCHUTZ_LISTE: ${{ secrets.DATENSCHUTZ_LISTE }}`) weiter. Das ist bewusst **nicht** eingerichtet: Die CI läuft ohne Liste grün, prüft dann aber nur Pfade, nicht Wörter. Hinweis: Secrets stehen für Pull Requests aus Forks nicht zur Verfügung; dort läuft der Guard ohne Liste.

**Grenze:** Bereits veröffentlichte Git-Historie lässt sich durch einen PR nicht ändern; frühere Commits enthalten weiterhin die alte Hash-Liste (siehe PR-Beschreibung).

## Meldeweg

GitHub «Private vulnerability reporting» (Security → Report a vulnerability) im Repository.

## Prüfprotokoll

| Datum | Änderung | Ergebnis | Funde (Schweregrad) | Fix |
|---|---|---|---|---|
| 27.9.2026 | Audit | Audit (nur lesend) | S-01…S-03, S-09…S-15 mittel; S-04…S-08, S-16…S-18 tief/Info | siehe Bericht |
| 29.9.2026 | PR Datenschutz | ok | S-11, S-12 | lokale Daten ausgeschlossen (`.gitignore`, Guard), Beispieldaten bereinigt |
| 29.9.2026 | PR Sicherheit | ok, `npm audit` 0, Tests 698 | S-01, S-02, S-03, S-04, S-05, S-06, S-08, S-09, S-10 (Hinweis), S-14, S-15 (Dependabot, Security-Workflow), S-17 | Validierungsschema mit Fuzz-Tests, FehlerGrenze, Guard in `simuliere`, CSP, SHA-Pins, Deploy-Rechte, `security.yml` |
| 29.9.2026 | PR Rechenfehler | ok, `npm audit` 0, Tests 711 (+1 übersprungen: Jahreswechsel-Wächter läuft im Workflow `regeljahr.yml`) | keine neuen Funde; neue Eingänge: keine; neuer Workflow `regeljahr.yml` (SHA-gepinnt, nur Lesen); Banner-Text enthält nur Jahreszahlen aus der Systemuhr | K-01, K-02, K-07 (Hinweis), K-10 (Hinweis), K-11 (Banner) |
| 30.9.2026 | PR Vorlesen | ok, `npm audit` 0, Tests 792 (+1 übersprungen), Browsertest (gemockte Sprachausgabe) bestanden, Guard/Geheimnis-Scan ok | keine Schwachstellen. Neue Eingänge: Einstellungs-Schlüssel im `localStorage` (Whitelist-Validierung); Hinweise: (V-01, Info) Ob eine als lokal gemeldete Stimme wirklich offline arbeitet, entscheidet das Betriebssystem/der Browser; (V-02, Info) ReDoS-Risiko der Aufbereitungs-Regeln wurde beim Test gefunden (Prozent-Regel, quadratisch bei sehr langen Ziffernfolgen) und behoben (Lookbehind, Längenlimits, Zeittest); (V-03, Info) Lookbehind-Regeln werden zur Laufzeit gebaut, damit ältere Safari-Versionen die Seite trotzdem laden | Prüfung: Eingabevalidierung (Einstellungen bereinigt, Längen begrenzt), XSS (Test `src/ui/vorlesen/sicherheit.test.ts` verbietet `innerHTML`, `eval`, `fetch` u. a.; Text nur an `SpeechSynthesisUtterance`), Geheimnisse, Rechte (keine neuen), Abhängigkeiten (keine neuen), Fehlermeldungen (ohne Text und Stimmennamen), CSP unverändert (`style.setProperty` per CSSOM ist mit `style-src 'self'` erlaubt). Quelle: eigene Prüfung, Stand 30.9.2026 |
| 30.9.2026 | PR Datenschutz-Bereinigung | ok, `npm audit` 0, Tests 807 (+1 übersprungen), tsc/Lint/Build ok, Guard mit und ohne Liste ok (Repo und `dist`), Geheimnis-Scan ok, Grep auf verbotene Begriffe 0 Treffer (Repo, `dist`) | keine Schwachstellen. (D-01, Info) Wortliste aus dem Repo entfernt; frühere Commits enthalten sie weiterhin (Historie wird nicht neu geschrieben). (D-02, Info) Ohne Liste prüft die CI nur Pfade, nicht Wörter (bewusst, Secret optional). (D-03, Info) Die Demo-Screenshots werden mit `bypassCSP` erzeugt; nur im Testskript, die App behält die CSP. Keine neuen Eingänge, keine neuen Abhängigkeiten, Workflows unverändert | Prüfung: Eingabevalidierung der Liste (Schema, Grössen, Fuzz-Tests), Injection (Liste wird nie ausgeführt, nur `JSON.parse` und Hash-Vergleich; Fund-Meldungen ohne Klartext), Geheimnisse (Liste nur lokal, `lokal/` ist ignoriert und im Guard verboten), Berechtigungen (unverändert), Abhängigkeiten (`npm audit` 0), Fehlermeldungen (ohne Listeninhalt), Angriffsflächen (siehe Tabelle). Quelle: eigene Prüfung, Stand 30.9.2026 |
| 2.10.2026 | PR Umbenennung | ok, `npm audit` 0, Tests 807 (+1 übersprungen), tsc/Lint/Build ok, Guard (Repo und `dist`) ok | keine Schwachstellen. Nur Text geändert: App-Name «Ruhestandsrechner Schweiz», Untertitel, Meta-Description, Name der Export-Datei (`ruhestandsrechner-versionen-a-b.json`). Keine neuen Eingänge, Abhängigkeiten, Workflows oder Rechte; CSP unverändert. | Prüfung: Diff enthält nur Zeichenketten und Dokumentation. Repo-Name, URLs und `package.json`-Name (Slug) unverändert. Quelle: eigene Prüfung, Stand 2.10.2026 |

### Offene Punkte

- **S-10**: Standard bleibt «Speichern an»; Wechsel zu Opt-in wäre eine Verhaltensänderung (Eingaben gingen beim Neuladen verloren). Entscheid beim Eigentümer.
- **S-16**: Monte Carlo im Hauptthread (Läufe bis 2000, Planungsalter bis 999): mögliche kurze Blockade bei Extremwerten; nur der eigene Tab betroffen.
- **Repo-Einstellungen (29.9.2026):** Dependabot-Alerts aktiviert; Ruleset «main-schutz» auf `main` (Pull Request Pflicht, 0 Reviews, Pflicht-Checks «build» und «security», Force-Push und Löschen verboten, keine Bypass-Akteure).
- Kein `frame-ancestors`/`X-Frame-Options` möglich (GitHub Pages).
