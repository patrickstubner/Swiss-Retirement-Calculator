import { describe, expect, it } from 'vitest';
import { type AutomatZustand, type Ereignis, LEER, schalte } from './automat';

const lauf = (start: AutomatZustand, ...e: Ereignis[]) => e.reduce(schalte, start);

describe('Zustandsautomat', () => {
  it('Start, Pause, Weiter, Stopp', () => {
    const a = schalte(LEER, { art: 'start', total: 3 });
    expect(a).toEqual({ status: 'spielt', index: 0, total: 3 });
    expect(schalte(a, { art: 'pause' }).status).toBe('pause');
    expect(lauf(a, { art: 'pause' }, { art: 'weiter' }).status).toBe('spielt');
    expect(schalte(a, { art: 'stopp' })).toEqual(LEER);
  });

  it('ungültige Übergänge ändern nichts', () => {
    expect(schalte(LEER, { art: 'pause' })).toEqual(LEER);
    expect(schalte(LEER, { art: 'weiter' })).toEqual(LEER);
    expect(schalte(LEER, { art: 'satzEnde' })).toEqual(LEER);
    expect(schalte(LEER, { art: 'springe', index: 2 })).toEqual(LEER);
    const a = schalte(LEER, { art: 'start', total: 2 });
    expect(schalte(a, { art: 'weiter' })).toEqual(a);
    const p = schalte(a, { art: 'pause' });
    expect(schalte(p, { art: 'pause' })).toEqual(p);
    expect(schalte(p, { art: 'satzEnde' })).toEqual(p);
  });

  it('satzEnde geht weiter und beendet nach dem letzten Satz', () => {
    const a = schalte(LEER, { art: 'start', total: 2 });
    const b = schalte(a, { art: 'satzEnde' });
    expect(b.index).toBe(1);
    expect(schalte(b, { art: 'satzEnde' })).toEqual(LEER);
  });

  it('Start ohne Sätze bleibt leer; Startindex wird begrenzt', () => {
    expect(schalte(LEER, { art: 'start', total: 0 })).toEqual(LEER);
    expect(schalte(LEER, { art: 'start', total: 3, index: 99 }).index).toBe(2);
    expect(schalte(LEER, { art: 'start', total: 3, index: -4 }).index).toBe(0);
  });

  it('Sprung: im Pausenzustand bleibt Pause, hinter dem Ende wird beendet', () => {
    const p = lauf(schalte(LEER, { art: 'start', total: 5 }), { art: 'pause' });
    const s = schalte(p, { art: 'springe', index: 3 });
    expect(s).toEqual({ status: 'pause', index: 3, total: 5 });
    expect(schalte(s, { art: 'springe', index: 5 })).toEqual(LEER);
    expect(schalte(s, { art: 'springe', index: -2 }).index).toBe(0);
  });
});
