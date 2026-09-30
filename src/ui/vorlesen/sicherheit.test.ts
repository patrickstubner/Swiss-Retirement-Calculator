/** Sicherheits- und Robustheitstests für das Vorlesen (Dauerregel: Prüfung nach jeder Änderung). */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bereiteAuf } from './aufbereitung';
import { planeSaetze } from './plan';
import { teileInSaetze } from './saetze';
import { deutscheStimmen } from './stimmen';

const dir = __dirname;
const quellen = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.|fake\.ts/.test(f));

describe('Vorlesen: Quelltext', () => {
  it('kein innerHTML, eval, Netzwerk, Cookies oder Weitergabe von Daten', () => {
    for (const f of quellen) {
      const t = readFileSync(join(dir, f), 'utf8');
      expect(t, f).not.toMatch(
        /\binnerHTML\b|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|\beval\(|new Function\(|document\.write|\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|document\.cookie|new Image\(|createContextualFragment/,
      );
    }
  });

  it('die Hervorhebung nutzt nur Ranges/Highlight-API bzw. ein Attribut ohne Inhalt', () => {
    const t = readFileSync(join(dir, 'hervorhebung.ts'), 'utf8');
    expect(t).toMatch(/CSS\.highlights|highlights/);
    expect(t).not.toMatch(/textContent\s*=|innerText\s*=|appendChild|replaceChild|surroundContents|\.insertNode/);
  });

  it('Stimmen: Online-Stimmen werden nie angeboten (Text bliebe sonst nicht im Gerät)', () => {
    const t = readFileSync(join(dir, 'controller.ts'), 'utf8');
    expect(t).toMatch(/localService !== false/);
  });
});

describe('Vorlesen: Robustheit gegen böse Eingaben', () => {
  const boese = [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '"><svg/onload=alert(1)>',
    '\u0000\u0001\u202E\u200B',
    "1'1'1'1'1'1'1'1'1'1'1'1'1'1'1'1'1'1'1'1'1'1'1'1'1",
    '9'.repeat(100_000),
    `${'1.'.repeat(50_000)}x`,
    `${"1'".repeat(50_000)}x`,
    'A'.repeat(200_000),
    `${'z. '.repeat(30_000)}B`,
    `${'CHF '.repeat(30_000)}`,
    `${'.'.repeat(100_000)}`,
    `${' '.repeat(100_000)}x`,
    '😀'.repeat(50_000),
  ];

  it('Aufbereitung und Satzteilung bleiben schnell (kein Regex-Blow-up) und werfen nicht', () => {
    for (const b of boese) {
      const t0 = performance.now();
      const a = bereiteAuf(b);
      const s = teileInSaetze(b);
      const p = planeSaetze([b]);
      const dauer = performance.now() - t0;
      expect(typeof a.sprech, b.slice(0, 20)).toBe('string');
      expect(Array.isArray(s)).toBe(true);
      expect(p.length).toBeLessThanOrEqual(4000);
      expect(dauer, `${b.slice(0, 20)}: ${dauer.toFixed(0)} ms`).toBeLessThan(4000);
    }
    // Gesamt-Timeout grosszügig: auf ausgelasteten CI-Runnern ist es ein Vielfaches der lokalen Zeit (< 1 s).
  }, 60_000);

  it('Sprechtext enthält nie Markup als HTML-Bedeutung (wird nur an die Stimme übergeben, nie in den DOM)', () => {
    const a = bereiteAuf('<img src=x onerror=alert(1)>');
    expect(a.sprech).not.toMatch(/[<>]/);
  });

  it('Stimmenlisten aus dem Browser mit fremden oder riesigen Werten', () => {
    const l = deutscheStimmen([
      { name: '<b>x</b>'.repeat(100), lang: 'de-CH', voiceURI: 'u'.repeat(1000) },
      { name: undefined, lang: undefined },
      { lang: 'de', name: 'ok', localService: true },
    ]);
    expect(l.length).toBe(2);
    expect(l.every((s) => s.name.length <= 100 && s.id.length <= 200)).toBe(true);
  });
});
