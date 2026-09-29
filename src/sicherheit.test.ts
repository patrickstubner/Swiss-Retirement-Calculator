/**
 * Konfigurationstests zur Sicherheit (Audit S-09, S-14): CSP im HTML, Actions per SHA, minimale Rechte.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const wurzel = join(__dirname, '..');
const lies = (p: string) => readFileSync(join(wurzel, p), 'utf8');

describe('Content-Security-Policy (Meta)', () => {
  const html = lies('src/index.html');
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? '';
  const direktiven = new Map(
    csp
      .split(';')
      .map((d) => d.trim().split(/\s+/) as [string, ...string[]])
      .map(([k, ...v]) => [k, v.join(' ')]),
  );

  it('ist vorhanden und schränkt Skripte, Verbindungen, Objekte und Basis-URL ein', () => {
    expect(direktiven.get('default-src')).toBe("'self'");
    expect(direktiven.get('script-src')).toBe("'self'");
    expect(direktiven.get('connect-src')).toBe("'none'");
    expect(direktiven.get('object-src')).toBe("'none'");
    expect(direktiven.get('base-uri')).toBe("'none'");
    expect(direktiven.get('worker-src')).toBe("'self'");
  });

  it('erlaubt weder unsafe-eval noch unsafe-inline für Skripte noch Fremdquellen', () => {
    expect(csp).not.toMatch(/unsafe-eval/);
    expect(direktiven.get('script-src')).not.toMatch(/unsafe-inline/);
    expect(csp).not.toMatch(/https?:|\*/);
  });

  it('Referrer-Policy: no-referrer', () => {
    expect(html).toMatch(/<meta name="referrer" content="no-referrer"/);
  });

  it('keine Inline-Skripte im HTML', () => {
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
  });
});

describe('GitHub Actions', () => {
  const dir = join(wurzel, '.github/workflows');
  const dateien = readdirSync(dir).filter((f) => f.endsWith('.yml'));

  it('es gibt deploy.yml und security.yml', () => {
    expect(dateien).toEqual(expect.arrayContaining(['deploy.yml', 'security.yml']));
  });

  it('jede Aktion ist per 40-stelligem Commit-SHA gepinnt (mit Versionskommentar)', () => {
    for (const f of dateien) {
      const text = lies(`.github/workflows/${f}`);
      const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)(.*)$/gm)];
      expect(uses.length).toBeGreaterThan(0);
      for (const [, ref, rest] of uses) {
        expect(ref, `${f}: ${ref}`).toMatch(/^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40}$/);
        expect(rest, `${f}: ${ref}`).toMatch(/#\s*v\d/);
      }
    }
  });

  it('Schreibrechte nur im Deploy-Job; oben nur contents: read', () => {
    const t = lies('.github/workflows/deploy.yml');
    const oben = t.split(/^jobs:/m)[0] ?? '';
    expect(oben).toMatch(/permissions:\s*\n\s+contents: read\s*\n/);
    expect(oben).not.toMatch(/write/);
    const jobs = t.split(/^jobs:/m)[1] ?? '';
    const build = jobs.split(/^ {2}deploy:/m)[0] ?? '';
    const deploy = jobs.split(/^ {2}deploy:/m)[1] ?? '';
    expect(build).not.toMatch(/write/);
    expect(deploy).toMatch(/pages: write/);
    expect(deploy).toMatch(/id-token: write/);
  });

  it('kein pull_request_target, checkout ohne gespeicherte Zugangsdaten', () => {
    for (const f of dateien) {
      const text = lies(`.github/workflows/${f}`);
      expect(text).not.toMatch(/pull_request_target/);
      if (/actions\/checkout/.test(text)) expect(text).toMatch(/persist-credentials: false/);
    }
  });

  it('Dependabot beobachtet npm und github-actions', () => {
    const d = lies('.github/dependabot.yml');
    expect(d).toMatch(/package-ecosystem: npm/);
    expect(d).toMatch(/package-ecosystem: github-actions/);
  });
});

describe('Quelltext: keine gefährlichen Senken', () => {
  const alle = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const p = join(d, e.name);
      return e.isDirectory() ? alle(p) : /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
    });

  it('kein innerHTML, dangerouslySetInnerHTML, eval, new Function, document.write, fetch, XMLHttpRequest', () => {
    for (const p of alle(join(wurzel, 'src'))) {
      const t = readFileSync(p, 'utf8');
      expect(t, p).not.toMatch(
        /\binnerHTML\b|dangerouslySetInnerHTML|\beval\(|new Function\(|document\.write|\bfetch\(|XMLHttpRequest|sendBeacon/,
      );
    }
  });
});
