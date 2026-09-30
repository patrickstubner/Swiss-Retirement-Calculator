/** Fake-speechSynthesis für Tests (kein Browser nötig). Nur in Tests verwendet. */
import type { AeusserungLike, Umgebung } from './controller';
import type { RohStimme } from './stimmen';

export class FakeAeusserung implements AeusserungLike {
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: unknown = null;
  onstart: AeusserungLike['onstart'] = null;
  onend: AeusserungLike['onend'] = null;
  onerror: AeusserungLike['onerror'] = null;
  onboundary: AeusserungLike['onboundary'] = null;
  constructor(public text: string) {}
}

export class FakeSynth {
  gesprochen: FakeAeusserung[] = [];
  aktiv: FakeAeusserung | null = null;
  abgebrochen = 0;
  private hoerer: (() => void)[] = [];
  stimmen: RohStimme[];
  constructor(stimmen: RohStimme[] = [{ voiceURI: 'de-ch-1', name: 'Test CH', lang: 'de-CH', localService: true }]) {
    this.stimmen = stimmen;
  }
  speak(u: AeusserungLike) {
    const f = u as FakeAeusserung;
    this.gesprochen.push(f);
    this.aktiv = f;
  }
  cancel() {
    this.abgebrochen++;
    const a = this.aktiv;
    this.aktiv = null;
    // echte Browser melden bei cancel ein error/end der alten Äusserung: wird vom Controller verworfen
    a?.onerror?.({ error: 'canceled' });
    a?.onend?.();
  }
  getVoices() {
    return this.stimmen;
  }
  addEventListener(_a: 'voiceschanged', fn: () => void) {
    this.hoerer.push(fn);
  }
  removeEventListener(_a: 'voiceschanged', fn: () => void) {
    this.hoerer = this.hoerer.filter((h) => h !== fn);
  }
  melde() {
    for (const h of this.hoerer) h();
  }
  /** Die aktuelle Äusserung beginnt / endet (wie der Browser). */
  starte() {
    this.aktiv?.onstart?.();
  }
  beende() {
    const a = this.aktiv;
    this.aktiv = null;
    a?.onend?.();
  }
}

export class FakeUhr {
  ms = 1000;
  private timer = new Map<number, { faellig: number; fn: () => void }>();
  private n = 1;
  jetzt = () => this.ms;
  setTimer = (fn: () => void, ms: number) => {
    const id = this.n++;
    this.timer.set(id, { faellig: this.ms + ms, fn });
    return id;
  };
  loescheTimer = (id: unknown) => {
    this.timer.delete(id as number);
  };
  vor(ms: number) {
    this.ms += ms;
    for (const [id, t] of [...this.timer]) {
      if (t.faellig <= this.ms) {
        this.timer.delete(id);
        t.fn();
      }
    }
  }
  offen() {
    return this.timer.size;
  }
}

export function fakeUmgebung(
  synth = new FakeSynth(),
  uhr = new FakeUhr(),
): { env: Umgebung; synth: FakeSynth; uhr: FakeUhr } {
  return {
    synth,
    uhr,
    env: {
      synth,
      neueAeusserung: (t) => new FakeAeusserung(t),
      jetzt: uhr.jetzt,
      setTimer: uhr.setTimer,
      loescheTimer: uhr.loescheTimer,
      seitenSprache: 'de-CH',
    },
  };
}
