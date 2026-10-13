import { useEffect, useState } from 'react';
import { moveSession, previewWeek, toggleDone, updateSession } from '../../db/engine';
import { addWeeks, DAY_SHORT, formatDay, formatShort, mondayOf, weekDays, type ISODate } from '../../domain/dates';
import { PHASES } from '../../domain/program';
import type { PlannedSession, WeekPlan } from '../../domain/types';
import { Icons, Sheet, Stepper, TYPE_CODE } from '../../ui/kit';
import { useUI, type Data } from '../../state';
import { DAY_STATUS, ROMAN, sessionMeta, WEEK_KIND } from '../labels';

export function Plan({ data }: { data: Data }) {
  const current = mondayOf(data.today) < data.profile.startDate ? data.profile.startDate : mondayOf(data.today);
  const [weekStart, setWeekStart] = useState(current);
  const [selected, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ week: WeekPlan; sessions: PlannedSession[] } | null>(null);

  const stored = data.weeks.find((w) => w.weekStart === weekStart);
  const firstWeek = data.weeks[0]?.weekStart ?? data.profile.startDate;
  const isPreview = !stored && weekStart > current;

  useEffect(() => {
    let alive = true;
    if (isPreview) void previewWeek(weekStart).then((p) => alive && setPreview(p));
    else setPreview(null);
    return () => {
      alive = false;
    };
  }, [weekStart, isPreview, data.logs, data.planned]);

  const week = stored ?? preview?.week;
  const sessions = stored ? data.planned.filter((p) => p.weekStart === weekStart) : (preview?.sessions ?? []);
  const trainable = sessions.filter((s) => s.type !== 'repos');
  const done = trainable.filter((s) => s.status === 'done').length;
  const session = selected != null ? data.planned.find((p) => p.id === selected) : undefined;

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="kicker num">{week ? `Phase ${ROMAN[week.phase]}, semaine ${week.weekInPhase}` : 'Plan'}</p>
        <h1>Plan de la semaine</h1>
      </header>

      <div className="week-nav">
        <button className="btn btn--sm" aria-label="Semaine précédente" disabled={weekStart <= firstWeek} onClick={() => setWeekStart(addWeeks(weekStart, -1))}>
          {Icons.left}
        </button>
        <div>
          <div className="num" style={{ fontSize: 'var(--step-1)' }}>
            {formatShort(weekStart)} au {formatShort(weekDays(weekStart)[6])}
          </div>
          {week && <span className={`week-kind week-kind--${week.kind}`}>{WEEK_KIND[week.kind]}{isPreview ? ', prévisionnel' : ''}</span>}
        </div>
        <button className="btn btn--sm" aria-label="Semaine suivante" disabled={weekStart > current} onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
          {Icons.right}
        </button>
      </div>

      {week && (
        <section className="plate stack stack--tight">
          <div className="kpis">
            <div className="kpi">
              <span className="num">{week.volumeTargetMin}′</span>
              <span>volume progressif visé</span>
            </div>
            <div className="kpi">
              <span className="num">{done}/{trainable.length}</span>
              <span>séances faites</span>
            </div>
            <div className="kpi">
              <span className="num">{ROMAN[week.phase]}</span>
              <span>{PHASES[week.phase].name}</span>
            </div>
          </div>
          <p className="small muted">{week.reason}</p>
        </section>
      )}

      <section>
        {weekDays(weekStart).map((d) => {
          const daySessions = sessions.filter((s) => s.date === d);
          const status = data.statuses.get(d);
          return (
            <div key={d} className={`day ${d === data.today ? 'day--today' : ''}`}>
              <div className="day-head">
                <h3>{formatDay(d)}</h3>
                <span className="day-status">{status && !isPreview ? DAY_STATUS[status] : ''}</span>
              </div>
              {daySessions.map((s, i) => (
                <button
                  key={s.id ?? `${d}-${i}`}
                  className={`mini-session ${s.status === 'done' ? 'session--done' : ''} ${s.type === 'repos' ? 'session--repos' : ''}`}
                  disabled={isPreview || s.type === 'repos'}
                  onClick={() => setSelected(s.id!)}
                >
                  <span className="session-code">{TYPE_CODE[s.type]}</span>
                  <span>
                    <span className="title">{s.title}</span>
                    <br />
                    <span className="meta">{sessionMeta(s) || s.details}</span>
                  </span>
                  {s.status === 'done' && <span style={{ color: 'var(--brass-bright)', width: 24 }}>{Icons.check}</span>}
                </button>
              ))}
            </div>
          );
        })}
      </section>

      {session && <SessionSheet session={session} onClose={() => setSelected(null)} />}
    </div>
  );
}

