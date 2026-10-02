import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { parseVersion, pruefeVersionsErhoehung, vergleicheVersion } from '../scripts/version-lib.mjs';
import { APP_VERSION } from './version';

describe('Version', () => {
  it('package.json und App-Anzeige stimmen überein und sind gültiges SemVer (1.x)', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(parseVersion(pkg.version)).not.toBeNull();
    expect(parseVersion(pkg.version)?.[0]).toBeGreaterThanOrEqual(1);
  });
  it('README und CHANGELOG nennen die aktuelle Version', async () => {
    const { readFileSync } = await import('node:fs');
    const cl = readFileSync(resolve(__dirname, '../CHANGELOG.md'), 'utf8');
    expect(cl).toContain(`## [${pkg.version}]`);
    const readme = readFileSync(resolve(__dirname, '../README.md'), 'utf8');
    expect(readme).toContain(`Version ${pkg.version.split('.').slice(0, 2).join('.')}`);
  });
});

describe('Versionsregel (CI-Check)', () => {
  it('parseVersion nimmt nur major.minor.patch an', () => {
    expect(parseVersion('1.0.0')).toEqual([1, 0, 0]);
    expect(parseVersion('10.20.30')).toEqual([10, 20, 30]);
    for (const x of ['1.0', '1.0.0-beta', 'v1.0.0', '01.0.0', '', '1.0.0.0', ' '])
      expect(parseVersion(x), x).toBeNull();
  });
  it('vergleicht numerisch, nicht als Text', () => {
    expect(vergleicheVersion('1.0.10', '1.0.9')).toBe(1);
    expect(vergleicheVersion('1.2.0', '1.10.0')).toBe(-1);
    expect(vergleicheVersion('2.0.0', '1.99.99')).toBe(1);
    expect(vergleicheVersion('1.0.0', '1.0.0')).toBe(0);
    expect(vergleicheVersion('x', '1.0.0')).toBeNull();
  });
  it('akzeptiert Erhöhung, lehnt gleiche, kleinere und ungültige Version ab', () => {
    expect(pruefeVersionsErhoehung('1.0.0', '1.0.1').ok).toBe(true);
    expect(pruefeVersionsErhoehung('1.0.9', '1.1.0').ok).toBe(true);
    expect(pruefeVersionsErhoehung('0.1.0', '1.0.0').ok).toBe(true);
    expect(pruefeVersionsErhoehung('1.0.1', '1.0.1').ok).toBe(false);
    expect(pruefeVersionsErhoehung('1.1.0', '1.0.5').ok).toBe(false);
    expect(pruefeVersionsErhoehung('1.0.0', 'abc').ok).toBe(false);
    expect(pruefeVersionsErhoehung('kaputt', '1.0.1').ok).toBe(false);
  });

  it('Skript: Exit 0 bei Erhöhung, 1 ohne Erhöhung, 2 ohne Argument', () => {
    const skript = resolve(__dirname, '../scripts/version-check.mjs');
    const lib = resolve(__dirname, '../scripts/version-lib.mjs');
    const dir = mkdtempSync(join(tmpdir(), 'vcheck-'));
    try {
      const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
      mkdirSync(join(dir, 'scripts'));
      writeFileSync(join(dir, 'scripts/version-check.mjs'), execFileSync('cat', [skript], { encoding: 'utf8' }));
      writeFileSync(join(dir, 'scripts/version-lib.mjs'), execFileSync('cat', [lib], { encoding: 'utf8' }));
      git('init', '-q', '-b', 'main');
      git('config', 'user.name', 'Test');
      git('config', 'user.email', 'test@users.noreply.github.com');
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      git('add', '.');
      git('commit', '-q', '-m', 'basis');
      const lauf = (arg?: string) => {
        try {
          execFileSync('node', ['scripts/version-check.mjs', ...(arg ? [arg] : [])], { cwd: dir, stdio: 'pipe' });
          return 0;
        } catch (e) {
          return (e as { status: number }).status;
        }
      };
      expect(lauf('main')).toBe(1);
      expect(lauf()).toBe(2);
      expect(lauf('main; rm -rf x')).toBe(2);
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.0.1' }));
      expect(lauf('main')).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
