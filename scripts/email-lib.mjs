/**
 * E-Mail-Prüfung (listenunabhängig, Audit DS-02): findet E-Mail-Adressen in Text und in Commit-Metadaten.
 *
 * Erlaubt sind nur GitHub-noreply-/support-Adressen, Bots (dependabot, github-actions), Beispieladressen (example.*, *.invalid, *.test).
 * Alles andere ist ein Fund; private Mail-Domänen (gmail, gmx, outlook, bluewin …) werden als solche benannt.
 * Die gefundene Adresse wird nie ausgegeben, nur Ort, Art und ein Kurz-Hash.
 */
import { createHash } from 'node:crypto';

/** Einziger dokumentierter Altfall (Commit mit privater Adresse im Verlauf von main); nur der Hash, keine Adresse. */
export const AUSNAHME_COMMITS = new Set(['377ef679a343af3371ac4182cdae74731f486a76']);

const EMAIL =
  /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,24}/g;

const PRIVAT_BASIS = [
  'gmail',
  'googlemail',
  'gmx',
  'outlook',
  'hotmail',
  'live',
  'msn',
  'bluewin',
  'bluemail',
  'yahoo',
  'ymail',
  'icloud',
  'me',
  'mac',
  'proton',
  'protonmail',
  'pm',
  'web',
  't-online',
  'freenet',
  'aol',
  'mail',
  'sunrise',
  'hispeed',
  'swissonline',
  'tutanota',
  'tuta',
  'posteo',
  'mailbox',
  'zoho',
  'yandex',
  'qq',
  '163',
  'naver',
  'seznam',
  'wp',
  'orange',
  'libero',
  'virgilio',
  'laposte',
  'free',
  'sfr',
];

const norm = (s) => s.toLowerCase();

/** Ist die Domäne ein bekannter privater Mail-Anbieter (z. B. gmail.com, gmx.ch, outlook.de, mail.bluewin.ch)? */
export function istPrivateDomain(domain) {
  const teile = norm(domain).split('.');
  if (teile.length < 2) return false;
  // Basisname = zweitletztes Label (bei gmx.co.uk etc. zusätzlich das drittletzte prüfen)
  const kandidaten = new Set([teile[teile.length - 2], teile[teile.length - 3]].filter(Boolean));
  return [...kandidaten].some((k) => PRIVAT_BASIS.includes(k));
}

/** Erlaubte Adresse (noreply, Bots, Beispiele)? */
export function istErlaubt(adresse) {
  const a = norm(adresse);
  const [lokal, domain] = a.split('@');
  if (!lokal || !domain) return false;
  if (domain === 'users.noreply.github.com' || domain === 'noreply.github.com') return true;
  if (domain === 'github.com' && /^(noreply|support)$/.test(lokal)) return true; // GitHub selbst
  if (/^(?:\d+\+)?dependabot\[bot\]$/.test(lokal) || /^(?:\d+\+)?github-actions\[bot\]$/.test(lokal)) {
    return domain === 'users.noreply.github.com';
  }
  if (/(^|\.)example\.(com|org|net)$/.test(domain)) return true;
  if (/\.(invalid|test|example|localhost)$/.test(domain)) return true;
  return false;
}

const kurz = (a) => createHash('sha256').update(norm(a)).digest('hex').slice(0, 8);

/** Alle Adressen eines Textes. */
export function adressen(text) {
  return String(text).match(EMAIL) ?? [];
}

/**
 * Prüft einen Text; hängt Funde (ohne Adresse) an `funde` an.
 * @param {string} ort z. B. Dateipfad
 */
export function pruefeText(ort, text, funde) {
  for (const a of adressen(text)) {
    if (istErlaubt(a)) continue;
    const art = istPrivateDomain(a.split('@')[1] ?? '') ? 'private Mail-Domain' : 'nicht erlaubte Adresse';
    funde.push(`${ort}: ${art} (Kurz-Hash ${kurz(a)})`);
  }
}

/**
 * Prüft Commits (Ausgabe von `git log --format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e`).
 * Dokumentierte Ausnahmen werden übersprungen (nur wenn der volle Hash passt).
 */
export function pruefeCommits(rohLog, funde, ausnahmen = AUSNAHME_COMMITS) {
  let geprueft = 0;
  let uebersprungen = 0;
  for (const eintrag of String(rohLog).split('\x1e')) {
    const e = eintrag.replace(/^\n+/, '');
    if (!e.trim()) continue;
    const [hash = '', an = '', ae = '', cn = '', ce = '', ...rest] = e.split('\x1f');
    const h = hash.trim();
    if (ausnahmen.has(h)) {
      uebersprungen++;
      continue;
    }
    geprueft++;
    const ort = `Commit ${h.slice(0, 7)}`;
    for (const [feld, wert] of [
      ['Autor-Adresse', ae],
      ['Committer-Adresse', ce],
    ]) {
      if (wert.trim() && !istErlaubt(wert.trim())) {
        const art = istPrivateDomain(wert.split('@')[1] ?? '') ? 'private Mail-Domain' : 'nicht erlaubte Adresse';
        funde.push(`${ort}: ${feld}: ${art} (Kurz-Hash ${kurz(wert.trim())})`);
      }
    }
    pruefeText(`${ort} (Name/Nachricht)`, [an, cn, rest.join('\x1f')].join('\n'), funde);
  }
  return { geprueft, uebersprungen };
}
