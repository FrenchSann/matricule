import { useEffect, useState } from 'react';
import { addSession, deleteSession, moveSession, previewWeek, swapAlternative, toggleDone, updateSession } from '../../db/engine';
import { addWeeks, DAY_SHORT, formatDay, formatShort, mondayOf, weekDays, type ISODate } from '../../domain/dates';
import { blockOf } from '../../domain/programme';
import { DECISION_LABEL } from '../../domain/cursor';
import type { PlannedSession, WeekPlan } from '../../domain/types';
import { Icons, Sheet, TYPE_CODE } from '../../ui/kit';
import { BulletHole } from '../../ui/Impact';
import { useUI, type Data } from '../../state';
import { DAY_STATUS, hours, prescriptionText, sessionMeta, weekLabel, WEEK_KIND } from '../labels';
import { SessionEditor, type EditorValue } from './SessionEditor';
import { CustomizeSheet } from './CustomizeSheet';

export function Plan({ data }: { data: Data }) {
  const current = mondayOf(data.today) < data.profile.startDate ? data.profile.startDate : mondayOf(data.today);
  const [weekStart, setWeekStart] = useState(current);
  const [selected, setSelected] = useState<number | null>(null);
  const [adding, setAdding] = useState<ISODate | null>(null);
  const [customize, setCustomize] = useState(false);
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
  }, [weekStart, isPreview, data.logs, data.planned, data.profile]);

  const week = stored ?? preview?.week;
  const sessions = stored ? data.planned.filter((p) => p.weekStart === weekStart) : (preview?.sessions ?? []);
  const trainable = sessions.filter((s) => s.type !== 'repos');
  const done = trainable.filter((s) => s.status === 'done').length;
  const session = selected != null ? data.planned.find((p) => p.id === selected) : undefined;
  const currentWeek = data.weeks.find((w) => w.weekStart === current);

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="kicker num">{week ? `${weekLabel(week)}, ${blockOf(week.programWeek).name}` : 'Plan'}</p>
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
              <span className="num">{hours(week.totalMin)}</span>
              <span>volume estimé, EPS exclue</span>
            </div>
            <div className="kpi">
              <span className="num">{done}/{trainable.length}</span>
              <span>séances faites</span>
            </div>
            <div className="kpi">
              <span className="num">{weekLabel(week)}</span>
              <span>{WEEK_KIND[week.kind].toLowerCase()}</span>
            </div>
          </div>
          <p className="small muted">{week.reason}</p>
          {week.checkin && (
            <p className="small">
              Décision du dimanche : <b>{DECISION_LABEL[week.checkin.decision].toLowerCase()}</b>
              {week.checkin.fatigue ? `, fatigue ${week.checkin.fatigue}/10` : ''}
              {week.checkin.sleepH ? `, sommeil ${String(week.checkin.sleepH).replace('.', ',')} h` : ''}
              {week.checkin.note ? `. ${week.checkin.note}` : ''}
            </p>
          )}
        </section>
      )}

      <button className="btn btn--brass btn--block" onClick={() => setCustomize(true)}>
        Personnaliser le programme
      </button>

      <section>
        {weekDays(weekStart).map((d) => {
          const daySessions = sessions.filter((s) => s.date === d);
          const status = data.statuses.get(d);
          return (
            <div key={d} className={`day ${d === data.today ? 'day--today' : ''}`}>
              <div className="day-head">
                <h3>{formatDay(d)}</h3>
                <span className="row" style={{ gap: 4 }}>
                  <span className="day-status">{status && !isPreview ? DAY_STATUS[status] : ''}</span>
                  {!isPreview && (
                    <button className="btn btn--ghost btn--sm" style={{ minHeight: 40, padding: '0 8px' }} aria-label={`Ajouter une séance le ${formatDay(d).toLowerCase()}`} onClick={() => setAdding(d)}>
                      {Icons.plus}
                    </button>
                  )}
                </span>
              </div>
              {daySessions.length === 0 && <p className="small muted">Repos</p>}
              {daySessions.map((s, i) => (
                <button
                  key={s.id ?? `${d}-${i}`}
                  className={`mini-session ${s.status === 'done' ? 'session--done' : ''} ${s.type === 'repos' ? 'session--repos' : ''}`}
                  disabled={isPreview}
                  onClick={() => setSelected(s.id!)}
                >
                  <span className="session-code">{TYPE_CODE[s.type]}</span>
                  <span>
                    <span className="title">{s.title}</span>
                    <br />
                    <span className="meta">
                      {[sessionMeta(s), s.exercises?.length ? `${s.exercises.length} exercices` : ''].filter(Boolean).join(', ') || s.details}
                    </span>
                  </span>
                  {s.status === 'done' && (
                    <span className="done-mark" title="Faite">
                      <BulletHole seed={s.id ?? 1} size={34} style={{ position: 'relative', transform: 'none' }} />
                      <span className="sr-only">Faite</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </section>

      {session && <SessionSheet session={session} onClose={() => setSelected(null)} />}
      {adding && (
        <Sheet title={`Ajouter, ${formatDay(adding).toLowerCase()}`} onClose={() => setAdding(null)}>
          <SessionEditor
            saveLabel="Ajouter au plan"
            initial={{ type: 'course', title: 'Course', details: '', durationMin: 30 }}
            onCancel={() => setAdding(null)}
            onSave={async (v) => {
              await addSession({
                date: adding,
                type: v.type,
                title: v.title,
                details: v.details,
                targets: { durationMin: v.type === 'repos' ? undefined : v.durationMin },
                exercises: v.type === 'force' ? v.exercises : undefined,
              });
              setAdding(null);
            }}
          />
        </Sheet>
      )}
      {customize && <CustomizeSheet data={data} weekStart={currentWeek?.weekStart} onClose={() => setCustomize(false)} />}
    </div>
  );
}

function SessionSheet({ session: s, onClose }: { session: PlannedSession; onClose: () => void }) {
  const ui = useUI();
  const [mode, setMode] = useState<'view' | 'move' | 'edit'>('view');
  const done = s.status === 'done';
  const isRest = s.type === 'repos';

  const move = async (d: ISODate) => {
    await moveSession(s.id!, d);
    onClose();
  };
  const saveEdit = async (v: EditorValue) => {
    await updateSession(s.id!, {
      type: v.type,
      title: v.title,
      details: v.details,
      targets: { ...s.targets, durationMin: v.type === 'repos' ? undefined : v.durationMin },
      exercises: v.type === 'force' ? v.exercises : undefined,
    });
    setMode('view');
  };

  return (
    <Sheet title={mode === 'edit' ? 'Modifier la séance' : s.title} onClose={onClose}>
      {mode === 'view' && (
        <div className="stack">
          <p className="kicker num">{TYPE_CODE[s.type]}, {formatDay(s.date).toLowerCase()}</p>
          {sessionMeta(s) && <p className="num" style={{ fontSize: 'var(--step-2)', color: 'var(--brass-bright)' }}>{sessionMeta(s)}</p>}
          <p className="muted">{s.details}</p>
          {s.exercises?.length ? (
            <ul className="ex-list">
              {s.exercises.map((e) => (
                <li key={e.name}>
                  <span>{e.name}</span>
                  <span className="num">{prescriptionText(e)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {!isRest && (
            <>
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
            </>
          )}
          {!done && s.alternative && (
            <button className="btn btn--sm btn--block" onClick={async () => { await swapAlternative(s.id!); onClose(); }}>
              Option : {s.alternative.title.toLowerCase()} à la place
            </button>
          )}
          <div className="grid-2">
            <button className="btn btn--sm" disabled={isRest} onClick={() => setMode('move')}>Déplacer</button>
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
        <SessionEditor
          initial={{ type: s.type, title: s.title, details: s.details, durationMin: s.targets.durationMin, exercises: s.exercises }}
          onCancel={() => setMode('view')}
          onSave={saveEdit}
          onDelete={async () => {
            await deleteSession(s.id!);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
