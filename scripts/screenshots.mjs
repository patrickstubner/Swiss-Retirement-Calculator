/**
 * Screenshots im mobilen Viewport (360 × 780) gegen einen laufenden Dev-/Preview-Server.
 * Aufruf: node scripts/screenshots.mjs [url]
 * Browser: PLAYWRIGHT_CHROMIUM_EXECUTABLE (z.B. /usr/bin/google-chrome) oder Playwright-Chromium.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// bypassCSP: nur in diesem Test-Skript (für addStyleTag); die App selbst behält die strenge CSP.
const url = process.argv[2] ?? 'http://localhost:4173/Swiss-Retirement-Calculator/';
const out = process.env.SCREENSHOT_DIR
  ? `${process.env.SCREENSHOT_DIR.replace(/\/$/, '')}/`
  : new URL('../screenshots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  bypassCSP: true,
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
const chartKarte = page
  .locator('.karte', { hasText: 'Vermögensverlauf' })
  .filter({ has: page.locator('.chart') })
  .filter({ hasNotText: 'Was wäre' });
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

// 4) Erfundenes Ehepaar mit ausländischer Rente von Person 2
await schritt(/Personen/);
await fuelle('Erwerbsaufgabe (Wunsch) mit', 63);
await page.getByText('Ehepaar', { exact: true }).click();
await schritt(/Vorsorge/);
await page.getByText('Person 2', { exact: true }).click();
await page.getByRole('button', { name: '+ Ausländische Rente hinzufügen' }).click();
await page.waitForTimeout(200);
await fuelle('Betrag pro Zahlung (heute)', 2500);
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
  bypassCSP: true,
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
await fuelle2('Geburtsjahr', 1971);
await p2.getByLabel('Geburtsmonat').selectOption('1');
await karteP1.getByText('Datum', { exact: true }).first().click();
await p2.getByLabel('Erwerbsaufgabe per Ende (Monat)').selectOption('11');
await fuelle2('Jahr', 2027);
await karteP1.screenshot({ path: `${out}16-ruecktritt-datum-360.png` });

// Wohnsitz im Ausland: Thailand mit freiwilliger AHV
await karteP1.getByText('Wohnsitz im Ausland (Wegzug)').click();
await karteP1.getByRole('checkbox', { name: /^Endgültiger Wegzug aus der Schweiz geplant/ }).check();
// Der Wegzug übernimmt beim Einschalten den Rücktritts-Modus (hier «Datum»); für das Beispiel auf «Alter» umstellen.
await karteP1
  .locator('fieldset', { hasText: 'Wohnsitz im Ausland ab' })
  .locator('label.segment', { hasText: 'Alter' })
  .click();
await fuelle2('Wegzug mit', 59);
await p2.getByLabel('Zielland', { exact: true }).selectOption('TH');
await karteP1.getByRole('checkbox', { name: /^Freiwillige AHV\/IV/ }).check();
await karteP1.locator('.wegzug').screenshot({ path: `${out}17-wohnsitz-ausland-freiwillige-ahv-360.png` });
await p2.getByLabel('Zielland', { exact: true }).selectOption('PT');
await karteP1.locator('.wegzug').screenshot({ path: `${out}18-wohnsitz-eu-nicht-moeglich-360.png` });
await p2.getByLabel('Zielland', { exact: true }).selectOption('TH');

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
  bypassCSP: true,
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
// Erfundenes Ehepaar: Person 1 seit Geburt in der Schweiz, Person 2 (Beispielperson B) seit 2014 in der Schweiz
await p3.getByText('Ehepaar', { exact: true }).click();
await fuelle3('Geburtsjahr', 1980, 0);
await fuelle3('Bruttoeinkommen pro Jahr (heute)', 110000, 0);
await fuelle3('Erwerbsaufgabe (Wunsch) mit', 63, 0);
await fuelle3('PK-Altersguthaben heute (optional)', 420000, 0);
await fuelle3('Säule 3a heute (optional)', 80000, 0);
await fuelle3('Übriges Vermögen: Konten und Wertschriften', 250000, 0);
const karteP2 = p3.locator('.karte', { hasText: 'Person 2' }).first();
await karteP2.getByText('Frau', { exact: true }).click();
await fuelle3('Geburtsjahr', 1985, 1);
await fuelle3('In der Schweiz seit (Jahr, optional)', 2014, 1);
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
  bypassCSP: true,
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
await fuelle4('Geburtsjahr', 1974);
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

// 8) PK-Guthaben ohne Lohn: kein obligatorischer Teil → Durchschnittssatz auf das ganze Guthaben
const ctx5 = await browser.newContext({
  bypassCSP: true,
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-CH',
});
const p5 = await ctx5.newPage();
p5.on('pageerror', (e) => fehler.push(String(e)));
p5.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
await p5.goto(url, { waitUntil: 'networkidle' });
{
  const feld = p5
    .getByLabel('PK-Altersguthaben heute (optional)', { exact: true })
    .or(p5.getByLabel('PK-Altersguthaben heute (optional) geschätzt', { exact: true }))
    .first();
  await feld.fill('650000');
  await feld.blur();
  const karte = p5.locator('.karte', { hasText: 'Person 1' }).first();
  const von = karte.locator('.feld', { hasText: 'PK-Altersguthaben heute (optional)' }).first();
  const bis = karte.locator('.feld', { hasText: 'Säule 3a heute (optional)' }).first();
  await von.evaluate((el) => {
    el.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -12);
  });
  const a = await von.boundingBox();
  const b = await bis.boundingBox();
  if (!a || !b) throw new Error('PK-Bereich nicht gefunden');
  await p5.screenshot({
    path: `${out}35-uws-ohne-obligatorium-kein-lohn-360.png`,
    clip: { x: 0, y: a.y - 10, width: 360, height: b.y - a.y + 2 },
  });
  const text = await karte.locator('.uws-schaetzung').first().innerText();
  console.log('Ohne Lohn, Schätzung Umwandlungssatz:', text);
  if (/ca\. 0%/.test(text)) fehler.push(`Text enthält «ca. 0%»: ${text}`);
  await p5
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await p5.waitForTimeout(800);
  const genauKarte = p5.locator('.karte', { hasText: 'Welche Werte geschätzt sind' }).first();
  const zeile = genauKarte.locator('li', { hasText: 'PK-Umwandlungssatz' }).first();
  const zText = await zeile.innerText();
  console.log('Ohne Lohn, Karte «Genauigkeit»:', zText);
  if (/ca\. 0%/.test(zText)) fehler.push(`Genauigkeit enthält «ca. 0%»: ${zText}`);
  await genauKarte.scrollIntoViewIfNeeded();
  await genauKarte.screenshot({ path: `${out}36-genauigkeit-ohne-obligatorium-360.png` });
}
await ctx5.close();

// 9) Wegzug mit Barauszahlung: Schnellmodus, Karte vor der Pensionskasse, EU/EFTA, Ergebnis
const ctx6 = await browser.newContext({
  bypassCSP: true,
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-CH',
});
const p6 = await ctx6.newPage();
p6.on('pageerror', (e) => fehler.push(String(e)));
p6.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
await p6.goto(url, { waitUntil: 'networkidle' });
{
  const fuelle6 = async (label, wert, nr = 0) => {
    const feld = p6
      .getByLabel(label, { exact: true })
      .or(p6.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  // Erfundene Beispielperson: Jg. 1981, Wegzug mit 50 nach Thailand
  await fuelle6('Geburtsjahr', 1981);
  await fuelle6('Bruttoeinkommen pro Jahr (heute)', 95000);
  await fuelle6('PK-Altersguthaben heute (optional)', 280000);
  await fuelle6('Säule 3a heute (optional)', 40000);
  await fuelle6('Übriges Vermögen: Konten und Wertschriften', 150000);
  await fuelle6('Ausgaben pro Jahr (heute)', 60000);
  await p6.getByLabel('Wohnkanton').selectOption('ZH');
  const person = p6.locator('.karte', { hasText: 'Person 1' }).first();
  await person.getByRole('checkbox', { name: /^Endgültiger Wegzug aus der Schweiz geplant/ }).check();
  await fuelle6('Wegzug mit', 50);
  await p6.getByLabel('Zielland', { exact: true }).selectOption('TH');
  await p6.waitForTimeout(500);
  const wz = person.locator('.wegzug');
  await wz.scrollIntoViewIfNeeded();
  await wz.screenshot({ path: `${out}37-schnell-wegzug-barauszahlung-360.png` });
  const schnellText = await wz.innerText();
  if (!/Barauszahlung ab/.test(schnellText)) fehler.push(`Schnellmodus: keine Barauszahlung angezeigt: ${schnellText}`);

  // Detail: Karte «Wegzug ins Ausland» steht vor der Pensionskasse (fixe Leiste für Kartenaufnahmen ausblenden)
  await p6.addStyleTag({ content: '.leiste{display:none!important}' });
  await p6.getByText('Detailliert', { exact: true }).click();
  await p6
    .getByRole('button', { name: /Vorsorge/ })
    .first()
    .click();
  await p6.getByLabel('Sitzkanton der Pensionskasse').selectOption('SZ');
  await p6.waitForTimeout(400);
  const karten = await p6.locator('.karte h2, .karte h3, .karte .karte__titel').allInnerTexts();
  const iW = karten.findIndex((t) => t.includes('Wegzug ins Ausland'));
  const iP = karten.findIndex((t) => t.includes('Pensionskasse (2. Säule)'));
  console.log('Reihenfolge Karten:', JSON.stringify({ iW, iP }));
  if (!(iW >= 0 && iP > iW)) fehler.push('Wegzug-Karte steht nicht vor der Pensionskasse');
  const wegKarte = p6.locator('.karte', { hasText: 'Wegzug ins Ausland' }).first();
  await wegKarte.scrollIntoViewIfNeeded();
  await wegKarte.screenshot({ path: `${out}38-detail-wegzug-vor-pk-360.png` });
  const pkKarte = p6.locator('.karte', { hasText: 'Pensionskasse (2. Säule)' }).first();
  await pkKarte.scrollIntoViewIfNeeded();
  await pkKarte.screenshot({ path: `${out}39-pk-reglement-hinweis-wegzug-360.png` });

  // EU/EFTA: nur Überobligatorium
  await fuelle6('Davon BVG-Altersguthaben (Obligatorium, optional)', 110000);
  await p6.getByLabel('Zielland', { exact: true }).selectOption('PT');
  await p6.waitForTimeout(400);
  await wegKarte.scrollIntoViewIfNeeded();
  await wegKarte.screenshot({ path: `${out}40-wegzug-eu-nur-ueberobligatorium-360.png` });
  const euText = await wegKarte.innerText();
  if (!/bleibt gesperrt/.test(euText)) fehler.push(`EU/EFTA: gesperrter Teil fehlt: ${euText}`);
  await p6.getByLabel('Zielland', { exact: true }).selectOption('TH');

  await p6
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await p6.waitForTimeout(800);
  const renten = p6.locator('.karte', { hasText: 'Renten und Kapital' }).first();
  await renten.scrollIntoViewIfNeeded();
  await renten.screenshot({ path: `${out}41-ergebnis-barauszahlung-quellensteuer-360.png` });
}
await ctx6.close();

// 10) Ausgaben in Phasen und Einzeljahre (heutige Franken, Hochrechnung mit Teuerung)
const ctx7 = await browser.newContext({
  bypassCSP: true,
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-CH',
});
const p7 = await ctx7.newPage();
p7.on('pageerror', (e) => fehler.push(String(e)));
p7.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
await p7.goto(url, { waitUntil: 'networkidle' });
{
  const fuelle7 = async (label, wert, nr = 0) => {
    const feld = p7.getByLabel(label, { exact: true }).nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  await p7.getByText('Detailliert', { exact: true }).click();
  await p7.addStyleTag({ content: '.leiste{display:none!important}' });
  await fuelle7('Geburtsjahr', 1964);
  await p7
    .getByRole('button', { name: /Vermögen/ })
    .first()
    .click();
  await fuelle7('Wertschriften (Börse)', 900000);
  await fuelle7('Lebenshaltungskosten pro Jahr (heute)', 60000);
  const karte = p7.locator('.karte', { hasText: 'Phasen (optional)' }).first();
  await karte.getByRole('button', { name: '+ Phase hinzufügen' }).click();
  await fuelle7('Betrag (heute)', 85000, 0);
  await karte.getByRole('button', { name: '+ Phase hinzufügen' }).click();
  await fuelle7('Betrag (heute)', 4500, 1);
  await p7.getByLabel('Einheit', { exact: true }).nth(1).selectOption('monat');
  await fuelle7('Bis Jahr (inkl.)', '', 1);
  await karte.getByRole('button', { name: '+ Einzeljahr hinzufügen' }).click();
  await fuelle7('Kalenderjahr', 2034);
  await fuelle7('Betrag (heute)', 110000, 2);
  await p7.waitForTimeout(400);
  await karte.scrollIntoViewIfNeeded();
  await karte.screenshot({ path: `${out}42-ausgaben-phasen-360.png` });
  const hinweis = await karte.locator('.heutige-franken').innerText();
  console.log('Hinweis heutige Franken:', hinweis);
  if (!/heutigen Franken/.test(hinweis) || !/entsprechen/.test(hinweis)) fehler.push(`Hinweis fehlt: ${hinweis}`);
  const vorschau = karte.locator('.ausgaben-vorschau');
  await vorschau.locator('summary').click();
  await vorschau.scrollIntoViewIfNeeded();
  await vorschau.screenshot({ path: `${out}43-ausgaben-vorschau-pro-jahr-360.png` });
  // Schnellmodus: Hinweis, dass Phasen erfasst sind
  await p7.getByText('Schnell', { exact: true }).click();
  const schnellKarte = p7.locator('.karte', { hasText: 'Ausgaben und Wohnort' }).first();
  await schnellKarte.scrollIntoViewIfNeeded();
  await schnellKarte.screenshot({ path: `${out}44-schnell-ausgaben-phasen-hinweis-360.png` });
}
await ctx7.close();

// 11) Steuern nach dem Wegzug (Zielland), Liechtenstein
const ctx8 = await browser.newContext({
  bypassCSP: true,
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-CH',
});
const p8 = await ctx8.newPage();
p8.on('pageerror', (e) => fehler.push(String(e)));
p8.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
await p8.goto(url, { waitUntil: 'networkidle' });
{
  const fuelle8 = async (label, wert, nr = 0) => {
    const feld = p8
      .getByLabel(label, { exact: true })
      .or(p8.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  // Erfundene Beispielperson: Jg. 1966, Wegzug mit 65 nach Italien
  await fuelle8('Geburtsjahr', 1966);
  await fuelle8('Bruttoeinkommen pro Jahr (heute)', 110000);
  await fuelle8('PK-Altersguthaben heute (optional)', 520000);
  await fuelle8('Säule 3a heute (optional)', 90000);
  await fuelle8('Übriges Vermögen: Konten und Wertschriften', 300000);
  await fuelle8('Ausgaben pro Jahr (heute)', 55000);
  await p8.getByLabel('Wohnkanton').selectOption('AG');
  const person = p8.locator('.karte', { hasText: 'Person 1' }).first();
  await person.getByRole('checkbox', { name: /^Endgültiger Wegzug aus der Schweiz geplant/ }).check();
  await fuelle8('Wegzug mit', 65);
  await p8.getByLabel('Zielland', { exact: true }).selectOption('IT');
  await p8.waitForTimeout(500);
  const zs = person.locator('.zielland-steuern');
  await zs.scrollIntoViewIfNeeded();
  await zs.screenshot({ path: `${out}45-schnell-steuern-zielland-it-360.png` });
  const zsText = await zs.innerText();
  if (!/Steuern nach dem Wegzug/.test(zsText)) fehler.push(`Zielland-Steuern fehlen: ${zsText}`);

  await p8.addStyleTag({ content: '.leiste{display:none!important}' });
  await p8.getByText('Detailliert', { exact: true }).click();
  await p8
    .getByRole('button', { name: /Vorsorge/ })
    .first()
    .click();
  await p8.waitForTimeout(400);
  const wegKarte = p8.locator('.karte', { hasText: 'Wegzug ins Ausland' }).first();
  const zd = wegKarte.locator('.zielland-steuern');
  await zd.getByLabel('Besonderes Steuerregime').selectOption({ index: 1 });
  await zd.locator('details summary').click();
  await p8.waitForTimeout(300);
  await zd.scrollIntoViewIfNeeded();
  await zd.screenshot({ path: `${out}46-detail-steuern-zielland-it-regime-360.png` });

  await p8.getByLabel('Zielland', { exact: true }).selectOption('PT');
  await p8.waitForTimeout(300);
  await zd.getByRole('checkbox', { name: /^Quellensteuer auf Vorsorgekapital zurückfordern/ }).check();
  await p8.waitForTimeout(300);
  await zd.scrollIntoViewIfNeeded();
  await zd.screenshot({ path: `${out}47-detail-steuern-zielland-pt-rueckforderung-360.png` });

  await fuelle8('Davon BVG-Altersguthaben (Obligatorium, optional)', 200000);
  await p8.getByLabel('Zielland', { exact: true }).selectOption('LI');
  await p8.waitForTimeout(400);
  await wegKarte.scrollIntoViewIfNeeded();
  await wegKarte.screenshot({ path: `${out}48-wegzug-liechtenstein-obligatorium-gesperrt-360.png` });
  const liText = await wegKarte.innerText();
  if (!/Art\. 25f Abs\. 1 lit\. c/.test(liText)) fehler.push(`LI-Hinweis fehlt: ${liText}`);
}
await ctx8.close();

// 12) Nicht erwerbstätige Person (z.B. Familienarbeit)
const ctx9 = await browser.newContext({
  bypassCSP: true,
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-CH',
});
const p9 = await ctx9.newPage();
p9.on('pageerror', (e) => fehler.push(String(e)));
p9.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
await p9.goto(url, { waitUntil: 'networkidle' });
{
  const fuelle9 = async (label, wert, nr = 0) => {
    const feld = p9
      .getByLabel(label, { exact: true })
      .or(p9.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  // Erfundenes Ehepaar: Person 1 Jg. 1980 erwerbstätig; Person 2 (Beispielperson B) Jg. 1985 nicht erwerbstätig
  await p9.getByText('Ehepaar', { exact: true }).click();
  await fuelle9('Geburtsjahr', 1980, 0);
  await fuelle9('Bruttoeinkommen pro Jahr (heute)', 98000);
  await fuelle9('Geburtsjahr', 1985, 1);
  const p2 = p9.locator('.karte', { hasText: 'Person 2' }).first();
  await p2.getByText('Nicht erwerbstätig (z.B. Familienarbeit)', { exact: true }).click();
  await p9.waitForTimeout(400);
  await p2.scrollIntoViewIfNeeded();
  await p2.screenshot({ path: `${out}49-schnell-nicht-erwerbstaetig-360.png` });
  const t2 = await p2.innerText();
  if (!/gelten als bezahlt/.test(t2)) fehler.push(`Nicht erwerbstätig: Befreiung fehlt: ${t2}`);
  if (/Bruttoeinkommen pro Jahr/.test(t2)) fehler.push('Nicht erwerbstätig: Lohnfeld nicht ausgeblendet');
  await p2.locator('details.aufklapp summary', { hasText: 'Frühere Erwerbstätigkeit' }).click();
  await fuelle9('Frühere Erwerbsjahre in der Schweiz', 5);
  await fuelle9('Durchschnittslohn damals (heute)', 58000);
  await fuelle9('Freizügigkeitsguthaben (optional)', 21000);
  await fuelle9('Jahre mit Kind unter 16', 7);
  await p9.waitForTimeout(400);
  const det = p2.locator('.nicht-erwerb');
  await det.scrollIntoViewIfNeeded();
  await det.screenshot({ path: `${out}50-schnell-nicht-erwerbstaetig-frueherer-erwerb-kinder-360.png` });
  // Partner mit tiefem Lohn: keine Befreiung
  await fuelle9('Bruttoeinkommen pro Jahr (heute)', 8000);
  await p9.waitForTimeout(400);
  const box = p2.locator('.ahv-annahmen');
  await box.scrollIntoViewIfNeeded();
  await box.screenshot({ path: `${out}51-nicht-erwerbstaetig-ohne-befreiung-hinweis-360.png` });
  const tb = await box.innerText();
  if (!/eigene AHV-Beiträge/.test(tb)) fehler.push(`Nicht erwerbstätig: Hinweis eigene Beiträge fehlt: ${tb}`);
  await fuelle9('Bruttoeinkommen pro Jahr (heute)', 98000);
  // Detailmodus: Vorsorge von Person 2
  await p9.addStyleTag({ content: '.leiste{display:none!important}' });
  await p9.getByText('Detailliert', { exact: true }).click();
  await p9
    .getByRole('button', { name: /Vorsorge/ })
    .first()
    .click();
  await p9.locator('.personenwahl').getByText('Person 2', { exact: true }).click();
  await p9.waitForTimeout(400);
  const neKarte = p9.locator('.karte', { hasText: 'Nicht erwerbstätig' }).first();
  await neKarte.scrollIntoViewIfNeeded();
  await neKarte.screenshot({ path: `${out}52-detail-nicht-erwerbstaetig-vorsorge-360.png` });
  if (await p9.locator('.karte', { hasText: 'Pensionskasse (2. Säule)' }).first().isVisible())
    fehler.push('Nicht erwerbstätig: PK-Karte im Detailmodus sichtbar');
}
await ctx9.close();

// 13) Krisenszenarien und Monte Carlo (PR D)
const ctx10 = await browser.newContext({
  bypassCSP: true,
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-CH',
});
const p10 = await ctx10.newPage();
p10.on('pageerror', (e) => fehler.push(String(e)));
p10.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
await p10.goto(url, { waitUntil: 'networkidle' });
{
  const fuelle10 = async (label, wert, nr = 0) => {
    const feld = p10
      .getByLabel(label, { exact: true })
      .or(p10.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  // Erfundenes Beispiel: Person Jg. 1963, Lohn 110'000, 700'000 Wertschriften, Ausgaben 72'000
  await fuelle10('Geburtsjahr', 1963);
  await fuelle10('Bruttoeinkommen pro Jahr (heute)', 110000);
  await fuelle10('Übriges Vermögen: Konten und Wertschriften', 700000);
  await fuelle10('Ausgaben pro Jahr (heute)', 72000);
  await p10.addStyleTag({ content: '.leiste{display:none!important}' });
  await p10
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await p10.waitForTimeout(500);
  const kk = p10.locator('.krisen-steuerung').first();
  await kk.getByText(/^Indi\u00ad?viduell$/).click();
  await p10.waitForTimeout(600);
  await kk.scrollIntoViewIfNeeded();
  await kk.screenshot({ path: `${out}53-krise-finanzkrise-nach-ruecktritt-360.png` });
  const kt = await kk.innerText();
  if (!/Mit Ihren Krisen/.test(kt) || !/Krisen in Ihrer Rechnung/.test(kt))
    fehler.push(`Krise: Vergleich fehlt: ${kt}`);
  // Grosse Depression im Kalenderjahr 2030, Daten USA
  await kk
    .getByLabel(/^Krise/)
    .first()
    .selectOption('depression1929');
  await kk.getByText(/^Kalender\u00ad?jahr$/).click();
  await fuelle10('Startjahr', 2030);
  await p10.waitForTimeout(600);
  await kk.screenshot({ path: `${out}54-krise-depression-kalenderjahr-360.png` });
  const top = p10.locator('.karte--ergebnis');
  await top.scrollIntoViewIfNeeded();
  await top.screenshot({ path: `${out}55-ergebnis-mit-krisenhinweis-360.png` });
  if (!/Mit Ihren Krisen: Grosse Depression/.test(await top.innerText())) fehler.push('Krisenhinweis fehlt');
  // Häufigkeit
  await kk.locator('summary', { hasText: 'Wie oft gab es Krisen?' }).click();
  const hf = kk.locator('details', { hasText: 'Wie oft gab es Krisen?' });
  await hf.scrollIntoViewIfNeeded();
  await hf.screenshot({ path: `${out}56-krisenhaeufigkeit-pro-dekade-360.png` });
  if (!/0\.74/.test(await hf.innerText())) fehler.push('Häufigkeit Schweiz 0.74 fehlt');
  // Monte Carlo
  const mc = p10.locator('.karte', { hasText: 'Wiederkehrende Krisen' }).first();
  await mc.getByRole('checkbox', { name: /^Monte-Carlo-Rechnung anzeigen/ }).check();
  await p10.waitForTimeout(2500);
  await mc.scrollIntoViewIfNeeded();
  await mc.screenshot({ path: `${out}57-monte-carlo-wiederkehrende-krisen-360.png` });
  if (!/wahrscheinlichkeit/.test(await mc.innerText())) fehler.push('Monte Carlo: Kennzahl fehlt');
  await mc.getByText('Nur Geschichte Schweiz', { exact: true }).click();
  await p10.waitForTimeout(2500);
  await mc.screenshot({ path: `${out}58-monte-carlo-bootstrap-schweiz-360.png` });
}
await ctx10.close();

// 14) Interaktive Auswertung und neues Design, hell und dunkel (PR E)
for (const schema of ['light', 'dark']) {
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
    colorScheme: schema,
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const f = async (label, wert) => {
    const feld = pg
      .getByLabel(label, { exact: true })
      .or(pg.getByLabel(`${label} geschätzt`, { exact: true }))
      .first();
    await feld.fill(String(wert));
    await feld.blur();
  };
  // Erfundenes Beispiel: Person Jg. 1966, Lohn 105'000, PK 380'000, 450'000 Wertschriften, Ausgaben 68'000
  await f('Geburtsjahr', 1966);
  await f('Bruttoeinkommen pro Jahr (heute)', 105000);
  await f('PK-Altersguthaben heute (optional)', 380000);
  await f('Übriges Vermögen: Konten und Wertschriften', 450000);
  await f('Ausgaben pro Jahr (heute)', 68000);
  if (schema === 'dark') {
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.waitForTimeout(200);
    await pg.screenshot({ path: `${out}63-dunkel-eingaben-360.png` });
  }
  await pg.addStyleTag({ content: '.leiste{display:none!important}' });
  await pg
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await pg.waitForTimeout(2500);
  const aw = pg.locator('.karte--auswertung');
  await aw.scrollIntoViewIfNeeded();
  if (schema === 'light') {
    await aw.screenshot({ path: `${out}59-auswertung-regler-kennzahlen-360.png` });
    const t = await aw.innerText();
    if (!/Geld reicht bis Alter/.test(t) || !/Varianten Ihres Plans im Vergleich/.test(t))
      fehler.push(`Auswertung fehlt: ${t.slice(0, 200)}`);
    // Regler: Rücktritt 62 (in Monaten), Ausgaben 60'000, Krisen automatisch
    await aw.getByLabel('Rücktrittsalter', { exact: true }).fill(String(62 * 12));
    await aw.getByLabel('Ausgaben pro Jahr (heute)', { exact: true }).fill('60000');
    await aw.getByLabel('Teuerung', { exact: true }).fill('0.03');
    await pg.waitForTimeout(2500);
    await aw.screenshot({ path: `${out}60-auswertung-regler-geaendert-krise-360.png` });
    if (!/Übernehmen/.test(await aw.innerText())) fehler.push('Auswertung: Übernehmen fehlt');
    const sz = aw.locator('.szenarien');
    await sz.scrollIntoViewIfNeeded();
    await sz.screenshot({ path: `${out}61-szenarien-vergleich-360.png` });
    await pg.locator('.karte--ergebnis').scrollIntoViewIfNeeded();
    await pg.screenshot({ path: `${out}62-ergebnis-neues-design-360.png` });
  } else {
    await aw.screenshot({ path: `${out}64-dunkel-auswertung-360.png` });
  }
  await ctx.close();
}

// 15) Regler Rücktritt/Planungsalter, Krisen in der Grafik, Krisenmodus (Nachfolge-PR zu #11)
for (const schema of ['light', 'dark']) {
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
    colorScheme: schema,
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const f = async (label, wert, nr = 0) => {
    const feld = pg
      .getByLabel(label, { exact: true })
      .or(pg.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  const zumErgebnis = async () => {
    await pg.addStyleTag({ content: '.leiste{display:none!important}' });
    await pg
      .getByRole('button', { name: /Ergebnis/ })
      .first()
      .click();
    await pg.waitForTimeout(2500);
  };
  const chartKarte = pg
    .locator('.karte', { hasText: 'Vermögensverlauf' })
    .filter({ has: pg.locator('.chart') })
    .filter({ hasNotText: 'Was wäre' });
  if (schema === 'light') {
    // a) Einzelperson: ein Regler Rücktritt, Regler Planungsalter
    // Erfundenes Beispiel: Jg. 1974, Lohn 96'000, 520'000 Wertschriften, Ausgaben 64'000
    await f('Geburtsjahr', 1974);
    await f('Bruttoeinkommen pro Jahr (heute)', 96000);
    await f('Übriges Vermögen: Konten und Wertschriften', 520000);
    await f('Ausgaben pro Jahr (heute)', 64000);
    await zumErgebnis();
    const aw = pg.locator('.karte--auswertung');
    const ruecktritt = aw.getByLabel('Rücktrittsalter', { exact: true });
    const min = Number(await ruecktritt.getAttribute('min'));
    const max = Number(await ruecktritt.getAttribute('max'));
    const wert = Number(await ruecktritt.inputValue());
    if (wert - min !== 120 || max !== 840) fehler.push(`Regler Rücktritt: ${min}/${wert}/${max}`);
    if ((await aw.getByLabel(/^Rücktritt beider/).count()) !== 0) fehler.push('Einzelperson: gemeinsamer Regler');
    const plan = aw.getByLabel('Planungsalter (Lebensende)', { exact: true });
    const pw = Number(await plan.inputValue());
    if (Number(await plan.getAttribute('min')) !== pw - 20 || Number(await plan.getAttribute('max')) !== pw + 20)
      fehler.push('Regler Planungsalter: Bereich');
    await plan.fill(String(pw - 5));
    await ruecktritt.fill(String(wert + 24));
    await pg.waitForTimeout(1500);
    const rg = aw.locator('.regler-gruppe');
    await rg.scrollIntoViewIfNeeded();
    await rg.screenshot({ path: `${out}65-auswertung-einzelperson-ruecktritt-planungsalter-360.png` });
    if (!/Eingabe: 65 J\./.test(await rg.innerText())) fehler.push('Regler: Eingabe-Hinweis fehlt');
    // b) Krisenmodus Automatisch in der Krisen-Karte
    await aw.getByText('Zurücksetzen', { exact: true }).click();
    const kk = pg.locator('.krisen-steuerung').first();
    await kk
      .getByText(/^Auto\u00ad?matisch$/)
      .first()
      .click();
    await pg.waitForTimeout(1500);
    await kk.scrollIntoViewIfNeeded();
    await kk.screenshot({ path: `${out}66-krisen-modus-automatisch-360.png` });
    const kt = await kk.innerText();
    if (!/2036/.test(kt) || !/Ölkrise 2036/.test(kt))
      fehler.push(`Automatisch: Standard 2036 fehlt: ${kt.slice(0, 400)}`);
    // c) Vermögensverlauf mit markierten Krisen
    await chartKarte.scrollIntoViewIfNeeded();
    await chartKarte
      .locator('.chart')
      .first()
      .screenshot({ path: `${out}67-vermoegensverlauf-krisen-markiert-360.png` });
    if (!/Krisenjahre: Ölkrise/.test(await chartKarte.innerText()))
      fehler.push('Vermögensverlauf: Krisenlegende fehlt');
    // d) Auswertung: Diagramm mit Bandbreite und Krisen, Szenarienvergleich mit Grafik
    const awChart = aw.locator('.chart').first();
    await awChart.scrollIntoViewIfNeeded();
    await pg.waitForTimeout(500);
    const box = await awChart.boundingBox();
    const leg = aw.locator('.krisen-legende').first();
    const lb = await leg.boundingBox();
    if (box && lb) {
      await pg.screenshot({
        path: `${out}68-auswertung-bandbreite-krisen-360.png`,
        clip: { x: 0, y: box.y - 8, width: 360, height: lb.y + lb.height - box.y + 16 },
      });
    }
    const szTitel = aw.getByText(/Varianten Ihres Plans im Vergleich/);
    await szTitel.scrollIntoViewIfNeeded();
    const szChart = aw.locator('.chart').nth(1);
    await szChart.scrollIntoViewIfNeeded();
    await pg.waitForTimeout(400);
    await szChart.screenshot({ path: `${out}69-szenarien-vergleich-grafik-krisen-360.png` });
    // e) Individuell: eigene Liste mit Beginn im Alter und extremer Krise
    await kk
      .getByText(/^Indi\u00ad?viduell$/)
      .first()
      .click();
    await pg.waitForTimeout(400);
    await kk
      .getByLabel(/^Krise/)
      .first()
      .selectOption('japan1990');
    await kk.getByText('Alter', { exact: true }).click();
    await f('Alter bei Krisenbeginn', 68);
    await pg.waitForTimeout(1200);
    await kk.scrollIntoViewIfNeeded();
    await kk.screenshot({ path: `${out}70-krisen-modus-individuell-alter-extrem-360.png` });
    if (!/Japan/.test(await kk.innerText())) fehler.push('Individuell: Japan fehlt');
  } else {
    // Dunkel: Paar mit unterschiedlichem Alter, Krisen automatisch
    // Erfundenes Ehepaar: A Jg. 1963, B Jg. 1974, beide erwerbstätig
    await pg.getByText('Ehepaar', { exact: true }).click();
    await f('Geburtsjahr', 1963, 0);
    await f('Bruttoeinkommen pro Jahr (heute)', 102000, 0);
    await f('Geburtsjahr', 1974, 1);
    await f('Bruttoeinkommen pro Jahr (heute)', 74000, 1);
    await f('Übriges Vermögen: Konten und Wertschriften', 650000, 0);
    await f('Ausgaben pro Jahr (heute)', 88000);
    await zumErgebnis();
    const aw = pg.locator('.karte--auswertung');
    const g = aw.getByLabel('Rücktritt beider um', { exact: true });
    const gmin = Number(await g.getAttribute('min'));
    const gmax = Number(await g.getAttribute('max'));
    // beide Eingabe 65 → oben +5 Jahre (70); unten −10 Jahre dank B (A ist heute schon über 63)
    if (gmax !== 60 || gmin !== -120) fehler.push(`Gemeinsamer Regler: ${gmin}/${gmax}`);
    await g.fill('-36');
    await pg.waitForTimeout(1500);
    const rg = aw.locator('.regler-gruppe');
    await rg.scrollIntoViewIfNeeded();
    await rg.screenshot({ path: `${out}71-dunkel-paar-gemeinsamer-regler-grenze-360.png` });
    if (!/bleibt an der Grenze/.test(await rg.innerText())) fehler.push('Gemeinsamer Regler: Grenze nicht angezeigt');
    await aw.getByText('Pro Person', { exact: true }).click();
    await pg.waitForTimeout(800);
    if ((await aw.getByLabel(/^Rücktritt Person/).count()) !== 2) fehler.push('Pro Person: zwei Regler erwartet');
    await rg.screenshot({ path: `${out}72-dunkel-paar-regler-pro-person-360.png` });
    const kk = pg.locator('.krisen-steuerung').first();
    await kk
      .getByText(/^Auto\u00ad?matisch$/)
      .first()
      .click();
    await pg.waitForTimeout(1500);
    await chartKarte.scrollIntoViewIfNeeded();
    await chartKarte
      .locator('.chart')
      .first()
      .screenshot({ path: `${out}73-dunkel-vermoegensverlauf-krisen-360.png` });
    const awChart = aw.locator('.chart').first();
    await awChart.scrollIntoViewIfNeeded();
    await pg.waitForTimeout(400);
    await awChart.screenshot({ path: `${out}74-dunkel-auswertung-bandbreite-krisen-360.png` });
  }
  await ctx.close();
}

// 16) Erster Start: Krisenmodus «Automatisch» voreingestellt
{
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const f = async (label, wert) => {
    const feld = pg
      .getByLabel(label, { exact: true })
      .or(pg.getByLabel(`${label} geschätzt`, { exact: true }))
      .first();
    await feld.fill(String(wert));
    await feld.blur();
  };
  // Erfundenes Beispiel: Jg. 1970, Lohn 92'000, 480'000 Wertschriften, Ausgaben 62'000
  await f('Geburtsjahr', 1970);
  await f('Bruttoeinkommen pro Jahr (heute)', 92000);
  await f('Übriges Vermögen: Konten und Wertschriften', 480000);
  await f('Ausgaben pro Jahr (heute)', 62000);
  await pg.addStyleTag({ content: '.leiste{display:none!important}' });
  await pg
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await pg.waitForTimeout(2500);
  const top = pg.locator('.karte--ergebnis');
  await top.scrollIntoViewIfNeeded();
  await top.screenshot({ path: `${out}75-erster-start-krisen-automatisch-ergebnis-360.png` });
  if (!/Mit Krisen \(automatisch\)/.test(await top.innerText())) fehler.push('Erster Start: Hinweis Automatisch fehlt');
  const kk = pg.locator('.krisen-steuerung').first();
  await kk.scrollIntoViewIfNeeded();
  await kk.screenshot({ path: `${out}76-erster-start-krisenkarte-automatisch-360.png` });
  if (!/Standard für neue Berechnungen/.test(await kk.innerText()))
    fehler.push('Erster Start: Krisenkarte nicht Automatisch');
  await ctx.close();
}

// 17) Wohneigentum: separate Wohnkosten, Vermietung nach dem Wegzug, Verkauf mit Grundstückgewinnsteuer,
//     Krisenausgleich über den Planungszeitraum (Schema 7)
{
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const f = async (label, wert, wo = pg, nr = 0) => {
    const feld = wo
      .getByLabel(label, { exact: true })
      .or(wo.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  // Erfundene Beispielperson: Jg. 1966, Kanton Zürich, Wegzug mit 65 nach Portugal, Wohnung 950'000
  await f('Geburtsjahr', 1966);
  await f('Bruttoeinkommen pro Jahr (heute)', 115000);
  await f('Übriges Vermögen: Konten und Wertschriften', 350000);
  await f('Ausgaben pro Jahr (heute)', 60000);
  await pg.getByLabel('Wohnkanton').selectOption('ZH');
  const person = pg.locator('.karte', { hasText: 'Person 1' }).first();
  await person.getByRole('checkbox', { name: /^Endgültiger Wegzug aus der Schweiz geplant/ }).check();
  await f('Wegzug mit', 65);
  await pg.getByLabel('Zielland', { exact: true }).selectOption('PT');
  await pg.addStyleTag({ content: '.leiste{display:none!important}' });
  await pg.getByText('Detailliert', { exact: true }).click();
  await pg
    .getByRole('button', { name: /Vermögen/ })
    .first()
    .click();
  await pg.waitForTimeout(400);
  const verm = pg.locator('.karte', { hasText: 'Bargeld / Konten' }).first();
  await verm.getByRole('checkbox', { name: /^Wohneigentum/ }).check();
  await f('Verkehrswert', 950000, verm);
  await f('Hypothek (optional)', 380000, verm);
  const aus = pg.locator('.karte', { hasText: 'Lebenshaltungskosten pro Jahr (heute)' }).first();
  await aus.getByRole('checkbox', { name: /^Wohnkosten separat rechnen/ }).check();
  await f('Miete pro Monat in der Schweiz (heute)', 2400, aus);
  await f('Lebenshaltungskosten pro Jahr (heute)', 48000, aus);
  await aus.scrollIntoViewIfNeeded();
  await aus.screenshot({ path: `${out}77-wohnkosten-separat-miete-360.png` });
  if (!/nicht mehr|doppelt/.test(await aus.innerText())) fehler.push('Wohnkosten: Hinweis Doppelzählung fehlt');
  await f('Hypothekarzins', '1.6', verm);
  await f('Unterhalt pro Jahr', '1', verm);
  await f('Eigenmietwert pro Jahr (bis 2028)', 23000, verm);
  await verm.getByText('Vermietet', { exact: true }).click();
  await f('Mieteinnahmen pro Monat (heute)', 2600, verm);
  await verm.scrollIntoViewIfNeeded();
  await verm.screenshot({ path: `${out}78-wohneigentum-wohnkosten-vermietet-360.png` });
  await verm.getByRole('checkbox', { name: /^Verkauf planen/ }).check();
  const vk = verm.locator('.unterkarte', { hasText: 'Anlagekosten' });
  await vk.getByText('Datum', { exact: true }).click();
  await vk.getByLabel('Verkauf im Monat', { exact: true }).selectOption('6');
  await f('Jahr', 2040, vk, 0);
  await f('Anlagekosten', 610000, vk);
  await vk.getByLabel('Gekauft im Monat', { exact: true }).selectOption('5');
  await f('Jahr', 2012, vk, 1);
  await f('Verkaufskosten', '2', vk);
  await vk.scrollIntoViewIfNeeded();
  await vk.screenshot({ path: `${out}79-wohneigentum-verkauf-grundstueckgewinnsteuer-360.png` });
  if (!/§ 225 StG/.test(await vk.innerText())) fehler.push('Verkauf: Tarif ZH fehlt');
  await pg
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await pg.waitForTimeout(2500);
  const info = pg.locator('.karte', { hasText: 'Verkauf Liegenschaft' }).first();
  await info.scrollIntoViewIfNeeded();
  await info.screenshot({ path: `${out}80-ergebnis-verkauf-nach-wegzug-360.png` });
  if (!/Grundstückgewinnsteuer CHF/.test(await info.innerText())) fehler.push('Ergebnis: Verkauf fehlt');
  const kk = pg.locator('.krisen-steuerung').first();
  await kk.scrollIntoViewIfNeeded();
  await kk.screenshot({ path: `${out}81-krisen-ausgleich-planungszeitraum-360.png` });
  if (!/Planungszeitraum/.test(await kk.innerText())) fehler.push('Krisen: Ausgleich über den Planungszeitraum fehlt');
  await ctx.close();
}

// 18) PK-Reglementsalter: Statuszeile pro Person (Barauszahlung vs. Pensionierung), Feld ausgegraut ohne Einfluss
{
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const f = async (label, wert, wo = pg, nr = 0) => {
    const feld = wo
      .getByLabel(label, { exact: true })
      .or(wo.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  // Erfundene Beispielperson: Jg. 1974, PK 320'000, Aufhören und Wegzug mit 55 nach Thailand
  await f('Geburtsjahr', 1974);
  await f('Bruttoeinkommen pro Jahr (heute)', 105000);
  await f('PK-Altersguthaben heute (optional)', 320000);
  await f('Übriges Vermögen: Konten und Wertschriften', 400000);
  await f('Ausgaben pro Jahr (heute)', 55000);
  await pg.getByLabel('Wohnkanton').selectOption('ZH');
  const person = pg.locator('.karte', { hasText: 'Person 1' }).first();
  await person.getByRole('checkbox', { name: /^Endgültiger Wegzug aus der Schweiz geplant/ }).check();
  await f('Wegzug mit', 55);
  await pg.getByLabel('Zielland', { exact: true }).selectOption('TH');
  await pg.addStyleTag({ content: '.leiste{display:none!important}' });
  await pg.getByText('Detailliert', { exact: true }).click();
  await f('Erwerbsaufgabe (Wunsch) mit', 55);
  await pg
    .getByRole('button', { name: /Vorsorge/ })
    .first()
    .click();
  await pg.waitForTimeout(500);
  const aufnahme = async (datei) => {
    const feld = pg.locator('.feld', { hasText: 'frühester Bezug laut Reglement' }).first();
    const status = pg.locator('.pk-status').first();
    await feld.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await pg.evaluate(() => window.scrollBy(0, -12));
    const a = await feld.boundingBox();
    const b = await status.boundingBox();
    if (!a || !b) {
      fehler.push(`PK-Status: Aufnahme ${datei} ohne Box`);
      return '';
    }
    const y = Math.max(0, a.y - 8);
    await pg.screenshot({
      path: `${out}${datei}`,
      clip: { x: 0, y, width: 360, height: Math.min(780 - y, b.y + b.height + 8 - y) },
    });
    return status.innerText();
  };
  const t82 = await aufnahme('82-pk-reglementsalter-status-barauszahlung-360.png');
  if (!/spielt hier keine Rolle/.test(t82)) fehler.push(`PK-Status 82: ${t82}`);
  const gesperrt = await pg.getByLabel(/frühester Bezug laut Reglement/).getAttribute('readonly');
  if (gesperrt === null) fehler.push('PK-Status 82: Feld nicht read-only');
  // Gleiche Person, Aufhören und Wegzug erst mit 63: Pensionierung statt Barauszahlung, Feld editierbar
  await pg
    .getByRole('button', { name: /Personen/ })
    .first()
    .click();
  await f('Erwerbsaufgabe (Wunsch) mit', 63);
  await f('Wegzug mit', 63);
  await pg
    .getByRole('button', { name: /Vorsorge/ })
    .first()
    .click();
  await f('Pensionskasse: frühester Bezug laut Reglement (58–70)', 58);
  await pg.waitForTimeout(500);
  const t83 = await aufnahme('83-pk-reglementsalter-status-pensionierung-360.png');
  if (!/Das gilt als Pensionierung/.test(t83)) fehler.push(`PK-Status 83: ${t83}`);
  if ((await pg.getByLabel(/frühester Bezug laut Reglement/).getAttribute('readonly')) !== null)
    fehler.push('PK-Status 83: Feld fälschlich read-only');
  console.log('PK-Status 82:', t82, '\nPK-Status 83:', t83);
  await ctx.close();
}

// 19) Darstellung heutige Kaufkraft / nominal, Monte-Carlo-Fächer, Varianten-Vergleich (Grafik 2)
{
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const f = async (label, wert, wo = pg, nr = 0) => {
    const feld = wo
      .getByLabel(label, { exact: true })
      .or(wo.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  // Erfundene Beispielperson: Jg. 1966, Lohn 125'000, PK 450'000, Vermögen 650'000, Ausgaben 72'000
  await f('Geburtsjahr', 1966);
  await f('Bruttoeinkommen pro Jahr (heute)', 125000);
  await f('PK-Altersguthaben heute (optional)', 450000);
  await f('Übriges Vermögen: Konten und Wertschriften', 650000);
  await f('Ausgaben pro Jahr (heute)', 72000);
  await pg.getByLabel('Wohnkanton').selectOption('ZH');
  await pg.addStyleTag({ content: '.leiste{display:none!important}' });
  await pg
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await pg.waitForTimeout(2500);
  const kopf = pg.locator('.karte--ergebnis').first();
  const umschalter = kopf.locator('.darstellung-umschalter');
  await umschalter.scrollIntoViewIfNeeded();
  await umschalter.screenshot({ path: `${out}84-darstellung-umschalter-real-360.png` });
  if (!/Heutige Kaufkraft/.test(await umschalter.innerText())) fehler.push('Darstellung: Umschalter fehlt');
  const verlauf = pg.locator('.karte', { hasText: 'nach Vermögenstopf' }).first();
  const realText = await verlauf.innerText();
  await umschalter.getByText('Nominal (mit Teuerung)', { exact: true }).click();
  await pg.waitForTimeout(1500);
  await verlauf.scrollIntoViewIfNeeded();
  await verlauf.screenshot({ path: `${out}85-vermoegensverlauf-nominal-360.png` });
  if (!/In Franken des jeweiligen Jahres/.test(await verlauf.innerText()) || realText === (await verlauf.innerText()))
    fehler.push('Darstellung: Vermögensverlauf nicht nominal');
  // Zurück auf heutige Kaufkraft für die Fächer
  await umschalter.getByText('Heutige Kaufkraft', { exact: true }).click();
  await pg.waitForTimeout(2500);
  const aw = pg.locator('.karte--auswertung');
  const awTitel = aw.getByText('Vermögensverlauf mit Bandbreite', { exact: true });
  await awTitel.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const saetze = aw.locator('.faecher-saetze').first();
  const a = await awTitel.boundingBox();
  const b = await saetze.boundingBox();
  if (a && b) {
    await pg.screenshot({
      path: `${out}86-auswertung-faecher-wahrscheinlichkeit-360.png`,
      clip: { x: 0, y: Math.max(0, a.y - 8), width: 360, height: Math.min(780, b.y + b.height - a.y + 16) },
    });
  } else fehler.push('Fächer: keine Box');
  const st = await saetze.innerText();
  if (!/Erfolgsquote/.test(st) || !/Mit 90 ?% Wahrscheinlichkeit/.test(st)) fehler.push(`Fächer: Sätze fehlen: ${st}`);
  const vTitel = aw.getByText(/Varianten Ihres Plans im Vergleich/);
  await vTitel.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const vChart = aw.locator('.chart').nth(1);
  const c = await vTitel.boundingBox();
  const d = await vChart.boundingBox();
  if (c && d) {
    await pg.screenshot({
      path: `${out}87-varianten-vergleich-erklaert-360.png`,
      clip: { x: 0, y: Math.max(0, c.y - 8), width: 360, height: Math.min(780, d.y + d.height - c.y + 16) },
    });
  } else fehler.push('Varianten: keine Box');
  // Monte-Carlo-Karte mit Fächer, nominal
  await umschalter.getByText('Nominal (mit Teuerung)', { exact: true }).click();
  const mcKarte = pg.locator('.karte', { hasText: 'Wiederkehrende Krisen (Monte Carlo)' }).first();
  await mcKarte.getByRole('checkbox', { name: /Monte-Carlo-Rechnung anzeigen/ }).check();
  await pg.waitForTimeout(3000);
  await mcKarte.scrollIntoViewIfNeeded();
  await mcKarte.screenshot({ path: `${out}88-monte-carlo-faecher-nominal-360.png` });
  const mt = await mcKarte.innerText();
  if (!/Franken des jeweiligen Jahres/.test(mt) || !/Wahrscheinlichkeit reicht das Geld/.test(mt))
    fehler.push(`MC-Karte: ${mt.slice(0, 300)}`);
  console.log('Fächer-Sätze:', st);
  await ctx.close();
}

// 20) Umkehrrechnung: höchste Ausgaben nach Kurve mit Pflege, Ziel Kaufkraft + Monte Carlo, Vorlage in den Phasen
{
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const f = async (label, wert, wo = pg, nr = 0) => {
    const feld = wo
      .getByLabel(label, { exact: true })
      .or(wo.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  // Erfundene Beispielperson: Jg. 1963, Lohn 115'000, PK 500'000, Vermögen 900'000, Ausgaben 70'000
  await f('Geburtsjahr', 1963);
  await f('Bruttoeinkommen pro Jahr (heute)', 115000);
  await f('PK-Altersguthaben heute (optional)', 500000);
  await f('Übriges Vermögen: Konten und Wertschriften', 900000);
  await f('Ausgaben pro Jahr (heute)', 70000);
  await pg.getByLabel('Wohnkanton').selectOption('ZH');
  await pg.addStyleTag({ content: '.leiste{display:none!important}' });
  await pg
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await pg.waitForTimeout(2500);
  const uk = pg.locator('.karte', { hasText: 'Wie viel kann ich ausgeben?' }).first();
  await uk.scrollIntoViewIfNeeded();
  await uk.getByText('Ohne Krise', { exact: true }).click();
  await uk.getByRole('button', { name: 'Berechnen' }).click();
  await uk.locator('.umkehr-ergebnis').waitFor({ timeout: 30000 });
  await pg.waitForTimeout(300);
  await uk.screenshot({ path: `${out}89-umkehrrechnung-kurve-pflege-360.png` });
  const t89 = await uk.locator('.umkehr-ergebnis').innerText();
  if (!/Go-go/.test(t89) || !/Pflegeheim/.test(t89) || !/pro Monat/.test(t89))
    fehler.push(`Umkehr 89: ${t89.slice(0, 300)}`);
  // Ziel Kaufkraft erhalten, Monte Carlo 90 %
  await uk.getByText('Kaufkraft erhalten ± %', { exact: true }).click();
  await uk.getByText('Monte Carlo', { exact: true }).click();
  await uk.getByRole('button', { name: 'Berechnen' }).click();
  await pg.waitForTimeout(500);
  await uk.getByRole('button', { name: 'Berechnen' }).waitFor({ timeout: 60000 });
  await pg.waitForTimeout(300);
  const erg = uk.locator('.umkehr-ergebnis');
  await erg.scrollIntoViewIfNeeded();
  await erg.screenshot({ path: `${out}90-umkehrrechnung-kaufkraft-monte-carlo-360.png` });
  const t90 = await erg.innerText();
  if (!/Monte Carlo, mindestens 90/.test(t90) || !/Kaufkraft|× \(1/.test(t90))
    fehler.push(`Umkehr 90: ${t90.slice(0, 300)}`);
  // Übernehmen und Vorlage in den Ausgabenphasen (Detailliert)
  await erg.getByRole('button', { name: 'Als Ausgabenphasen übernehmen' }).click();
  await pg.waitForTimeout(500);
  if (!/Übernommen/.test(await erg.innerText())) fehler.push('Umkehr: Übernehmen ohne Bestätigung');
  await pg.getByText('Detailliert', { exact: true }).click();
  await pg
    .getByRole('button', { name: /Vermögen/ })
    .first()
    .click();
  await pg.waitForTimeout(600);
  const vorlage = pg.getByRole('button', { name: 'Vorlage Go-go / Slow-go / No-go' });
  await vorlage.click();
  await pg.waitForTimeout(400);
  const phasen = pg.locator('.ausgaben-phasen').first();
  await phasen.screenshot({ path: `${out}91-ausgabenphasen-vorlage-kurve-360.png` });
  const tp = await phasen.innerText();
  if (!/Phase 3/.test(tp)) fehler.push(`Vorlage: ${tp.slice(0, 300)}`);
  console.log('Umkehr 89:', t89.slice(0, 400), '\nUmkehr 90:', t90.slice(0, 400));
  await ctx.close();
}

// 21) Vermögen (linke Achse) und geplante Ausgaben (rechte Achse), Jahrestabelle mit fixer erster Spalte, CSV
{
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
    acceptDownloads: true,
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const f = async (label, wert, wo = pg, nr = 0) => {
    const feld = wo
      .getByLabel(label, { exact: true })
      .or(wo.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  // Erfundene Beispielperson: Jg. 1964, Lohn 130'000, PK 600'000, Vermögen 800'000, Ausgaben 75'000
  await f('Geburtsjahr', 1964);
  await f('Bruttoeinkommen pro Jahr (heute)', 130000);
  await f('PK-Altersguthaben heute (optional)', 600000);
  await f('Übriges Vermögen: Konten und Wertschriften', 800000);
  await f('Ausgaben pro Jahr (heute)', 75000);
  await pg.getByLabel('Wohnkanton').selectOption('ZH');
  await pg.addStyleTag({ content: '.leiste{display:none!important}' });
  await pg
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await pg.waitForTimeout(2500);
  // Umkehrrechnung (Kurve, ohne Krise) mit Grafik, dann als Ausgabenphasen übernehmen
  const uk = pg.locator('.karte', { hasText: 'Wie viel kann ich ausgeben?' }).first();
  await uk.getByText('Ohne Krise', { exact: true }).click();
  await uk.getByRole('button', { name: 'Berechnen' }).click();
  await uk.locator('.umkehr-ergebnis').waitFor({ timeout: 30000 });
  const ukJahre = uk.locator('.jahres-uebersicht');
  await ukJahre.scrollIntoViewIfNeeded();
  await pg.waitForTimeout(400);
  await ukJahre.screenshot({ path: `${out}92-umkehrrechnung-vermoegen-ausgaben-zwei-achsen-360.png` });
  if (!/Verlauf mit diesen Ausgaben/.test(await ukJahre.innerText())) fehler.push('Umkehr: Jahresübersicht fehlt');
  await uk.getByRole('button', { name: 'Als Ausgabenphasen übernehmen' }).click();
  await pg.waitForTimeout(2000);
  // Ergebnis: Vermögensverlauf-Karte mit Zwei-Achsen-Grafik und Tabelle
  const verlauf = pg.locator('.karte', { hasText: 'nach Vermögenstopf' }).first();
  const ju = verlauf.locator('.jahres-uebersicht');
  await ju.scrollIntoViewIfNeeded();
  await pg.waitForTimeout(400);
  await ju.screenshot({ path: `${out}93-ergebnis-vermoegen-ausgaben-kurve-360.png` });
  await ju.getByText('Jahrestabelle: Einnahmen, Ausgaben, Steuern', { exact: true }).click();
  await pg.waitForTimeout(400);
  const scroll = ju.locator('.tabelle-scroll');
  await scroll.evaluate((el) => {
    el.scrollLeft = 420;
  });
  await pg.waitForTimeout(300);
  await scroll.screenshot({ path: `${out}94-jahrestabelle-erste-spalte-fix-360.png` });
  const kopf = await ju.locator('thead').innerText();
  for (const w of ['Vermögen Ende Jahr', 'Geplante Ausgaben', 'AHV', 'Vermögenserträge', 'Steuern total'])
    if (!kopf.includes(w)) fehler.push(`Jahrestabelle: Spalte ${w} fehlt`);
  const sticky = await ju
    .locator('tbody th')
    .first()
    .evaluate((el) => getComputedStyle(el).position);
  if (sticky !== 'sticky') fehler.push(`Jahrestabelle: erste Spalte nicht fix (${sticky})`);
  // CSV-Export
  const [download] = await Promise.all([
    pg.waitForEvent('download'),
    ju.getByRole('button', { name: 'Tabelle als CSV herunterladen' }).click(),
  ]);
  const pfad = await download.path();
  const csv = pfad ? (await import('node:fs')).readFileSync(pfad, 'utf8') : '';
  if (!csv.startsWith('\uFEFFJahr;') || !/Vermögen Ende Jahr \(CHF heute\)/.test(csv))
    fehler.push(`CSV: ${csv.slice(0, 120)}`);
  console.log('CSV:', download.suggestedFilename(), csv.split('\r\n').length - 2, 'Jahre');
  // Nominal
  await pg.locator('.darstellung-umschalter').getByText('Nominal (mit Teuerung)', { exact: true }).click();
  await pg.waitForTimeout(1500);
  await ju.scrollIntoViewIfNeeded();
  await ju.locator('.chart').screenshot({ path: `${out}95-vermoegen-ausgaben-nominal-360.png` });
  if (!/in Franken des jeweiligen Jahres/.test(await ju.innerText())) fehler.push('Jahresübersicht: nicht nominal');
  await ctx.close();
}

// 22) Todesfall-Szenario (Ehepaar, erfundene Werte): 360 px und Desktop-Breite
for (const [breite, hoehe, mobil, suffix] of [
  [360, 780, true, '360'],
  [1280, 900, false, 'desktop'],
]) {
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: breite, height: hoehe },
    deviceScaleFactor: mobil ? 2 : 1,
    isMobile: mobil,
    hasTouch: mobil,
    locale: 'de-CH',
    acceptDownloads: true,
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const f = async (label, wert, nr = 0) => {
    const feld = pg
      .getByLabel(label, { exact: true })
      .or(pg.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  await pg.getByText('Ehepaar', { exact: true }).click();
  await f('Geburtsjahr', 1962, 0);
  await f('Bruttoeinkommen pro Jahr (heute)', 120000, 0);
  await f('Geburtsjahr', 1966, 1);
  await f('Bruttoeinkommen pro Jahr (heute)', 60000, 1);
  await f('Übriges Vermögen: Konten und Wertschriften', 900000);
  await f('Ausgaben pro Jahr (heute)', 80000);
  await pg.getByLabel('Wohnkanton').selectOption('ZH');
  await pg.addStyleTag({ content: '.leiste{display:none!important}' });
  await pg
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await pg.waitForTimeout(2500);
  const tk = pg.locator('.karte', { hasText: 'Todesfall: Was passiert' }).first();
  await tk.scrollIntoViewIfNeeded();
  await tk.getByText('Todesfall-Szenario rechnen').click();
  await pg.waitForTimeout(1500);
  await tk.screenshot({ path: `${out}${suffix === '360' ? '96' : '99'}-todesfall-szenario-${suffix}.png` });
  const txt = await tk.innerText();
  for (const w of ['Geld reicht bis Alter', 'Endvermögen', 'Witwen', 'Jahrestabelle mit Todesfall'])
    if (!txt.includes(w)) fehler.push(`Todesfall (${suffix}): «${w}» fehlt`);
  if (suffix === '360') {
    const chart = tk.locator('.chart').first();
    await chart.scrollIntoViewIfNeeded();
    await chart.screenshot({ path: `${out}97-todesfall-vermoegen-mit-ohne-360.png` });
    const tj = tk.locator('.jahres-uebersicht');
    await tj.scrollIntoViewIfNeeded();
    await tj.getByText('Jahrestabelle: Einnahmen, Ausgaben, Steuern', { exact: true }).click();
    await pg.waitForTimeout(400);
    const marker = await tj.locator('tr.todesjahr').count();
    if (marker !== 1) fehler.push(`Todesfall: Todesjahr-Zeilen = ${marker}`);
    await tj.screenshot({ path: `${out}98-todesfall-jahrestabelle-marker-360.png` });
  }
  await tk.getByRole('button', { name: /Matrix berechnen/ }).click();
  await tk.locator('.vergleich-tabelle', { hasText: 'Es stirbt' }).waitFor({ timeout: 60000 });
  await tk.locator('.vergleich-tabelle', { hasText: 'Es stirbt' }).scrollIntoViewIfNeeded();
  await tk
    .locator('.tabelle-scroll', { hasText: 'Es stirbt' })
    .screenshot({ path: `${out}${suffix === '360' ? '100' : '101'}-todesfall-matrix-${suffix}.png` });
  if (mobil) {
    const ueberlauf = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (ueberlauf) fehler.push('Todesfall: horizontaler Überlauf bei 360 px');
  }
  await ctx.close();
}

// 23) Kapitalbezug in den 26 Kantonen (erfundene Werte): 360 px und Desktop-Breite
for (const [breite, hoehe, mobil, suffix] of [
  [360, 780, true, '360'],
  [1280, 900, false, 'desktop'],
]) {
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: breite, height: hoehe },
    deviceScaleFactor: mobil ? 2 : 1,
    isMobile: mobil,
    hasTouch: mobil,
    locale: 'de-CH',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  await pg.getByLabel('Wohnkanton').selectOption('ZH');
  await pg.addStyleTag({ content: '.leiste{display:none!important}' });
  await pg
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await pg.waitForTimeout(2000);
  const kk = pg.locator('.karte', { hasText: 'Kapitalbezug in den 26 Kantonen' }).first();
  await kk.scrollIntoViewIfNeeded();
  await pg.waitForTimeout(500);
  const rows = await kk.locator('tbody tr').count();
  if (rows < 26) fehler.push(`Kantone (${suffix}): nur ${rows} Zeilen`);
  await kk.screenshot({ path: `${out}${suffix === '360' ? '102' : '105'}-kantone-wohnsitz-${suffix}.png` });
  await kk.getByText('Wohnsitz im Ausland (Quellensteuer)').click();
  await pg.waitForTimeout(400);
  const txt = await kk.innerText();
  for (const w of [
    'Es zählt der Sitz der auszahlenden Einrichtung',
    'Strategie: Freizügigkeit in einen Tiefsteuerkanton',
    'Zug (ZG)',
  ])
    if (!txt.includes(w)) fehler.push(`Kantone (${suffix}): «${w}» fehlt`);
  await kk.screenshot({ path: `${out}${suffix === '360' ? '103' : '106'}-kantone-quellensteuer-${suffix}.png` });
  if (mobil) {
    const st = kk.getByRole('heading', { name: /Strategie: Freizügigkeit/ });
    await st.scrollIntoViewIfNeeded();
    await pg.screenshot({ path: `${out}104-kantone-strategie-360.png` });
    const ueberlauf = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (ueberlauf) fehler.push('Kantone: horizontaler Überlauf bei 360 px');
  }
  await ctx.close();
}

// 24) Wegzug-Vergleich PK/3a (erfundene Werte): 360 px und Desktop-Breite
for (const [breite, hoehe, mobil, suffix] of [
  [360, 780, true, '360'],
  [1280, 900, false, 'desktop'],
]) {
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: breite, height: hoehe },
    deviceScaleFactor: mobil ? 2 : 1,
    isMobile: mobil,
    hasTouch: mobil,
    locale: 'de-CH',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const f = async (label, wert, nr = 0) => {
    const feld = pg
      .getByLabel(label, { exact: true })
      .or(pg.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  await f('Geburtsjahr', 1970, 0);
  await f('Bruttoeinkommen pro Jahr (heute)', 100000, 0);
  await f('Erwerbsaufgabe (Wunsch) mit', 58, 0);
  await f('PK-Altersguthaben heute (optional)', 600000, 0);
  await f('Säule 3a heute (optional)', 150000, 0);
  await f('Übriges Vermögen: Konten und Wertschriften', 400000);
  await f('Ausgaben pro Jahr (heute)', 60000);
  await pg.getByLabel('Wohnkanton').selectOption('ZH');
  await pg.addStyleTag({ content: '.leiste{display:none!important}' });
  await pg
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await pg.waitForTimeout(2000);
  const wk = pg.locator('.karte', { hasText: 'Wegzug-Vergleich: Pensionskasse und 3a' }).first();
  await wk.scrollIntoViewIfNeeded();
  await wk.getByText('Wegzug-Vergleich rechnen').click();
  await pg.waitForTimeout(2500);
  await wk.getByLabel('Sitzkanton der Pensionskasse').selectOption('ZG');
  await pg.waitForTimeout(2500);
  const txt = await wk.innerText();
  for (const w of [
    'Wenn Sie den obligatorischen Teil als Kapital wollen, müssen Sie vor dem Bezug in ein Nicht-EU/EFTA-Land ziehen.',
    'Netto-Kapital nach Steuer',
    'Portugal',
  ])
    if (!txt.includes(w)) fehler.push(`Wegzug-Vergleich (${suffix}): «${w}» fehlt`);
  await wk.screenshot({ path: `${out}${suffix === '360' ? '107' : '109'}-wegzug-vergleich-${suffix}.png` });
  if (mobil) {
    const t = wk.locator('.tabelle-scroll').first();
    await t.scrollIntoViewIfNeeded();
    const masse = await t.evaluate((el) => {
      el.style.maxHeight = 'none';
      el.scrollLeft = el.scrollWidth;
      return [el.scrollWidth, el.clientWidth, el.querySelectorAll('thead th').length];
    });
    console.log('Wegzug-Tabelle scrollWidth/clientWidth/Spalten:', masse.join(' / '));
    const box = await t.boundingBox();
    await pg.screenshot({ path: `${out}108-wegzug-vergleich-tabelle-360.png`, clip: box });
    const ueberlauf = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (ueberlauf) fehler.push('Wegzug-Vergleich: horizontaler Überlauf bei 360 px');
  }
  await ctx.close();
}

// 25) Staffelung der Kapitalbezüge und Steuer-Tipps (erfundene Werte): 360 px und Desktop-Breite
for (const [breite, hoehe, mobil, suffix] of [
  [360, 780, true, '360'],
  [1280, 900, false, 'desktop'],
]) {
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: breite, height: hoehe },
    deviceScaleFactor: mobil ? 2 : 1,
    isMobile: mobil,
    hasTouch: mobil,
    locale: 'de-CH',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const f = async (label, wert, nr = 0) => {
    const feld = pg
      .getByLabel(label, { exact: true })
      .or(pg.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  await f('Geburtsjahr', 1966, 0);
  await f('Bruttoeinkommen pro Jahr (heute)', 100000, 0);
  await f('Erwerbsaufgabe (Wunsch) mit', 62, 0);
  await f('PK-Altersguthaben heute (optional)', 500000, 0);
  await f('Säule 3a heute (optional)', 300000, 0);
  await f('Übriges Vermögen: Konten und Wertschriften', 300000);
  await f('Ausgaben pro Jahr (heute)', 60000);
  await pg.getByLabel('Wohnkanton').selectOption('ZH');
  await pg.addStyleTag({ content: '.leiste{display:none!important}' });
  await pg
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await pg.waitForTimeout(2000);
  const sk = pg.locator('.karte', { hasText: 'Kapitalbezüge staffeln und Steuer-Tipps' }).first();
  await sk.scrollIntoViewIfNeeded();
  await pg.waitForTimeout(800);
  const txt0 = await sk.innerText();
  for (const w of ['Steuer auf Kapitalleistungen je Anzahl Bezugsjahre', 'Steuer-Tipps für Ihren Fall', 'Ersparnis'])
    if (!txt0.includes(w)) fehler.push(`Staffelung (${suffix}): «${w}» fehlt`);
  await sk.screenshot({ path: `${out}${suffix === '360' ? '110' : '112'}-staffelung-${suffix}.png` });
  await sk.getByText('Kapitalbezüge im Plan staffeln').click();
  await pg.waitForTimeout(2500);
  const txt1 = await sk.innerText();
  for (const w of ['Anzahl Bezugsjahre', 'Staffelung ist eingeschaltet', 'Bezugsjahre bei 3 Jahren'])
    if (!txt1.includes(w)) fehler.push(`Staffelung eingeschaltet (${suffix}): «${w}» fehlt`);
  if (mobil) {
    await sk.screenshot({ path: `${out}111-staffelung-eingeschaltet-360.png` });
    const ueberlauf = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (ueberlauf) fehler.push('Staffelung: horizontaler Überlauf bei 360 px');
  }
  await ctx.close();
}

// 26) Szenario-Vergleich Version A/B (erfundene Werte, Person 1): 360 px gestapelt, Desktop zwei Spalten
for (const [breite, hoehe, mobil, suffix] of [
  [360, 780, true, '360'],
  [1400, 900, false, 'desktop'],
]) {
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: breite, height: hoehe },
    deviceScaleFactor: mobil ? 2 : 1,
    isMobile: mobil,
    hasTouch: mobil,
    locale: 'de-CH',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const f = async (label, wert, nr = 0) => {
    const feld = pg
      .getByLabel(label, { exact: true })
      .or(pg.getByLabel(`${label} geschätzt`, { exact: true }))
      .nth(nr);
    await feld.fill(String(wert));
    await feld.blur();
  };
  await f('Geburtsjahr', 1966, 0);
  await f('Bruttoeinkommen pro Jahr (heute)', 100000, 0);
  await f('Erwerbsaufgabe (Wunsch) mit', 62, 0);
  await f('PK-Altersguthaben heute (optional)', 500000, 0);
  await f('Säule 3a heute (optional)', 300000, 0);
  await f('Übriges Vermögen: Konten und Wertschriften', 300000);
  await f('Ausgaben pro Jahr (heute)', 60000);
  await pg.getByLabel('Wohnkanton').selectOption('ZH');
  await pg.addStyleTag({ content: '.leiste{display:none!important}' });
  await pg.getByRole('button', { name: 'Version B anlegen' }).click();
  await pg.waitForTimeout(500);
  // Version B: späterer Rücktritt und höhere Ausgaben
  await f('Erwerbsaufgabe (Wunsch) mit', 65, 1);
  await f('Ausgaben pro Jahr (heute)', 72000, 1);
  await pg.waitForTimeout(3500);
  const vk = pg.locator('.karte', { hasText: 'Vergleich der Versionen' }).first();
  await vk.scrollIntoViewIfNeeded();
  const t = await vk.innerText();
  for (const w of [
    'Endvermögen',
    'Steuern total',
    'Verfügbar pro Jahr im Ruhestand',
    'Erfolgsquote (Monte Carlo)',
    'Geld reicht bis Alter',
    'Differenz',
    'besser',
  ])
    if (!t.includes(w)) fehler.push(`Vergleich (${suffix}): «${w}» fehlt`);
  if (t.includes('rechnet …')) fehler.push(`Vergleich (${suffix}): Monte Carlo noch nicht fertig`);
  await vk.screenshot({ path: `${out}${suffix === '360' ? '113' : '115'}-vergleich-${suffix}.png` });
  const sp = pg.locator('.versionen-spalten').first();
  await sp.scrollIntoViewIfNeeded();
  const pos = await pg.evaluate(() => {
    const [a, b] = [...document.querySelectorAll('.versionen-spalte')].map((e) => e.getBoundingClientRect());
    return { nebeneinander: Math.abs(a.top - b.top) < 4, breiteA: a.width, breiteB: b.width };
  });
  if (mobil === pos.nebeneinander) fehler.push(`Spalten (${suffix}): Anordnung falsch ${JSON.stringify(pos)}`);
  await sp.screenshot({ path: `${out}${suffix === '360' ? '114' : '116'}-versionen-spalten-${suffix}.png` });
  if (mobil) {
    const ueberlauf = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (ueberlauf) fehler.push('Vergleich: horizontaler Überlauf bei 360 px');
  }
  await ctx.close();
}

// 27) Sicherheit (Audit S-02, S-10): Fehlerseite mit Notfall-Reset, Speicherhinweis (nur erfundene Beispielwerte)
{
  const ctx = await browser.newContext({
    bypassCSP: true,
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', () => {});
  await pg.goto(url, { waitUntil: 'networkidle' });
  await pg.locator('.speicherleiste').screenshot({ path: `${out}117-speicherleiste-hinweis-360.png` });
  if (!(await pg.locator('.speicherleiste').innerText()).includes('unverschlüsselt'))
    fehler.push('Speicherhinweis: Text «unverschlüsselt» fehlt');
  // Absturz im Ergebnisschritt erzwingen (Test-Hilfe im Browser, nicht in der App)
  await pg.evaluate(() => {
    window.__absturz = true;
    const orig = Array.prototype.map;
    Array.prototype.map = function (...a) {
      if (window.__absturz && new Error().stack.includes('index.')) throw new Error('Test-Absturz');
      return orig.apply(this, a);
    };
  });
  await pg
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    window.__absturz = false;
  });
  if ((await pg.getByRole('alert').count()) !== 1) fehler.push('Fehlerseite erscheint nicht');
  await pg.screenshot({ path: `${out}118-fehlerseite-notfall-reset-360.png` });
  pg.on('dialog', (d) => d.accept());
  await pg.getByRole('button', { name: /Gespeicherte Daten löschen/ }).click();
  await pg.waitForLoadState('networkidle');
  await pg.waitForTimeout(500);
  if ((await pg.getByRole('alert').count()) !== 0) fehler.push('Fehlerseite nach Reset noch sichtbar');
  await ctx.close();
}

// 28) Banner bei fehlendem bzw. teilweise erfasstem Regeljahr (K-11): Systemdatum nur im Browser des Skripts gesetzt
{
  for (const [jahr, text, datei] of [
    [2028, 'Regeln für 2028 noch nicht erfasst', '119-banner-regeljahr-fehlt-360.png'],
    [2027, 'Regeln für 2027 teilweise erfasst', '134-banner-regeljahr-teilweise-360.png'],
  ]) {
    const ctx = await browser.newContext({
      bypassCSP: true,
      viewport: { width: 360, height: 780 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: 'de-CH',
    });
    const pg = await ctx.newPage();
    await pg.clock.setFixedTime(new Date(`${jahr}-01-15T10:00:00`));
    await pg.goto(url, { waitUntil: 'networkidle' });
    const banner = pg.locator('.regeljahr-banner');
    if ((await banner.count()) !== 1) fehler.push(`Regeljahr-Banner fehlt im Jahr ${jahr}`);
    else if (!(await banner.innerText()).includes(text)) fehler.push(`Regeljahr-Banner ${jahr}: Text falsch`);
    await pg.screenshot({ path: `${out}${datei}` });
    await ctx.close();
  }
  const ctxHeute = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'de-CH' });
  const heute = await ctxHeute.newPage();
  await heute.clock.setFixedTime(new Date('2026-06-15T10:00:00'));
  await heute.goto(url, { waitUntil: 'networkidle' });
  if ((await heute.locator('.regeljahr-banner').count()) !== 0)
    fehler.push('Regeljahr-Banner erscheint im aktuellen Jahr');
  await ctxHeute.close();
}

// 29) Rendite-Einordnung (7 % ↔ Aktienanteil): Schnellmodus-Hinweis und Orientierungstabelle im Schritt «Annahmen»
{
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    locale: 'de-CH',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fehler.push(String(e)));
  await pg.goto(url, { waitUntil: 'networkidle' });
  const hinweis = pg.locator('.annahmen-schnell');
  const t = await hinweis.innerText();
  if (!t.includes('100 % Aktien') || !t.includes('Obligationenanteil')) fehler.push(`Rendite-Hinweis fehlt: ${t}`);
  await hinweis.scrollIntoViewIfNeeded();
  await hinweis.screenshot({ path: `${out}132-rendite-hinweis-schnell-360.png` });
  await pg.getByText('Detailliert', { exact: true }).click();
  await pg
    .getByRole('button', { name: /Annahmen/ })
    .first()
    .click();
  const aufklapp = pg.locator('details.aufklapp', { hasText: 'Aktienanteil und historische Rendite' });
  await aufklapp.locator('summary').click();
  const tab = aufklapp.locator('table');
  if ((await tab.locator('tbody tr').count()) !== 5) fehler.push('Richtwert-Tabelle: nicht 5 Zeilen');
  await aufklapp.scrollIntoViewIfNeeded();
  await pg
    .locator('.karte', { has: aufklapp })
    .first()
    .screenshot({ path: `${out}133-rendite-richtwerte-tabelle-360.png` });
  await ctx.close();
}

await browser.close();
if (fehler.length) {
  console.error('Fehler im Browser:\n', fehler.join('\n'));
  process.exit(1);
}
console.log('Screenshots in', out);
