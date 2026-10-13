import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/schema';
import { ensureWeeks, reviewer } from './db/engine';
import { addWeeks, mondayOf, toISO, today as todayISO, weekday, type ISODate } from './domain/dates';
import { filledCount } from './domain/bilans';
import { suggestDecision } from './domain/cursor';
import { blockOf, PROGRAM_WEEKS } from './domain/programme';
import { currentRank } from './domain/ranks';
import { dayStatuses, jokerCandidates, summarize } from './domain/streak';
import type { PlannedSession, WeekPlan } from './domain/types';

/** Date du jour, mise à jour au retour dans l'app et à minuit. */
export function useToday(): ISODate {
  const [day, setDay] = useState(todayISO);
  useEffect(() => {
    const refresh = () => setDay(todayISO());
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return day;
}

export function useData() {
  const today = useToday();
  const profile = useLiveQuery(() => db.profile.get('me').then((p) => p ?? null), []);
  const weeks = useLiveQuery(() => db.weeks.orderBy('weekStart').toArray(), []);
  const planned = useLiveQuery(() => db.planned.toArray(), []);
  const logs = useLiveQuery(() => db.logs.orderBy('date').toArray(), []);
  const bilans = useLiveQuery(() => db.bilans.orderBy('programWeek').toArray(), []);
  const jokers = useLiveQuery(() => db.jokers.toArray(), []);
  const ranks = useLiveQuery(() => db.ranks.toArray(), []);

  useEffect(() => {
    if (profile) void ensureWeeks(today);
  }, [profile?.startDate, today]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => {
    if (profile === undefined || !weeks || !planned || !logs || !bilans || !jokers || !ranks) {
      return { status: 'loading' as const };
    }
    if (profile === null) return { status: 'new' as const };

    // Les jours antérieurs à l'installation ne comptent pas comme manqués.
    const created = toISO(new Date(profile.createdAt));
    const start = created > profile.startDate ? created : profile.startDate;
    const statuses = dayStatuses({ start, today, planned, logs, jokers });
    const streak = summarize(statuses, jokers, today);
    const done = new Set(bilans.filter((b) => filledCount(b) > 0).map((b) => b.programWeek));
    const week = weeks.find((w) => w.weekStart === mondayOf(today));
    const last = weeks.at(-1);
    const programDone = !week && !!last && last.nextProgramWeek > PROGRAM_WEEKS && last.weekStart < mondayOf(today);
    const rank = currentRank({ heldWeeks: streak.heldWeeks, bilans: done, programDone: programDone || done.has(PROGRAM_WEEKS) });
    const block = blockOf(week?.programWeek ?? last?.programWeek ?? 1);
    const bilanDue = week && (week.kind === 'bilan') && !done.has(week.programWeek) ? week.programWeek : null;

    // Décision du dimanche : la semaine en cours le dimanche, la précédente en début de semaine si elle manque.
    const reviewOf = reviewer(logs, planned);
    let checkin: { week: WeekPlan; suggestion: ReturnType<typeof suggestDecision> } | null = null;
    const prevWeek = weeks.find((w) => w.weekStart === addWeeks(mondayOf(today), -1));
    const target = weekday(today) === 6 ? week : weekday(today) <= 1 ? prevWeek : undefined;
    if (target && !target.checkin) {
      const history = weeks.filter((w) => w.weekStart <= target.weekStart);
      checkin = { week: target, suggestion: suggestDecision(target, history, reviewOf) };
    }
    const sortSessions = (a: PlannedSession, b: PlannedSession) => a.date.localeCompare(b.date) || a.slot - b.slot;

    return {
      status: 'ready' as const,
      today,
      profile,
      weeks,
      planned: [...planned].sort(sortSessions),
      logs,
      bilans,
      bilansDone: done,
      jokers,
      ranks,
      statuses,
      streak,
      programDone,
      rank,
      block,
      week,
      checkin,
      bilanDue,
      reviewOf,
      jokerDays: streak.jokersAvailable > 0 ? jokerCandidates(statuses, today) : [],
    };
  }, [today, profile, weeks, planned, logs, bilans, jokers, ranks]);
}

export type Data = Extract<ReturnType<typeof useData>, { status: 'ready' }>;

export interface UI {
  openLog: (session?: PlannedSession) => void;
  stamp: (text?: string) => void;
  go: (tab: Tab) => void;
}
export type Tab = 'today' | 'plan' | 'stats' | 'dossier';

export const UIContext = createContext<UI>(null!);
export const useUI = () => useContext(UIContext);
