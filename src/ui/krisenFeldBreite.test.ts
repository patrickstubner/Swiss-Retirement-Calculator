import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KRISEN_KATALOG_OPTIONEN } from './krisenSchwereText';

const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/google-chrome';

/**
 * Der Zusatz der Optionszeile (alles vor dem Namen) muss im geschlossenen Feld bei 360 px
 * vor dem Pfeil enden. Gemessen wird die gerenderte Textbreite, nicht die Zeichenzahl.
 * Headless zeichnet den Select-Text nicht; der Test braucht deshalb eine Anzeige.
 */
describe('Krisenfeld bei 360 px', () => {
  it.skipIf(!existsSync(chrome) || !process.env.DISPLAY)(
    'der Zusatz endet vor dem Pfeil',
    async () => {
      const { chromium } = await import('playwright');
      const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
      const browser = await chromium.launch({
        executablePath: chrome,
        headless: false,
        args: ['--no-sandbox', '--window-position=0,40'],
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

        const sel = page.locator('#k');
        const box = await sel.boundingBox();
        expect(box).not.toBeNull();
        if (!box) return;
        expect(box.width).toBeGreaterThan(260);
        expect(box.width).toBeLessThan(340);

        await page.waitForTimeout(400);
        const origin = await page.evaluate(() => ({
          sx: window.screenX,
          sy: window.screenY,
          chromeTop: window.outerHeight - window.innerHeight,
        }));
        const grab = {
          x: origin.sx + box.x,
          y: origin.sy + origin.chromeTop + box.y,
          w: box.width,
          h: box.height,
        };
        const py = spawnSync(
          'python3',
          [
            '-c',
            `import json,sys
from PIL import ImageGrab
b=json.loads(sys.argv[1])
im=ImageGrab.grab(bbox=(int(b['x']),int(b['y']),int(b['x']+b['w']),int(b['y']+b['h']))).convert('RGB')
w,h=im.size
px=im.load()
y0,y1=int(h*0.35),int(h*0.75)
xs=[]
for x in range(w):
    for y in range(y0,y1):
        r,g,bl=px[x,y]
        if r<80 and g<90 and bl<120:
            xs.append(x); break
runs=[]
if xs:
    von=prev=xs[0]
    for x in xs[1:]:
        if x>prev+3:
            runs.append((von,prev)); von=x
        prev=x
    runs.append((von,prev))
print(json.dumps({'breite':w,'hoehe':h,'textStart':runs[0][0] if runs else -1,'pfeilLinks':runs[-1][0] if runs else -1,'runs':len(runs)}))
`,
            JSON.stringify(grab),
          ],
          { encoding: 'utf8' },
        );
        expect(py.status, py.stderr).toBe(0);
        const lage = JSON.parse(py.stdout) as { breite: number; textStart: number; pfeilLinks: number; runs: number };
        expect(lage).not.toBeNull();
        if (!lage) return;
        expect(lage.pfeilLinks, JSON.stringify({ lage, grab })).toBeGreaterThan(lage.breite * 0.7);

        const breiten = await sel.evaluate((el) => {
          const select = el as HTMLSelectElement;
          const cs = getComputedStyle(select);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return [];
          ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          return [...select.options].map((o) => {
            const teile = o.label.split(' · ');
            const zusatz = teile.length >= 3 ? `${teile[0]} · ${teile[1]}` : null;
            return { label: o.label, px: zusatz ? ctx.measureText(zusatz).width : null };
          });
        });
        const mitZusatz = breiten.filter((b) => b.px !== null);
        expect(mitZusatz.length).toBeGreaterThanOrEqual(4);
        for (const b of mitZusatz) {
          expect(lage.textStart + (b.px as number), b.label).toBeLessThan(lage.pfeilLinks - 4);
        }
      } finally {
        await browser.close();
      }
    },
    30_000,
  );
});
