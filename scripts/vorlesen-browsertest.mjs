/**
 * Browsertest «Vorlesen» mit gemocktem speechSynthesis (Playwright) gegen einen laufenden Preview-Server.
 * Aufruf: node scripts/vorlesen-browsertest.mjs [url] [--screenshots]
 * Browser: PLAYWRIGHT_CHROMIUM_EXECUTABLE (z.B. /usr/bin/google-chrome).
 * Es werden nur erfundene Beispielwerte verwendet; Screenshots nur mit --screenshots (Nummern ab 120).
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:4173/Swiss-Retirement-Calculator/';
const shots = process.argv.includes('--screenshots');
const out = new URL('../screenshots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });

let fehler = 0;
const pruefe = (bedingung, text) => {
  if (bedingung) console.log(`  ok   ${text}`);
  else {
    fehler++;
    console.log(`  FEHLER ${text}`);
  }
};

/** Fake-Sprachausgabe: meldet je Wort ein boundary-Ereignis (60 ms) und dann end. */
const MOCK = ({ mitStimme, wortMs }) => {
  const stimmen = mitStimme
    ? [
        { voiceURI: 'mock-ch', name: 'Mock Schweizerdeutsch', lang: 'de-CH', localService: true, default: true },
        { voiceURI: 'mock-de', name: 'Mock Deutsch', lang: 'de-DE', localService: true, default: false },
        { voiceURI: 'mock-net', name: 'Mock Netz', lang: 'de-DE', localService: false, default: false },
      ]
    : [];
  const log = { gesprochen: [], abgebrochen: 0, raten: [] };
  window.__vorlesen = log;
  let lauf = null;
  class Utter extends EventTarget {
    constructor(text) {
      super();
      this.text = text;
      this.lang = '';
      this.rate = 1;
      this.voice = null;
      this.onstart = this.onend = this.onerror = this.onboundary = null;
    }
  }
  const synth = {
    speaking: false,
    pending: false,
    getVoices: () => stimmen,
    addEventListener: () => {},
    removeEventListener: () => {},
    speak(u) {
      log.gesprochen.push(u.text);
      log.raten.push(u.rate);
      const wort = [...u.text.matchAll(/\S+/g)];
      let i = 0;
      const id = setTimeout(function schritt() {
        if (lauf?.u !== u) return;
        if (i === 0) u.onstart?.({});
        if (i < wort.length) {
          u.onboundary?.({ name: 'word', charIndex: wort[i].index });
          i++;
          lauf.id = setTimeout(schritt, wortMs);
        } else {
          lauf = null;
          u.onend?.({});
        }
      }, 20);
      lauf = { u, id };
    },
    cancel() {
      if (lauf) {
        clearTimeout(lauf.id);
        const u = lauf.u;
        lauf = null;
        log.abgebrochen++;
        u.onerror?.({ error: 'canceled' });
      }
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = Utter;
};

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--no-sandbox'],
});

