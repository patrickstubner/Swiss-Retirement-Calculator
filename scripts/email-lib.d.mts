export const AUSNAHME_COMMITS: Set<string>;
export function istPrivateDomain(domain: string): boolean;
export function istErlaubt(adresse: string): boolean;
export function adressen(text: string): string[];
export function pruefeText(ort: string, text: string, funde: string[]): void;
export function pruefeCommits(
  rohLog: string,
  funde: string[],
  ausnahmen?: Set<string>,
): { geprueft: number; uebersprungen: number };
