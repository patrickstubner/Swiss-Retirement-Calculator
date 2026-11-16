/**
 * Homescreen-App (PWA): Manifest, Icons, HTML-Verweise und das Verhalten des Service Workers.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { CACHE_PRAEFIX, precacheListe, swQuelltext } from '../scripts/pwa-lib.mjs';
import { registriereServiceWorker } from './ui/pwa';

const wurzel = join(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(wurzel, 'public/manifest.webmanifest'), 'utf8'));

function pngGroesse(datei: string): [number, number] {
  const b = readFileSync(join(wurzel, 'public', datei));
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('Manifest', () => {
  it('relativer Scope und Start unter dem GitHub-Pages-Unterpfad, eigenständig', () => {
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.id).toBe('./');
    expect(manifest.display).toBe('standalone');
    expect(manifest.name).toBe('Ruhestandsrechner Schweiz');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it('keine Fremd-URLs', () => {
    expect(JSON.stringify(manifest)).not.toMatch(/https?:|\/\//);
  });

  it('Icons 192, 512 und 512 maskable existieren in der angegebenen Grösse', () => {
    const icons = manifest.icons as { src: string; sizes: string; purpose: string }[];
    expect(icons.map((i) => i.purpose).sort()).toEqual(['any', 'any', 'maskable']);
    for (const i of icons) {
      const [w, h] = pngGroesse(i.src);
      expect(`${w}x${h}`).toBe(i.sizes);
    }
    expect(pngGroesse('icons/apple-touch-icon.png')).toEqual([180, 180]);
    expect(pngGroesse('icons/favicon-32.png')).toEqual([32, 32]);
    expect(pngGroesse('icons/favicon-16.png')).toEqual([16, 16]);
  });
});

describe('index.html', () => {
  const html = readFileSync(join(wurzel, 'src/index.html'), 'utf8');
  it('verweist auf Manifest und Icons über den Asset-Präfix, Apple-Meta-Tags', () => {
    expect(html).toContain('<link rel="manifest" href="<%= assetPrefix %>/manifest.webmanifest" />');
    expect(html).toContain(
      'rel="apple-touch-icon" sizes="180x180" href="<%= assetPrefix %>/icons/apple-touch-icon.png"',
    );
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Ruhestand CH" />');
  });
});

describe('Registrierung', () => {
  it('nur im Produktions-Build, relativ zum Scope', () => {
    const register = vi.fn(() => Promise.resolve());
    const nav = { serviceWorker: { register } } as unknown as Navigator;
    expect(registriereServiceWorker(nav, false)).toBe(false);
    expect(registriereServiceWorker({} as Navigator, true)).toBe(false);
    expect(registriereServiceWorker(nav, true)).toBe(true);
    expect(register).toHaveBeenCalledWith('./sw.js', { scope: './' });
  });
});

// --- Service Worker in einer Sandbox ausführen -------------------------------------------
const SCOPE = 'https://konto.github.io/Swiss-Retirement-Calculator/';
type Antwort = { status: number; type: string; body: string; clone(): Antwort };
const antwort = (body: string, status = 200, type = 'basic'): Antwort => ({
  status,
  type,
  body,
  clone: () => antwort(body, status, type),
});

function sandbox(version: string, vorhandeneCaches: string[] = []) {
  const speicher = new Map<string, Map<string, Antwort>>(vorhandeneCaches.map((k) => [k, new Map()]));
  const listener = new Map<string, (e: unknown) => void>();
  let netz: (url: string) => Promise<Antwort> = async (url) => antwort(`netz:${url}`);
  const fetchAufrufe: { url: string; init?: unknown }[] = [];
  const cacheFuer = (name: string) => {
    if (!speicher.has(name)) speicher.set(name, new Map());
    const m = speicher.get(name) as Map<string, Antwort>;
    const key = (r: string | { url: string }) => (typeof r === 'string' ? r : r.url);
    return {
      addAll: async (reqs: { url: string }[]) => {
        for (const r of reqs) m.set(r.url, await netz(r.url));
      },
      put: async (r: string | { url: string }, a: Antwort) => void m.set(key(r), a),
      match: async (r: string | { url: string }) => m.get(key(r)),
    };
  };
  const ctx = {
    URL,
    Promise,
    Request: class {
      url: string;
      constructor(url: string, init?: unknown) {
        this.url = url;
        void init;
      }
    },
    self: {
      location: { href: `${SCOPE}sw.js` },
      addEventListener: (t: string, f: (e: unknown) => void) => listener.set(t, f),
      skipWaiting: vi.fn(async () => undefined),
      clients: { claim: vi.fn(async () => undefined) },
    },
    caches: {
      open: async (n: string) => cacheFuer(n),
      keys: async () => [...speicher.keys()],
      delete: async (n: string) => speicher.delete(n),
    },
    fetch: async (url: string | { url: string }, init?: unknown) => {
      const u = typeof url === 'string' ? url : url.url;
      fetchAufrufe.push({ url: u, init });
      return netz(u);
    },
  };
  runInNewContext(swQuelltext(version, ['./', 'static/js/index.abc.js']), ctx);
  const warte = async (typ: string) => {
    let p: Promise<unknown> = Promise.resolve();
    listener.get(typ)?.({ waitUntil: (x: Promise<unknown>) => (p = x) });
    await p;
  };
  const anfrage = async (url: string, method = 'GET', mode = 'no-cors') => {
    const box: { p: Promise<Antwort> | null } = { p: null };
    listener.get('fetch')?.({
      request: { url, method, mode },
      respondWith: (x: Promise<Antwort>) => (box.p = x),
    });
    return box.p;
  };
  return { speicher, warte, anfrage, fetchAufrufe, setzeNetz: (f: typeof netz) => (netz = f), self: ctx.self };
}

describe('Service Worker', () => {
  it('Install lädt Startseite und gehashte Dateien vorab, Aktivieren löscht nur eigene alte Caches', async () => {
    const sw = sandbox('1.4.0', [`${CACHE_PRAEFIX}1.3.99`, 'workbox-precache-v2-padel', 'anderes-projekt']);
    await sw.warte('install');
    expect([...(sw.speicher.get(`${CACHE_PRAEFIX}1.4.0`)?.keys() ?? [])]).toEqual([
      SCOPE,
      `${SCOPE}static/js/index.abc.js`,
    ]);
    expect(sw.self.skipWaiting).toHaveBeenCalled();
    await sw.warte('activate');
    expect([...sw.speicher.keys()].sort()).toEqual([
      'anderes-projekt',
      `${CACHE_PRAEFIX}1.4.0`,
      'workbox-precache-v2-padel',
    ]);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it('Startseite: Netzwerk zuerst ohne HTTP-Cache, neue Version ersetzt die alte; offline die zuletzt geladene', async () => {
    const sw = sandbox('1.4.0');
    await sw.warte('install');
    sw.setzeNetz(async () => antwort('neue Version'));
    const a = await sw.anfrage(SCOPE, 'GET', 'navigate');
    expect((await a)?.body).toBe('neue Version');
    expect(sw.fetchAufrufe.at(-1)?.init).toMatchObject({ cache: 'no-cache' });
    sw.setzeNetz(async () => {
      throw new TypeError('offline');
    });
    expect((await sw.anfrage(`${SCOPE}index.html`, 'GET', 'navigate'))?.body).toBe('neue Version');
  });

  it('speichert Fehlerseiten und fremde Antworten nicht als Startseite', async () => {
    const sw = sandbox('1.4.0');
    sw.setzeNetz(async () => antwort('alt'));
    await sw.warte('install');
    sw.setzeNetz(async () => antwort('Fehler 404', 404));
    await sw.anfrage(SCOPE, 'GET', 'navigate');
    sw.setzeNetz(async () => antwort('opaque', 0, 'opaque'));
    await sw.anfrage(SCOPE, 'GET', 'navigate');
    sw.setzeNetz(async () => {
      throw new TypeError('offline');
    });
    expect((await sw.anfrage(SCOPE, 'GET', 'navigate'))?.body).toBe('alt');
  });

  it('Manifest und Icons: Netzwerk zuerst, offline aus dem Cache', async () => {
    const sw = sandbox('1.4.0');
    await sw.warte('install');
    sw.setzeNetz(async (u) => antwort(`frisch:${u}`));
    expect((await sw.anfrage(`${SCOPE}manifest.webmanifest`))?.body).toBe(`frisch:${SCOPE}manifest.webmanifest`);
    sw.setzeNetz(async () => {
      throw new TypeError('offline');
    });
    expect((await sw.anfrage(`${SCOPE}manifest.webmanifest?x=1`))?.body).toBe(`frisch:${SCOPE}manifest.webmanifest`);
  });

  it('gehashte Dateien: Cache zuerst', async () => {
    const sw = sandbox('1.4.0');
    await sw.warte('install');
    const n = sw.fetchAufrufe.length;
    expect((await sw.anfrage(`${SCOPE}static/js/index.abc.js`))?.body).toContain('index.abc.js');
    expect(sw.fetchAufrufe.length).toBe(n);
  });

  it('greift nicht ein bei POST, anderer Herkunft, anderem Pfad auf demselben Origin und anderen Dateien', async () => {
    const sw = sandbox('1.4.0');
    expect(await sw.anfrage(SCOPE, 'POST', 'navigate')).toBeNull();
    expect(await sw.anfrage('https://example.com/Swiss-Retirement-Calculator/', 'GET', 'navigate')).toBeNull();
    expect(await sw.anfrage('https://konto.github.io/PadelCounterV2/', 'GET', 'navigate')).toBeNull();
    expect(await sw.anfrage(`${SCOPE}sw.js`)).toBeNull();
    expect(await sw.anfrage(`${SCOPE}icons/../index.html`)).not.toBeNull();
  });

  it('lehnt ungültige Versionen und Pfade ab', () => {
    expect(() => swQuelltext('1.4', ['./'])).toThrow();
    expect(() => swQuelltext('1.4.0', ['https://x/a.js'])).toThrow();
    expect(() => swQuelltext('1.4.0', ['../a.js'])).toThrow();
  });
});

describe('Precache-Liste', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pwa-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  it('Startseite zuerst, nur static/ ohne Source-Maps und Lizenzdateien, plus Manifest und Icon', () => {
    mkdirSync(join(dir, 'static/js/async'), { recursive: true });
    for (const f of [
      'index.html',
      'sw.js',
      'static/js/a.1.js',
      'static/js/a.1.js.map',
      'static/js/a.1.js.LICENSE.txt',
      'static/js/async/b.2.js',
    ])
      writeFileSync(join(dir, f), '');
    expect(precacheListe(dir)).toEqual([
      './',
      'icons/apple-touch-icon.png',
      'icons/icon-192.png',
      'manifest.webmanifest',
      'static/js/a.1.js',
      'static/js/async/b.2.js',
    ]);
  });
});
