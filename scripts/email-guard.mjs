#!/usr/bin/env node
/**
 * E-Mail-Guard (listenunabhängig, läuft in CI und lokal):
 *   node scripts/email-guard.mjs [--range <von>..<bis>] [--alle] [--nur-dateien]
 *
 * 1. Getrackte Textdateien: keine E-Mail-Adressen ausser noreply/Bots/Beispielen.
 * 2. Commit-Metadaten (Autor, Committer, Nachricht inkl. Co-authored-by): mit --range nur diese Commits (PR),
 *    mit --alle den ganzen Verlauf (main, wöchentlich). Ein dokumentierter Altfall (nur Hash) wird übersprungen.
 * Ohne --range/--alle/--nur-dateien: Commits von origin/main..HEAD (falls vorhanden), sonst nur Dateien.
 * Die Ausgabe enthält nie eine Adresse. Exit 1 bei Fund, 2 bei Aufruffehlern.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pruefeCommits, pruefeText } from './email-lib.mjs';

const args = process.argv.slice(2);
const git = (a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const TEXT = /\.(md|ts|tsx|js|mjs|cjs|json|css|html|yml|yaml|txt|py|svg|toml|cfg|nvmrc)$/i;
const funde = [];

const dateien = git(['ls-files', '-z']).split('\0').filter(Boolean);
let anzahl = 0;
for (const p of dateien) {
  if (!TEXT.test(p) && !/^(LICENSE|NOTICE|\.nvmrc|\.gitignore)$/.test(p)) continue;
  if (!existsSync(p)) continue;
  anzahl++;
  pruefeText(p, readFileSync(p, 'utf8'), funde);
}

let commitInfo = 'Commits: nicht geprüft';
if (!args.includes('--nur-dateien')) {
  const i = args.indexOf('--range');
  let bereich = null;
  if (i >= 0) {
    bereich = args[i + 1];
    if (!bereich || !/^[0-9A-Za-z_][0-9A-Za-z._/~^-]*\.\.[0-9A-Za-z_][0-9A-Za-z._/~^-]*$/.test(bereich)) {
      console.error('E-Mail-Guard: --range braucht <von>..<bis>');
      process.exit(2);
    }
  } else if (!args.includes('--alle')) {
    try {
      git(['rev-parse', '--verify', '-q', 'origin/main']);
      bereich = 'origin/main..HEAD';
    } catch {
      bereich = null;
    }
  }
  if (bereich !== null || args.includes('--alle')) {
    const log = git(['log', '--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e', ...(bereich ? [bereich] : ['--all'])]);
    const r = pruefeCommits(log, funde);
    commitInfo = `Commits: ${r.geprueft} geprüft${r.uebersprungen ? `, ${r.uebersprungen} dokumentierte Ausnahme` : ''} (${bereich ?? 'alle'})`;
  }
}

if (funde.length) {
  console.error(`E-Mail-Guard: ${funde.length} Fund(e)\n${funde.join('\n')}`);
  process.exit(1);
}
console.log(`E-Mail-Guard: ok (${anzahl} Dateien; ${commitInfo})`);
