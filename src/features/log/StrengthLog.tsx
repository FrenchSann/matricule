import { useState } from 'react';
import {
  exerciseHistory,
  knownExercises,
  LOAD_STEP,
  records,
  suggestLoad,
  UNIT_LABEL,
  type ExerciseSession,
} from '../../domain/strength';
import type { ExercisePrescription, LogEntry, SetEntry, SetUnit, TemplateItem } from '../../domain/types';
import { MiniStepper } from '../../ui/kit';

export interface ExerciseGroup {
  name: string;
  unit: SetUnit;
  prescription?: ExercisePrescription;
  sets: { reps?: number; kg?: number }[];
}

const fmtKg = (kg: number) => String(kg).replace('.', ',');

/** Groupes initiaux : séries déjà consignées, sinon séries prévues avec la charge proposée. */
export function initialGroups(existing: SetEntry[] | undefined, prescribed: ExercisePrescription[] | undefined, history: LogEntry[]): ExerciseGroup[] {
  if (existing?.length) {
    const groups: ExerciseGroup[] = [];
    for (const s of existing) {
      let g = groups.find((x) => x.name === s.exercise);
      if (!g) {
        g = { name: s.exercise, unit: s.unit ?? 'reps', prescription: prescribed?.find((p) => p.name === s.exercise), sets: [] };
        groups.push(g);
      }
      g.sets.push({ reps: s.reps, kg: s.kg });
    }
    return groups;
  }
  return (prescribed ?? []).map((p) => {
    const sug = suggestLoad(exerciseHistory(history, p.name), p);
    return { name: p.name, unit: p.unit ?? 'reps', prescription: p, sets: Array.from({ length: p.sets }, () => ({ reps: p.reps, kg: sug.kg })) };
  });
}

export function flattenGroups(groups: ExerciseGroup[]): SetEntry[] {
  return groups.flatMap((g) =>
    g.sets.filter((s) => (s.reps ?? 0) > 0).map((s) => ({ exercise: g.name, reps: s.reps!, kg: s.kg || undefined, unit: g.unit })),
  );
}

export function StrengthLog({
  groups,
  onChange,
  history,
  templates,
}: {
  groups: ExerciseGroup[];
  onChange: (g: ExerciseGroup[]) => void;
  /** séances antérieures (hors séance en cours) */
  history: LogEntry[];
  templates: TemplateItem[][];
}) {
  const [custom, setCustom] = useState('');
  const known = knownExercises(history, templates).filter((e) => !groups.some((g) => g.name === e.name));

  const update = (i: number, g: ExerciseGroup) => onChange(groups.map((x, k) => (k === i ? g : x)));
  const add = (name: string, unit: SetUnit = 'reps') => {
    const clean = name.trim();
    if (!clean || groups.some((g) => g.name === clean)) return;
    const h = exerciseHistory(history, clean);
    const last = h.at(-1);
    onChange([...groups, { name: clean, unit, sets: [{ reps: last?.topReps, kg: last?.topKg || undefined }] }]);
    setCustom('');
  };

  return (
    <div className="field">
      <span className="field-label">Exercices et charges</span>
      {groups.map((g, i) => (
        <ExerciseBlock key={g.name} group={g} history={exerciseHistory(history, g.name)} onChange={(ng) => update(i, ng)} onRemove={() => onChange(groups.filter((_, k) => k !== i))} />
      ))}
      <div className="stack stack--tight" style={{ paddingTop: 8, borderTop: '1px solid var(--steel)' }}>
        <span className="small muted">Ajouter un exercice</span>
        <div className="chips">
          {known.slice(0, 10).map((e) => (
            <button key={e.name} type="button" className="chip" onClick={() => add(e.name, e.unit)}>
              + {e.name}
            </button>
          ))}
        </div>
        <div className="row">
          <input className="text-input" placeholder="Autre exercice" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button type="button" className="btn btn--sm" disabled={!custom.trim()} onClick={() => add(custom)}>
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

function ExerciseBlock({
  group: g,
  history,
  onChange,
  onRemove,
}: {
  group: ExerciseGroup;
  history: ExerciseSession[];
  onChange: (g: ExerciseGroup) => void;
  onRemove: () => void;
}) {
  const rec = records(history);
  const sug = g.prescription ? suggestLoad(history, g.prescription) : null;
  const last = history.at(-1);
  const unit = UNIT_LABEL[g.unit];
  // Changer une valeur l'applique aussi aux séries suivantes qui avaient la même valeur.
  const setRow = (k: number, field: 'reps' | 'kg', value: number | undefined) => {
    const old = g.sets[k][field];
    onChange({ ...g, sets: g.sets.map((s, j) => (j === k || (j > k && s[field] === old) ? { ...s, [field]: value } : s)) });
  };

  return (
    <div className="exercise">
      <div className="exercise-head">
        <span className="exercise-name">{g.name}</span>
        <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
          {g.prescription ? `prévu ${g.prescription.sets}×${g.prescription.reps}${g.unit === 'reps' ? '' : ` ${unit}`}` : ''}
        </span>
      </div>
      {sug && <p className={`exercise-hint ${sug.reason === 'progress' ? 'exercise-hint--up' : ''}`}>{sug.text}</p>}
      {!sug && last && (
        <p className="exercise-hint">
          Dernière fois : {last.topReps} {unit}
          {last.topKg ? ` à ${fmtKg(last.topKg)} kg` : ''}.
        </p>
      )}
      {(rec.bestKg || rec.bestReps) && (
        <p className="small">
          <span className="pr">Record</span>{' '}
          {rec.bestKg ? `${fmtKg(rec.bestKg.kg)} kg × ${rec.bestKg.reps}` : `${rec.bestReps!.reps} ${unit}`}
          {rec.bestE1rm ? <span className="muted">, 1RM estimé {fmtKg(rec.bestE1rm)} kg</span> : null}
        </p>
      )}
      {g.sets.map((s, k) => (
        <div key={k} className="set-line">
          <span className="set-n">{k + 1}</span>
          <MiniStepper label={`${g.name}, série ${k + 1} : ${unit}`} value={s.reps} onChange={(v) => setRow(k, 'reps', v)} suffix={unit} />
          <MiniStepper
            label={`${g.name}, série ${k + 1} : charge`}
            value={s.kg}
            onChange={(v) => setRow(k, 'kg', v || undefined)}
            step={LOAD_STEP}
            decimals={1}
            suffix="kg"
            placeholder="PDC"
          />
          <button type="button" className="remove" aria-label={`Retirer la série ${k + 1}`} onClick={() => onChange({ ...g, sets: g.sets.filter((_, j) => j !== k) })}>
            ×
          </button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn btn--sm" style={{ flex: 1 }} onClick={() => onChange({ ...g, sets: [...g.sets, { ...(g.sets.at(-1) ?? {}) }] })}>
          + Série
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRemove}>
          Retirer l'exercice
        </button>
      </div>
    </div>
  );
}
