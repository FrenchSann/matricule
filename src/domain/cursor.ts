// Avancement dans les 58 fiches : la « décision du dimanche » (avancer, répéter, alléger).
import type { ISODate } from './dates';
import { deloadOf, lastOrdinaryWeeks, PROGRAM_WEEKS, sheet, sheetKind } from './programme';
import type { Decision, LogEntry, PlannedSession, Profile, WeekKind, WeekPlan } from './types';

export const DECISION_LABEL: Record<Decision, string> = {
  advance: 'Avancer',
  repeat: 'Répéter',
  lighten: 'Alléger',
};

export const OVERLOAD_RPE = 8;
export const PAIN_LIMIT = 2;
export const FATIGUE_LIMIT = 8;
/** Au-delà, une semaine ordinaire n'est plus « bien tolérée ». */
export const TOLERATED_FATIGUE = 7;

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
    completion: trainable.length ? done / trainable.length : 1,
    done,
    planned: trainable.length,
  };
}

const fmt = (n: number) => n.toFixed(1).replace('.', ',');
const LIGHT: WeekKind[] = ['deload', 'forced-deload', 'taper', 'adaptation'];

export interface Suggestion {
  decision: Decision;
  reason: string;
}

export function isTolerated(week: WeekPlan, review: WeekReview): boolean {
  return review.painCount === 0 && (week.checkin?.fatigue ?? 0) < TOLERATED_FATIGUE;
}

/** Ordinaires du bloc (dernière occurrence de chaque fiche, répétitions comprises). */
function ordinaryWeeksOfBlock(bilanWeek: number, history: WeekPlan[]): WeekPlan[] {
  const wanted = lastOrdinaryWeeks(bilanWeek);
  const out: WeekPlan[] = [];
  for (const n of wanted) {
    const w = [...history].reverse().find((h) => h.programWeek === n && (h.kind === 'normal' || h.kind === 'repeat'));
    if (w) out.push(w);
  }
  return out;
}

/** Décision conseillée pour la semaine qui suit `prev`, d'après le journal et le bilan du dimanche. */
export function suggestDecision(prev: WeekPlan, history: WeekPlan[], reviewOf: (w: WeekPlan) => WeekReview): Suggestion {
  const r = reviewOf(prev);
  const signals = [
    r.painCount >= PAIN_LIMIT ? `${r.painCount} douleurs signalées` : null,
    r.avgRpe !== null && r.avgRpe > OVERLOAD_RPE ? `RPE moyen ${fmt(r.avgRpe)}` : null,
    (prev.checkin?.fatigue ?? 0) >= FATIGUE_LIMIT ? `fatigue ${prev.checkin!.fatigue}/10` : null,
  ].filter(Boolean);

  if (signals.length) {
    if (LIGHT.includes(prev.kind)) {
      return { decision: 'repeat', reason: `${signals.join(', ')} : fatigue persistante, on répète la semaine légère avant de relancer.` };
    }
    return { decision: 'lighten', reason: `${signals.join(', ')} : semaine allégée (feu orange).` };
  }

  if (r.planned > 0 && r.done === 0 && !LIGHT.includes(prev.kind)) {
    return { decision: 'lighten', reason: 'Semaine interrompue : reprise allégée, sans rattraper les séances.' };
  }

  if (prev.kind === 'bilan' && prev.programWeek < PROGRAM_WEEKS) {
    const ordinary = ordinaryWeeksOfBlock(prev.programWeek, history);
    const tolerated = ordinary.filter((w) => isTolerated(w, reviewOf(w))).length;
    if (tolerated < 2) {
      return {
        decision: 'repeat',
        reason: `${tolerated} semaine${tolerated > 1 ? 's' : ''} bien tolérée${tolerated > 1 ? 's' : ''} sur les 3 dernières : on répète la dernière semaine bien tolérée avant le bloc suivant.`,
      };
    }
    return { decision: 'advance', reason: `Bloc validé : ${tolerated} semaines sur 3 sans douleur ni fatigue durable.` };
  }

  return { decision: 'advance', reason: 'Semaine bien tolérée : on avance.' };
}

const make = (weekStart: ISODate, programWeek: number, kind: WeekKind, nextProgramWeek: number, reason: string, extra: Partial<WeekPlan> = {}): WeekPlan => ({
  weekStart,
  programWeek,
  nextProgramWeek,
  kind,
  reason,
  totalMin: programWeek === 0 ? 0 : sheet(programWeek).totalMin,
  ...extra,
});

export interface PlanInput {
  profile: Profile;
  weekStart: ISODate;
  history: WeekPlan[];
  reviewOf: (w: WeekPlan) => WeekReview;
}

/** Première semaine : adaptation éventuelle, puis S01. */
export function firstWeek(profile: Profile, weekStart: ISODate): WeekPlan {
  if (profile.entryWeeks > 0) {
    return make(weekStart, 0, 'adaptation', profile.entryWeeks > 1 ? 0 : 1, 'Version d’entrée avant la semaine 1.', { entryLeft: profile.entryWeeks });
  }
  return make(weekStart, 1, sheetKind(1), 2, 'Première semaine du programme.');
}

/**
 * Semaine suivante selon la décision (celle du dimanche si elle existe, sinon la décision conseillée).
 * Renvoie null quand le programme est terminé.
 */
export function planNextWeek({ profile, weekStart, history, reviewOf }: PlanInput): WeekPlan | null {
  const prev = history.at(-1);
  if (!prev) return firstWeek(profile, weekStart);

  const suggested = suggestDecision(prev, history, reviewOf);
  const decision = prev.checkin?.decision ?? suggested.decision;
  const reason = prev.checkin ? `Ta décision du dimanche : ${DECISION_LABEL[decision].toLowerCase()}.` : suggested.reason;

  if (decision === 'lighten') {
    if (prev.nextProgramWeek === 0 || prev.programWeek === 0) {
      return make(weekStart, 0, 'adaptation', prev.nextProgramWeek, reason, { entryLeft: prev.entryLeft });
    }
    if (prev.nextProgramWeek > PROGRAM_WEEKS) return null;
    return make(weekStart, deloadOf(prev.nextProgramWeek), 'forced-deload', prev.nextProgramWeek, reason);
  }

  if (decision === 'repeat') {
    if (prev.programWeek === 0) return make(weekStart, 0, 'adaptation', prev.nextProgramWeek, reason, { entryLeft: prev.entryLeft });
    if (prev.kind === 'bilan' && prev.programWeek < PROGRAM_WEEKS) {
      const ordinary = ordinaryWeeksOfBlock(prev.programWeek, history);
      const target = [...ordinary].reverse().find((w) => isTolerated(w, reviewOf(w)))?.programWeek ?? prev.programWeek - 1;
      return make(weekStart, target, 'repeat', prev.nextProgramWeek, reason);
    }
    const kind: WeekKind = prev.kind === 'normal' || prev.kind === 'repeat' ? 'repeat' : prev.kind;
    return make(weekStart, prev.programWeek, kind, prev.nextProgramWeek, reason);
  }

  // Avancer
  const n = prev.nextProgramWeek;
  if (n > PROGRAM_WEEKS) return null;
  if (n === 0) {
    const left = (prev.entryLeft ?? 1) - 1;
    return make(weekStart, 0, 'adaptation', left > 1 ? 0 : 1, reason, { entryLeft: left });
  }
  return make(weekStart, n, sheetKind(n), n + 1, reason);
}
