/**
 * Logik des Datenschutz-Guards (ohne Dateizugriff auf das Repo, damit sie testbar ist).
 *
 * Die Liste verbotener Wörter liegt NICHT im Repo. Sie besteht aus gesalzenen SHA-256-Hashes normalisierter Wörter
 * (Kleinbuchstaben, ohne Akzente) und wird lokal (`lokal/datenschutz-woerter.json`, ungetrackt) oder in CI über die
 * Umgebungsvariable `DATENSCHUTZ_LISTE` (JSON) bereitgestellt. Format siehe `scripts/datenschutz-woerter.beispiel.json`.
 */
import { createHash } from 'node:crypto';

export const STANDARD_SALT = 'rr-datenschutz-v1:';
export const MAX_LISTE_ZEICHEN = 200_000;
export const MAX_HASHES = 5000;

// Adressen von GitHub (Repo-URL, Pages-Adresse) sind erlaubt und werden vor der Wortprüfung entfernt.
const URL_KONTO = /https?:\/\/(?:[a-z0-9-]+\.github\.io|github\.com)\/?[^\s"'`)<>\]]*/gi;

export const norm = (w) =>
  String(w)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const hashWort = (w, salt = STANDARD_SALT) =>
  createHash('sha256')
    .update(salt + norm(w))
    .digest('hex');

/**
 * Liste aus JSON-Text lesen und prüfen. Gibt `{ salt, hashes }` zurück oder wirft einen Error mit einer
 * Meldung ohne Inhalt der Liste.
 */
export function parseListe(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_LISTE_ZEICHEN) {
    throw new Error('Liste hat eine ungültige Grösse');
  }
  let o;
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error('Liste ist kein gültiges JSON');
  }
  if (o === null || typeof o !== 'object' || Array.isArray(o)) throw new Error('Liste hat ein ungültiges Format');
  const salt = o.salt === undefined ? STANDARD_SALT : o.salt;
  if (typeof salt !== 'string' || salt.length > 200) throw new Error('Salt ungültig');
  if (!Array.isArray(o.hashes) || o.hashes.length > MAX_HASHES) throw new Error('hashes fehlt oder ist zu lang');
  const hashes = new Set();
  for (const h of o.hashes) {
    if (typeof h !== 'string' || !/^[0-9a-f]{64}$/.test(h)) throw new Error('hashes enthält einen ungültigen Eintrag');
    hashes.add(h);
  }
  return { salt, hashes };
}

/** Wörter (4 bis 30 Zeichen, normalisiert) eines Textes, ohne erlaubte GitHub-Adressen. */
export function woerter(text) {
  const sauber = String(text).replace(URL_KONTO, ' ');
  return new Set(
    sauber
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4 && w.length <= 30)
      .map(norm),
  );
}

/** Fügt Funde (ohne das Wort selbst, nur Kurz-Hash) zu `funde` hinzu. */
export function pruefeText(name, text, liste, funde) {
  if (!liste) return;
  for (const w of woerter(text)) {
    const h = hashWort(w, liste.salt);
    if (liste.hashes.has(h)) funde.push(`${name}: verbotenes Wort (Hash ${h.slice(0, 8)}…)`);
  }
}
