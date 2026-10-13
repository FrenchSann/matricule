import { useState } from 'react';
import { formatShort } from '../../domain/dates';
import { exerciseHistory, practicedExercises, records, summarizeSets, UNIT_LABEL } from '../../domain/strength';
import type { LogEntry } from '../../domain/types';
import { LineChart, SERIES_COLOR } from './charts';

type Metric = 'topKg' | 'e1rm' | 'volume' | 'reps';

const METRIC_LABEL: Record<Metric, string> = {
  topKg: 'Charge max',
  e1rm: '1RM estimé',
  volume: 'Tonnage',
  reps: 'Meilleure série',
};

const kg = (v: number) => `${(Math.round(v * 2) / 2).toString().replace('.', ',')} kg`;

export function StrengthProgress({ logs }: { logs: LogEntry[] }) {
  const exercises = practicedExercises(logs);
  const [name, setName] = useState(exercises[0]);
  const [metric, setMetric] = useState<Metric>('topKg');

  if (!exercises.length) {
    return <p className="empty">Note tes séries et tes charges dans une séance de force : ta progression par exercice apparaîtra ici.</p>;
  }
  const current = exercises.includes(name) ? name : exercises[0];
  const history = exerciseHistory(logs, current);
  const rec = records(history);
  const unit = UNIT_LABEL[history[0]?.sets[0]?.unit ?? 'reps'];
  const weighted = history.some((h) => h.topKg > 0);
  const metrics: Metric[] = weighted ? ['topKg', 'e1rm', 'volume', 'reps'] : ['reps'];
  const m = metrics.includes(metric) ? metric : metrics[0];

  const points = history
    .map((h) => ({
      label: formatShort(h.date),
      value: m === 'topKg' ? h.topKg : m === 'e1rm' ? (h.e1rm ?? 0) : m === 'volume' ? h.volumeKg : Math.max(...h.sets.map((s) => s.reps)),
    }))
    .filter((p) => p.value > 0);
  const format = m === 'reps' ? (v: number) => `${Math.round(v)} ${unit}` : kg;
  const first = points[0]?.value;
  const last = points.at(-1)?.value;
  const delta = first && last && points.length > 1 ? last - first : null;

  return (
    <div className="stack">
      <div className="chips" role="group" aria-label="Exercice">
        {exercises.map((e) => (
          <button key={e} className="chip" aria-pressed={e === current} onClick={() => setName(e)}>
            {e}
          </button>
        ))}
      </div>

      <div className="kpis plate">
        <div className="kpi">
          <span className="num">{rec.bestKg ? kg(rec.bestKg.kg) : `${rec.bestReps?.reps ?? 0}`}</span>
          <span>{rec.bestKg ? `record, × ${rec.bestKg.reps}` : `record, ${unit}`}</span>
        </div>
        <div className="kpi">
          <span className="num">{rec.bestE1rm ? kg(rec.bestE1rm) : '—'}</span>
          <span>1RM estimé</span>
        </div>
        <div className="kpi">
          <span className="num">{delta === null ? '—' : `${delta >= 0 ? '+' : '−'}${m === 'reps' ? Math.abs(Math.round(delta)) : kg(Math.abs(delta)).replace(' kg', '')}`}</span>
          <span>depuis le début{m === 'reps' ? '' : ' (kg)'}</span>
        </div>
      </div>

      {metrics.length > 1 && (
        <div className="toggle-row" style={{ gridTemplateColumns: `repeat(${metrics.length}, 1fr)` }}>
          {metrics.map((x) => (
            <button key={x} aria-pressed={x === m} onClick={() => setMetric(x)}>
              {METRIC_LABEL[x]}
            </button>
          ))}
        </div>
      )}

      {points.length >= 2 ? (
        <LineChart points={points} format={format} color={SERIES_COLOR.force} label={`${current} : ${METRIC_LABEL[m]}`} />
      ) : (
        <p className="empty">Encore une séance avec cet exercice pour tracer la courbe.</p>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Séance</th>
            <th>Séries</th>
          </tr>
        </thead>
        <tbody>
          {[...history].reverse().slice(0, 8).map((h) => (
            <tr key={`${h.date}-${h.logId}`}>
              <td>{formatShort(h.date)}</td>
              <td>{summarizeSets(h.sets)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
