/**
 * Steuerung der Sprachausgabe (Web Speech API, `speechSynthesis`), ohne direkten Zugriff auf `window`:
 * Browser-Objekte kommen über `Umgebung` herein, damit die Logik mit einem Fake getestet werden kann.
 *
 * Bekannte Eigenheiten der API und wie sie hier umgangen werden:
 * - Lange Äusserungen werden von Chrome nach ca. 15 s abgebrochen: es wird satzweise gesprochen (`plan.ts`).
 * - `pause()`/`resume()` sind auf Android/Chrome unzuverlässig: Pause = `cancel()`, Weiter = Satz neu starten.
 * - `cancel()` löst bei der alten Äusserung ein `end`/`error` aus: veraltete Ereignisse werden über einen
 *   Zähler (`gen`) verworfen.
 * - Manchmal kommt kein `end`: ein Wächter-Timer geht nach der geschätzten Dauer (mit Reserve) zum nächsten Satz.
 * - Sprünge (±10 s) sind nur geschätzt (`zeit.ts`) und landen immer auf Satzgrenzen.
 */
import { anzeigeBereich } from './aufbereitung';
import { type AutomatZustand, LEER, schalte } from './automat';
import type { Satz } from './plan';
import { deutscheStimmen, type RohStimme, type StimmeInfo, stimmeId, waehleStimme } from './stimmen';
import { kalibriere, START_ZEICHEN_PRO_SEKUNDE, schaetzeDauer, sprungZiel } from './zeit';

export interface AeusserungLike {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: unknown;
  onstart: ((e?: unknown) => void) | null;
  onend: ((e?: unknown) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onboundary: ((e: { name?: string; charIndex?: number }) => void) | null;
}

export interface SynthLike {
  speak(u: AeusserungLike): void;
  cancel(): void;
  getVoices(): RohStimme[];
  speaking?: boolean;
  pending?: boolean;
  addEventListener?(art: 'voiceschanged', fn: () => void): void;
  removeEventListener?(art: 'voiceschanged', fn: () => void): void;
}

export interface Umgebung {
  synth: SynthLike;
  neueAeusserung(text: string): AeusserungLike;
  /** Zeit in Millisekunden (monoton) */
  jetzt(): number;
  setTimer(fn: () => void, ms: number): unknown;
  loescheTimer(id: unknown): void;
  seitenSprache: string;
}

export const TEMPI = [0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.75] as const;
export const STANDARD_TEMPO = 1;
export const SPRUNG_SEKUNDEN = 10;

export interface Ansicht {
  status: AutomatZustand['status'];
  index: number;
  total: number;
  /** aktueller Satz (Block-Index und Bereich im Blocktext) */
  satz: { block: number; von: number; bis: number } | null;
  /** aktuell gesprochenes Wort als Bereich im Blocktext (falls der Browser Wortgrenzen meldet) */
  wort: { von: number; bis: number } | null;
  tempo: number;
  stimmeId: string | null;
  stimmen: StimmeInfo[];
  /** geschätzte verbleibende Sekunden */
  rest: number;
  /** Fehler in einfachen Worten (ohne Textinhalt), sonst null */
  fehler: string | null;
  /** Stimmen wurden geladen (sonst kann die Verfügbarkeit noch nicht beurteilt werden) */
  stimmenGeladen: boolean;
}

type Hoerer = (a: Ansicht) => void;

const klemmeTempo = (t: number) => (Number.isFinite(t) ? Math.min(2, Math.max(0.5, t)) : STANDARD_TEMPO);

export class Vorleser {
  private zustand: AutomatZustand = LEER;
  private saetze: Satz[] = [];
  private gen = 0;
  private timer: unknown = null;
  /** Referenz halten: Chrome sammelt sonst laufende Äusserungen ein und meldet kein `end`. */
  private aktuell: AeusserungLike | null = null;
  private startMs = 0;
  private wort: { von: number; bis: number } | null = null;
  private cps = START_ZEICHEN_PRO_SEKUNDE;
  private tempo = STANDARD_TEMPO;
  private stimmen: StimmeInfo[] = [];
  private roh = new Map<string, RohStimme>();
  private gewaehlt: string | null = null;
  private fehler: string | null = null;
  private geladen = false;
  private hoerer = new Set<Hoerer>();
  private readonly beiVoices = () => this.ladeStimmen();

  constructor(private readonly env: Umgebung) {
    env.synth.addEventListener?.('voiceschanged', this.beiVoices);
    this.ladeStimmen();
  }

