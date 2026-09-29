import { describe, expect, it } from 'vitest';
import { jahresBereiche } from './schritte/Ergebnis';

describe('jahresBereiche', () => {
  it('fasst aufeinanderfolgende Jahre zusammen', () => {
    expect(jahresBereiche([2028, 2026, 2027, 2031])).toBe('2026–2028, 2031');
    expect(jahresBereiche([2030])).toBe('2030');
    expect(jahresBereiche([])).toBe('');
  });
});
