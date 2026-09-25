/**
 * Erzeugt data/qst-kapital-kantone-2026.json aus den ESTV-Tarifdateien «Quellensteuertarife für
 * übrige Einkünfte» (Record 06 = Kapitalleistungen aus Vorsorge, Codes Y9N/Z9N ohne Kirchensteuer).
 * Quelle: https://www.estv.admin.ch/de/quellensteuertarife-fuer-uebrige-einkuenfte
 * (vsl2026txt.zip, Recordformat: qst-tarife-recordformate-einkuenfte-2025-de.pdf).
 *
 * Aufruf: node scripts/qst-kapital-tarife.mjs <Verzeichnis mit vsl26xx.txt>
 *
 * Die Sätze der ESTV-Dateien gelten auf dem ganzen Bruttobetrag (satzbestimmend nach Stufe) und
 * enthalten den Bundesteil (Abgleich ZH: 6 % + Bundestarif QStV; AG: § 19 Abs. 2 QStV-AG).
 * Aufeinanderfolgende Stufen mit gleichem Satz werden zusammengefasst: [ab Fr., Satz in Basispunkten].
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KANTONE = ['AG', 'BL', 'GE', 'JU', 'NE', 'SO', 'VS', 'VD'];
const dir = process.argv[2];
if (!dir) {
  console.error('Verzeichnis mit den ESTV-Dateien vsl26xx.txt angeben');
  process.exit(1);
}
const out = {
  quelle: 'https://www.estv.admin.ch/de/quellensteuertarife-fuer-uebrige-einkuenfte',
  datei: 'vsl2026txt.zip (Record 06, Y9N/Z9N)',
  stand: 'Tarife gültig ab 1.1.2026, ESTV-Dateien vom 20.11.–19.12.2025, abgerufen 25.09.2026',
  hinweis:
    'Stufen [ab Fr., Satz in Basispunkten] auf dem ganzen Bruttobetrag, inkl. direkte Bundessteuer (Tarif-Gesamtsatz).',
  kantone: {},
};
for (const k of KANTONE) {
  const text = readFileSync(join(dir, `vsl26${k.toLowerCase()}.txt`), 'latin1');
  const tarife = { alleinstehend: [], verheiratet: [] };
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('06')) continue;
    const code = line.slice(6, 16).trim();
    const ziel = code === 'Y9N' ? tarife.alleinstehend : code === 'Z9N' ? tarife.verheiratet : null;
    if (!ziel) continue;
    const ab = Math.round(Number(line.slice(24, 33)) / 100);
    const bp = Number(line.slice(54, 59)) / 1;
    const satzBp = Math.round(bp); // Satz in 1/100 % = Basispunkte
    if (ziel.length > 0 && ziel[ziel.length - 1][1] === satzBp) continue;
    ziel.push([ab <= 1 ? 0 : ab, satzBp]);
  }
  out.kantone[k] = tarife;
}
writeFileSync('data/qst-kapital-kantone-2026.json', `${JSON.stringify(out)}\n`);
console.log('geschrieben: data/qst-kapital-kantone-2026.json');
