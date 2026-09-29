/**
 * Dünner React-Wrapper um uPlot (~50 kB, Canvas, sehr schnell auch mit vielen Punkten).
 */
import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { chartFarbe } from '../farben';
import { fmtChf, fmtKompakt } from '../format';

export interface Serie {
  label: string;
  werte: (number | null)[];
  farbe: string;
  fuellung?: string;
  /** gestapelt (kumuliert) darstellen; Legende zeigt den Einzelwert */
  stapel?: boolean;
  /** gestrichelte Linie */
  gestrichelt?: boolean;
  /** auf der rechten y-Achse (zweite Skala), z.B. Ausgaben neben dem Vermögen */
  rechts?: boolean;
}

/** Fläche zwischen zwei Serien (per Label) */
export interface Band {
  oben: string;
  unten: string;
  fuellung: string;
}

interface Props {
  x: number[];
  xLabel: string;
  serien: Serie[];
  beschreibung: string;
  hoehe?: number;
  /** Fläche zwischen zwei (nicht gestapelten) Serien, z.B. Bandbreite 10.–90. Perzentil */
  baender?: Band[];
  /** Farbig hinterlegte x-Bereiche mit Beschriftung, z.B. Krisenjahre */
  markierungen?: Markierung[];
  /** Beschriftung der linken bzw. rechten y-Achse (rechte Achse nur mit Serien `rechts`) */
  yLabel?: string;
  y2Label?: string;
  /** x-Achse nur mit ganzen Zahlen beschriften (Kalenderjahre) */
  xGanzzahl?: boolean;
}

export interface Markierung {
  /** x-Bereich (gleiche Einheit wie x) */
  von: number;
  bis: number;
  label: string;
}

/** Hinterlegt die Bereiche (halbtransparent über dem Diagramm) */
function zeichneFlaechen(u: uPlot, m: readonly Markierung[]) {
  const ctx = u.ctx;
  const { left, top, width, height } = u.bbox;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, width, height);
  ctx.clip();
  ctx.fillStyle = chartFarbe('krise');
  ctx.strokeStyle = chartFarbe('kriseRand');
  ctx.lineWidth = 1;
  for (const b of m) {
    const x0 = u.valToPos(b.von, 'x', true);
    const x1 = u.valToPos(b.bis, 'x', true);
    ctx.fillRect(x0, top, Math.max(2, x1 - x0), height);
    ctx.beginPath();
    ctx.moveTo(x0 + 0.5, top);
    ctx.lineTo(x0 + 0.5, top + height);
    ctx.stroke();
  }
  ctx.restore();
}

