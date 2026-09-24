import { type ReactNode, useEffect, useId, useState } from 'react';
import { fmtZahl, parseZahl } from '../format';

interface Basis {
  label: string;
  hinweis?: ReactNode;
  warnung?: string | null;
}

function Rahmen({ id, label, hinweis, warnung, children }: Basis & { id: string; children: ReactNode }) {
  return (
    <div className={`feld${warnung ? ' feld--warnung' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
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
  value,
  onChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  prozent = false,
  einheit,
  nachkomma = 2,
  gruppieren = true,
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
    <Rahmen id={id} label={label} hinweis={hinweis} warnung={fehler ?? warnung}>
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
          onFocus={() => {
            setFokus(true);
            setText(value === 0 ? '' : String(Number((value * faktor).toFixed(nachkomma))));
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
            if (n !== null) onChange(Math.min(max, Math.max(min, n / faktor)));
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
