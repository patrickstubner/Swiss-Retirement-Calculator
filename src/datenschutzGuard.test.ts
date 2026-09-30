import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashWort, MAX_HASHES, norm, parseListe, pruefeText, woerter } from '../scripts/datenschutz-lib.mjs';

// Nur erfundene Platzhalter-Wörter: die echte Liste liegt lokal und ist nie Teil der Tests.
const SALT = 'test-salt:';
const liste = () =>
  parseListe(JSON.stringify({ salt: SALT, hashes: ['musterwort', 'zwölfer-beispiel'].map((w) => hashWort(w, SALT)) }));

describe('Datenschutz-Guard: Logik', () => {
  it('normalisiert Akzente und Gross-/Kleinschreibung', () => {
    expect(norm('MÜSTERWÖRT')).toBe('musterwort');
    expect(norm('Crème')).toBe('creme');
    expect(hashWort('Musterwort', SALT)).toBe(hashWort('musterwort', SALT));
    expect(hashWort('a', 'x:')).not.toBe(hashWort('a', 'y:'));
  });

  it('findet verbotene Wörter, meldet aber nur einen Kurz-Hash', () => {
    const funde: string[] = [];
    pruefeText('datei.md', 'Das ist ein Musterwort im Satz.', liste(), funde);
    expect(funde).toHaveLength(1);
    expect(funde[0]).toContain('datei.md');
    expect(funde[0]).not.toMatch(/muster/i);
  });

  it('ohne Liste wird nichts gemeldet', () => {
    const funde: string[] = [];
    pruefeText('datei.md', 'Musterwort', null, funde);
    expect(funde).toEqual([]);
  });

  it('erlaubt GitHub-Adressen, prüft aber den Rest', () => {
    const funde: string[] = [];
    pruefeText('a', 'siehe https://github.com/musterwort/repo und https://musterwort.github.io/x', liste(), funde);
    expect(funde).toEqual([]);
    pruefeText('a', 'https://github.com/x musterwort', liste(), funde);
    expect(funde).toHaveLength(1);
  });

  it('erkennt Wörter nur ganz (keine Teilstrings) und ignoriert zu kurze/lange', () => {
    const funde: string[] = [];
    pruefeText('a', 'Musterwortkette Mustervorwort', liste(), funde);
    expect(funde).toEqual([]);
    expect(woerter('ab abc abcd').has('abc')).toBe(false);
    expect(woerter(`${'x'.repeat(31)} ${'y'.repeat(30)}`).size).toBe(1);
  });

  it('Fuzz: zufällige Texte werfen nie und finden nichts', () => {
    let s = 42;
    const zufall = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    const zeichen = 'abcXYZ äöü é1.-_ \n\t"\'`<>/https://github.com/'.split('');
    for (let i = 0; i < 300; i++) {
      const t = Array.from(
        { length: Math.floor(zufall() * 400) },
        () => zeichen[Math.floor(zufall() * zeichen.length)],
      ).join('');
      const funde: string[] = [];
      expect(() => pruefeText('f', t, liste(), funde)).not.toThrow();
      expect(funde).toEqual([]);
    }
  });

  it('parseListe: gültige und ungültige Formate', () => {
    expect(parseListe('{"hashes":[]}').salt).toMatch(/^rr-datenschutz/);
    for (const schlecht of [
      '',
      'kein json',
      '[]',
      'null',
      '{}',
      '{"hashes":"x"}',
      '{"hashes":["zu-kurz"]}',
      `{"hashes":["${'g'.repeat(64)}"]}`,
      '{"salt":1,"hashes":[]}',
      `{"salt":"${'s'.repeat(201)}","hashes":[]}`,
      JSON.stringify({ hashes: Array.from({ length: MAX_HASHES + 1 }, () => 'a'.repeat(64)) }),
    ]) {
      expect(() => parseListe(schlecht), schlecht.slice(0, 30)).toThrow();
    }
    expect(() => parseListe(undefined as unknown as string)).toThrow();
  });

  it('Fehlermeldungen von parseListe enthalten keinen Inhalt der Liste', () => {
    try {
      parseListe('{"hashes":["geheim-eintrag"]}');
    } catch (e) {
      expect(String(e)).not.toContain('geheim-eintrag');
    }
  });

  it('die Beispiel-Vorlage im Repo ist gültig und enthält nur Platzhalter', () => {
    const t = readFileSync('scripts/datenschutz-woerter.beispiel.json', 'utf8');
    const l = parseListe(t);
    expect(l.hashes.size).toBe(3);
    const funde: string[] = [];
    pruefeText('x', 'musterwort platzhalterone', l, funde);
    expect(funde).toHaveLength(2);
  });
});

