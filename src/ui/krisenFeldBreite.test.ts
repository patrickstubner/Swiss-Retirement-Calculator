import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KRISEN_KATALOG_OPTIONEN } from './krisenSchwereText';

const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/google-chrome';
/** Platz, den der native Auswahlpfeil am rechten Rand belegt. */
const PFEIL_RESERVE = 32;

/**
 * Der Zusatz der Optionszeile («Rückgang · Zusatz») muss im geschlossenen Feld bei 360 px
 * vor dem Pfeil enden. Gemessen wird die Textbreite, ohne Bildschirm: Playwright headless,
 * Start aus paddingLeft, Pfeilreserve 32 px, Breite per canvas measureText.
 */
describe('Krisenfeld bei 360 px', () => {
  it('der Zusatz «Rückgang · Zusatz» endet vor dem Pfeil', async () => {
    if (!existsSync(chrome)) {
      throw new Error(
        `Chrome fehlt (${chrome}). Setzen Sie PLAYWRIGHT_CHROMIUM_EXECUTABLE oder installieren Sie Google Chrome unter /usr/bin/google-chrome. Der Test wird nicht übersprungen.`,
      );
    }
    const { chromium } = await import('playwright');
    const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
    const browser = await chromium.launch({
      executablePath: chrome,
      headless: true,
      args: ['--no-sandbox'],
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 360, height: 780 },
        deviceScaleFactor: 1,
        locale: 'de-CH',
      });
      const optionen = KRISEN_KATALOG_OPTIONEN.map((o) => o.label);
      await page.setContent(
        '<div class="inhalt"><section class="karte"><div class="feld"><select id="k"></select></div></section></div>',
      );
      await page.addStyleTag({ content: css });
      await page.addStyleTag({
        content: 'html,body{width:360px;margin:0;overflow-x:hidden}select{min-width:0;max-width:100%}',
      });
      await page.locator('#k').evaluate((el, labels) => {
        const select = el as HTMLSelectElement;
        select.replaceChildren(
          ...labels.map((label) => {
            const o = document.createElement('option');
            o.value = label;
            o.textContent = label;
            return o;
          }),
        );
        select.value = 'Covid 2020';
      }, optionen);

      const lage = await page.locator('#k').evaluate((el, reserve) => {
        const select = el as HTMLSelectElement;
        const cs = getComputedStyle(select);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        // `cs.font` ist in Chrome leer; die Einzelwerte ergeben die echte Schrift (sonst 10 px).
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const textStart = Number.parseFloat(cs.paddingLeft);
        const pfeilLinks = select.clientWidth - reserve;
        const zeilen = [...select.options].map((o) => {
          const teile = o.label.split(' · ');
          const zusatz = teile.length >= 3 ? `${teile[0]} · ${teile[1]}` : null;
          return { label: o.label, breite: zusatz ? ctx.measureText(zusatz).width : null };
        });
        return {
          textStart,
          pfeilLinks,
          clientWidth: select.clientWidth,
          fontSize: cs.fontSize,
          canvasFont: ctx.font,
          zeilen,
        };
      }, PFEIL_RESERVE);

      expect(lage, 'canvas oder Feld fehlt').not.toBeNull();
      if (!lage) return;
      expect(lage.clientWidth).toBeGreaterThan(260);
      expect(lage.clientWidth).toBeLessThan(340);
      expect(lage.textStart).toBeGreaterThan(0);
      expect(lage.pfeilLinks).toBe(lage.clientWidth - PFEIL_RESERVE);
      expect(lage.canvasFont).toContain(lage.fontSize);
      expect(Number.parseFloat(lage.fontSize)).toBeGreaterThanOrEqual(16);
      const mitZusatz = lage.zeilen.filter((z) => z.breite !== null);
      expect(mitZusatz.length).toBeGreaterThanOrEqual(4);
      for (const z of mitZusatz) {
        expect(lage.textStart + (z.breite as number), z.label).toBeLessThan(lage.pfeilLinks);
      }
    } finally {
      await browser.close();
    }
  }, 30_000);
});