function SessionSheet({ session: s, onClose }: { session: PlannedSession; onClose: () => void }) {
  const ui = useUI();
  const [mode, setMode] = useState<'view' | 'move' | 'edit'>('view');
  const [title, setTitle] = useState(s.title);
  const [duration, setDuration] = useState(s.targets.durationMin);
  const [details, setDetails] = useState(s.details);
  const done = s.status === 'done';

  const move = async (d: ISODate) => {
    await moveSession(s.id!, d);
    onClose();
  };
  const saveEdit = async () => {
    await updateSession(s.id!, { title: title.trim() || s.title, details, targets: { ...s.targets, durationMin: duration } });
    setMode('view');
  };

  return (
    <Sheet title={s.title} onClose={onClose}>
      {mode === 'view' && (
        <div className="stack">
          <p className="kicker num">{TYPE_CODE[s.type]}, {formatDay(s.date).toLowerCase()}</p>
          {sessionMeta(s) && <p className="num" style={{ fontSize: 'var(--step-2)', color: 'var(--brass-bright)' }}>{sessionMeta(s)}</p>}
          <p className="muted">{s.details}</p>
          <button className="btn btn--primary btn--block" onClick={() => { onClose(); ui.openLog(s); }}>
            {done ? 'Modifier ce qui a été consigné' : 'Consigner'}
          </button>
          <button
            className="btn btn--block"
            onClick={async () => {
              await toggleDone(s);
              if (!done) ui.stamp();
              onClose();
            }}
          >
            {done ? 'Marquer comme non faite' : 'Cocher comme faite'}
          </button>
          <div className="grid-2">
            <button className="btn btn--sm" onClick={() => setMode('move')}>Déplacer</button>
            <button className="btn btn--sm" onClick={() => setMode('edit')}>Modifier</button>
          </div>
        </div>
      )}

      {mode === 'move' && (
        <div className="stack">
          <p className="muted">Choisis le nouveau jour. Placée sur un repos, la séance le remplace.</p>
          <div className="types" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {weekDays(s.weekStart).map((d, i) => (
              <button key={d} className="type-btn" aria-pressed={d === s.date} onClick={() => move(d)}>
                <span className="num">{DAY_SHORT[i]}</span>
                {formatShort(d).split(' ')[0]}
              </button>
            ))}
          </div>
          <button className="btn btn--ghost btn--block" onClick={() => setMode('view')}>Retour</button>
        </div>
      )}

      {mode === 'edit' && (
        <div className="stack">
          <div className="field">
            <label className="field-label" htmlFor="ed-title">Intitulé</label>
            <input id="ed-title" className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Stepper label="Durée prévue" unit="minutes" value={duration} onChange={setDuration} step={5} />
          <div className="field">
            <label className="field-label" htmlFor="ed-details">Contenu</label>
            <textarea id="ed-details" className="text-input" value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <button className="btn btn--primary btn--block" onClick={saveEdit}>Enregistrer</button>
          <button className="btn btn--ghost btn--block" onClick={() => setMode('view')}>Annuler</button>
        </div>
      )}
    </Sheet>
  );
}