  /** Aufräumen (Komponente verschwindet): Ausgabe stoppen, Ereignisse lösen. */
  beende(): void {
    this.stoppe();
    this.env.synth.removeEventListener?.('voiceschanged', this.beiVoices);
    this.hoerer.clear();
  }

  abonniere(fn: Hoerer): () => void {
    this.hoerer.add(fn);
    fn(this.ansicht());
    return () => {
      this.hoerer.delete(fn);
    };
  }

  // ---------- Einstellungen ----------

  setzeTempo(t: number): void {
    this.tempo = klemmeTempo(t);
    if (this.zustand.status === 'spielt') this.sprecheAktuellen();
    else this.melde();
  }

  /** Vorgabe (z.B. aus dem Speicher), ohne laufende Wiedergabe zu beeinflussen. */
  ladeEinstellungen(tempo: number | null, stimme: string | null): void {
    if (tempo !== null) this.tempo = klemmeTempo(tempo);
    if (stimme !== null) this.gewaehlt = stimme;
    this.melde();
  }

  setzeStimme(id: string): void {
    if (!this.stimmen.some((s) => s.id === id)) return;
    this.gewaehlt = id;
    if (this.zustand.status === 'spielt') this.sprecheAktuellen();
    else this.melde();
  }

  // ---------- Bedienung ----------

  /** Startet mit einer neuen Warteschlange. Muss direkt aus einer Nutzergeste aufgerufen werden (iOS). */
  start(saetze: Satz[], index = 0): boolean {
    this.stoppe();
    if (saetze.length === 0 || this.stimmen.length === 0) return false;
    this.saetze = saetze;
    this.fehler = null;
    this.zustand = schalte(LEER, { art: 'start', total: saetze.length, index });
    this.sprecheAktuellen();
    return true;
  }

  pause(): void {
    if (this.zustand.status !== 'spielt') return;
    this.zustand = schalte(this.zustand, { art: 'pause' });
    this.pausenFortschritt = this.fortschritt();
    this.verwirf();
    this.melde();
  }

  weiter(): void {
    if (this.zustand.status !== 'pause') return;
    this.zustand = schalte(this.zustand, { art: 'weiter' });
    this.sprecheAktuellen();
  }

  umschalten(): void {
    if (this.zustand.status === 'spielt') this.pause();
    else if (this.zustand.status === 'pause') this.weiter();
  }

  stoppe(): void {
    const war = this.zustand.status !== 'leer';
    this.zustand = LEER;
    this.wort = null;
    this.pausenFortschritt = 0;
    this.verwirf();
    if (war || this.saetze.length > 0) {
      this.saetze = [];
      this.melde();
    }
  }

  /** 10 Sekunden zurück/vor (geschätzt, auf Satzgrenzen). */
  springe(sekunden: number): void {
    if (this.zustand.status === 'leer') return;
    const ziel = sprungZiel(this.dauern(), this.zustand.index, this.fortschritt(), sekunden);
    this.pausenFortschritt = 0;
    this.zustand = schalte(this.zustand, { art: 'springe', index: ziel });
    if (this.zustand.status === 'leer') {
      this.stoppe();
      return;
    }
    if (this.zustand.status === 'spielt') this.sprecheAktuellen();
    else {
      this.verwirf();
      this.wort = null;
      this.melde();
    }
  }

  // ---------- Innenleben ----------

  private pausenFortschritt = 0;

  private dauern(): number[] {
    return this.saetze.map((s) => schaetzeDauer(s.sprech.length, this.tempo, this.cps));
  }

  private fortschritt(): number {
    if (this.zustand.status === 'pause') return this.pausenFortschritt;
    return this.startMs > 0 ? Math.max(0, (this.env.jetzt() - this.startMs) / 1000) : 0;
  }

  private verwirf(): void {
    this.gen++;
    if (this.timer !== null) {
      this.env.loescheTimer(this.timer);
      this.timer = null;
    }
    this.startMs = 0;
    this.aktuell = null;
    try {
      this.env.synth.cancel();
    } catch {
      // ältere Browser: ignorieren
    }
  }

  private aktuelleStimme(): StimmeInfo | null {
    return waehleStimme(this.stimmen, this.gewaehlt);
  }

