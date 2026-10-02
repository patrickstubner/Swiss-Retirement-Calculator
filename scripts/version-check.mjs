#!/usr/bin/env node
/**
 * Versions-Check für Pull Requests: node scripts/version-check.mjs <git-ref-des-Zielzweigs>
 * Vergleicht `version` in package.json (Arbeitsbaum) mit der Version im Zielzweig. Exit 1, wenn nicht erhöht.
 * Dependabot-PRs nimmt der Workflow aus (kein Aufruf).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pruefeVersionsErhoehung } from './version-lib.mjs';

const ref = process.argv[2];
if (!ref || !/^[0-9A-Za-z_][0-9A-Za-z._/~^-]*$/.test(ref)) {
  console.error('Versions-Check: Aufruf: node scripts/version-check.mjs <git-ref-des-Zielzweigs>');
  process.exit(2);
}
const basisJson = execFileSync('git', ['show', `${ref}:package.json`], { encoding: 'utf8' });
const basis = JSON.parse(basisJson).version;
const kopf = JSON.parse(readFileSync('package.json', 'utf8')).version;
const r = pruefeVersionsErhoehung(basis, kopf);
console.log(`Versions-Check: ${r.meldung}`);
process.exit(r.ok ? 0 : 1);
