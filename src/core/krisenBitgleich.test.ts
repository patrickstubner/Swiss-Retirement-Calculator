/**
 * Die Anzeige der Krisen-Schwere darf die Simulation nicht verschieben.
 * Zwei Läufe derselben Eingabe sind bitgleich; die gespeicherte Id, nicht die Listenposition,
 * wählt die Krise. Die Konstanten unten sind der Stand vor der reinen Anzeigeänderung.
 */
import { describe, expect, it } from 'vitest';
import { neueKrisenEinstellungen, neuePerson, standardHaushalt } from '../data/defaults';
import { KRISEN, krisenNachSchwere, krisenOptionen } from '../data/krisen';
import { ladeRegeln } from '../rules';
import { simuliere } from './simulation';
import type { Haushalt, JahresZeile, SimulationsErgebnis } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

/**
 * Voller Verlauf (Erfolg, Ruin, Endvermögen, Krisenjahre, Vermögen je Jahr auf 17 Stellen).
 * Stand der Rechnung ohne die Anzeigeänderung. `toBe` vergleicht bitgenau.
 */
const SIGNATUR_AUTOMATISCH =
  '1||359576.14486050472|2036:oelkrise1973:1973:1-12,2037:oelkrise1973:1974:1-12,2050:schwarzerMontag1987:1987:1-12|2026:448730.60466058605;2027:500037.70930576447;2028:554053.38216091355;2029:610923.39941436588;2030:622941.70798527449;2031:630209.92470755137;2032:637562.94386582635;2033:645001.75489855814;2034:652527.35878854909;2035:660140.76819763973;2036:509180.29570256866;2037:359756.05046374653;2038:365849.12109291251;2039:370117.69175638247;2040:374436.06627192837;2041:378804.82572953968;2042:383224.55799911456;2043:387695.85780956515;2044:392219.32682884543;2045:396795.57374491321;2046:401425.21434763621;2047:406108.87161165429;2048:410847.17578020837;2049:415640.76444994716;2050:333662.82128176931;2051:339313.95941766980;2052:343272.92919337755;2053:347278.09053076425;2054:351329.98237316398;2055:355429.14995207044;2056:359576.14486050472';
const SIGNATUR_INDIVIDUELL =
  '1||302835.35187693941|2030:finanzkrise2007:2007:1-12,2031:finanzkrise2007:2008:1-12,2032:finanzkrise2007:2009:1-12,2036:covid2020:2020:7-12,2037:covid2020:2020:1-6|2026:437103.44009900989;2027:475092.28218066855;2028:513981.84213563561;2029:553794.41496077518;2030:523051.93343413639;2031:411232.14895988395;2032:458996.02279329451;2033:442135.87185702601;2034:434956.63591796142;2035:427893.97371097672;2036:420546.85056326038;2037:413325.88067280909;2038:406614.45053119119;2039:400011.99806712032;2040:393516.75374207005;2041:387126.97675061470;2042:380840.95455387206;2043:374657.00242052204;2044:368573.46297527791;2045:362588.70575468929;2046:356701.12677015772;2047:350909.14807804825;2048:345211.21735678095;2049:339605.80749078962;2050:334091.41616123624;2051:328666.56544337067;2052:323329.80141042883;2053:318079.69374396250;2054:312914.83535049623;2055:307833.84198440897;2056:302835.35187693941';

function haushalt(patch: Partial<Haushalt> = {}): Haushalt {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: 'Beispiel',
    geburtsjahr: 1966,
    geburtsmonat: 6,
    lohn: 90_000,
    stoppAlter: 64,
    wertschriften: 400_000,
  });
  return {
    ...h,
    personen: [p],
    ausgaben: { ...h.ausgaben, lebenshaltung: 55_000 },
    planungsalter: 90,
    annahmen: { ...h.annahmen, renditeNominal: 0.04, inflation: 0.01, aktienanteil: 0.6 },
    krisen: { ...neueKrisenEinstellungen(), modus: 'automatisch' },
    ...patch,
  };
}

function signatur(e: SimulationsErgebnis): string {
  const zeilen = e.zeilen.map((z) => `${z.jahr}:${z.vermoegen.toPrecision(17)}`).join(';');
  const krisen = e.krisenJahre
    .map((k) => `${k.jahr}:${k.krise}:${k.histJahr}:${k.monatVon ?? 1}-${k.monatBis ?? 12}`)
    .join(',');
  return `${e.erfolg ? 1 : 0}|${e.ruinJahr ?? ''}|${e.endVermoegen.toPrecision(17)}|${krisen}|${zeilen}`;
}

function zeilenGleich(a: readonly JahresZeile[], b: readonly JahresZeile[]): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(a[i]?.vermoegen).toBe(b[i]?.vermoegen);
    expect(a[i]?.jahr).toBe(b[i]?.jahr);
  }
}

describe('Simulation bleibt bitgleich', () => {
  it('Automatisch: zwei Läufe und die Krisen-Ids hängen nicht an der Anzeigereihenfolge', () => {
    const h = haushalt();
    const a = simuliere(h, regeln, { start, krisen: krisenOptionen(h) });
    const b = simuliere(h, regeln, { start, krisen: krisenOptionen(h) });
    expect(signatur(a)).toBe(signatur(b));
    zeilenGleich(a.zeilen, b.zeilen);
    const ids = krisenOptionen(h)?.wahl.map((w) => w.krise.id) ?? [];
    expect(ids.slice(0, 3)).toEqual(['oelkrise1973', 'schwarzerMontag1987', 'immobilienCh1990']);
    expect(krisenNachSchwere()[0]?.id).toBe('japan1990');
    expect(KRISEN[0]?.id).toBe('depression1929');
    expect(a.endVermoegen).toBe(a.zeilen.at(-1)?.vermoegen);
    expect(signatur(a)).toBe(SIGNATUR_AUTOMATISCH);
  });

  it('Individuell: Auswahl über die Id, Ergebnis zweier Läufe bitgleich', () => {
    const h = haushalt({
      krisen: {
        ...neueKrisenEinstellungen(),
        modus: 'individuell',
        ausgleich: false,
        auswahl: [
          {
            uid: 'a',
            id: 'finanzkrise2007',
            land: 'CHE',
            startArt: 'jahr',
            jahr: 2030,
            alter: 70,
            person: 0,
            jahreNach: 0,
            monat: 1,
            eigen: null,
          },
          {
            uid: 'b',
            id: 'covid2020',
            land: 'CHE',
            startArt: 'jahr',
            jahr: 2036,
            alter: 70,
            person: 0,
            jahreNach: 0,
            monat: 7,
            eigen: null,
          },
        ],
      },
    });
    const opt = krisenOptionen(h);
    expect(opt?.wahl.map((w) => w.krise.id)).toEqual(['finanzkrise2007', 'covid2020']);
    const a = simuliere(h, regeln, { start, krisen: opt });
    const c = simuliere(h, regeln, { start, krisen: krisenOptionen(h) });
    expect(signatur(a)).toBe(signatur(c));
    zeilenGleich(a.zeilen, c.zeilen);
    expect(a.zeilen.find((z) => z.jahr === 2030)?.vermoegen).toBe(c.zeilen.find((z) => z.jahr === 2030)?.vermoegen);
    expect(signatur(a)).toBe(SIGNATUR_INDIVIDUELL);
  });
});
