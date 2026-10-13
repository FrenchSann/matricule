// Progression automatique : +10 % max, allègement toutes les 4 semaines,
// allègement forcé sur signaux de fatigue, affûtage en fin de phase 4.
import type { ISODate } from './dates';
import { DELOAD_FACTOR, PHASES, START_VOLUME, TAPER_CUTS, phaseAt, taperIndex, weekInPhase } from './program';
import type { LogEntry, PlannedSession, Profile, SessionType, WeekKind, WeekPlan } from './types';

export const MAX_WEEKLY_GROWTH = 0.1;
export const COMFORT_RPE = 7;
export const OVERLOAD_RPE = 8;
export const PAIN_LIMIT = 2;
export const COMPLETION_MIN = 0.8;
export const LOADING_WEEKS = 3;

/** Poids de chaque type dans le volume (le grappling compte, la mobilité peu). */
export const TYPE_WEIGHT: Record<SessionType, number> = {
  course: 1.1,
  marche: 1.2,
  natation: 0.8,
  force: 1,
  grappling: 1,
  mobilite: 0.3,
  repos: 0,
};

export function weightedMinutes(logs: LogEntry[]): number {
  return logs.reduce((sum, l) => sum + (l.durationMin ?? 0) * TYPE_WEIGHT[l.type], 0);
}

export interface WeekReview {
  avgRpe: number | null;
  painCount: number;
  completion: number;
  done: number;
  planned: number;
}

export function reviewWeek(logs: LogEntry[], planned: PlannedSession[]): WeekReview {
  const rpes = logs.filter((l) => l.type !== 'repos' && typeof l.rpe === 'number').map((l) => l.rpe!);
  const trainable = planned.filter((p) => p.type !== 'repos');
  const done = trainable.filter((p) => p.status === 'done').length;
  return {
    avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    painCount: logs.filter((l) => l.pain).length,
    completion: trainable.length ? done / trainable.length : 0,
    done,
    planned: trainable.length,
  };
}

const fmt = (n: number) => n.toFixed(1).replace('.', ',');

export interface NextWeekInput {
  profile: Profile;
  weekStart: ISODate;
  /** semaines précédentes, de la plus ancienne à la plus récente */
  history: WeekPlan[];
  /** bilan de la semaine précédente (null si aucune) */
  previous: WeekReview | null;
}

/** Détermine la nature et le volume cible d'une nouvelle semaine. */
export function planNextWeek({ profile, weekStart, history, previous }: NextWeekInput): WeekPlan {
  const phase = phaseAt(profile, weekStart);
  const w = weekInPhase(profile, weekStart);
  const cap = PHASES[phase].cap;
  const prev = history.at(-1);

  const make = (kind: WeekKind, base: number, target: number, reason: string): WeekPlan => ({
    weekStart,
    phase,
    weekInPhase: w,
    kind,
    baseVolumeMin: Math.round(base),
    volumeTargetMin: Math.round(target),
    reason,
  });

  if (!prev || !previous) {
    const base = Math.min(prev?.baseVolumeMin ?? START_VOLUME, cap);
    return make('normal', base, base, 'Première semaine du programme.');
  }

  // 1. Volume de référence : progresse uniquement après une semaine normale réussie et confortable.
  let base = prev.baseVolumeMin;
  let reason: string;
  if (prev.kind !== 'normal') {
    reason = prev.kind === 'taper' ? 'Affûtage en cours.' : 'Reprise après la semaine allégée.';
  } else if (previous.completion < COMPLETION_MIN) {
    reason = `Plan réalisé à ${Math.round(previous.completion * 100)} % : volume maintenu.`;
  } else if (previous.avgRpe === null) {
    reason = 'Aucun RPE noté : volume maintenu.';
  } else if (previous.avgRpe > COMFORT_RPE) {
    reason = `RPE moyen ${fmt(previous.avgRpe)} : volume maintenu.`;
  } else {
    base = prev.baseVolumeMin * (1 + MAX_WEEKLY_GROWTH);
    reason = `Séances réussies, RPE moyen ${fmt(previous.avgRpe)} : progression.`;
  }
  base = Math.min(base, cap);

  // 2. Affûtage final : prioritaire sur le reste.
  const taper = taperIndex(profile, weekStart);
  if (taper) {
    const cut = TAPER_CUTS[taper - 1];
    return make('taper', base, base * (1 - cut), `Affûtage, semaine ${taper}/3 : volume −${cut * 100} %.`);
  }

  // 3. Signaux de fatigue de la semaine précédente → allègement forcé.
  const overload = previous.avgRpe !== null && previous.avgRpe > OVERLOAD_RPE;
  const pain = previous.painCount >= PAIN_LIMIT;
  if (overload || pain) {
    const why = [
      overload ? `RPE moyen ${fmt(previous.avgRpe!)} la semaine dernière` : null,
      pain ? `${previous.painCount} douleurs signalées` : null,
    ]
      .filter(Boolean)
      .join(' et ');
    return make('forced-deload', prev.baseVolumeMin, prev.baseVolumeMin * DELOAD_FACTOR, `${why} : semaine allégée.`);
  }

  // 4. Cycle 3 semaines de charge + 1 semaine allégée.
  let loading = 0;
  for (let i = history.length - 1; i >= 0 && history[i].kind === 'normal'; i--) loading++;
  if (loading >= LOADING_WEEKS) {
    return make('deload', base, base * DELOAD_FACTOR, 'Semaine allégée du cycle : volume −35 %.');
  }

  return make('normal', base, base, reason);
}
