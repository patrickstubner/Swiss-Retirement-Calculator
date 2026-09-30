/** Stimmenwahl: deutsche Stimmen bevorzugt (de-CH, dann de-DE, de-AT, übrige). Rein und ohne Browser. */

export interface StimmeInfo {
  /** stabile Kennung (voiceURI, sonst Name + Sprache) */
  id: string;
  name: string;
  lang: string;
  lokal: boolean;
}

/** Was wir von einer Browser-Stimme brauchen (SpeechSynthesisVoice). */
export interface RohStimme {
  voiceURI?: string;
  name?: string;
  lang?: string;
  localService?: boolean;
}

const normLang = (l: string | undefined) => (l ?? '').replace('_', '-').toLowerCase();

export const istDeutsch = (v: RohStimme): boolean => /^de(-|$)/.test(normLang(v.lang));

const RANG: Record<string, number> = { 'de-ch': 0, 'de-de': 1, 'de-at': 2 };

export function stimmeId(v: RohStimme): string {
  const uri = (v.voiceURI ?? '').slice(0, 200);
  return uri !== '' ? uri : `${(v.name ?? '').slice(0, 100)}|${normLang(v.lang)}`;
}

/** Deutsche Stimmen, sortiert: passende Sprache der Seite zuerst, lokale vor Netzstimmen, dann nach Name. */
export function deutscheStimmen(roh: readonly RohStimme[], seitenSprache = 'de-CH'): StimmeInfo[] {
  const bevorzugt = normLang(seitenSprache);
  return roh
    .filter(istDeutsch)
    .map((v) => ({
      info: {
        id: stimmeId(v),
        name: (v.name ?? 'Stimme').slice(0, 100),
        lang: v.lang ?? 'de',
        lokal: v.localService !== false,
      },
      rang: normLang(v.lang) === bevorzugt ? -1 : (RANG[normLang(v.lang)] ?? 3),
    }))
    .filter((x, i, a) => a.findIndex((y) => y.info.id === x.info.id) === i)
    .sort(
      (a, b) =>
        a.rang - b.rang || Number(b.info.lokal) - Number(a.info.lokal) || a.info.name.localeCompare(b.info.name, 'de'),
    )
    .map((x) => x.info);
}

/** Gewünschte (gespeicherte) Stimme, sofern vorhanden, sonst die erste der Liste, sonst null. */
export function waehleStimme(liste: readonly StimmeInfo[], gewuenscht: string | null): StimmeInfo | null {
  return liste.find((s) => s.id === gewuenscht) ?? liste[0] ?? null;
}