  private ladeStimmen(): void {
    let liste: RohStimme[] = [];
    try {
      liste = this.env.synth.getVoices() ?? [];
    } catch {
      liste = [];
    }
    // nur lokale Stimmen: Netzstimmen (z.B. «Google Deutsch» in Chrome) würden den Text an einen Server senden
    const lokal = liste.filter((v) => v.localService !== false);
    this.stimmen = deutscheStimmen(lokal, this.env.seitenSprache);
    this.roh = new Map(lokal.map((v) => [stimmeId(v), v]));
    if (liste.length > 0) this.geladen = true;
    this.melde();
  }

  /** Nach kurzer Wartezeit gelten die Stimmen als endgültig geladen (manche Browser melden nie `voiceschanged`). */
  markiereGeladen(): void {
    if (!this.geladen) {
      this.geladen = true;
      this.melde();
    }
  }

  private sprecheAktuellen(): void {
    const satz = this.saetze[this.zustand.index];
    if (!satz || this.zustand.status !== 'spielt') return;
    this.verwirf();
    this.wort = null;
    const stimme = this.aktuelleStimme();
    const gen = this.gen;
    const u = this.env.neueAeusserung(satz.sprech);
    this.aktuell = u;
    u.lang = stimme?.lang ?? this.env.seitenSprache;
    u.voice = stimme ? (this.roh.get(stimme.id) ?? null) : null;
    u.rate = this.tempo;
    u.pitch = 1;
    u.volume = 1;
    const geschaetzt = schaetzeDauer(satz.sprech.length, this.tempo, this.cps);
    u.onstart = () => {
      if (gen !== this.gen) return;
      this.startMs = this.env.jetzt();
    };
    u.onboundary = (e) => {
      if (gen !== this.gen || e.name === 'sentence') return;
      const b = anzeigeBereich(satz, satz.anzeige, e.charIndex ?? -1);
      this.wort = b ? { von: satz.von + b.von, bis: satz.von + b.bis } : null;
      this.melde();
    };
    u.onend = () => {
      if (gen !== this.gen) return;
      this.satzFertig(satz);
    };
    u.onerror = (e) => {
      if (gen !== this.gen) return;
      if (e?.error === 'canceled' || e?.error === 'interrupted') return;
      this.fehler =
        e?.error === 'not-allowed'
          ? 'Der Browser hat das Vorlesen blockiert. Bitte erneut auf «Vorlesen» tippen.'
          : 'Das Vorlesen wurde vom Browser abgebrochen.';
      this.stoppe();
    };
    this.startMs = this.env.jetzt();
    this.timer = this.env.setTimer(
      () => {
        if (gen !== this.gen) return;
        this.satzFertig(satz, false);
      },
      Math.round((geschaetzt * 2.5 + 6) * 1000),
    );
    this.melde();
    try {
      this.env.synth.speak(u);
    } catch {
      this.fehler = 'Das Vorlesen ist auf diesem Gerät nicht möglich.';
      this.stoppe();
    }
  }

  private satzFertig(satz: Satz, messen = true): void {
    if (messen && this.startMs > 0) {
      const sek = (this.env.jetzt() - this.startMs) / 1000;
      this.cps = kalibriere(this.cps, satz.sprech.length, sek, this.tempo);
    }
    this.gen++;
    if (this.timer !== null) {
      this.env.loescheTimer(this.timer);
      this.timer = null;
    }
    this.startMs = 0;
    this.zustand = schalte(this.zustand, { art: 'satzEnde' });
    this.wort = null;
    if (this.zustand.status === 'spielt') this.sprecheAktuellen();
    else {
      this.saetze = [];
      this.melde();
    }
  }

  /** Die gerade laufende Äusserung (nur für Tests und zum Festhalten der Referenz). */
  laufendeAeusserung(): AeusserungLike | null {
    return this.aktuell;
  }

  ansicht(): Ansicht {
    const satz = this.saetze[this.zustand.index] ?? null;
    const d = this.dauern();
    let rest = 0;
    if (this.zustand.status !== 'leer') {
      for (let i = this.zustand.index; i < d.length; i++) rest += d[i] ?? 0;
      rest = Math.max(0, rest - this.fortschritt());
    }
    return {
      status: this.zustand.status,
      index: this.zustand.index,
      total: this.zustand.total,
      satz: satz && this.zustand.status !== 'leer' ? { block: satz.block, von: satz.von, bis: satz.bis } : null,
      wort: this.wort,
      tempo: this.tempo,
      stimmeId: this.aktuelleStimme()?.id ?? null,
      stimmen: this.stimmen,
      rest,
      fehler: this.fehler,
      stimmenGeladen: this.geladen,
    };
  }

  private melde(): void {
    const a = this.ansicht();
    for (const h of [...this.hoerer]) h(a);
  }
}
