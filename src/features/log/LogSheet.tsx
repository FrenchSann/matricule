import { useState } from 'react';
import { deleteLog, saveLog } from '../../db/engine';
import { addDays, formatDuration, formatShort } from '../../domain/dates';
import { SESSION_LABEL, type LogEntry, type PlannedSession, type SessionType } from '../../domain/types';
import { flattenGroups, initialGroups, StrengthLog, type ExerciseGroup } from './StrengthLog';
import { RpePicker, Sheet, Stepper, TYPE_CODE } from '../../ui/kit';
import { useUI, type Data } from '../../state';

const TYPES: SessionType[] = ['course', 'grappling', 'force', 'natation', 'marche', 'mobilite', 'repos'];
const PAIN_ZONES = ['Genou', 'Cheville', 'Tibia', 'Pied', 'Hanche', 'Dos', 'Épaule', 'Coude'];

const HAS = {
  duration: (t: SessionType) => t !== 'repos',
  distance: (t: SessionType) => t === 'course' || t === 'marche' || t === 'natation',
  load: (t: SessionType) => t === 'marche',
  sets: (t: SessionType) => t === 'force',
  rpe: (t: SessionType) => t !== 'repos',
};

export function LogSheet({ data, session, onClose }: { data: Data; session?: PlannedSession; onClose: () => void }) {
  const ui = useUI();
  const existing = session?.logId ? data.logs.find((l) => l.id === session.logId) : undefined;
  const openFor = (date: string, t?: SessionType) =>
    data.planned.find((p) => p.date === date && p.type !== 'repos' && p.status !== 'done' && (!t || p.type === t));
  // Depuis « + » : on part de la prochaine séance prévue aujourd'hui.
  const source = session ?? openFor(data.today);
  const base: Partial<LogEntry> = existing ?? {
    date: source?.date ?? data.today,
    type: source?.type ?? 'course',
    durationMin: source?.targets.durationMin,
    distanceKm: source?.targets.distanceKm,
    loadKg: source?.targets.loadKg,
  };

  const [type, setType] = useState<SessionType>(base.type!);
  const [date, setDate] = useState(base.date!);
  const [duration, setDuration] = useState(base.durationMin);
  const [distance, setDistance] = useState(base.distanceKm);
  const [load, setLoad] = useState(base.loadKg);
  const historyFor = (d: string) => data.logs.filter((l) => l.id !== existing?.id && l.date <= d);
  const [groups, setGroups] = useState<ExerciseGroup[]>(() => initialGroups(base.sets, source?.exercises, historyFor(base.date!)));
  const [rpe, setRpe] = useState(base.rpe);
  const [pain, setPain] = useState(!!base.pain);
  const [zone, setZone] = useState(base.pain?.zone ?? '');
  const [note, setNote] = useState(base.note ?? '');

  const plannedMatch = session ?? openFor(date, type);

  const pickType = (t: SessionType) => {
    setType(t);
    const match = openFor(date, t);
    setDuration(match?.targets.durationMin);
    setDistance(match?.targets.distanceKm);
    setLoad(match?.targets.loadKg);
    if (t === 'force' && !groups.length) setGroups(initialGroups(undefined, match?.exercises, historyFor(date)));
  };

  const swim = type === 'natation';
  const pace = type === 'course' && duration && distance ? formatDuration((duration * 60) / distance) : null;

  const save = async () => {
    const entry: Omit<LogEntry, 'createdAt'> = {
      id: existing?.id,
      date,
      type,
      durationMin: HAS.duration(type) ? duration : undefined,
      distanceKm: HAS.distance(type) ? distance : undefined,
      loadKg: HAS.load(type) ? load : undefined,
      sets: HAS.sets(type) ? flattenGroups(groups) : undefined,
      rpe: HAS.rpe(type) ? rpe : undefined,
      pain: pain ? { zone } : null,
      note: note.trim() || undefined,
      plannedId: plannedMatch?.type === type ? plannedMatch.id : undefined,
    };
    await saveLog(entry);
    onClose();
    ui.stamp(pain ? 'Noté' : 'Consigné');
  };

  const remove = async () => {
    if (existing?.id) await deleteLog(existing.id);
    onClose();
  };

  const title = session ? session.title : 'Consigner';

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="stack" style={{ gap: 18 }}>
        {!session && (
          <div className="field">
            <span className="field-label">Type de séance</span>
            <div className="types">
              {TYPES.map((t) => (
                <button key={t} type="button" className="type-btn" aria-pressed={type === t} onClick={() => pickType(t)}>
                  <span className="num">{TYPE_CODE[t]}</span>
                  {SESSION_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
        )}

        {!session && (
          <div className="field">
            <span className="field-label">Jour</span>
            <div className="toggle-row">
              <button type="button" aria-pressed={date === data.today} onClick={() => setDate(data.today)}>
                Aujourd'hui
              </button>
              <button type="button" aria-pressed={date === addDays(data.today, -1)} onClick={() => setDate(addDays(data.today, -1))}>
                Hier ({formatShort(addDays(data.today, -1))})
              </button>
            </div>
          </div>
        )}

        {HAS.rpe(type) && <RpePicker value={rpe} onChange={setRpe} />}

        {(HAS.duration(type) || HAS.distance(type)) && (
          <div className="grid-2">
            {HAS.duration(type) && <Stepper label="Durée" unit="minutes" value={duration} onChange={setDuration} step={5} />}
            {HAS.distance(type) &&
              (swim ? (
                <Stepper
                  label="Distance"
                  unit="mètres"
                  value={distance !== undefined ? Math.round(distance * 1000) : undefined}
                  onChange={(m) => setDistance(m === undefined ? undefined : m / 1000)}
                  step={50}
                />
              ) : (
                <Stepper label="Distance" unit={pace ? `km, allure ${pace} /km` : 'km'} value={distance} onChange={setDistance} step={0.5} decimals={1} />
              ))}
            {HAS.load(type) && <Stepper label="Charge du sac" unit="kg" value={load} onChange={setLoad} step={1} />}
          </div>
        )}

        {HAS.sets(type) && <StrengthLog groups={groups} onChange={setGroups} history={historyFor(date)} prescribed={source?.exercises} />}

        <div className="field">
          <span className="field-label">Douleur</span>
          <div className="toggle-row">
            <button type="button" aria-pressed={!pain} onClick={() => setPain(false)}>
              Aucune
            </button>
            <button type="button" className="is-alert" aria-pressed={pain} onClick={() => setPain(true)}>
              Oui, une douleur
            </button>
          </div>
          {pain && (
            <>
              <div className="chips" role="group" aria-label="Zone de la douleur">
                {PAIN_ZONES.map((z) => (
                  <button key={z} type="button" className="chip" aria-pressed={zone === z} onClick={() => setZone(z)}>
                    {z}
                  </button>
                ))}
              </div>
              <input className="text-input" placeholder="Autre zone" value={PAIN_ZONES.includes(zone) ? '' : zone} onChange={(e) => setZone(e.target.value)} />
              <p className="small muted">Deux douleurs dans la semaine allègent automatiquement la suivante.</p>
            </>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="log-note">Note</label>
          <textarea id="log-note" className="text-input" placeholder="Sensations, météo, terrain…" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="form-footer stack stack--tight">
          <button className="btn btn--primary btn--block" onClick={save}>
            {existing ? 'Mettre à jour' : 'Consigner la séance'}
          </button>
          {existing && (
            <button className="btn btn--ghost btn--block" onClick={remove}>
              Supprimer cette entrée
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
