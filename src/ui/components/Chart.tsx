/**
 * Dünner React-Wrapper um uPlot (~50 kB, Canvas, sehr schnell auch mit vielen Punkten).
 */
import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { fmtChf, fmtKompakt } from '../format';

export interface Serie {
  label: string;
  werte: number[];
  farbe: string;
  fuellung?: string;
}

interface Props {
  x: number[];
  xLabel: string;
  serien: Serie[];
  beschreibung: string;
  hoehe?: number;
}

export function LinienChart({ x, xLabel, serien, beschreibung, hoehe = 280 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const opts: uPlot.Options = {
      width: Math.max(280, el.clientWidth),
      height: hoehe,
      scales: { x: { time: false } },
      cursor: { drag: { x: false, y: false }, points: { size: 8 } },
      legend: { show: true, live: true },
      axes: [
        { label: xLabel, labelSize: 20, size: 36, stroke: '#44535c', grid: { stroke: '#e3e8eb' } },
        {
          size: 70,
          stroke: '#44535c',
          grid: { stroke: '#e3e8eb' },
          values: (_u, vals) => vals.map((v) => fmtKompakt(v)),
        },
      ],
      series: [
        { label: xLabel, value: (_u, v) => (v == null ? '–' : String(v)) },
        ...serien.map((s) => ({
          label: s.label,
          stroke: s.farbe,
          width: 2,
          ...(s.fuellung ? { fill: s.fuellung } : {}),
          value: (_u: uPlot, v: number | null) => (v == null ? '–' : fmtChf(v)),
        })),
      ],
      hooks: {
        draw: [
          (u) => {
            // Null-Linie hervorheben
            const y0 = u.valToPos(0, 'y', true);
            if (y0 < u.bbox.top || y0 > u.bbox.top + u.bbox.height) return;
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = '#b3261e';
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
    const daten: uPlot.AlignedData = [x, ...serien.map((s) => s.werte)];
    const plot = new uPlot(opts, daten, el);
    const ro = new ResizeObserver(() => plot.setSize({ width: Math.max(280, el.clientWidth), height: hoehe }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      plot.destroy();
    };
  }, [x, xLabel, serien, hoehe]);

  return <div ref={ref} className="chart" role="img" aria-label={beschreibung} />;
}
