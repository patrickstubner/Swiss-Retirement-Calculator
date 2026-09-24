/**
 * Screenshots im mobilen Viewport (360 × 780) gegen einen laufenden Dev-/Preview-Server.
 * Aufruf: node scripts/screenshots.mjs [url]
 * Browser: PLAYWRIGHT_CHROMIUM_EXECUTABLE (z.B. /usr/bin/google-chrome) oder Playwright-Chromium.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173/Swiss-Retirement-Calculator/';
const out = new URL('../screenshots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-CH',
});
const fehler = [];
page.on('pageerror', (e) => fehler.push(String(e)));
page.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
page.on('response', (r) => r.status() >= 400 && fehler.push(`${r.status()} ${r.url()}`));

await page.goto(url, { waitUntil: 'networkidle' });

/** Ganzseitige Aufnahme: fixe Leiste dafür kurz ans Seitenende verschieben. */
async function ganzeSeite(name) {
  const stil = await page.addStyleTag({ content: '.leiste{position:static!important}' });
  await page.screenshot({ path: `${out}${name}`, fullPage: true });
  await stil.evaluate((el) => el.remove());
}

/** Feld per Label ausfüllen (Standardwerte sind bewusst leer/0). */
async function fuelle(label, wert, nr = 0) {
  const feld = page.getByLabel(label, { exact: true }).nth(nr);
  await feld.fill(String(wert));
  await feld.blur();
}
const schritt = (name) => page.getByRole('button', { name }).first().click();

// 1) Start mit neutralen Standardwerten (alles leer)
await page.screenshot({ path: `${out}01-start-360.png` });
await ganzeSeite('02-personen-ganz-360.png');

// 2) Beispielwerte erfassen (nur im Skript, nicht in der App)
await fuelle('Geburtsjahr', 1968);
await schritt(/Vorsorge/);
await fuelle('Bruttolohn pro Jahr (heute)', 120000);
await page.getByRole('button', { name: /AHV-Schätzhilfe/ }).click();
await fuelle('Durchschnittliches AHV-Jahreseinkommen (heutige CHF)', 85000);
await fuelle('Fehlende Beitragsjahre (Lücken, ohne Auslandsjahre)', 2);
await page.getByText('Beitragsjahre im Ausland', { exact: true }).click();
await fuelle('Anzahl Jahre im Ausland', 3);
await page.getByRole('button', { name: 'Ins AHV-Feld übernehmen' }).click();
const ahvKarte = page.locator('.karte', { hasText: 'AHV (1. Säule)' });
await ahvKarte.scrollIntoViewIfNeeded();
await ahvKarte.screenshot({ path: `${out}08-ahv-schaetzhilfe-360.png` });
await fuelle('Altersguthaben heute', 450000);
await fuelle('Sparbeitrag pro Jahr (Arbeitnehmer + Arbeitgeber)', 20000);
await fuelle('Guthaben heute', 60000, 1); // Säule 3a (0 = Freizügigkeit)
const fzKarte = page.locator('.karte', { hasText: 'Freizügigkeitsguthaben' });
await fzKarte.scrollIntoViewIfNeeded();
await page.locator('.karte', { hasText: 'Pensionskasse (2. Säule)' }).screenshot({ path: `${out}09-pk-360.png` });

await schritt(/Vermögen/);
await fuelle('Bargeld / Konten', 40000);
await fuelle('Wertschriften (Börse)', 200000);
await fuelle('Lebenshaltungskosten pro Jahr (heute)', 75000);
await page
  .locator('.karte')
  .first()
  .screenshot({ path: `${out}10-toepfe-360.png` });
await page.getByRole('button', { name: '+ Ausgabe' }).click();
await fuelle('Betrag pro Jahr (heute)', 7200);
await page.getByRole('button', { name: '+ Ereignis hinzufügen' }).click();
await fuelle('Betrag (heute, + Zufluss / − Abfluss)', 150000);
const postenKarte = page.locator('.karte', { hasText: 'Weitere Einnahmen und Ausgaben' });
await postenKarte.scrollIntoViewIfNeeded();
await postenKarte.screenshot({ path: `${out}11-posten-360.png` });
await page.locator('.karte', { hasText: 'Einmalige Ereignisse' }).screenshot({ path: `${out}12-ereignisse-360.png` });

await schritt(/Ergebnis/);
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}03-ergebnis-360.png` });
const chartKarte = page.locator('.karte', { has: page.locator('.chart') });
await chartKarte.scrollIntoViewIfNeeded();
await chartKarte.screenshot({ path: `${out}04-chart-360.png` });

// 3) Frühe Erwerbsaufgabe mit 55 → Liquiditätslücke bis zum PK-Bezug
await schritt(/Personen/);
await fuelle('Erwerbsaufgabe (Wunsch) mit', 55);
await schritt(/Ergebnis/);
await page.waitForTimeout(600);
const wunschKarte = page.locator('.karte', { hasText: 'Mit Ihrem Wunsch-Rücktrittsalter' });
await wunschKarte.scrollIntoViewIfNeeded();
await wunschKarte.screenshot({ path: `${out}13-liquiditaetsluecke-360.png` });
await chartKarte.screenshot({ path: `${out}14-chart-gesperrt-360.png` });

// 4) Ehepaar mit brasilianischer Rente der Ehefrau
await schritt(/Personen/);
await fuelle('Erwerbsaufgabe (Wunsch) mit', 63);
await page.getByText('Ehepaar', { exact: true }).click();
await schritt(/Vorsorge/);
await page.getByText('Person 2', { exact: true }).click();
await page.getByRole('button', { name: '+ Ausländische Rente hinzufügen' }).click();
await page.waitForTimeout(200);
await fuelle('Betrag pro Zahlung', 2500);
await fuelle('Wechselkurs CHF je 1 EUR', 0.95);
const renten = page.locator('.karte', { hasText: 'Ausländische Renten' });
await renten.scrollIntoViewIfNeeded();
await renten.screenshot({ path: `${out}05-auslandrente-360.png` });
await schritt(/Vermögen/);
await page.getByText('Wohneigentum', { exact: true }).first().click();
await fuelle('Verkehrswert', 900000);
await page
  .locator('.karte')
  .first()
  .screenshot({ path: `${out}06a-vermoegen-wohneigentum-360.png` });
await page.getByLabel('Wohnkanton').selectOption('ZH');
const steuerKarte = page.locator('.karte', { hasText: 'Kantons- und Gemeindesteuern' });
await steuerKarte.scrollIntoViewIfNeeded();
await steuerKarte.screenshot({ path: `${out}06-kanton-360.png` });
await schritt(/Ergebnis/);
await page.waitForTimeout(600);
await ganzeSeite('07-ergebnis-ehepaar-ganz-360.png');

console.log('URL mit Zustand:', page.url().slice(0, 120), '…');
await browser.close();
if (fehler.length) {
  console.error('Fehler im Browser:\n', fehler.join('\n'));
  process.exit(1);
}
console.log('Screenshots in', out);