/** Beschriftet die Bereiche oben (über den Linien, mit Hintergrund für den Kontrast) */
function zeichneLabels(u: uPlot, m: readonly Markierung[]) {
  const ctx = u.ctx;
  const { left, top, width } = u.bbox;
  const pr = uPlot.pxRatio;
  ctx.save();
  ctx.font = `600 ${Math.round(11 * pr)}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  const pad = 3 * pr;
  const hoehe = 16 * pr;
  for (const b of m) {
    const x0 = Math.max(left, u.valToPos(b.von, 'x', true));
    const x1 = Math.min(left + width, u.valToPos(b.bis, 'x', true));
    if (x1 <= left || x0 >= left + width) continue;
    const tw = ctx.measureText(b.label).width;
    ctx.fillStyle = chartFarbe('kriseLabelHg');
    if (tw + 2 * pad <= x1 - x0) {
      // waagrecht, wenn der Bereich breit genug ist
      ctx.fillRect(x0 + 1, top + 2 * pr, tw + 2 * pad, hoehe);
      ctx.fillStyle = chartFarbe('kriseText');
      ctx.fillText(b.label, x0 + 1 + pad, top + 2 * pr + hoehe / 2);
    } else {
      // senkrecht (von unten nach oben lesbar), links im Bereich
      ctx.save();
      ctx.translate(x0 + 1 + hoehe / 2, top + 4 * pr);
      ctx.rotate(-Math.PI / 2);
      ctx.fillRect(-(tw + 2 * pad), -hoehe / 2, tw + 2 * pad, hoehe);
      ctx.fillStyle = chartFarbe('kriseText');
      ctx.textAlign = 'right';
      ctx.fillText(b.label, -pad, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

export function LinienChart({
  x,
  xLabel,
  serien,
  beschreibung,
  hoehe = 280,
  baender,
  markierungen,
  yLabel,
  y2Label,
  xGanzzahl,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Gestapelte Serien kumulieren (in der gegebenen Reihenfolge von unten nach oben) und von
    // oben nach unten zeichnen, damit jede Fläche sichtbar bleibt.
    const kum: number[][] = [];
    let summe = x.map(() => 0);
    const gestapelt = serien.filter((s) => s.stapel);
    for (const s of gestapelt) {
      summe = summe.map((v, i) => v + Math.max(0, s.werte[i] ?? 0));
      kum.push(summe);
    }
    const geordnet = [
      ...gestapelt.map((s, i) => ({ s, daten: kum[i] ?? [] })).reverse(),
      ...serien.filter((s) => !s.stapel).map((s) => ({ s, daten: s.werte })),
    ];
    const mitRechts = serien.some((s) => s.rechts);
    const idx = (label: string) => geordnet.findIndex((g) => g.s.label === label) + 1;
    const bands: uPlot.Band[] = (baender ?? [])
      .map((b) => ({ series: [idx(b.oben), idx(b.unten)] as [number, number], fill: b.fuellung }))
      .filter((b) => b.series[0] > 0 && b.series[1] > 0);
    const opts: uPlot.Options = {
      bands,
      width: Math.max(280, el.clientWidth),
      height: hoehe,
      scales: mitRechts
        ? { x: { time: false }, y2: { range: (_u, _min, max) => [0, max > 0 ? max * 1.08 : 1] } }
        : { x: { time: false } },
      cursor: { drag: { x: false, y: false }, points: { size: 8 } },
      legend: { show: true, live: true },
      axes: [
        {
          label: xLabel,
          labelSize: 20,
          size: 36,
          stroke: chartFarbe('achse'),
          grid: { stroke: chartFarbe('gitter') },
          ticks: { stroke: chartFarbe('gitter') },
          ...(xGanzzahl
            ? { values: (_u: uPlot, vals: number[]) => vals.map((v) => (Number.isInteger(v) ? String(v) : '')) }
            : {}),
        },
        {
          size: 70,
          stroke: chartFarbe('achse'),
          grid: { stroke: chartFarbe('gitter') },
          ticks: { stroke: chartFarbe('gitter') },
          values: (_u, vals) => vals.map((v) => fmtKompakt(v)),
          ...(yLabel ? { label: yLabel, labelSize: 18 } : {}),
        },
        ...(mitRechts
          ? [
              {
                scale: 'y2',
                side: 1 as const,
                size: 64,
                stroke: chartFarbe('achse'),
                grid: { show: false },
                ticks: { stroke: chartFarbe('gitter') },
                values: (_u: uPlot, vals: number[]) => vals.map((v) => fmtKompakt(v)),
                ...(y2Label ? { label: y2Label, labelSize: 18 } : {}),
              },
            ]
          : []),
      ],
      series: [
        { label: xLabel, value: (_u, v) => (v == null ? '–' : String(v)) },
        ...geordnet.map(({ s }) => ({
          label: s.label,
          ...(s.rechts ? { scale: 'y2' } : {}),
          stroke: s.farbe,
          width: s.stapel ? 1 : 2,
          ...(s.gestrichelt ? { dash: [6, 4] } : {}),
          ...(s.fuellung ? { fill: s.fuellung } : {}),
          value: (_u: uPlot, v: number | null, _si: number, idx: number | null) =>
            v == null || idx == null ? '–' : fmtChf(s.werte[idx] ?? 0),
        })),
      ],
      hooks: {
        draw: [
          (u) => {
            // über den Flächen (halbtransparent), damit Krisen auch im gestapelten Diagramm sichtbar sind
            if (!markierungen?.length) return;
            zeichneFlaechen(u, markierungen);
            zeichneLabels(u, markierungen);
          },
          (u) => {
            // Null-Linie hervorheben
            const y0 = u.valToPos(0, 'y', true);
            if (y0 < u.bbox.top || y0 > u.bbox.top + u.bbox.height) return;
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = chartFarbe('negativ');
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(u.bbox.left, y0);
            ctx.lineTo(u.bbox.left + u.bbox.width, y0);
            ctx.stroke();
            ctx.restore();
          },
        ],
      },
    };
    const daten: uPlot.AlignedData = [x, ...geordnet.map((g) => g.daten)];
    const plot = new uPlot(opts, daten, el);
    const ro = new ResizeObserver(() => plot.setSize({ width: Math.max(280, el.clientWidth), height: hoehe }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      plot.destroy();
    };
  }, [x, xLabel, serien, hoehe, baender, markierungen, yLabel, y2Label, xGanzzahl]);

  return <div ref={ref} className="chart" role="img" aria-label={beschreibung} />;
}
