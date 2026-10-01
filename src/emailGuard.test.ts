import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUSNAHME_COMMITS,
  adressen,
  istErlaubt,
  istPrivateDomain,
  pruefeCommits,
  pruefeText,
} from '../scripts/email-lib.mjs';

// Adressen werden zur Laufzeit zusammengesetzt: im Quelltext stehen keine Adress-Literale (der E-Mail-Guard prüft auch diese Datei).
const AT = String.fromCharCode(64);
const adr = (lokal: string, domain: string) => `${lokal}${AT}${domain}`;

// Nur erfundene Adressen (example.*, .invalid, erfundene Anbieter-Domains in Tests).
const log = (hash: string, ae: string, ce: string, nachricht = 'Text') =>
  `${hash}\x1fName\x1f${ae}\x1fName\x1f${ce}\x1f${nachricht}\x1e\n`;

describe('E-Mail-Guard: Logik', () => {
  it('erlaubt noreply, Bots und Beispieladressen', () => {
    for (const a of [
      adr('x', 'users.noreply.github.com'),
      adr('123+x', 'users.noreply.github.com'),
      adr('noreply', 'github.com'),
      adr('support', 'github.com'),
      adr('49699333+dependabot[bot]', 'users.noreply.github.com'),
      adr('a', 'example.com'),
      adr('a', 'mail.example.org'),
      adr('a', 'host.invalid'),
      adr('a', 'host.test'),
    ]) {
      expect(istErlaubt(a), a).toBe(true);
    }
  });

  it('verbietet private und fremde Adressen', () => {
    for (const a of [
      adr('x', 'gmail.com'),
      adr('x', 'googlemail.com'),
      adr('x', 'gmx.ch'),
      adr('x', 'gmx.net'),
      adr('x', 'outlook.com'),
      adr('x', 'outlook.de'),
      adr('x', 'hotmail.com'),
      adr('x', 'bluewin.ch'),
      adr('x', 'mail.bluewin.ch'),
      adr('x', 'proton.me'),
      adr('x', 'icloud.com'),
      adr('x', 'firma.ch'),
      adr('GROSS', 'GMAIL.COM'),
      adr('x', 'evil-noreply.github.com.firma.net'),
      adr('x', 'users.noreply.github.com.firma.net'),
    ]) {
      expect(istErlaubt(a), a).toBe(false);
    }
  });

  it('erkennt private Mail-Domains', () => {
    expect(istPrivateDomain('gmail.com')).toBe(true);
    expect(istPrivateDomain('GMX.ch')).toBe(true);
    expect(istPrivateDomain('mail.bluewin.ch')).toBe(true);
    expect(istPrivateDomain('outlook.de')).toBe(true);
    expect(istPrivateDomain('firma.ch')).toBe(false);
    expect(istPrivateDomain('localhost')).toBe(false);
  });

  it('findet Adressen im Text und nennt sie nie im Fund', () => {
    const funde: string[] = [];
    pruefeText(
      'datei.md',
      `Kontakt: ${adr('erfunden.person', 'gmail.com')} und ${adr('ok', 'users.noreply.github.com')}`,
      funde,
    );
    expect(adressen(`${adr('a', 'b.ch')}, ${adr('c', 'd.com')}`)).toHaveLength(2);
    expect(funde).toHaveLength(1);
    expect(funde[0]).toContain('datei.md');
    expect(funde[0]).toContain('private Mail-Domain');
    expect(funde[0]).not.toMatch(/erfunden|gmail/i);
  });

  it('prüft Autor, Committer und Nachricht eines Commits', () => {
    const funde: string[] = [];
    const roh =
      log('a'.repeat(40), adr('x', 'users.noreply.github.com'), adr('noreply', 'github.com')) +
      log('b'.repeat(40), adr('privat', 'gmx.ch'), adr('noreply', 'github.com')) +
      log('c'.repeat(40), adr('x', 'users.noreply.github.com'), adr('privat', 'bluewin.ch')) +
      log(
        'd'.repeat(40),
        adr('x', 'users.noreply.github.com'),
        adr('noreply', 'github.com'),
        `Co-authored-by: A <${adr('a', 'outlook.com')}>`,
      );
    const r = pruefeCommits(roh, funde);
    expect(r.geprueft).toBe(4);
    expect(funde).toHaveLength(3);
    expect(funde.join('\n')).not.toMatch(/privat@|outlook\.com|bluewin\.ch/);
  });

  it('dokumentierte Ausnahme: nur der volle Hash zählt', () => {
    const [hash] = [...AUSNAHME_COMMITS] as [string];
    expect(hash).toHaveLength(40);
    const funde: string[] = [];
    const r = pruefeCommits(log(hash, adr('privat', 'gmail.com'), adr('noreply', 'github.com')), funde);
    expect(funde).toEqual([]);
    expect(r.uebersprungen).toBe(1);
    const f2: string[] = [];
    pruefeCommits(
      log(`${hash.slice(0, 7)}${'0'.repeat(33)}`, adr('privat', 'gmail.com'), adr('noreply', 'github.com')),
      f2,
    );
    expect(f2).toHaveLength(1);
  });

  it('Fuzz: zufällige Texte werfen nie', () => {
    let z = 12345;
    const rnd = () => {
      z = (z * 1103515245 + 12345) & 0x7fffffff;
      return z / 0x7fffffff;
    };
    const zeichen = `ab.${AT}-_+ \n[]é0`.split('');
    for (let i = 0; i < 300; i++) {
      const t = Array.from({ length: Math.floor(rnd() * 200) }, () => zeichen[Math.floor(rnd() * zeichen.length)]).join(
        '',
      );
      expect(() => pruefeText('x', t, [])).not.toThrow();
      expect(() => pruefeCommits(t, [])).not.toThrow();
    }
  });

  it('lange Eingaben bleiben schnell (kein Regex-Blow-up)', () => {
    const t0 = Date.now();
    pruefeText('x', `${'a'.repeat(200_000)}${AT}${'b-'.repeat(50_000)}`, []);
    pruefeText('x', `a${AT}`.repeat(100_000), []);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});

describe('E-Mail-Guard: Kommandozeile (Temp-Repo)', () => {
  const wurzel = resolve(__dirname, '..');
  const git = (d: string, ...a: string[]) =>
    execFileSync('git', ['-c', 'commit.gpgsign=false', ...a], { cwd: d, encoding: 'utf8' });
  const repo = (mail: string, inhalt = 'ok') => {
    const d = mkdtempSync(join(tmpdir(), 'mailguard-'));
    mkdirSync(join(d, 'scripts'));
    for (const f of ['email-guard.mjs', 'email-lib.mjs']) cpSync(join(wurzel, 'scripts', f), join(d, 'scripts', f));
    git(d, 'init', '-q', '-b', 'main');
    git(d, 'config', 'user.name', 'Test');
    git(d, 'config', 'user.email', mail);
    writeFileSync(join(d, 'a.md'), inhalt);
    git(d, 'add', '-A');
    git(d, 'commit', '-q', '-m', 'eins');
    return d;
  };
  const lauf = (d: string, ...args: string[]) =>
    spawnSync(process.execPath, ['scripts/email-guard.mjs', ...args], { cwd: d, encoding: 'utf8' });

  it('sauberes Repo: Exit 0', () => {
    const d = repo(adr('t', 'users.noreply.github.com'));
    try {
      const r = lauf(d, '--alle');
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('E-Mail-Guard: ok');
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('private Adresse in Commit-Metadaten: Exit 1, Adresse nicht in der Ausgabe', () => {
    const d = repo(adr('erfunden', 'gmx.ch'));
    try {
      const r = lauf(d, '--alle');
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('private Mail-Domain');
      expect(r.stderr + r.stdout).not.toMatch(/erfunden|gmx/i);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('--range prüft nur neue Commits; --nur-dateien ignoriert Commits', () => {
    const d = repo(adr('erfunden', 'gmx.ch')); // erster Commit mit privater Adresse
    try {
      git(d, 'config', 'user.email', adr('t', 'users.noreply.github.com'));
      writeFileSync(join(d, 'b.md'), 'zwei');
      git(d, 'add', '-A');
      git(d, 'commit', '-q', '-m', 'zwei');
      expect(lauf(d, '--range', 'HEAD~1..HEAD').status).toBe(0);
      expect(lauf(d, '--alle').status).toBe(1);
      expect(lauf(d, '--nur-dateien').status).toBe(0);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('private Adresse in einer getrackten Datei: Exit 1', () => {
    const d = repo(adr('t', 'users.noreply.github.com'), `Mail an ${adr('erfunden', 'bluewin.ch')}`);
    try {
      const r = lauf(d, '--nur-dateien');
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('a.md');
      expect(r.stderr).not.toMatch(/erfunden|bluewin/i);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('ungültiger --range: Exit 2', () => {
    const d = repo(adr('t', 'users.noreply.github.com'));
    try {
      expect(lauf(d, '--range', '--exec=boese').status).toBe(2);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});
