# Mitarbeit

## Versionsregel

Die Version steht in `package.json` (und `package-lock.json`), wird im Footer der App angezeigt und im [CHANGELOG](CHANGELOG.md) geführt (SemVer, `major.minor.patch`).

- **Jeder Pull Request erhöht die Version**, auch reine Text- und Dokumentationsänderungen.
- **Patch-Stelle** (1.0.1, 1.0.2 …): kleine Änderungen, Korrekturen, Daten- und Textanpassungen.
- **Minor-Stelle** (1.1.0, 1.2.0 …): grössere Änderungen, neue Funktionen.
- **Major-Stelle**: nur bei einem grundlegenden Bruch (Entscheid der Projektinhaberin bzw. des Projektinhabers).
- Ausgenommen sind Dependabot-Pull-Requests.
- Pro PR: `npm version <neue Version> --no-git-tag-version`, Eintrag im CHANGELOG, README-Hinweis auf die Minor-Version anpassen.
- Die CI (Workflow `security`, Schritt «Versionsregel») schlägt fehl, wenn die Version gegenüber dem Zielzweig nicht erhöht wurde (`scripts/version-check.mjs`).
- Nach dem Merge entsteht ein Git-Tag mit GitHub-Release `vX.Y.Z` (neutrale Notizen, keine Personendaten).

## Prüfungen vor jedem PR

`npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, `node scripts/datenschutz-guard.mjs`, `node scripts/secret-scan.mjs`, `node scripts/email-guard.mjs --range origin/main..HEAD`, `npm audit --audit-level=high`, eine Zeile in `docs/SECURITY.md`. Commit-Autor nur mit der noreply-Adresse von GitHub. Keine echten Personendaten im Repo.
