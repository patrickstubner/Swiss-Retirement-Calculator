#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
/**
 * Datenschutz-Guard (läuft in CI und lokal: `node scripts/datenschutz-guard.mjs [dist]`).
 *
 * 1. Kein getrackter Pfad unter lokal/, audit-local/ oder mit lokalen Datei-Mustern (echte Zahlen bleiben lokal).
 * 2. Keine verbotenen Wörter in getrackten Textdateien, Dateinamen und (optional) im gebauten Bundle.
 *
 * Die verbotenen Wörter stehen NICHT im Klartext im Repo: nur gesalzene SHA-256-Hashes normalisierter
 * Wörter (Kleinbuchstaben, ohne Akzente). Grenze: Hashes kurzer Namen lassen sich durch Ausprobieren
 * erraten. Das ist kein kryptografischer Schutz, sondern verhindert nur, dass die Liste die Namen offen zeigt.
 * Ausnahmen: LICENSE, package.json (Autor) sowie Adressen auf github.com und *.github.io (Repo-URL, Pages).
 * Hinzufügen eines Worts: `node scripts/datenschutz-guard.mjs --hash <wort>` und den Hash unten eintragen.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SALT = 'rr-datenschutz-v1:';
const VERBOTEN = new Set([
  'f45e5110eb21e77a4d31ef4b4827829a618e6bbd9e5c832e27707a68ddb94f0f',
  '6f95d03c0c6f13fdbc8eada224d72f259c8b617fc3b679034cf1a49a0f8a42b7',
  '186e5513e1cc51b72c892efee6a16ca8f28acabddc95024c42d374169feec01b',
  'f9c00ff42131eea7fa1b27fc61cdefa5ddd5361afc3ba1294450a250aa1157d6',
  'd7852307e88b14f23749951d964b31d635e09188a39b040217eb09a93e51c0eb',
  '1da82e21dc85d0c582e4a06394eff1a35fa3a6b11d2b1024a47ed069da8d3b21',
  '7d9ca5847b426ffa93a15e44399907943d6e493b01c044df5140a337af21edb8',
  '4723481d6ba23fd31526b1726e307aa92b4ed1f4658c3b08f9ee3170fbada8d4',
  '65754600def1fffe012f040fde31e82c13425053ae8acff6b754b789c3f463ec',
  '7e519877691deb67505a4af6b628696b543746c76b45cb3a6f160846c50e9ce9',
]);

const PFAD_VERBOTEN = [
  /(^|\/)lokal(\/|$)/,
  /(^|\/)audit-local(\/|$)/,
  /(^|\/)rr-audit(\/|$)/,
  /\.local\.[a-z0-9]+$/i,
  /(^|\/)\.env(\.|$)/,
  /(^|\/)fortschritt\.md$/,
];
const AUSNAHME_DATEIEN = new Set(['LICENSE', 'package.json', 'package-lock.json', 'scripts/datenschutz-guard.mjs']);
const TEXT_ENDUNGEN = /\.(md|ts|tsx|js|mjs|cjs|json|css|html|yml|yaml|txt|py|svg|map|toml|cfg)$/i;
// Adressen von GitHub (Repo-URL, Pages-Adresse) sind erlaubt und werden vor der Wortprüfung entfernt.
const URL_KONTO = /https?:\/\/(?:[a-z0-9-]+\.github\.io|github\.com)\/?[^\s"'`)<>\]]*/gi;

const norm = (w) =>
  w
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const hash = (w) =>
  createHash('sha256')
    .update(SALT + norm(w))
    .digest('hex');

if (process.argv[2] === '--hash') {
  console.log(hash(process.argv[3] ?? ''));
  process.exit(0);
}

function woerter(text) {
  const sauber = text.replace(URL_KONTO, ' ');
  return new Set(
    sauber
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4 && w.length <= 30)
      .map(norm),
  );
}

function pruefe(name, text, funde) {
  for (const w of woerter(text)) {
    if (VERBOTEN.has(hash(w))) funde.push(`${name}: verbotenes Wort (Hash ${hash(w).slice(0, 8)}…)`);
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

const funde = [];
const dist = process.argv[2];
if (dist) {
  if (!existsSync(dist)) {
    console.error(`Verzeichnis ${dist} fehlt`);
    process.exit(2);
  }
  for (const p of alleDateien(dist)) {
    pruefe(`${p} (Dateiname)`, p, funde);
    if (TEXT_ENDUNGEN.test(p) && statSync(p).size < 20_000_000) pruefe(p, readFileSync(p, 'utf8'), funde);
  }
} else {
  const dateien = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean);
  for (const p of dateien) {
    if (PFAD_VERBOTEN.some((r) => r.test(p))) funde.push(`${p}: lokale Daten dürfen nicht getrackt sein`);
    if (AUSNAHME_DATEIEN.has(p)) continue;
    pruefe(`${p} (Dateiname)`, p, funde);
    if (TEXT_ENDUNGEN.test(p) && existsSync(p)) pruefe(p, readFileSync(p, 'utf8'), funde);
  }
}
if (funde.length) {
  console.error(`Datenschutz-Guard: ${funde.length} Fund(e)\n${funde.join('\n')}`);
  process.exit(1);
}
console.log(`Datenschutz-Guard: ok${dist ? ` (${dist})` : ''}`);