describe('Datenschutz-Guard: Kommandozeile (in einem Temp-Repo)', () => {
  const guard = resolve('scripts/datenschutz-guard.mjs');
  const lib = resolve('scripts/datenschutz-lib.mjs');

  function tempRepo(): string {
    const d = mkdtempSync(join(tmpdir(), 'guard-'));
    mkdirSync(join(d, 'scripts'));
    writeFileSync(join(d, 'scripts', 'datenschutz-lib.mjs'), readFileSync(lib));
    writeFileSync(join(d, 'scripts', 'datenschutz-guard.mjs'), readFileSync(guard));
    writeFileSync(join(d, 'text.md'), 'Ein harmloser Text mit Musterwort darin.\n');
    execFileSync('git', ['init', '-q'], { cwd: d });
    execFileSync('git', ['add', '-A'], { cwd: d });
    return d;
  }
  const lauf = (d: string, env: Record<string, string> = {}, args: string[] = []) =>
    spawnSync(process.execPath, ['scripts/datenschutz-guard.mjs', ...args], {
      cwd: d,
      encoding: 'utf8',
      env: { PATH: process.env.PATH ?? '', ...env },
    });

  it('ohne Liste: Exit 0 und klare Meldung', () => {
    const d = tempRepo();
    try {
      const r = lauf(d);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('Wortliste nicht vorhanden, übersprungen');
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('mit Liste (Umgebungsvariable): Fund → Exit 1; ohne Fund → Exit 0', () => {
    const d = tempRepo();
    try {
      const mit = JSON.stringify({ salt: SALT, hashes: [hashWort('musterwort', SALT)] });
      const ohne = JSON.stringify({ salt: SALT, hashes: [hashWort('anderes', SALT)] });
      const a = lauf(d, { DATENSCHUTZ_LISTE: mit });
      expect(a.status).toBe(1);
      expect(a.stderr).toContain('text.md');
      expect(a.stderr).not.toMatch(/musterwort/i);
      expect(lauf(d, { DATENSCHUTZ_LISTE: ohne }).status).toBe(0);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('mit lokaler Datei lokal/datenschutz-woerter.json', () => {
    const d = tempRepo();
    try {
      mkdirSync(join(d, 'lokal'));
      writeFileSync(
        join(d, 'lokal', 'datenschutz-woerter.json'),
        JSON.stringify({ salt: SALT, hashes: [hashWort('musterwort', SALT)] }),
      );
      expect(lauf(d).status).toBe(1);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('ungültige Liste: Exit 2, keine Ausgabe des Inhalts', () => {
    const d = tempRepo();
    try {
      const r = lauf(d, { DATENSCHUTZ_LISTE: '{"hashes":["geheim"]}' });
      expect(r.status).toBe(2);
      expect(r.stderr).not.toContain('geheim');
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('getrackte Dateien unter lokal/ werden auch ohne Liste gemeldet', () => {
    const d = tempRepo();
    try {
      mkdirSync(join(d, 'lokal'));
      writeFileSync(join(d, 'lokal', 'x.txt'), 'x');
      execFileSync('git', ['add', '-f', '-A'], { cwd: d });
      const r = lauf(d);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('lokale Daten dürfen nicht getrackt sein');
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('--hash mit eigenem Salt', () => {
    const d = tempRepo();
    try {
      const r = lauf(d, {}, ['--hash', 'Musterwort', '--salt', SALT]);
      expect(r.stdout.trim()).toBe(hashWort('musterwort', SALT));
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});
