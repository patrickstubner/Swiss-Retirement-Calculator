#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
/**
 * Datenschutz-Guard (läuft in CI und lokal: `node scripts/datenschutz-guard.mjs [dist]`).
 *
 * 1. Kein getrackter Pfad unter lokal/, audit-local/ oder mit lokalen Datei-Mustern (echte Zahlen bleiben lokal).
 * 2. Keine verbotenen Wörter in getrackten Textdateien, Dateinamen und (optional) im gebauten Bundle.
 *
 * Die Wortliste (gesalzene SHA-256-Hashes) steht NICHT im Repo. Quellen, in dieser Reihenfolge:
 *   a) Umgebungsvariable `DATENSCHUTZ_LISTE` (JSON, z. B. als Actions-Secret),
 *   b) lokale, ungetrackte Datei `lokal/datenschutz-woerter.json`.
 * Format: `scripts/datenschutz-woerter.beispiel.json`. Ohne Liste läuft nur die Pfadprüfung (Schritt 1); der Guard meldet
 * «Liste nicht vorhanden, übersprungen» und endet mit Exit 0. Eine vorhandene, aber ungültige Liste ist ein Fehler (Exit 2).
 * Grenze: Hashes kurzer Namen lassen sich durch Ausprobieren erraten; das ist kein kryptografischer Schutz.
 * Ausnahmen: LICENSE, package.json (Autor) sowie Adressen auf github.com und *.github.io.
 * Hash eines Worts: `node scripts/datenschutz-guard.mjs --hash <wort> [--salt <salt>]`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hashWort, parseListe, pruefeText, STANDARD_SALT } from './datenschutz-lib.mjs';

const LISTE_DATEI = 'lokal/datenschutz-woerter.json';

const PFAD_VERBOTEN = [
  /(^|\/)lokal(\/|$)/,
  /(^|\/)audit-local(\/|$)/,
  /(^|\/)rr-audit(\/|$)/,
  /\.local\.[a-z0-9]+$/i,
  /(^|\/)\.env(\.|$)/,
  /(^|\/)fortschritt\.md$/,
];
const AUSNAHME_DATEIEN = new Set([
  'LICENSE',
  'package.json',
  'package-lock.json',
  'scripts/datenschutz-guard.mjs',
  'scripts/datenschutz-lib.mjs',
]);
const TEXT_ENDUNGEN = /\.(md|ts|tsx|js|mjs|cjs|json|css|html|yml|yaml|txt|py|svg|map|toml|cfg)$/i;

const args = process.argv.slice(2);
if (args[0] === '--hash') {
  const i = args.indexOf('--salt');
  console.log(hashWort(args[1] ?? '', i > 0 ? (args[i + 1] ?? '') : STANDARD_SALT));
  process.exit(0);
}

function ladeListe() {
  const env = process.env.DATENSCHUTZ_LISTE;
  let text = null;
  let herkunft = '';
  if (env !== undefined && env.trim() !== '') {
    text = env;
    herkunft = 'Umgebungsvariable DATENSCHUTZ_LISTE';
  } else if (existsSync(LISTE_DATEI)) {
    text = readFileSync(LISTE_DATEI, 'utf8');
    herkunft = LISTE_DATEI;
  }
  if (text === null) return null;
  try {
    return { liste: parseListe(text), herkunft };
  } catch (e) {
    console.error(`Datenschutz-Guard: Liste (${herkunft}) ist ungültig: ${e instanceof Error ? e.message : 'Fehler'}`);
    process.exit(2);
  }
}

function alleDateien(dir) {
  const aus = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) aus.push(...alleDateien(p));
    else aus.push(p);
  }
  return aus;
}

const geladen = ladeListe();
const liste = geladen?.liste ?? null;
const funde = [];
const dist = args[0];
if (dist) {
  if (!existsSync(dist)) {
    console.error(`Verzeichnis ${dist} fehlt`);
    process.exit(2);
  }
  for (const p of alleDateien(dist)) {
    pruefeText(`${p} (Dateiname)`, p, liste, funde);
    if (TEXT_ENDUNGEN.test(p) && statSync(p).size < 20_000_000) pruefeText(p, readFileSync(p, 'utf8'), liste, funde);
  }
} else {
  const dateien = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean);
  for (const p of dateien) {
    if (PFAD_VERBOTEN.some((r) => r.test(p))) funde.push(`${p}: lokale Daten dürfen nicht getrackt sein`);
    if (AUSNAHME_DATEIEN.has(p)) continue;
    pruefeText(`${p} (Dateiname)`, p, liste, funde);
    if (TEXT_ENDUNGEN.test(p) && existsSync(p)) pruefeText(p, readFileSync(p, 'utf8'), liste, funde);
  }
}
if (!liste) console.log('Datenschutz-Guard: Wortliste nicht vorhanden, übersprungen (nur Pfadprüfung).');
if (funde.length) {
  console.error(`Datenschutz-Guard: ${funde.length} Fund(e)\n${funde.join('\n')}`);
  process.exit(1);
}
console.log(
  `Datenschutz-Guard: ok${dist ? ` (${dist})` : ''}${liste ? ` – Wortliste aktiv (${liste.hashes.size} Einträge, ${geladen?.herkunft})` : ''}`,
);
