import { describe, expect, it } from 'vitest';
import { standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { dekodiere, kodiere, normalisiere } from './state';

const regeln = ladeRegeln(2026);

describe('Zustand (URL-Fragment)', () => {
  it('Kodieren und Dekodieren ergibt denselben Haushalt', () => {
    const h = standardHaushalt(regeln);
    h.personen[0] = {
      ...(h.personen[0] as (typeof h.personen)[number]),
      wohneigentum: { vorhanden: true, verkehrswert: 800000, hypothek: 300000 },
    };
    expect(dekodiere(kodiere(h), regeln)).toEqual(h);
  });

  it('Ehepaar: zwei vollständig individuelle Personen', () => {
    const h = normalisiere(
      {
        zivilstand: 'verheiratet',
        personen: [
          { geburtsjahr: 1962, geschlecht: 'w' },
          { geburtsjahr: 1958, bargeld: 5 },
        ],
      },
      regeln,
    );
    expect(h.personen).toHaveLength(2);
    expect(h.personen[0]?.geschlecht).toBe('w');
    expect(h.personen[1]?.geburtsjahr).toBe(1958);
    expect(h.personen[1]?.bargeld).toBe(5);
    expect(h.personen[1]?.wohneigentum.hypothek).toBe(0);
  });

  it('migriert frühere Felder freiesVermoegen/vermoegen zu Wertschriften', () => {
    expect(
      normalisiere({ freiesVermoegen: 123000, personen: [{ geburtsjahr: 1970 }] }, regeln).personen[0]?.wertschriften,
    ).toBe(123000);
    expect(normalisiere({ personen: [{ vermoegen: 7 }] }, regeln).personen[0]?.wertschriften).toBe(7);
  });

  it('Standardwerte sind neutral (keine Beispielvermögen)', () => {
    const h = standardHaushalt(regeln);
    const p = h.personen[0];
    expect(p?.lohn).toBe(0);
    expect(p?.bargeld).toBe(0);
    expect(p?.wertschriften).toBe(0);
    expect(p?.pk.guthaben).toBe(0);
    expect(p?.saeule3a.guthaben).toBe(0);
    expect(p?.ahv.renteMonat).toBe(0);
    expect(h.ausgaben.lebenshaltung).toBe(0);
  });

  it('Posten und Ereignisse werden normalisiert', () => {
    const h = normalisiere(
      {
        posten: [{ art: 'einnahme', betragJahr: 1000, person: 5, indexierung: { art: 'satz', satz: 0.02 } }],
        ereignisse: [{ betrag: -5 }],
      },
      regeln,
    );
    expect(h.posten[0]?.art).toBe('einnahme');
    expect(h.posten[0]?.person).toBe(0);
    expect(h.posten[0]?.indexierung).toEqual({ art: 'satz', satz: 0.02 });
    expect(h.ereignisse[0]?.betrag).toBe(-5);
  });

  it('Planungsalter bis 999, Standard 120', () => {
    expect(normalisiere({}, regeln).planungsalter).toBe(120);
    expect(normalisiere({ planungsalter: 5000 }, regeln).planungsalter).toBe(999);
  });
});
