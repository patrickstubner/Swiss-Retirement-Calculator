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
  const feld = page
    .getByLabel(label, { exact: true })
    .or(page.getByLabel(`${label} geschätzt`, { exact: true }))
    .nth(nr);
  await feld.fill(String(wert));
  await feld.blur();
}
const schritt = (name) => page.getByRole('button', { name }).first().click();

// 1) Start mit neutralen Standardwerten (alles leer, Modus «Schnell»); danach Detailansicht
await page.screenshot({ path: `${out}01-start-360.png` });
await page.getByText('Detailliert', { exact: true }).click();
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
const steuerKarte = page.locator('.karte', { hasText: 'Kantons- und Gemeindesteuern' });
await page.getByLabel('Wohnkanton').selectOption('BE');
await steuerKarte.scrollIntoViewIfNeeded();
await steuerKarte.screenshot({ path: `${out}06b-kanton-naeherung-360.png` });
await page.getByLabel('Wohnkanton').selectOption('ZH');
await page.getByLabel('Gemeinde', { exact: true }).selectOption('Winterthur');
await page.getByLabel('Kirchensteuer').selectOption('reformiert');
await steuerKarte.scrollIntoViewIfNeeded();
await steuerKarte.screenshot({ path: `${out}06-kanton-360.png` });
await schritt(/Ergebnis/);
await page.waitForTimeout(600);
await ganzeSeite('07-ergebnis-ehepaar-ganz-360.png');

// 5) Neue Teile (frische Seite): Speicherleiste, Rücktritt per Datum, AHV/PK-Bezugsalter, Wohnsitz im Ausland
const ctx2 = await browser.newContext({
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-CH',
});
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => fehler.push(String(e)));
p2.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
await p2.goto(url, { waitUntil: 'networkidle' });
await p2.getByText('Detailliert', { exact: true }).click();
const fuelle2 = async (label, wert, nr = 0) => {
  const feld = p2
    .getByLabel(label, { exact: true })
    .or(p2.getByLabel(`${label} geschätzt`, { exact: true }))
    .nth(nr);
  await feld.fill(String(wert));
  await feld.blur();
};
const schritt2 = (name) => p2.getByRole('button', { name }).first().click();
await p2.locator('.speicherleiste').screenshot({ path: `${out}15-speicherleiste-an-360.png` });

const karteP1 = p2.locator('.karte').nth(1);
await karteP1.getByText('Frau', { exact: true }).click();
await fuelle2('Geburtsjahr', 1969);
await p2.getByLabel('Geburtsmonat').selectOption('1');
await karteP1.getByText('Datum', { exact: true }).first().click();
await p2.getByLabel('Erwerbsaufgabe per Ende (Monat)').selectOption('11');
await fuelle2('Jahr', 2027);
await karteP1.screenshot({ path: `${out}16-ruecktritt-datum-360.png` });

// Wohnsitz im Ausland: Thailand mit freiwilliger AHV
await karteP1.getByText('Wohnsitz im Ausland (Wegzug)').click();
await karteP1.getByText('Wegzug aus der Schweiz geplant').click();
await fuelle2('Wegzug mit', 59);
await p2.getByLabel('Land', { exact: true }).selectOption('TH');
await karteP1.getByRole('checkbox', { name: /^Freiwillige AHV\/IV/ }).check();
await karteP1.locator('.wegzug').screenshot({ path: `${out}17-wohnsitz-ausland-freiwillige-ahv-360.png` });
await p2.getByLabel('Land', { exact: true }).selectOption('PT');
await karteP1.locator('.wegzug').screenshot({ path: `${out}18-wohnsitz-eu-nicht-moeglich-360.png` });
await p2.getByLabel('Land', { exact: true }).selectOption('TH');

// AHV: frühester Bezug abgeleitet; PK-Feld klar getrennt (mit Warnung bei 62)
await schritt2(/Vorsorge/);
await fuelle2('Bruttolohn pro Jahr (heute)', 90000);
await fuelle2('Erwartete AHV-Rente pro Monat', 2300);
const ahv2 = p2.locator('.karte', { hasText: 'AHV (1. Säule)' });
await ahv2.scrollIntoViewIfNeeded();
await ahv2.screenshot({ path: `${out}19-ahv-fruehester-bezug-360.png` });
await fuelle2('Altersguthaben heute', 500000);
await fuelle2('Pensionskasse: frühester Bezug laut Reglement (58–70)', 62);
await p2
  .locator('.karte', { hasText: 'Pensionskasse (2. Säule)' })
  .screenshot({ path: `${out}20-pk-reglement-360.png` });
await fuelle2('Pensionskasse: frühester Bezug laut Reglement (58–70)', 60);