async function neueSeite({ mitStimme = true, wortMs = 60, dunkel = false, reduziert = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
    colorScheme: dunkel ? 'dark' : 'light',
    reducedMotion: reduziert ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.addInitScript(MOCK, { mitStimme, wortMs });
  await page.goto(url, { waitUntil: 'networkidle' });
  return { page, errs, ctx };
}

const hervorgehoben = (page, name) =>
  page.evaluate((n) => {
    const h = CSS.highlights.get(n);
    if (!h) return null;
    return [...h].map((r) => r.toString()).join('|');
  }, name);

// ---------------------------------------------------------------- 1) Leiste, Highlight, Pause, Sprünge, Stopp
console.log('1) Vorlesen mit Stimme (360 px)');
{
  const { page, errs } = await neueSeite({ wortMs: 90 });
  await page.getByRole('button', { name: 'Ganze Seite vorlesen' }).waitFor();
  pruefe(true, 'Knopf «Ganze Seite vorlesen» sichtbar');
  pruefe(
    (await page.getByRole('button', { name: /Abschnitt .* vorlesen/ }).count()) > 0,
    'Vorlesen-Knöpfe je Abschnitt',
  );
  pruefe((await page.locator('.vorlesen-leiste').count()) === 0, 'Leiste vor dem Start nicht vorhanden');

  if (shots) await page.screenshot({ path: `${out}120-vorlesen-knoepfe-360.png` });

  await page.getByRole('button', { name: 'Ganze Seite vorlesen' }).click();
  await page.locator('.vorlesen-leiste').waitFor();
  pruefe((await page.locator('.vorlesen-leiste [role=toolbar]').count()) === 1, 'Leiste mit role=toolbar');
  await page.waitForFunction(() => window.__vorlesen.gesprochen.length > 0);
  const erster = await page.evaluate(() => window.__vorlesen.gesprochen[0]);
  console.log(`  erster Sprechtext: ${erster.slice(0, 60)}…`);
  await page.waitForFunction(() => CSS.highlights.get('vorlesen-satz')?.size > 0);
  const satz1 = await hervorgehoben(page, 'vorlesen-satz');
  pruefe(!!satz1 && satz1.length > 5, 'aktueller Satz ist hervorgehoben');
  await page.waitForFunction(() => CSS.highlights.get('vorlesen-wort')?.size > 0);
  pruefe(!!(await hervorgehoben(page, 'vorlesen-wort')), 'aktuelles Wort ist hervorgehoben (boundary)');
  if (shots) await page.screenshot({ path: `${out}121-vorlesen-leiste-highlight-360.png` });

  // Highlight wandert
  const s0 = await hervorgehoben(page, 'vorlesen-satz');
  await page.waitForFunction(
    (alt) =>
      CSS.highlights.get('vorlesen-satz')?.size > 0 &&
      [...CSS.highlights.get('vorlesen-satz')].map((r) => r.toString()).join('|') !== alt,
    s0,
    { timeout: 15000 },
  );
  pruefe(true, 'Hervorhebung wandert zum nächsten Satz');

  // Leiste verdeckt keine Bedienelemente der Seite: Abstand am Seitenende
  const leiste = await page.locator('.vorlesen-leiste').boundingBox();
  const nav = await page.locator('.leiste').boundingBox();
  pruefe(leiste.y + leiste.height <= nav.y + 1, 'Vorlesen-Leiste liegt über der Navigationsleiste (keine Überdeckung)');
  pruefe(leiste.width <= 360.5 && leiste.x >= -0.5, 'Leiste passt in 360 px Breite');
  const sichtbarAnteil = (leiste.height + nav.height) / 780;
  console.log(`  Leisten belegen ${(sichtbarAnteil * 100).toFixed(0)} % der Höhe`);

  // Pause / Weiter
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Weiterlesen' }).waitFor();
  const n1 = await page.evaluate(() => window.__vorlesen.gesprochen.length);
  await page.waitForTimeout(400);
  pruefe(
    (await page.evaluate(() => window.__vorlesen.gesprochen.length)) === n1,
    'in der Pause wird nichts gesprochen',
  );
  pruefe(
    (await page.evaluate(() => window.__vorlesen.abgebrochen)) >= 1,
    'Pause bricht die Äusserung ab (Android-Workaround)',
  );
  await page.getByRole('button', { name: 'Weiterlesen' }).click();
  await page.getByRole('button', { name: 'Pause' }).waitFor();
  pruefe((await page.evaluate(() => window.__vorlesen.gesprochen.length)) === n1 + 1, 'Weiter startet den Satz neu');

  // ±10 s
  const idx = () => page.locator('.vorlesen-leiste__status').innerText();
  const vorSprung = await idx();
  await page.getByRole('button', { name: /^10 Sekunden vor/ }).click();
  await page.waitForTimeout(150);
  const nachVor = await idx();
  pruefe(
    vorSprung !== nachVor,
    `+10 s springt zu anderem Satz («${vorSprung.replace(/\s+/g, ' ')}» → «${nachVor.replace(/\s+/g, ' ')}»)`,
  );
  await page.getByRole('button', { name: /^10 Sekunden zurück/ }).click();
  await page.waitForTimeout(150);
  pruefe(true, '−10 s ohne Fehler');
  pruefe(
    (await page.getByRole('button', { name: /^10 Sekunden vor/ }).getAttribute('title')).includes('geschätzt'),
    'Tooltip «geschätzt» an den ±10-s-Knöpfen',
  );

  // Tempo und Stimme
  await page.getByRole('button', { name: 'Tempo und Stimme' }).click();
  await page.getByLabel('Tempo', { exact: true }).selectOption('1.5');
  await page.waitForTimeout(150);
  pruefe(
    (await page.evaluate(() => window.__vorlesen.raten.at(-1))) === 1.5,
    'Tempo 1,5× wird an die Äusserung übergeben',
  );
  const optionen = await page.getByLabel('Stimme', { exact: true }).locator('option').allInnerTexts();
  pruefe(
    optionen.length === 2 && !optionen.some((o) => o.includes('Netz')),
    `nur lokale deutsche Stimmen (${optionen.join(', ')})`,
  );
  pruefe(optionen[0].includes('de-CH'), 'de-CH steht zuerst');
  pruefe(
    (await page.locator('.vorlesen-leiste__hilfe').innerText()).includes('geschätzt'),
    'Erklärung «geschätzt» in den Einstellungen',
  );
  if (shots) await page.screenshot({ path: `${out}122-vorlesen-tempo-stimme-360.png` });

  // Stopp per Esc
  await page
    .locator('.vorlesen-leiste')
    .focus()
    .catch(() => {});
  await page.getByRole('button', { name: 'Stopp' }).focus();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  pruefe((await page.locator('.vorlesen-leiste').count()) === 0, 'Esc beendet das Vorlesen, Leiste verschwindet');
  pruefe((await hervorgehoben(page, 'vorlesen-satz')) === null, 'Hervorhebung wird entfernt');
  pruefe(
    await page.evaluate(() => document.activeElement?.textContent?.includes('Ganze Seite vorlesen') === true),
    'Fokus kehrt nach dem Schliessen zum Auslöser zurück',
  );
  pruefe(
    await page.evaluate(
      () =>
        !document.documentElement.hasAttribute('data-vorlesen-aktiv') &&
        !document.documentElement.style.getPropertyValue('--leiste-hoehe'),
    ),
    'Aufräumen: Attribut und Höhenvariable entfernt',
  );

  // Stopp per Knopf
  await page.getByRole('button', { name: 'Ganze Seite vorlesen' }).click();
  await page.locator('.vorlesen-leiste').waitFor();
  await page.getByRole('button', { name: 'Stopp' }).click();
  await page.waitForTimeout(150);
  pruefe((await page.locator('.vorlesen-leiste').count()) === 0, 'Stopp-Knopf beendet das Vorlesen');
  pruefe(errs.length === 0, `keine Konsolenfehler (${errs.join(' / ')})`);
}

// ---------------------------------------------------------------- 2) Inhalt: nichts aus Formularen, nur Erklärtexte
console.log('2) Was gelesen wird');
{
  const { page } = await neueSeite({ wortMs: 5 });
  await page.getByText('Detailliert', { exact: true }).click();
  const feld = page.getByLabel('Geburtsjahr', { exact: true });
  await feld.fill('1968'); // erfundener Beispielwert
  await feld.blur();
  await page.getByRole('button', { name: 'Ganze Seite vorlesen' }).click();
  await page.waitForFunction(() => window.__vorlesen.gesprochen.length > 8);
  await page.waitForTimeout(600);
  const alles = await page.evaluate(() => window.__vorlesen.gesprochen.join(' \n '));
  pruefe(!/1968/.test(alles), 'Eingabewert (Geburtsjahr) wird nicht gelesen');
  pruefe(!/Geburtsjahr/.test(alles), 'Feldbeschriftungen werden nicht gelesen');
  pruefe(!/Vorlesen|Ganze Seite/.test(alles), 'Die Vorlesen-Bedienung liest sich nicht selbst vor');
  pruefe(/A H V|Franken|Prozent/.test(alles), 'Aufbereitung aktiv (AHV, Franken, Prozent ausgeschrieben)');
  pruefe(!/CHF|%|’/.test(alles), 'keine rohen Symbole im Sprechtext');
  const anzahl = await page.evaluate(() => window.__vorlesen.gesprochen.length);
  console.log(`  ${anzahl} Sätze gesprochen`);
  await page.getByRole('button', { name: 'Stopp' }).click();
}

// ---------------------------------------------------------------- 3) «ab hier»
console.log('3) «ab hier»');
{
  const { page } = await neueSeite({ wortMs: 5 });
  await page.getByText('Detailliert', { exact: true }).click();
  await page
    .getByRole('button', { name: /^Ab «.*» bis zum Ende der Seite vorlesen$/ })
    .nth(1)
    .click();
  await page.waitForFunction(() => window.__vorlesen.gesprochen.length > 0);
  const erster = await page.evaluate(() => window.__vorlesen.gesprochen[0]);
  const titel = await page.locator('.karte h2').nth(1).innerText();
  console.log(`  Start bei zweiter Karte «${titel}»: ${erster.slice(0, 50)}…`);
  pruefe(!/Wichtiger Hinweis/.test(erster), 'startet nicht am Seitenanfang');
  await page.getByRole('button', { name: 'Stopp' }).click();
}

// ---------------------------------------------------------------- 4) Keine Stimme / keine API
console.log('4) Keine deutsche Stimme bzw. keine Sprachausgabe');
{
  const { page } = await neueSeite({ mitStimme: false });
  await page.waitForSelector('.vorlesen-hinweis', { timeout: 4000 });
  pruefe((await page.getByRole('button', { name: /vorlesen/i }).count()) === 0, 'keine Vorlesen-Knöpfe ohne Stimme');
  pruefe(
    (await page.locator('.vorlesen-hinweis').innerText()).includes('keine lokale deutsche Stimme'),
    'klarer Hinweis',
  );
  if (shots) await page.screenshot({ path: `${out}123-vorlesen-keine-stimme-hinweis-360.png` });
}
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'de-CH' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    delete window.SpeechSynthesisUtterance;
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  pruefe(
    (await page.getByRole('button', { name: /vorlesen/i }).count()) === 0,
    'ohne speechSynthesis: Knöpfe ausgeblendet',
  );
  pruefe((await page.locator('.vorlesen-hinweis').count()) === 0, 'ohne speechSynthesis: kein Hinweis');
  pruefe((await page.locator('h1').innerText()) === 'Ruhestandsrechner Schweiz', 'Seite funktioniert normal');
}

