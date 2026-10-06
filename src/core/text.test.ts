import { describe, expect, it } from 'vitest';
import { filterAnzeigename, ohneUnsichtbareZeichen } from './text';

describe('Unsichtbare Zeichen (N-01)', () => {
  it('entfernt Format-, Privat- und Nichtzeichen sowie U+2028/U+2029', () => {
    const roh = `A\u202EB\u200B\u200C\u200D\uFEFF\u2028\u2029C\uE000D\uFFFFE`;
    expect(ohneUnsichtbareZeichen(roh)).toBe('ABCDE');
    expect(filterAnzeigename(`  ${roh}<x>  `, 40, true)).toBe('  ABCDEx  ');
    expect(filterAnzeigename(`Name\u0000\u202E`, 40)).toBe('Name');
    expect(filterAnzeigename('ä'.repeat(50), 40)).toHaveLength(40);
  });
});
