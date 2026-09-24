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

// 1) Einzelperson mit Standardwerten
await page.screenshot({ path: `${out}01-start-360.png` });
await ganzeSeite('02-personen-ganz-360.png');
await page
  .getByRole('button', { name: /Ergebnis/ })
  .first()
  .click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}03-ergebnis-360.png` });
const chartKarte = page.locator('.karte', { has: page.locator('.chart') });
await chartKarte.scrollIntoViewIfNeeded();
await chartKarte.screenshot({ path: `${out}04-chart-360.png` });

// 2) Ehepaar mit brasilianischer Rente der Ehefrau
await page
  .getByRole('button', { name: /Personen/ })
  .first()
  .click();
await page.getByText('Ehepaar', { exact: true }).click();
await page
  .getByRole('button', { name: /Vorsorge/ })
  .first()
  .click();
await page.getByText('Person 2', { exact: true }).click();
await page.getByRole('button', { name: '+ Ausländische Rente hinzufügen' }).click();
await page.waitForTimeout(200);
const renten = page.locator('.karte', { hasText: 'Ausländische Renten' });
await renten.scrollIntoViewIfNeeded();
await renten.screenshot({ path: `${out}05-auslandrente-360.png` });
await page.getByRole('button', { name: /Vermögen/ }).first().click();
await page.getByLabel('Wohnkanton').selectOption('ZH');
const steuerKarte = page.locator('.karte', { hasText: 'Kantons- und Gemeindesteuern' });
await steuerKarte.scrollIntoViewIfNeeded();
await steuerKarte.screenshot({ path: `${out}06-kanton-360.png` });
await page
  .getByRole('button', { name: /Ergebnis/ })
  .first()
  .click();
await page.waitForTimeout(600);
await ganzeSeite('07-ergebnis-ehepaar-ganz-360.png');

console.log('URL mit Zustand:', page.url().slice(0, 120), '…');
await browser.close();
if (fehler.length) {
  console.error('Fehler im Browser:\n', fehler.join('\n'));
  process.exit(1);
}
console.log('Screenshots in', out);
