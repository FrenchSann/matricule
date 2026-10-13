// Musculation : historique par exercice, records, 1RM estimé et charge proposée.
import type { ISODate } from './dates';
import type { ExercisePrescription, LogEntry, SetEntry, SetUnit, TemplateItem } from './types';

export const LOAD_STEP = 2.5;
/** Au-delà de ce RPE de séance, on ne monte pas la charge. */
export const MAX_RPE_TO_PROGRESS = 8;

export const UNIT_LABEL: Record<SetUnit, string> = { reps: 'reps', s: 's', m: 'm' };

export const COMMON_EXERCISES: { name: string; unit: SetUnit }[] = [
  { name: 'Tractions strictes', unit: 'reps' },
  { name: 'Pompes', unit: 'reps' },
  { name: 'Dips', unit: 'reps' },
  { name: 'Squat', unit: 'reps' },
  { name: 'Soulevé de terre', unit: 'reps' },
  { name: 'Développé couché', unit: 'reps' },
  { name: 'Développé militaire', unit: 'reps' },
  { name: 'Rowing barre', unit: 'reps' },
  { name: 'Fentes', unit: 'reps' },
  { name: 'Corde (montées)', unit: 'reps' },
  { name: 'Gainage', unit: 's' },
  { name: 'Farmer walk', unit: 'm' },
];

export interface ExerciseSession {
  date: ISODate;
  logId?: number;
  sets: SetEntry[];
  /** charge la plus lourde de la séance (0 si poids du corps) */
  topKg: number;
  /** meilleures répétitions (à la charge la plus lourde) */
  topReps: number;
  /** 1RM estimé (Epley), seulement pour les séries lestées en répétitions */
  e1rm: number | null;
  /** tonnage : somme kg × reps */
  volumeKg: number;
  rpe?: number;
}

/** Formule d'Epley, plafonnée à 12 répétitions pour rester fiable. */
export function epley(kg: number, reps: number): number {
  if (kg <= 0 || reps <= 0) return 0;
  return reps === 1 ? kg : kg * (1 + Math.min(reps, 12) / 30);
}

