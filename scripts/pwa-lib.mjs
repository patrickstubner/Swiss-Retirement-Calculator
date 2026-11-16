/**
 * Homescreen-App (PWA): erzeugt den Service Worker beim Build (rsbuild.config.ts, onAfterBuild).
 * Muster wie PadelCounterV2 (versionierter Cache, nur eigene Dateien), aber:
 * - Startseite (./ und index.html): Netzwerk zuerst (cache: 'no-cache'), Cache nur offline.
 *   Neue Versionen und neue Regeljahre kommen so beim nächsten Öffnen sofort an.
 * - Manifest und Icons: ebenfalls Netzwerk zuerst, offline aus dem Cache.
 * - Gehashte Dateien unter static/: Cache zuerst (unveränderlich), beim Install vorab geladen.
 * - Nur GET, nur gleiche Herkunft, nur innerhalb des Scopes; nur 200-Antworten vom Typ «basic».
 * - Beim Aktivieren werden nur eigene alte Caches gelöscht (Präfix), nie Caches anderer
 *   Projekte auf demselben github.io-Origin.
 * Der Quelltext liegt bewusst nicht unter src/ (dort ist fetch( verboten, src/sicherheit.test.ts).
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const CACHE_PRAEFIX = 'ruhestandsrechner-pwa-';

/** Dateien, die der Service Worker beim Install vorab lädt (relativ zum Scope). */
export function precacheListe(dist) {
  const liste = ['./'];
  const lauf = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) lauf(p);
      else {
        const rel = relative(dist, p).split(sep).join('/');
        if (rel.startsWith('static/') && !rel.endsWith('.map') && !rel.endsWith('.LICENSE.txt')) liste.push(rel);
      }
    }
  };
  lauf(dist);
  for (const extra of ['manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png']) liste.push(extra);
  return liste.sort((a, b) => (a === './' ? -1 : b === './' ? 1 : a.localeCompare(b)));
}

/** Quelltext von sw.js. `version` aus package.json, `dateien` aus precacheListe. */
export function swQuelltext(version, dateien) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`ungültige Version ${version}`);
  for (const d of dateien)
    if (typeof d !== 'string' || /^[a-z]+:|^\/\/|\.\./i.test(d)) throw new Error(`ungültiger Pfad ${d}`);
  return `/* Ruhestandsrechner Schweiz ${version}: Service Worker, erzeugt beim Build (scripts/pwa-lib.mjs). */
'use strict';
const CACHE = ${JSON.stringify(CACHE_PRAEFIX + version)};
const PRAEFIX = ${JSON.stringify(CACHE_PRAEFIX)};
const DATEIEN = ${JSON.stringify(dateien)};
const SCOPE = new URL('./', self.location.href);
const INDEX = new URL('./', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(DATEIEN.map((d) => new Request(new URL(d, SCOPE).href, { cache: 'no-cache' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PRAEFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function speicherbar(response) {
  return response && response.status === 200 && response.type === 'basic';
}

async function netzwerkZuerst(request, schluessel) {
  // Navigations-Requests dürfen nicht mit RequestInit kopiert werden, deshalb nur die URL (immer GET).
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' });
    if (speicherbar(response)) await cache.put(schluessel, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(schluessel);
    if (cached) return cached;
    throw error;
  }
}

async function cacheZuerst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (speicherbar(response)) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const pfad = url.pathname.slice(SCOPE.pathname.length);
  if (pfad === '' || pfad === 'index.html') {
    event.respondWith(netzwerkZuerst(request, INDEX));
    return;
  }
  if (pfad === 'manifest.webmanifest' || (pfad.startsWith('icons/') && pfad.endsWith('.png') && !pfad.slice(6).includes('/'))) {
    event.respondWith(netzwerkZuerst(request, url.origin + url.pathname));
    return;
  }
  if (pfad.startsWith('static/')) event.respondWith(cacheZuerst(request));
});
`;
}
