# Redesign-Vorschlag (Prototyp)

Klickbarer UX-Vorschlag für den künftigen neuen Rechner. Er liegt in diesem Ordner im Repo `Swiss-Retirement-Calculator`, Branch `prototype/redesign`. Kein Ersatz für die produktive App, kein echter Rechenkern, keine Beratung.

- Nur statisches HTML, CSS und JavaScript. Kein Build, keine Laufzeit-Abhängigkeiten, kein Netz, kein Speichern.
- Start mit einem **Beispielhaushalt** (Jahrgang 1976, Kanton Zürich). Zuerst nur Eckdaten, der Rest sind sichtbare Standardwerte. Das Ergebnis ist eine grobe Schätzung und lässt sich freiwillig verfeinern, bis ins Detail. Wohneigentum und Wegzug sind optionale Module. Der Planungshorizont bleibt 120.
- Es gibt keinen Schalter «Schnell / Detailliert».
- **Nicht nach main mergen.** Die Production-Pages der App (`https://patrickstubner.github.io/Swiss-Retirement-Calculator/`) bleiben unberührt.

## Vorschau

Kostenlos als Cloudflare-Worker (gleicher Weg wie der Edovita-Prototyp), ohne die GitHub-Pages der App zu ersetzen:

- https://ruhestandsrechner-prototyp.pstubner.workers.dev/

Lokal: `python3 -m http.server` in diesem Ordner.

Zum erneuten Veröffentlichen: `python3 build-worker.py` erzeugt `worker.mjs` (liegt in `.gitignore`). Das Skript ist der Worker selbst, kein zusätzliches Paket.

## Sicherheitsprüfung

| Datum | Stand | Quelle | Ergebnis |
|---|---|---|---|
| 22.11.2026 | Erste Fassung in `prototype/` | eigene Prüfung | keine Schwachstellen. Keine Geheimnisse, keine Fremdskripte, kein `localStorage`. CSP über Meta-Tag. Eingaben nur als Zahlen, Ausgabe mit `textContent`. |
| 24.11.2026 | Branch `prototype/redesign`, Auslieferung als Cloudflare-Worker `ruhestandsrechner-prototyp` | Skill Sicherheitsprüfung nach Code-Änderung | keine Schwachstellen. Worker bettet nur die Dateien aus diesem Ordner ein (inkl. Logos als Base64), kein Netz, keine Secrets, keine Cookies. Zusätzlich zu der Meta-CSP setzt der Worker Sicherheits-Header (`Content-Security-Policy` inkl. `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS). `worker.mjs` wird nicht committet. |
