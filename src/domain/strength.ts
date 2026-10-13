// Musculation : historique par exercice, records, 1RM estimé et charge proposée.
import type { ISODate } from './dates';
import type { ExercisePrescription, LogEntry, SetEntry, SetUnit } from './types';

/** Plus petit palier : souvent 1 à 2 kg au total en haut du corps, 2 à 5 kg en bas. */
export const UPPER_STEP = 1;
export const LOWER_STEP = 2.5;
/** Pas de saisie des charges dans le journal. */
export const LOAD_STEP = 1;
/** Au-delà de ce RPE de séance, la réserve demandée (RIR) n'est plus respectée. */
export const MAX_RPE_TO_PROGRESS = 8;

const LOWER_BODY = /squat|soulevé|fente|trap bar|kettlebell|mollets|leg curl|chaise|presse|porté|farmer/i;

export function loadStep(name: string): number {
  return LOWER_BODY.test(name) ? LOWER_STEP : UPPER_STEP;
}

export const UNIT_LABEL: Record<SetUnit, string> = { reps: 'reps', s: 's', m: 'm' };

/** Exercices du programme, puis quelques classiques pour les séances ajoutées. */
export const COMMON_EXERCISES: { name: string; unit: SetUnit }[] = [
  { name: 'Développé couché', unit: 'reps' },
  { name: 'Tractions pronation / assistées', unit: 'reps' },
  { name: 'Squat (variante conservée)', unit: 'reps' },
  { name: 'Soulevé de terre roumain', unit: 'reps' },
  { name: 'Trap bar / kettlebell surélevée', unit: 'reps' },
  { name: 'Développé épaules haltères', unit: 'reps' },
  { name: 'Tirage vertical pronation', unit: 'reps' },
  { name: 'Développé incliné haltères', unit: 'reps' },
  { name: 'Rowing poitrine appuyée', unit: 'reps' },
  { name: 'Élévations latérales', unit: 'reps' },
  { name: 'Curl biceps', unit: 'reps' },
  { name: 'Extension triceps', unit: 'reps' },
  { name: 'Fente arrière', unit: 'reps' },
  { name: 'Goblet squat', unit: 'reps' },
  { name: 'Pompes (hauteur adaptée)', unit: 'reps' },
  { name: 'Mollets debout', unit: 'reps' },
  { name: 'Dead bug', unit: 'reps' },
  { name: 'Chaise de Killy', unit: 's' },
  { name: 'Porté fermier', unit: 'm' },
  { name: 'Dips', unit: 'reps' },
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
  /** répétitions visées pour la prochaine séance */
  reps: number;
  reason: 'start' | 'progress' | 'reps' | 'confirm' | 'hold' | 'bodyweight';
  text: string;
}

const fmtKg = (kg: number) => `${String(+kg.toFixed(2)).replace('.', ',')} kg`;

export const rangeText = (p: ExercisePrescription) => (p.repsMin && p.repsMin !== p.reps ? `${p.repsMin}-${p.reps}` : `${p.reps}`);

/** Toutes les séries de travail au haut de plage, avec la réserve respectée (RPE de séance ≤ 8). */
function atTop(session: ExerciseSession, p: ExercisePrescription): boolean {
  const working = session.sets.filter((s) => (s.kg ?? 0) >= session.topKg);
  const comfortable = session.rpe === undefined || session.rpe <= MAX_RPE_TO_PROGRESS;
  const needed = p.bilan ? 1 : p.sets;
  return comfortable && working.length >= needed && working.every((s) => s.reps >= p.reps);
}

/**
 * Double progression du programme : on monte d'abord les répétitions dans la plage ;
 * après deux séances réussies au haut de plage avec la réserve demandée, on ajoute le plus petit palier.
 */
export function suggestLoad(history: ExerciseSession[], p: ExercisePrescription): LoadSuggestion {
  const range = rangeText(p);
  const low = p.repsMin ?? p.reps;
  const last = history.at(-1);
  if (!last) {
    return p.kg
      ? { kg: p.kg, reps: low, reason: 'start', text: `Charge de départ : ${fmtKg(p.kg)}, ${range} répétitions avec la réserve demandée.` }
      : { reps: low, reason: 'start', text: `Choisis une charge qui laisse la réserve demandée sur ${range} répétitions.` };
  }

  const unit = p.unit ?? 'reps';
  if (unit !== 'reps') {
    return { kg: last.topKg || undefined, reps: p.reps, reason: 'hold', text: `Objectif ${p.reps} ${UNIT_LABEL[unit]}${last.topKg ? `, ${fmtKg(last.topKg)} la dernière fois` : ''}.` };
  }

  const kg = last.topKg;
  const prev = history.at(-2);
  const lastTop = atTop(last, p);
  const prevTop = !!prev && prev.topKg === kg && atTop(prev, p);

  if (kg <= 0) {
    if (lastTop && prevTop) {
      return { reps: p.reps, reason: 'bodyweight', text: `Haut de plage atteint deux fois : ajoute un petit lest (ou réduis l'assistance).` };
    }
    const target = Math.min(p.reps, Math.max(low, Math.min(...last.sets.map((s) => s.reps)) + 1));
    return { reps: target, reason: 'bodyweight', text: `Vise ${target} répétitions propres (plage ${range}).` };
  }

  if (lastTop && prevTop) {
    const next = kg + loadStep(p.name);
    return { kg: next, reps: low, reason: 'progress', text: `Deux séances au haut de plage à ${fmtKg(kg)} : passe à ${fmtKg(next)}, ${range} répétitions.` };
  }
  if (lastTop) {
    return { kg, reps: p.reps, reason: 'confirm', text: `Haut de plage atteint à ${fmtKg(kg)} : confirme-le une fois, puis la charge montera.` };
  }
  if (last.rpe !== undefined && last.rpe > MAX_RPE_TO_PROGRESS) {
    return { kg, reps: low, reason: 'hold', text: `Dernière séance trop dure (RPE ${last.rpe}) : garde ${fmtKg(kg)} et la réserve demandée.` };
  }
  const target = Math.min(p.reps, Math.max(low, Math.min(...last.sets.filter((s) => (s.kg ?? 0) >= kg).map((s) => s.reps)) + 1));
  return { kg, reps: target, reason: 'reps', text: `Garde ${fmtKg(kg)} et vise ${target} répétitions (plage ${range}).` };
}

/** Tous les exercices connus : base, séances prévues et historique. */
export function knownExercises(logs: LogEntry[], prescribed: ExercisePrescription[] = []): { name: string; unit: SetUnit }[] {
  const map = new Map<string, SetUnit>(COMMON_EXERCISES.map((e) => [e.name, e.unit]));
  for (const e of prescribed) if (!map.has(e.name)) map.set(e.name, e.unit ?? 'reps');
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
