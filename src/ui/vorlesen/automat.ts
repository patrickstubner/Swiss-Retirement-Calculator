/**
 * Zustandsautomat des Vorlesens (rein, ohne Browser). Der Controller führt die Wirkungen aus
 * (Sprechen, Abbrechen); der Automat entscheidet nur, in welchem Zustand die Wiedergabe ist.
 */

export type Status = 'leer' | 'spielt' | 'pause';

export interface AutomatZustand {
  status: Status;
  /** Index des aktuellen Satzes */
  index: number;
  /** Anzahl Sätze der Warteschlange */
  total: number;
}

export type Ereignis =
  | { art: 'start'; total: number; index?: number }
  | { art: 'pause' }
  | { art: 'weiter' }
  | { art: 'stopp' }
  /** aktueller Satz ist fertig gelesen */
  | { art: 'satzEnde' }
  /** Sprung auf einen Satz (`index` >= total = Ende) */
  | { art: 'springe'; index: number };

export const LEER: AutomatZustand = { status: 'leer', index: 0, total: 0 };

export function schalte(z: AutomatZustand, e: Ereignis): AutomatZustand {
  switch (e.art) {
    case 'start': {
      const total = Math.max(0, Math.trunc(e.total));
      if (total === 0) return LEER;
      const index = Math.min(total - 1, Math.max(0, Math.trunc(e.index ?? 0)));
      return { status: 'spielt', index, total };
    }
    case 'pause':
      return z.status === 'spielt' ? { ...z, status: 'pause' } : z;
    case 'weiter':
      return z.status === 'pause' ? { ...z, status: 'spielt' } : z;
    case 'stopp':
      return LEER;
    case 'satzEnde': {
      if (z.status !== 'spielt') return z;
      return z.index + 1 >= z.total ? LEER : { ...z, index: z.index + 1 };
    }
    case 'springe': {
      if (z.status === 'leer') return z;
      if (e.index >= z.total) return LEER;
      return { ...z, index: Math.max(0, Math.trunc(e.index)) };
    }
  }
}
