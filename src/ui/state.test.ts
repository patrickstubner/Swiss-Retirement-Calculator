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
          { geburtsjahr: 1958, vermoegen: 5 },
        ],
      },
      regeln,
    );
    expect(h.personen).toHaveLength(2);
    expect(h.personen[0]?.geschlecht).toBe('w');
    expect(h.personen[1]?.geburtsjahr).toBe(1958);
    expect(h.personen[1]?.vermoegen).toBe(5);
    expect(h.personen[1]?.wohneigentum.hypothek).toBe(0);
  });

  it('migriert das frühere gemeinsame Feld freiesVermoegen zu Person 1', () => {
    const h = normalisiere({ freiesVermoegen: 123000, personen: [{ geburtsjahr: 1970 }] }, regeln);
    expect(h.personen[0]?.vermoegen).toBe(123000);
  });

  it('Planungsalter bis 999, Standard 120', () => {
    expect(normalisiere({}, regeln).planungsalter).toBe(120);
    expect(normalisiere({ planungsalter: 5000 }, regeln).planungsalter).toBe(999);
  });
});
