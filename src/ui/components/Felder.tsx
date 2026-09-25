import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { bearbeiteEingabe, formatBetrag, parseBetrag } from '../betrag';
import { fmtZahl, parseZahl } from '../format';

/** Feld mit Schätzwert: «geschätzt» (keine eigene Eingabe) oder eigene Eingabe mit Rücksetzen. */
export interface SchaetzAnzeige {
  /** true = der angezeigte Wert ist die Schätzung */
  geschaetzt: boolean;
  /** Schätzwert formatiert (für den Rücksetz-Hinweis) */
  wertText: string;
  onZuruecksetzen: () => void;
}

interface Basis {
  label: string;
  hinweis?: ReactNode;
  warnung?: string | null;
  schaetzung?: SchaetzAnzeige;
}

function Rahmen({ id, label, hinweis, warnung, schaetzung, children }: Basis & { id: string; children: ReactNode }) {
  return (
    <div className={`feld${warnung ? ' feld--warnung' : ''}${schaetzung?.geschaetzt ? ' feld--geschaetzt' : ''}`}>
      <label htmlFor={id}>
        {label}
        {schaetzung?.geschaetzt ? (
          <>
            {' '}
            <span className="badge-geschaetzt">geschätzt</span>
          </>
        ) : null}
      </label>
      {children}
      {schaetzung && !schaetzung.geschaetzt ? (
        <button type="button" className="link-knopf" onClick={schaetzung.onZuruecksetzen}>
          Zurücksetzen auf Schätzung ({schaetzung.wertText})
        </button>
      ) : null}
      {hinweis ? (
        <small className="feld__hinweis" id={`${id}-h`}>
          {hinweis}
        </small>
      ) : null}
      {warnung ? (
        <small className="feld__warnung" role="alert">
          {warnung}
        </small>
      ) : null}
    </div>
  );
}

interface BetragInputProps {
  id?: string;
  value: number;
  onChange: (v: number) => void;
  /** Nachkommastellen erlaubt (z.B. Fremdwährungsbeträge); Standard: ganze Beträge */
  dezimal?: boolean;
  min?: number;
  max?: number;
  describedBy?: string;
  /** Beim Antippen den ganzen Text markieren (z.B. Schätzwert überschreiben) */
  alleMarkieren?: boolean;
  /** Rückmeldung bei ungültiger Eingabe (null = gültig) */
  onFehler?: (fehler: string | null) => void;
}

const betragText = (v: number, dezimal: boolean): string => (v === 0 ? '' : formatBetrag(v, dezimal ? 2 : 0));

/**
 * Kontrolliertes Betragsfeld mit Schweizer Tausendertrennzeichen live während der Eingabe
 * (1’250’000). Parst Einfügungen wie «1 250 000» oder «1,250,000», hält den Cursor hinter
 * derselben Ziffer und erlaubt negative Werte nur, wenn `min` < 0.
 */
