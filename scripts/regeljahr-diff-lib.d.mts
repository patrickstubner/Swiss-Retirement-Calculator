export type RegelKnoten = { value: unknown; source: unknown; stand: unknown; status: unknown };
export function flach(json: unknown): Map<string, RegelKnoten>;
export type RegeljahrDiff = {
  neuHinzu: string[];
  entfernt: string[];
  geaendert: {
    schluessel: string;
    felder: string[];
    alt: unknown;
    neu: unknown;
    statusAlt: unknown;
    statusNeu: unknown;
  }[];
  unveraendert: number;
  offenNeu: string[];
};
export function regeljahrDiff(alt: unknown, neu: unknown): RegeljahrDiff;
export function alsMarkdown(d: RegeljahrDiff, von: string, nach: string): string;
