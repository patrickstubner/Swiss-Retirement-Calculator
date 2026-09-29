import { describe, expect, it } from 'vitest';
import { krisenPool } from './krisen';

describe('Krisenpool', () => {
  it('enthält nur Krisen mit realem Rückgang ≥ 20 % (100 % Aktien)', () => {
    const ids = krisenPool().map((k) => k.krise.id);
    expect(ids).toContain('finanzkrise2007');
    expect(ids).toContain('depression1929');
    expect(ids).not.toContain('covid2020');
    expect(ids).not.toContain('eurokrise2011');
  });
});
