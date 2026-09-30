export interface Liste {
  salt: string;
  hashes: Set<string>;
}
export const STANDARD_SALT: string;
export const MAX_LISTE_ZEICHEN: number;
export const MAX_HASHES: number;
export function norm(w: string): string;
export function hashWort(w: string, salt?: string): string;
export function parseListe(text: string): Liste;
export function woerter(text: string): Set<string>;
export function pruefeText(name: string, text: string, liste: Liste | null, funde: string[]): void;
