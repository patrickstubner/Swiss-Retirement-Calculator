#!/usr/bin/env node
/**
 * Regeljahr-Diff: node scripts/regeljahr-diff.mjs [vonJahr] [nachJahr] [--json]
 * Zeigt geänderte, neue, entfernte und offene Regelwerte zwischen src/rules/<von>.json und <nach>.json.
 * Ohne Argumente: die zwei neusten Regeljahre. Liest nur lokale Dateien, schreibt nichts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { alsMarkdown, regeljahrDiff } from './regeljahr-diff-lib.mjs';

const dir = join(import.meta.dirname, '..', 'src', 'rules');
const args = process.argv.slice(2);
const json = args.includes('--json');
const jahre = args.filter((a) => a !== '--json');
if (jahre.some((j) => !/^\d{4}$/.test(j)) || jahre.length === 1 || jahre.length > 2) {
  console.error('Aufruf: node scripts/regeljahr-diff.mjs [vonJahr nachJahr] [--json]');
  process.exit(2);
}
const vorhanden = readdirSync(dir)
  .filter((f) => /^\d{4}\.json$/.test(f))
  .map((f) => f.slice(0, 4))
  .sort();
const [von, nach] = jahre.length === 2 ? jahre : vorhanden.slice(-2);
for (const j of [von, nach]) {
  if (!vorhanden.includes(j)) {
    console.error(`Regeljahr-Diff: src/rules/${j}.json fehlt (vorhanden: ${vorhanden.join(', ')})`);
    process.exit(2);
  }
}
const lies = (/** @type {string} */ j) => JSON.parse(readFileSync(join(dir, `${j}.json`), 'utf8'));
const d = regeljahrDiff(lies(von), lies(nach));
console.log(json ? JSON.stringify(d, null, 2) : alsMarkdown(d, von, nach));