export function exerciseHistory(logs: LogEntry[], name: string): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const l of logs) {
    const sets = (l.sets ?? []).filter((s) => s.exercise === name && s.reps > 0);
    if (!sets.length) continue;
    const topKg = Math.max(...sets.map((s) => s.kg ?? 0));
    const topReps = Math.max(...sets.filter((s) => (s.kg ?? 0) === topKg).map((s) => s.reps));
    const isReps = (sets[0].unit ?? 'reps') === 'reps';
    const best = isReps ? Math.max(...sets.map((s) => epley(s.kg ?? 0, s.reps))) : 0;
    out.push({
      date: l.date,
      logId: l.id,
      sets,
      topKg,
      topReps,
      e1rm: best > 0 ? Math.round(best * 2) / 2 : null,
      volumeKg: sets.reduce((sum, s) => sum + (s.kg ?? 0) * s.reps, 0),
      rpe: l.rpe,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface ExerciseRecord {
  /** charge max soulevée, avec ses répétitions */
  bestKg: { kg: number; reps: number; date: ISODate } | null;
  /** meilleures répétitions en une série (poids du corps ou toutes charges) */
  bestReps: { reps: number; kg: number; date: ISODate } | null;
  bestE1rm: number | null;
}

export function records(history: ExerciseSession[]): ExerciseRecord {
  let bestKg: ExerciseRecord['bestKg'] = null;
  let bestReps: ExerciseRecord['bestReps'] = null;
  let bestE1rm: number | null = null;
  for (const h of history) {
    for (const s of h.sets) {
      const kg = s.kg ?? 0;
      if (kg > 0 && (!bestKg || kg > bestKg.kg || (kg === bestKg.kg && s.reps > bestKg.reps))) bestKg = { kg, reps: s.reps, date: h.date };
      if (!bestReps || s.reps > bestReps.reps) bestReps = { reps: s.reps, kg, date: h.date };
    }
    if (h.e1rm && (!bestE1rm || h.e1rm > bestE1rm)) bestE1rm = h.e1rm;
  }
  return { bestKg, bestReps, bestE1rm };
}

export interface LoadSuggestion {
  kg?: number;
  reps: number;
  reason: 'start' | 'progress' | 'hold' | 'bodyweight';
  text: string;
}

const fmtKg = (kg: number) => `${String(kg).replace('.', ',')} kg`;

/**
 * Charge proposée pour la prochaine séance : on monte de 2,5 kg quand toutes les séries
 * prévues ont été réussies à la dernière séance avec un RPE ≤ 8, sinon on garde la charge.
 */
export function suggestLoad(history: ExerciseSession[], p: ExercisePrescription): LoadSuggestion {
  const last = history.at(-1);
  if (!last) {
    return p.kg
      ? { kg: p.kg, reps: p.reps, reason: 'start', text: `Charge de départ : ${fmtKg(p.kg)}.` }
      : { reps: p.reps, reason: 'bodyweight', text: 'Première fois : note tes séries.' };
  }
  const working = last.sets.filter((s) => (s.kg ?? 0) >= last.topKg);
  const hit = working.filter((s) => s.reps >= p.reps).length >= p.sets;
  const comfortable = last.rpe === undefined || last.rpe <= MAX_RPE_TO_PROGRESS;

  if (last.topKg <= 0) {
    const unit = p.unit ?? 'reps';
    const step = unit === 's' ? 5 : unit === 'm' ? 10 : 1;
    const more = unit === 'reps' ? '1 répétition de plus ou ajoute du lest' : `${step} ${UNIT_LABEL[unit]} de plus`;
    const text = hit && comfortable ? `Toutes les séries réussies : vise ${more}.` : `Vise l'objectif prévu.`;
    return { reps: hit && comfortable ? p.reps + step : p.reps, reason: 'bodyweight', text };
  }
  if (hit && comfortable) {
    const kg = last.topKg + LOAD_STEP;
    return { kg, reps: p.reps, reason: 'progress', text: `Séries réussies la dernière fois à ${fmtKg(last.topKg)} : passe à ${fmtKg(kg)}.` };
  }
  const why = !hit ? 'séries incomplètes' : `RPE ${last.rpe}`;
  return { kg: last.topKg, reps: p.reps, reason: 'hold', text: `Dernière fois ${fmtKg(last.topKg)} (${why}) : garde la charge.` };
}

/** Tous les exercices connus : base, semaines types et historique. */
export function knownExercises(logs: LogEntry[], templates: TemplateItem[][]): { name: string; unit: SetUnit }[] {
  const map = new Map<string, SetUnit>(COMMON_EXERCISES.map((e) => [e.name, e.unit]));
  for (const t of templates.flat()) for (const e of t.exercises ?? []) if (!map.has(e.name)) map.set(e.name, e.unit ?? 'reps');
  for (const l of logs) for (const s of l.sets ?? []) if (!map.has(s.exercise)) map.set(s.exercise, s.unit ?? 'reps');
  return [...map.entries()].map(([name, unit]) => ({ name, unit }));
}

/** Exercices réellement pratiqués, du plus récent au plus ancien. */
export function practicedExercises(logs: LogEntry[]): string[] {
  const seen = new Map<string, ISODate>();
  for (const l of logs) {
    for (const s of l.sets ?? []) {
      const prev = seen.get(s.exercise);
      if (s.reps > 0 && (!prev || l.date > prev)) seen.set(s.exercise, l.date);
    }
  }
  return [...seen.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([n]) => n);
}

export function summarizeSets(sets: SetEntry[]): string {
  // Regroupe les séries identiques : "3×8 à 40 kg, 1×6 à 40 kg"
  const groups: { reps: number; kg: number; unit: SetUnit; n: number }[] = [];
  for (const s of sets) {
    const g = groups.at(-1);
    const kg = s.kg ?? 0;
    if (g && g.reps === s.reps && g.kg === kg) g.n++;
    else groups.push({ reps: s.reps, kg, unit: s.unit ?? 'reps', n: 1 });
  }
  return groups
    .map((g) => `${g.n}×${g.reps}${g.unit === 'reps' ? '' : ` ${UNIT_LABEL[g.unit]}`}${g.kg ? ` à ${fmtKg(g.kg)}` : ''}`)
    .join(', ');
}
