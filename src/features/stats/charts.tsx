import { useState } from 'react';

// Palette catégorielle validée (fond #17161a) : ordre fixe, jamais recyclé.
export const SERIES_COLOR = {
  course: '#d6404a',
  grappling: '#b98a26',
  natation: '#4f8fd6',
  force: '#5fa344',
  marche: '#a46ad6',
  mobilite: '#2fa59c',
} as const;
export type SeriesKey = keyof typeof SERIES_COLOR;

const W = 358;
const PAD = { l: 34, r: 8, t: 10, b: 22 };

export interface StackDatum {
  label: string;
  values: Partial<Record<SeriesKey, number>>;
}

export function StackedBars({
  data,
  keys,
  labels,
  unit,
  height = 190,
}: {
  data: StackDatum[];
  keys: SeriesKey[];
  labels: Record<SeriesKey, string>;
  unit: (v: number) => string;
  height?: number;
}) {
  const [sel, setSel] = useState<number | null>(data.length - 1);
  const totals = data.map((d) => keys.reduce((s, k) => s + (d.values[k] ?? 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const ih = height - PAD.t - PAD.b;
  const slot = (W - PAD.l - PAD.r) / data.length;
  const bw = Math.min(22, slot - 6);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;

  const selected = sel != null ? data[sel] : null;
  return (
    <figure className="stack" style={{ margin: 0 }}>
      <div className="legend">
        {keys.map((k) => (
          <span key={k}><i style={{ background: SERIES_COLOR[k] }} />{labels[k]}</span>
        ))}
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Volume hebdomadaire par type">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} strokeOpacity={f === 0 ? 1 : 0.5} />
            <text x={PAD.l - 6} y={y(max * f) + 4} textAnchor="end">{unit(max * f)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.l + i * slot + (slot - bw) / 2;
          let acc = 0;
          return (
            <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
              <rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={ih} fill="transparent" />
              {keys.map((k) => {
                const v = d.values[k] ?? 0;
                if (!v) return null;
                const y0 = y(acc);
                acc += v;
                const h = Math.max(1, y0 - y(acc) - 2); // 2 px d'espace entre segments
                return <rect key={k} x={x} y={y(acc)} width={bw} height={h} fill={SERIES_COLOR[k]} opacity={sel === null || sel === i ? 1 : 0.45} />;
              })}
              {(i % 2 === data.length % 2 || data.length < 7) && (
                <text x={x + bw / 2} y={height - 6} textAnchor="middle">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {selected && (
        <figcaption className="small" aria-live="polite">
          <b>Semaine du {selected.label}</b> : {unit(totals[sel!])} au total.{' '}
          <span className="muted">
            {keys.filter((k) => selected.values[k]).map((k) => `${labels[k]} ${unit(selected.values[k]!)}`).join(', ') || 'Aucune séance.'}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

export interface Point {
  label: string;
  value: number;
}

export function LineChart({
  points,
  format,
  invert = false,
  color = '#cfae68',
  height = 160,
  label,
}: {
  points: Point[];
  format: (v: number) => string;
  /** vrai si une valeur basse est meilleure (chrono, allure) : axe inversé */
  invert?: boolean;
  color?: string;
  height?: number;
  label: string;
}) {
  const [sel, setSel] = useState<number>(points.length - 1);
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  lo -= span * 0.1;
  hi += span * 0.1;
  const ih = height - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + 8 + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - PAD.l - PAD.r - 16));
  const y = (v: number) => {
    const f = (v - lo) / (hi - lo);
    return PAD.t + (invert ? f : 1 - f) * ih;
  };
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const p = points[sel];
  const ticks = [lo + span * 0.1, hi - span * 0.1];

  return (
    <figure className="stack stack--tight" style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} strokeOpacity={0.5} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {p && <line x1={x(sel)} x2={x(sel)} y1={PAD.t} y2={PAD.t + ih} stroke="#55535c" strokeDasharray="2 3" />}
        {points.map((pt, i) => (
          <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
            <circle cx={x(i)} cy={y(pt.value)} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(pt.value)} r={i === sel ? 5.5 : 4} fill={color} stroke="#17161a" strokeWidth={2} />
          </g>
        ))}
        <text x={x(0)} y={height - 6} textAnchor="start">{points[0]?.label}</text>
        {points.length > 1 && <text x={x(points.length - 1)} y={height - 6} textAnchor="end">{points.at(-1)!.label}</text>}
      </svg>
      {p && (
        <figcaption className="small" aria-live="polite">
          <b className="num" style={{ fontSize: 'var(--step-1)' }}>{format(p.value)}</b> <span className="muted">le {p.label}</span>
        </figcaption>
      )}
    </figure>
  );
}

function niceMax(v: number): number {
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}