// ---------------------------------------------------------------- 5) Dunkel, reduzierte Bewegung, Einstellungen speichern
console.log('5) Dunkelmodus und Speichern');
{
  const { page } = await neueSeite({ wortMs: 90, dunkel: true, reduziert: true });
  await page.getByRole('button', { name: 'Ganze Seite vorlesen' }).click();
  await page.waitForFunction(() => CSS.highlights.get('vorlesen-wort')?.size > 0);
  const farben = await page.evaluate(() => {
    const sheet = [...document.styleSheets].flatMap((s) => [...s.cssRules]);
    const dark = sheet.find(
      (r) =>
        r.media?.mediaText.includes('dark') && [...r.cssRules].some((c) => c.selectorText?.includes('vorlesen-wort')),
    );
    return dark ? [...dark.cssRules].filter((c) => c.selectorText?.includes('vorlesen')).map((c) => c.cssText) : [];
  });
  pruefe(farben.length === 2, 'eigene Farben für dunkles Erscheinungsbild vorhanden');
  if (shots) await page.screenshot({ path: `${out}124-vorlesen-dunkel-360.png` });
  await page.getByRole('button', { name: 'Tempo und Stimme' }).click();
  await page.getByLabel('Tempo', { exact: true }).selectOption('1.3');
  await page.waitForTimeout(700);
  const gespeichert = await page.evaluate(() => localStorage.getItem('ruhestandsrechner:vorlesen'));
  pruefe(gespeichert !== null && JSON.parse(gespeichert).tempo === 1.3, 'Tempo wird gespeichert (Speichern an)');
  pruefe(
    !/[A-Za-z]{12,}/.test(gespeichert.replace(/mock-[a-z]+/, '').replace(/tempo|stimme/g, '')),
    'gespeichert wird nur Tempo und Stimme',
  );
  const reduziert = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  pruefe(reduziert, 'prefers-reduced-motion erkannt (Mitscrollen ohne Animation)');
  await page.getByRole('button', { name: 'Stopp' }).click();
  // Neu laden: Tempo bleibt
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Ganze Seite vorlesen' }).click();
  await page.locator('.vorlesen-leiste').waitFor();
  await page.getByRole('button', { name: 'Tempo und Stimme' }).click();
  pruefe(
    (await page.getByLabel('Tempo', { exact: true }).inputValue()) === '1.3',
    'Tempo nach Neuladen wiederhergestellt',
  );
  await page.getByRole('button', { name: 'Stopp' }).click();
  // Speichern ausschalten löscht die Einstellung
  await page.getByRole('switch', { name: /Eingaben im Browser speichern/ }).uncheck();
  await page.waitForTimeout(200);
  pruefe(
    (await page.evaluate(() => localStorage.getItem('ruhestandsrechner:vorlesen'))) === null,
    'Speichern aus: Einstellung gelöscht',
  );
  await page.getByRole('button', { name: 'Ganze Seite vorlesen' }).click();
  await page.locator('.vorlesen-leiste').waitFor();
  await page.getByRole('button', { name: 'Tempo und Stimme' }).click();
  await page.getByLabel('Tempo', { exact: true }).selectOption('0.7');
  await page.waitForTimeout(700);
  pruefe(
    (await page.evaluate(() => localStorage.getItem('ruhestandsrechner:vorlesen'))) === null,
    'Speichern aus: nichts wird gespeichert',
  );
  await page.getByRole('button', { name: 'Stopp' }).click();
}

