import { useState } from 'react';
import { DAY_SHORT } from '../../domain/dates';
import { COMMON_EXERCISES } from '../../domain/strength';
import { SESSION_LABEL, type ExercisePrescription, type SessionType, type SetUnit } from '../../domain/types';
import { MiniStepper, Stepper, TYPE_CODE } from '../../ui/kit';

export interface EditorValue {
  type: SessionType;
  title: string;
  details: string;
  durationMin?: number;
  exercises?: ExercisePrescription[];
  /** semaine type uniquement */
  day?: number;
  progressive?: boolean;
  autoLabel?: string;
  keepAuto?: boolean;
}

const TYPES: SessionType[] = ['course', 'grappling', 'force', 'natation', 'marche', 'mobilite', 'repos'];
const UNITS: SetUnit[] = ['reps', 's', 'm'];

export function SessionEditor({
  mode,
  initial,
  saveLabel = 'Enregistrer',
  onSave,
  onCancel,
  onDelete,
}: {
  mode: 'week' | 'template';
  initial: EditorValue;
  saveLabel?: string;
  onSave: (v: EditorValue) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [v, setV] = useState<EditorValue>(initial);
  const set = (patch: Partial<EditorValue>) => setV((cur) => ({ ...cur, ...patch }));

  const pickType = (type: SessionType) => {
    const keepTitle = v.title.trim() && v.title !== SESSION_LABEL[v.type];
    set({ type, title: keepTitle ? v.title : SESSION_LABEL[type], exercises: type === 'force' ? (v.exercises ?? []) : undefined });
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="field">
        <span className="field-label">Type</span>
        <div className="types">
          {TYPES.map((t) => (
            <button key={t} type="button" className="type-btn" aria-pressed={v.type === t} onClick={() => pickType(t)}>
              <span className="num">{TYPE_CODE[t]}</span>
              {SESSION_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {mode === 'template' && (
        <div className="field">
          <span className="field-label">Jour</span>
          <div className="chips chips--days">
            {DAY_SHORT.map((d, i) => (
              <button key={d} type="button" className="chip" aria-pressed={v.day === i} onClick={() => set({ day: i })}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor="ed-title">Intitulé</label>
        <input id="ed-title" className="text-input" value={v.title} onChange={(e) => set({ title: e.target.value })} />
      </div>

      {v.type !== 'repos' && (
        <>
          {mode === 'template' && (
            <div className="field">
              <span className="field-label">Durée</span>
              <div className="toggle-row">
                <button type="button" aria-pressed={!!v.progressive} onClick={() => set({ progressive: true })}>
                  Suit la progression
                </button>
                <button type="button" aria-pressed={!v.progressive} onClick={() => set({ progressive: false })}>
                  Durée fixe
                </button>
              </div>
            </div>
          )}
          <Stepper
            label={mode === 'template' && v.progressive ? 'Durée cette semaine' : 'Durée prévue'}
            unit={mode === 'template' && v.progressive ? 'minutes, puis +10 % max par semaine avec le volume' : 'minutes'}
            value={v.durationMin}
            onChange={(d) => set({ durationMin: d })}
            step={5}
          />
        </>
      )}

      {v.autoLabel && (
        <div className="field">
          <span className="field-label">Contenu ajusté chaque semaine : {v.autoLabel.toLowerCase()}</span>
          <div className="toggle-row">
            <button type="button" aria-pressed={!!v.keepAuto} onClick={() => set({ keepAuto: true })}>Garder</button>
            <button type="button" aria-pressed={!v.keepAuto} onClick={() => set({ keepAuto: false })}>Texte libre seul</button>
          </div>
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor="ed-details">Contenu, consignes</label>
        <textarea id="ed-details" className="text-input" value={v.details} onChange={(e) => set({ details: e.target.value })} />
      </div>

      {v.type === 'force' && <ExercisesEditor value={v.exercises ?? []} onChange={(exercises) => set({ exercises })} />}

      <div className="form-footer stack stack--tight">
        <button className="btn btn--primary btn--block" disabled={!v.title.trim()} onClick={() =>
            onSave({
              ...v,
              title: v.title.trim(),
              exercises: v.exercises?.filter((e) => e.name.trim()).map((e) => ({ ...e, name: e.name.trim() })),
            })
          }
        >
          {saveLabel}
        </button>
        {onDelete && (
          <button className="btn btn--ghost btn--block" style={{ color: 'var(--blood-bright)' }} onClick={onDelete}>
            Supprimer cette séance
          </button>
        )}
        <button className="btn btn--ghost btn--block" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function ExercisesEditor({ value, onChange }: { value: ExercisePrescription[]; onChange: (v: ExercisePrescription[]) => void }) {
  const update = (i: number, patch: Partial<ExercisePrescription>) => onChange(value.map((e, k) => (k === i ? { ...e, ...patch } : e)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="field">
      <span className="field-label">Exercices prescrits</span>
      <datalist id="exercise-names">
        {COMMON_EXERCISES.map((e) => (
          <option key={e.name} value={e.name} />
        ))}
      </datalist>
      {value.length === 0 && <p className="small muted">Aucun exercice. Ajoute ceux de la séance pour suivre tes charges.</p>}
      {value.map((e, i) => (
        <div key={i} className="exercise">
          <div className="row">
            <input
              className="text-input"
              list="exercise-names"
              aria-label={`Exercice ${i + 1}`}
              placeholder="Nom de l'exercice"
              value={e.name}
              onChange={(ev) => {
                const name = ev.target.value;
                const known = COMMON_EXERCISES.find((c) => c.name === name);
                update(i, known ? { name, unit: known.unit } : { name });
              }}
            />
            <button type="button" className="btn btn--ghost btn--sm" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="btn btn--ghost btn--sm" aria-label="Retirer" onClick={() => onChange(value.filter((_, k) => k !== i))}>×</button>
          </div>
          <div className="grid-3">
            <div className="stack stack--tight">
              <span className="small muted">Séries</span>
              <MiniStepper label={`${e.name} : séries`} value={e.sets} onChange={(n) => update(i, { sets: Math.max(1, n ?? 1) })} />
            </div>
            <div className="stack stack--tight">
              <span className="small muted">{e.unit === 's' ? 'Secondes' : e.unit === 'm' ? 'Mètres' : 'Répétitions'}</span>
              <MiniStepper label={`${e.name} : objectif`} value={e.reps} onChange={(n) => update(i, { reps: n ?? 0 })} step={e.unit === 'reps' || !e.unit ? 1 : 5} />
            </div>
            <div className="stack stack--tight">
              <span className="small muted">Charge de départ</span>
              <MiniStepper label={`${e.name} : charge de départ`} value={e.kg} onChange={(n) => update(i, { kg: n || undefined })} step={2.5} decimals={1} suffix="kg" placeholder="PDC" />
            </div>
          </div>
          <div className="chips" role="group" aria-label="Unité">
            {UNITS.map((u) => (
              <button key={u} type="button" className="chip" aria-pressed={(e.unit ?? 'reps') === u} onClick={() => update(i, { unit: u })}>
                {u === 'reps' ? 'Répétitions' : u === 's' ? 'Secondes' : 'Mètres'}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="btn btn--sm btn--block" onClick={() => onChange([...value, { name: '', sets: 3, reps: 8, unit: 'reps' }])}>
        + Ajouter un exercice
      </button>
      <p className="small muted">En séance, la charge proposée suit ton historique : +2,5 kg quand toutes les séries ont été réussies.</p>
    </div>
  );
}
