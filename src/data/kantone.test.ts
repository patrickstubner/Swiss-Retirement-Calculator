import { describe, expect, it } from 'vitest';
import { KANTONE, kantonNach } from './kantone';

describe('Kantone', () => {
  it('enthält alle 26 Kantone genau einmal', () => {
    expect(KANTONE).toHaveLength(26);
    expect(new Set(KANTONE.map((k) => k.code)).size).toBe(26);
  });
  it('ZH und AG: exakte Tarife ausstehend, sonst Näherung (keine erfundenen Tarife)', () => {
    expect(kantonNach('ZH')?.status).toBe('exakt-ausstehend');
    expect(kantonNach('AG')?.status).toBe('exakt-ausstehend');
    expect(KANTONE.filter((k) => k.status === 'exakt')).toHaveLength(0);
  });
});
