/**
 * Diagrammfarben aus CSS-Variablen (hell/dunkel, siehe styles.css). Canvas kann keine CSS-Variablen
 * verwenden; deshalb werden sie beim Zeichnen gelesen. Ersatzwerte für Tests/ohne DOM.
 */
const ERSATZ = {
  haupt: '#174e5f',
  median: '#2f6f86',
  band: '#4c7fd9',
  bandFlaeche: 'rgba(76,127,217,0.14)',
  bandKern: 'rgba(76,127,217,0.3)',
  negativ: '#b42318',
  achse: '#4f5d68',
  gitter: '#e4e9ec',
  bargeld: '#2a9d8f',
  wertschriften: '#174e5f',
  sonstiges: '#8a5a44',
  wohneigentum: '#6d597a',
  freizuegigkeit: '#f4a261',
  saeule3a: '#e9c46a',
  pk: '#e36414',
  versionA: '#1f5fbf',
  versionB: '#c2570c',
  krise: 'rgba(217,98,43,0.14)',
  kriseRand: 'rgba(178,74,23,0.8)',
  kriseText: '#8a3310',
  kriseLabelHg: 'rgba(255,255,255,0.88)',
  // Abflüsse (gestapelte Grafik «Zu- und Abflüsse»)
  abfl1: '#174e5f',
  abfl2: '#6d597a',
  abfl3: '#2a9d8f',
  abfl4: '#e36414',
  abfl5: '#b42318',
  abfl6: '#8a5a44',
  abfl7: '#7a6a00',
  abfl8: '#4c7fd9',
  abfl9: '#6b7780',
} as const;

export type ChartFarbe = keyof typeof ERSATZ;

export function chartFarbe(name: ChartFarbe): string {
  if (typeof document === 'undefined') return ERSATZ[name];
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--chart-${name}`).trim();
  return v || ERSATZ[name];
}

/** Farbe mit Deckkraft (für Flächen), akzeptiert #rrggbb */
export function mitAlpha(farbe: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(farbe);
  if (!m?.[1]) return farbe;
  const n = Number.parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
