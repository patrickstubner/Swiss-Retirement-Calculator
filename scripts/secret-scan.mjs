#!/usr/bin/env node
/**
 * Einfacher Geheimnis-Scan ohne Drittanbieter-Aktion (Lieferkette klein halten).
 * `node scripts/secret-scan.mjs` prüft alle getrackten Textdateien, `node scripts/secret-scan.mjs dist` ein Verzeichnis.
 * Ergänzend ist GitHub Secret Scanning mit Push Protection im Repo aktiv.
 * Gefunden wird nur, was ein Muster trifft; das ist kein Ersatz für Sorgfalt (nie echte Zahlen oder Zugangsdaten committen).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MUSTER = [
  ['GitHub-Token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/],
  ['GitHub-PAT', /\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
  ['AWS-Zugangsschlüssel', /\bAKIA[0-9A-Z]{16}\b/],
  ['Privater Schlüssel', /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['Slack-Token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['API-Schlüssel (sk-)', /\bsk-[A-Za-z0-9]{32,}\b/],
  ['Google-API-Schlüssel', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Zuweisung Passwort/Secret', /\b(password|passwort|secret|api[_-]?key|token)\b\s*[:=]\s*['"][^'"\s]{12,}['"]/i],
];
const TEXT = /\.(md|ts|tsx|js|mjs|cjs|json|css|html|yml|yaml|txt|py|svg|toml|cfg|env)$/i;
const AUSNAHME = new Set(['scripts/secret-scan.mjs', 'package-lock.json']);

function dateien(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? dateien(p) : [p];
  });
}

const ziel = process.argv[2];
const liste = ziel
  ? dateien(ziel)
  : execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\0')
      .filter(Boolean);
const funde = [];
for (const p of liste) {
  if (AUSNAHME.has(p) || !TEXT.test(p) || !existsSync(p) || statSync(p).size > 20_000_000) continue;
  const text = readFileSync(p, 'utf8');
  for (const [name, re] of MUSTER) if (re.test(text)) funde.push(`${p}: ${name}`);
}
if (funde.length) {
  console.error(`Geheimnis-Scan: ${funde.length} Fund(e)\n${funde.join('\n')}`);
  process.exit(1);
}
console.log(`Geheimnis-Scan: ok (${liste.length} Dateien${ziel ? `, ${ziel}` : ''})`);