// ---------------------------------------------------------------- 6) Ergebnis lesen, Tastatur
console.log('6) Tastatur und Ergebnis');
{
  const { page } = await neueSeite({ wortMs: 30 });
  await page.getByRole('button', { name: 'Ganze Seite vorlesen' }).focus();
  await page.keyboard.press('Enter');
  await page.locator('.vorlesen-leiste').waitFor();
  await page.getByRole('button', { name: 'Pause' }).focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Weiterlesen' }).waitFor();
  pruefe(true, 'Pause per Tastatur (Leertaste)');
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Pause' }).waitFor();
  pruefe(true, 'Weiter per Tastatur');
  const fokusStil = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  pruefe(fokusStil !== 'none', 'Fokus sichtbar');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  pruefe((await page.locator('.vorlesen-leiste').count()) === 0, 'Esc in der Leiste beendet das Vorlesen');
  // Ergebnisseite
  await page
    .getByRole('button', { name: /Ergebnis/ })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Abschnitt «Frühestes Rücktrittsalter» vorlesen/ }).click();
  await page.waitForFunction(() => window.__vorlesen.gesprochen.length > 0);
  const t = await page.evaluate(() => window.__vorlesen.gesprochen.join(' | '));
  pruefe(t.length > 20, `Ergebnistext wird gelesen («${t.slice(0, 70)}…»)`);
  if (shots) await page.screenshot({ path: `${out}125-vorlesen-ergebnis-360.png` });
  await page.getByRole('button', { name: 'Stopp' }).click();
}

await browser.close();
console.log(fehler === 0 ? '\nAlle Browserprüfungen bestanden.' : `\n${fehler} Prüfung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