export function BetragInput({
  id,
  value,
  onChange,
  dezimal = false,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  describedBy,
  alleMarkieren = false,
  onFehler,
}: BetragInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => betragText(value, dezimal));
  const [fokus, setFokus] = useState(false);
  const caret = useRef<number | null>(null);
  const opt = { dezimal, negativ: min < 0 };

  useEffect(() => {
    if (!fokus) setText(betragText(value, dezimal));
  }, [value, fokus, dezimal]);

  // Cursor nach dem Neuformatieren an die berechnete Stelle setzen
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && caret.current !== null && document.activeElement === el) {
      el.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  const uebernehme = (t: string) => {
    const n = t.trim() === '' || t === '-' ? 0 : parseBetrag(t, opt);
    if (n === null) {
      onFehler?.('Bitte einen Betrag eingeben.');
      return;
    }
    if (n < min || n > max) {
      onFehler?.(`Erlaubter Bereich: ${formatBetrag(min)} bis ${formatBetrag(max)}`);
      return;
    }
    onFehler?.(null);
    onChange(n);
  };

  return (
    <input
      ref={ref}
      id={id}
      type="text"
      inputMode={dezimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={text}
      placeholder="0"
      aria-describedby={describedBy}
      onFocus={(e) => {
        setFokus(true);
        if (alleMarkieren) e.currentTarget.select();
      }}
      onPaste={(e) => {
        const eingefuegt = e.clipboardData.getData('text');
        const n = parseBetrag(eingefuegt, opt);
        if (n === null) return; // Browser-Standard, danach normale Bereinigung
        e.preventDefault();
        const el = e.currentTarget;
        const start = el.selectionStart ?? text.length;
        const ende = el.selectionEnd ?? text.length;
        // ganze Auswahl ersetzt → Betrag direkt übernehmen, sonst in den Text einfügen
        const ersatz = start === 0 && ende === text.length ? formatBetrag(n, dezimal ? 2 : 0) : String(n);
        const roh = text.slice(0, start) + ersatz + text.slice(ende);
        const r = bearbeiteEingabe(text, roh, start + ersatz.length, opt, 'insertFromPaste');
        caret.current = r.caret;
        setText(r.text);
        uebernehme(r.text);
      }}
      onChange={(e) => {
        const el = e.target;
        const inputType = (e.nativeEvent as InputEvent).inputType ?? '';
        const r = bearbeiteEingabe(text, el.value, el.selectionStart ?? el.value.length, opt, inputType);
        caret.current = r.caret;
        setText(r.text);
        uebernehme(r.text);
      }}
      onBlur={() => {
        setFokus(false);
        const n = text.trim() === '' || text === '-' ? 0 : parseBetrag(text, opt);
        // nur bei Änderung melden (sonst würde ein Schätzwert schon durch Antippen zur eigenen Eingabe)
        if (n !== null) {
          const w = Math.min(max, Math.max(min, n));
          if (w !== value) onChange(w);
        }
        onFehler?.(null);
      }}
    />
  );
}

interface BetragFeldProps extends Basis {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** Währung als Einheit (Standard CHF) */
  einheit?: string;
  dezimal?: boolean;
}

/** Betragsfeld (CHF oder Fremdwährung) mit Label, Einheit und Live-Tausendertrennzeichen. */
export function BetragFeld({
  label,
  hinweis,
  warnung,
  schaetzung,
  value,
  onChange,
  min = 0,
  max,
  einheit = 'CHF',
  dezimal = false,
}: BetragFeldProps) {
  const id = useId();
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <Rahmen id={id} label={label} hinweis={hinweis} warnung={fehler ?? warnung} schaetzung={schaetzung}>
      <div className="eingabe">
        <BetragInput
          id={id}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          dezimal={dezimal}
          alleMarkieren={schaetzung?.geschaetzt ?? false}
          describedBy={hinweis ? `${id}-h` : undefined}
          onFehler={setFehler}
        />
        {min < 0 ? (
          <button
            type="button"
            className="eingabe__vorzeichen"
            aria-label="Vorzeichen wechseln (+/−)"
            onClick={() => onChange(-value)}
          >
            ±
          </button>
        ) : null}
        <span className="eingabe__einheit">{einheit}</span>
      </div>
    </Rahmen>
  );
}

interface ZahlFeldProps extends Basis {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** Anzeige als Prozent (Wert 0.05 ↔ «5») */
  prozent?: boolean;
  einheit?: string;
  nachkomma?: number;
  gruppieren?: boolean;
}

function anzeige(v: number, prozent: boolean, nachkomma: number, gruppieren: boolean): string {
  // 0 wird als leeres Feld (Platzhalter «0») angezeigt: neutrale Voreinstellung
  if (v === 0) return '';
  const x = prozent ? v * 100 : v;
  if (gruppieren && Math.abs(x) >= 1000) return fmtZahl(x);
  return String(Number(x.toFixed(nachkomma)));
}

