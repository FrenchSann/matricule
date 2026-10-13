import { addWeeks, formatDuration, formatShort, mondayOf, weekDays } from '../../domain/dates';
import { TEST_KEYS, TEST_LABEL } from '../../domain/checkpoints';
import { KEPT, type DayStatus } from '../../domain/streak';
import { SESSION_LABEL } from '../../domain/types';
import type { Data } from '../../state';
import { DAY_STATUS } from '../labels';
import { LineChart, SERIES_COLOR, StackedBars, type SeriesKey, type StackDatum } from './charts';

const KEYS: SeriesKey[] = ['course', 'grappling', 'natation', 'force', 'marche', 'mobilite'];
const LABELS = Object.fromEntries(KEYS.map((k) => [k, SESSION_LABEL[k]])) as Record<SeriesKey, string>;
const hours = (min: number) => (min >= 60 ? `${(min / 60).toFixed(min % 60 ? 1 : 0).replace('.', ',')} h` : `${Math.round(min)} min`);

const CAL_COLOR: Partial<Record<DayStatus, string>> = {
  done: '#b98a26',
  rest: '#6e5a2c',
  excused: '#55535c',
  joker: '#4f8fd6',
  missed: '#a8141f',
  'rest-broken': '#a8141f',
};

export function Stats({ data }: { data: Data }) {
  const { logs, today, streak } = data;
  const thisMonday = mondayOf(today);
  const first = mondayOf(data.profile.startDate);

  // Volume hebdomadaire par type (12 dernières semaines du programme)
  const weeks: StackDatum[] = [];
  for (let i = 11; i >= 0; i--) {
    const monday = addWeeks(thisMonday, -i);
    if (monday < first) continue;
    const end = addWeeks(monday, 1);
    const values: StackDatum['values'] = {};
    for (const l of logs) {
      if (l.date < monday || l.date >= end || l.type === 'repos') continue;
      values[l.type as SeriesKey] = (values[l.type as SeriesKey] ?? 0) + (l.durationMin ?? 0);
    }
    weeks.push({ label: formatShort(monday), values });
  }
  const thisWeek = weeks.at(-1);
  const weekMin = thisWeek ? Object.values(thisWeek.values).reduce((a, b) => a + (b ?? 0), 0) : 0;

  // Allure des courses (au moins 2 km)
  const runs = logs
    .filter((l) => l.type === 'course' && l.distanceKm && l.distanceKm >= 2 && l.durationMin)
    .map((l) => ({ label: formatShort(l.date), value: (l.durationMin! * 60) / l.distanceKm! }));

  // Tractions : meilleure série par jour + tests de contrôle
  const pullByDay = new Map<string, number>();
  for (const l of logs) {
    for (const s of l.sets ?? []) {
      if (s.exercise === 'Tractions') pullByDay.set(l.date, Math.max(pullByDay.get(l.date) ?? 0, s.reps));
    }
  }
  for (const c of data.checkpoints) {
    if (c.results.tractions !== undefined) pullByDay.set(c.date, Math.max(pullByDay.get(c.date) ?? 0, c.results.tractions));
  }
  const pulls = [...pullByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ label: formatShort(d), value: v }));

  // Calendrier du streak : 12 dernières semaines
  const calStart = [addWeeks(thisMonday, -11), first].sort().at(-1)!;
  const calDays: string[] = [];
  for (let m = calStart; m <= thisMonday; m = addWeeks(m, 1)) calDays.push(...weekDays(m));

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="kicker num">Rapport</p>
        <h1>Statistiques</h1>
      </header>

      <section className="kpis plate">
        <div className="kpi"><span className="num">{hours(weekMin)}</span><span>cette semaine</span></div>
        <div className="kpi"><span className="num">{logs.filter((l) => l.type !== 'repos').length}</span><span>séances consignées</span></div>
        <div className="kpi"><span className="num">{streak.best}</span><span>record de streak</span></div>
      </section>

      <section className="stack">
        <h2>Volume par semaine</h2>
        {weeks.some((w) => Object.keys(w.values).length) ? (
          <>
            <StackedBars data={weeks} keys={KEYS} labels={LABELS} unit={hours} />
            <details className="small muted">
              <summary>Voir en tableau</summary>
              <table className="table">
                <thead><tr><th>Semaine</th>{KEYS.map((k) => <th key={k}>{LABELS[k].slice(0, 4)}.</th>)}</tr></thead>
                <tbody>
                  {weeks.map((w) => (
                    <tr key={w.label}><td>{w.label}</td>{KEYS.map((k) => <td key={k}>{w.values[k] ? Math.round(w.values[k]!) : ''}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              <p>En minutes.</p>
            </details>
          </>
        ) : (
          <p className="empty">Consigne tes premières séances : le volume de chaque semaine apparaîtra ici.</p>
        )}
      </section>

      <section className="stack">
        <h2>Allure en course</h2>
        {runs.length >= 2 ? (
          <LineChart points={runs} format={(v) => `${formatDuration(v)}/km`} invert color={SERIES_COLOR.course} label="Allure des sorties course" />
        ) : (
          <p className="empty">Indique la distance de tes sorties (2 km et plus) pour suivre ton allure.</p>
        )}
      </section>

      <section className="stack">
        <h2>Tractions strictes</h2>
        {pulls.length >= 2 ? (
          <LineChart points={pulls} format={(v) => `${Math.round(v)} reps`} color={SERIES_COLOR.force} label="Meilleure série de tractions" />
        ) : (
          <p className="empty">Ajoute une série « Tractions » dans tes séances de force pour suivre ta progression.</p>
        )}
      </section>

      {data.checkpoints.length > 0 && (
        <section className="stack">
          <h2>Chronos des tests</h2>
          <table className="table">
            <thead><tr><th>Épreuve</th>{data.checkpoints.map((c) => <th key={c.id}>M{c.month}</th>)}</tr></thead>
            <tbody>
              {TEST_KEYS.map((k) => (
                <tr key={k}>
                  <td>{TEST_LABEL[k]}</td>
                  {data.checkpoints.map((c) => {
                    const r = c.results;
                    const v = k === 'course' ? r.courseSec : k === 'marche' ? r.marcheSec : k === 'natation' ? r.natationSec : undefined;
                    const text = k === 'tractions' ? (r.tractions ?? '—') : k === 'corde' ? (r.corde ? 'Oui' : 'Non') : v !== undefined ? formatDuration(v) : '—';
                    return <td key={c.id} className={c.passed[k] ? '' : 'ko'}>{text}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="stack">
        <h2>Historique du streak</h2>
        <div className="calendar" role="img" aria-label={`Calendrier des ${calDays.length / 7} dernières semaines`}>
          {calDays.map((d) => {
            const s = data.statuses.get(d);
            return <span key={d} title={`${formatShort(d)} : ${s ? DAY_STATUS[s] : 'avant le programme'}`} style={{ background: s && CAL_COLOR[s] }} />;
          })}
        </div>
        <div className="legend">
          {(['done', 'rest', 'excused', 'joker', 'missed'] as DayStatus[]).map((s) => (
            <span key={s}><i style={{ background: CAL_COLOR[s] }} />{DAY_STATUS[s]}</span>
          ))}
        </div>
        <p className="small muted">
          {streak.heldWeeks} semaine{streak.heldWeeks > 1 ? 's' : ''} tenue{streak.heldWeeks > 1 ? 's' : ''}, dont {streak.perfectWeeks} sans joker.{' '}
          {[...data.statuses.values()].filter((s) => KEPT.has(s)).length} jours tenus au total.
        </p>
      </section>
    </div>
  );
}