await schritt2(/Vermögen/);
// Live-Tausendertrennzeichen: Ziffern einzeln tippen, dann in der Mitte eine Ziffer einfügen und löschen
const wert = p2.getByLabel('Wertschriften (Börse)', { exact: true });
await wert.click();
await wert.pressSequentially('1250000');
const nachTippen = await wert.evaluate((el) => [el.value, el.selectionStart]);
await p2
  .locator('.karte')
  .first()
  .screenshot({ path: `${out}23-tausendertrennzeichen-live-360.png` });
await wert.evaluate((el) => el.setSelectionRange(2, 2)); // «1’|250’000»
await p2.keyboard.type('9');
const nachEinfuegen = await wert.evaluate((el) => [el.value, el.selectionStart]);
await p2.keyboard.press('Backspace');
const nachLoeschen = await wert.evaluate((el) => [el.value, el.selectionStart]);
console.log('Live-Format:', JSON.stringify({ nachTippen, nachEinfuegen, nachLoeschen }));
await wert.fill('');
await wert.pressSequentially('900000');
await wert.blur();
await fuelle2('Lebenshaltungskosten pro Jahr (heute)', 50000);
await schritt2(/Ergebnis/);
await p2.waitForTimeout(600);
const renten2 = p2.locator('.karte', { hasText: 'Renten und Kapital' });
await renten2.scrollIntoViewIfNeeded();
await renten2.screenshot({ path: `${out}21-ergebnis-wegzug-360.png` });

// Speichern ausschalten → Hinweis, nichts mehr gespeichert
await p2.getByLabel('Eingaben im Browser speichern').uncheck();
const reste = await p2.evaluate(() => Object.keys(localStorage));
console.log('localStorage nach Ausschalten:', reste);
await p2.locator('.speicherleiste').screenshot({ path: `${out}22-speicherleiste-aus-360.png` });
await ctx2.close();

// 6) Modus «Schnell»: wenige Eingaben, Schätzwerte, Genauigkeit, Moduswechsel ohne Datenverlust
const ctx3 = await browser.newContext({
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-CH',
});
const p3 = await ctx3.newPage();
p3.on('pageerror', (e) => fehler.push(String(e)));
p3.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
await p3.goto(url, { waitUntil: 'networkidle' });
const fuelle3 = async (label, wert, nr = 0) => {
  const feld = p3
    .getByLabel(label, { exact: true })
    .or(p3.getByLabel(`${label} geschätzt`, { exact: true }))
    .nth(nr);
  await feld.fill(String(wert));
  await feld.blur();
};
await p3.locator('.moduswahl').screenshot({ path: `${out}24-moduswahl-360.png` });
// Ehepaar: Ehemann seit Geburt in der Schweiz, Ehefrau 2008 aus Brasilien zugezogen
await p3.getByText('Ehepaar', { exact: true }).click();
await fuelle3('Geburtsjahr', 1968, 0);
await fuelle3('Bruttoeinkommen pro Jahr (heute)', 110000, 0);
await fuelle3('Erwerbsaufgabe (Wunsch) mit', 63, 0);
await fuelle3('PK-Altersguthaben heute (optional)', 420000, 0);
await fuelle3('Säule 3a heute (optional)', 80000, 0);
await fuelle3('Übriges Vermögen: Konten und Wertschriften', 250000, 0);
const karteP2 = p3.locator('.karte', { hasText: 'Person 2' }).first();
await karteP2.getByText('Frau', { exact: true }).click();
await fuelle3('Geburtsjahr', 1978, 1);
await fuelle3('In der Schweiz seit (Jahr, optional)', 2008, 1);
await fuelle3('Bruttoeinkommen pro Jahr (heute)', 45000, 1);
await fuelle3('Erwerbsaufgabe (Wunsch) mit', 60, 1);
await fuelle3('Ausgaben pro Jahr (heute)', 80000);
await p3.getByLabel('Wohnkanton').selectOption('ZH');
await p3.getByLabel('Gemeinde', { exact: true }).selectOption('Winterthur');
await karteP2.scrollIntoViewIfNeeded();
await karteP2.screenshot({ path: `${out}25-schnell-person-zuzug-360.png` });
/** PK-Bereich von Person 1 im Modus «Schnell» (PK-Guthaben bis vor Säule 3a). */
async function pkBereich(name) {
  const karte = p3.locator('.karte', { hasText: 'Person 1' }).first();
  const von = karte.locator('.feld', { hasText: 'PK-Altersguthaben heute (optional)' }).first();
  const bis = karte.locator('.feld', { hasText: 'Säule 3a heute (optional)' }).first();
  await von.evaluate((el) => {
    el.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -12);
  });
  const a = await von.boundingBox();
  const b = await bis.boundingBox();
  if (!a || !b) throw new Error('PK-Bereich nicht gefunden');
  await p3.screenshot({ path: `${out}${name}`, clip: { x: 0, y: a.y - 10, width: 360, height: b.y - a.y + 2 } });
}
await pkBereich('31-schnell-pk-umwandlungssatz-geschaetzt-360.png');
const stil3 = await p3.addStyleTag({ content: '.leiste{position:static!important}' });
await p3.screenshot({ path: `${out}26-schnell-eingaben-ganz-360.png`, fullPage: true });
await stil3.evaluate((el) => el.remove());
await p3
  .getByRole('button', { name: /Ergebnis/ })
  .first()
  .click();
