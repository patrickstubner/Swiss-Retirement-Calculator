export function parseVersion(text: string): [number, number, number] | null;
export function vergleicheVersion(a: string, b: string): -1 | 0 | 1 | null;
export function pruefeVersionsErhoehung(basis: string, kopf: string): { ok: boolean; meldung: string };
