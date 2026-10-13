// Le streak récompense le respect du plan : un repos prévu et respecté est un jour réussi,
// une douleur signalée excuse les séances non faites. Jamais d'incitation à s'entraîner blessé.
import { addDays, mondayOf, weekDays, type ISODate } from './dates';
import type { JokerUse, LogEntry, PlannedSession } from './types';

export type DayStatus =
  | 'done' // toutes les séances prévues faites
  | 'rest' // repos prévu et respecté
  | 'excused' // douleur signalée la veille ou le jour même
  | 'joker'
  | 'missed'
  | 'rest-broken' // entraînement sur un jour de repos
  | 'pending' // aujourd'hui, pas encore terminé
  | 'future';

export const KEPT: ReadonlySet<DayStatus> = new Set(['done', 'rest', 'excused', 'joker']);
const LIGHT_ON_REST = new Set(['mobilite', 'repos']);

export interface StreakInput {
  start: ISODate;
  today: ISODate;
  planned: PlannedSession[];
  logs: LogEntry[];
  jokers: JokerUse[];
}

export function dayStatuses({ start, today, planned, logs, jokers }: StreakInput): Map<ISODate, DayStatus> {
  const plannedByDay = groupBy(planned, (p) => p.date);
  const logsByDay = groupBy(logs, (l) => l.date);
  const painDays = new Set(logs.filter((l) => l.pain).map((l) => l.date));
  const jokerDays = new Set(jokers.map((j) => j.date));
  const out = new Map<ISODate, DayStatus>();

  const end = addDays(mondayOf(today), 6);
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (d > today) {
      out.set(d, 'future');
      continue;
    }
    const sessions = (plannedByDay.get(d) ?? []).filter((p) => p.type !== 'repos');
    const dayLogs = logsByDay.get(d) ?? [];
    let status: DayStatus;
    if (sessions.length === 0) {
      status = dayLogs.some((l) => !LIGHT_ON_REST.has(l.type)) ? 'rest-broken' : 'rest';
    } else if (sessions.every((s) => s.status === 'done')) {
      status = 'done';
    } else if (painDays.has(d) || painDays.has(addDays(d, -1))) {
      status = 'excused';
    } else {
      status = d === today ? 'pending' : 'missed';
    }
    if ((status === 'missed' || status === 'rest-broken') && jokerDays.has(d)) status = 'joker';
    // Aujourd'hui, un repos n'est acquis qu'en fin de journée : il ne casse rien en attendant.
    if (d === today && status === 'rest-broken') status = 'pending';
    out.set(d, status);
  }
  return out;
}

export interface StreakSummary {
  current: number;
  best: number;
  /** semaines entièrement tenues sans joker (gagnent des jokers) */
  perfectWeeks: number;
  /** semaines tenues, jokers compris (comptent pour les grades) */
  heldWeeks: number;
  jokersEarned: number;
  jokersAvailable: number;
}

export function summarize(statuses: Map<ISODate, DayStatus>, jokers: JokerUse[], today: ISODate): StreakSummary {
  const days = [...statuses.keys()].sort();
  let best = 0;
  let run = 0;
  for (const d of days) {
    const s = statuses.get(d)!;
    if (s === 'future' || s === 'pending') continue;
    run = KEPT.has(s) ? run + 1 : 0;
    best = Math.max(best, run);
  }

  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const s = statuses.get(days[i])!;
    if (s === 'future' || s === 'pending') continue;
    if (!KEPT.has(s)) break;
    current++;
  }

  let perfectWeeks = 0;
  let heldWeeks = 0;
  const thisMonday = mondayOf(today);
  const mondays = new Set(days.map(mondayOf));
  for (const monday of mondays) {
    if (monday >= thisMonday) continue; // seules les semaines terminées comptent
    const week = weekDays(monday).map((d) => statuses.get(d));
    if (week.some((s) => s === undefined)) continue; // semaine entamée avant le début du programme
    if (week.every((s) => KEPT.has(s!))) {
      heldWeeks++;
      if (!week.includes('joker')) perfectWeeks++;
    }
  }

  const jokersEarned = Math.floor(perfectWeeks / 2);
  return {
    current,
    best,
    perfectWeeks,
    heldWeeks,
    jokersEarned,
    jokersAvailable: Math.max(0, jokersEarned - jokers.length),
  };
}

/** Jours des 7 derniers jours qu'un joker peut encore couvrir. */
export function jokerCandidates(statuses: Map<ISODate, DayStatus>, today: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, -i);
    const s = statuses.get(d);
    if (s === 'missed' || s === 'rest-broken') out.push(d);
  }
  return out;
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