await p3.waitForTimeout(1200);
const genau = p3.locator('.karte', { hasText: 'Wo sich Genauigkeit lohnt' });
await genau.scrollIntoViewIfNeeded();
await genau.screenshot({ path: `${out}27-ergebnis-genauigkeit-360.png` });
// Detailliert: Schätzwerte mit Badge, eigene Eingabe mit «Zurücksetzen auf Schätzung»
await p3.getByText('Detailliert', { exact: true }).click();
await p3
  .getByRole('button', { name: /Vorsorge/ })
  .first()
  .click();
const pk3 = p3.locator('.karte', { hasText: 'Pensionskasse (2. Säule)' }).first();
await pk3.scrollIntoViewIfNeeded();
await pk3.screenshot({ path: `${out}28-detail-geschaetzt-badge-360.png` });
await fuelle3('Umwandlungssatz', 5.4);
await fuelle3('Sparbeitrag pro Jahr (Arbeitnehmer + Arbeitgeber)', 18000);
await pk3.screenshot({ path: `${out}29-detail-zuruecksetzen-360.png` });
// zurück zu «Schnell»: Hinweis auf gesetzte Detailwerte, Eingaben unverändert
await p3.getByText('Schnell', { exact: true }).click();
await p3
  .getByRole('button', { name: /Eingaben/ })
  .first()
  .click();
await p3
  .locator('p.info[role="status"]')
  .first()
  .evaluate((el) => el.scrollIntoView({ block: 'center' }));
await p3.screenshot({ path: `${out}30-schnell-detailwerte-hinweis-360.png` });
const behalten = await p3.getByLabel('PK-Altersguthaben heute (optional)', { exact: true }).first().inputValue();
const uws = await p3
  .getByLabel('Umwandlungssatz laut Vorsorgeausweis (optional)', { exact: true })
  .first()
  .inputValue();
console.log('Nach Moduswechsel PK-Guthaben:', behalten, 'Umwandlungssatz (im Detail eingegeben):', uws);
await pkBereich('32-schnell-pk-umwandlungssatz-eingegeben-360.png');
await ctx3.close();

// 7) Erststart (ohne gespeicherten Zustand): Modus «Schnell» aktiv, Umwandlungssatz leer →
//    aufgeteilte Schätzung (6,8% auf den obligatorischen Teil, Durchschnitt OAK BV auf den Rest)
const ctx4 = await browser.newContext({
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-CH',
});
const p4 = await ctx4.newPage();
p4.on('pageerror', (e) => fehler.push(String(e)));
p4.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
await p4.goto(url, { waitUntil: 'networkidle' });
const schnellAktiv = await p4.locator('.moduswahl .segment--aktiv').allInnerTexts();
if (schnellAktiv.join('').trim() !== 'Schnell') fehler.push(`Erststart nicht im Modus «Schnell»: ${schnellAktiv}`);
console.log('Erststart, aktiver Modus:', schnellAktiv.join(' ') || '(nicht erkannt)');
const fuelle4 = async (label, wert, nr = 0) => {
  const feld = p4
    .getByLabel(label, { exact: true })
    .or(p4.getByLabel(`${label} geschätzt`, { exact: true }))
    .nth(nr);
  await feld.fill(String(wert));
  await feld.blur();
};
await fuelle4('Geburtsjahr', 1972);
await fuelle4('Bruttoeinkommen pro Jahr (heute)', 150000);
await fuelle4('PK-Altersguthaben heute (optional)', 650000);
await p4.evaluate(() => window.scrollTo(0, 0));
await p4.screenshot({ path: `${out}33-erststart-schnell-360.png` });
{
  const karte = p4.locator('.karte', { hasText: 'Person 1' }).first();
  const von = karte.locator('.feld', { hasText: 'PK-Altersguthaben heute (optional)' }).first();
  const bis = karte.locator('.feld', { hasText: 'Säule 3a heute (optional)' }).first();
  await von.evaluate((el) => {
    el.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -12);
  });
  const a = await von.boundingBox();
  const b = await bis.boundingBox();
  if (!a || !b) throw new Error('PK-Bereich nicht gefunden');
  await p4.screenshot({
    path: `${out}34-erststart-uws-aufgeteilt-360.png`,
    clip: { x: 0, y: a.y - 10, width: 360, height: b.y - a.y + 2 },
  });
  const text = await karte.locator('.uws-schaetzung').first().innerText();
  console.log('Erststart, Schätzung Umwandlungssatz:', text);
}
await ctx4.close();

await browser.close();
if (fehler.length) {
  console.error('Fehler im Browser:\n', fehler.join('\n'));
  process.exit(1);
}
console.log('Screenshots in', out);