/** Zahleneingabe mit Schweizer Format (1'000), Komma oder Punkt, grosse Touch-Fläche. */
export function ZahlFeld({
  label,
  hinweis,
  warnung,
  schaetzung,
  value,
  onChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  prozent = false,
  einheit,
  nachkomma = 2,
  gruppieren = false,
}: ZahlFeldProps) {
  const id = useId();
  const [text, setText] = useState(() => anzeige(value, prozent, nachkomma, gruppieren));
  const [fokus, setFokus] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const faktor = prozent ? 100 : 1;

  useEffect(() => {
    if (!fokus) setText(anzeige(value, prozent, nachkomma, gruppieren));
  }, [value, fokus, prozent, nachkomma, gruppieren]);

  const bereich = `${min === Number.NEGATIVE_INFINITY ? '' : `min. ${fmtZahl(min * faktor)}`}${
    max === Number.POSITIVE_INFINITY ? '' : ` max. ${fmtZahl(max * faktor)}`
  }`.trim();

  return (
    <Rahmen id={id} label={label} hinweis={hinweis} warnung={fehler ?? warnung} schaetzung={schaetzung}>
      <div className="eingabe">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder="0"
          aria-describedby={hinweis ? `${id}-h` : undefined}
          aria-invalid={fehler ? true : undefined}
          onFocus={(e) => {
            setFokus(true);
            setText(value === 0 ? '' : String(Number((value * faktor).toFixed(nachkomma))));
            if (schaetzung?.geschaetzt) {
              const el = e.currentTarget;
              requestAnimationFrame(() => el.select());
            }
          }}
          onChange={(e) => {
            setText(e.target.value);
            const n = e.target.value.trim() === '' ? 0 : parseZahl(e.target.value);
            if (n === null) {
              setFehler('Bitte eine Zahl eingeben.');
              return;
            }
            const v = n / faktor;
            if (v < min || v > max) {
              setFehler(`Erlaubter Bereich: ${bereich}`);
              return;
            }
            setFehler(null);
            onChange(v);
          }}
          onBlur={() => {
            setFokus(false);
            const n = text.trim() === '' ? 0 : parseZahl(text);
            if (n !== null) {
              const w = Math.min(max, Math.max(min, n / faktor));
              if (Math.abs(w - value) > 1e-12) onChange(w);
            }
            setFehler(null);
          }}
        />
        {einheit || prozent ? <span className="eingabe__einheit">{prozent ? '%' : einheit}</span> : null}
      </div>
    </Rahmen>
  );
}

export function TextFeld({
  label,
  hinweis,
  value,
  onChange,
}: Basis & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <Rahmen id={id} label={label} hinweis={hinweis}>
      <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </Rahmen>
  );
}

export interface Option<T extends string | number> {
  value: T;
  label: string;
}

export function AuswahlFeld<T extends string | number>({
  label,
  hinweis,
  warnung,
  value,
  optionen,
  onChange,
}: Basis & { value: T; optionen: readonly Option<T>[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <Rahmen id={id} label={label} hinweis={hinweis} warnung={warnung}>
      <select
        id={id}
        value={String(value)}
        onChange={(e) => {
          const o = optionen.find((x) => String(x.value) === e.target.value);
          if (o) onChange(o.value);
        }}
      >
        {optionen.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </Rahmen>
  );
}

/** Segmentierte Auswahl (Radio-Gruppe) mit grossen Touch-Flächen. */
export function Segmente<T extends string>({
  label,
  value,
  optionen,
  onChange,
}: {
  label: string;
  value: T;
  optionen: readonly Option<T>[];
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="segmente">
      <legend>{label}</legend>
      <div className="segmente__reihe">
        {optionen.map((o) => (
          <label key={o.value} className={`segment${o.value === value ? ' segment--aktiv' : ''}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Schalter({
  label,
  hinweis,
  checked,
  onChange,
}: {
  label: string;
  hinweis?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="schalter">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>
        {label}
        {hinweis ? <small className="feld__hinweis">{hinweis}</small> : null}
      </label>
    </div>
  );
}
