import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/schema';
import { ensureWeeks } from './db/engine';
import { mondayOf, toISO, today as todayISO, type ISODate } from './domain/dates';
import { phaseAt, programEnd, checkpointOpen, PHASE_CHECKPOINT } from './domain/program';
import { currentRank } from './domain/ranks';
import { dayStatuses, jokerCandidates, summarize } from './domain/streak';
import type { CheckpointMonth, PlannedSession } from './domain/types';

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
  const checkpoints = useLiveQuery(() => db.checkpoints.orderBy('date').toArray(), []);
  const jokers = useLiveQuery(() => db.jokers.toArray(), []);
  const ranks = useLiveQuery(() => db.ranks.toArray(), []);

  useEffect(() => {
    if (profile) void ensureWeeks(today);
  }, [profile?.startDate, today]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => {
    if (profile === undefined || !weeks || !planned || !logs || !checkpoints || !jokers || !ranks) {
      return { status: 'loading' as const };
    }
    if (profile === null) return { status: 'new' as const };

    // Les jours antérieurs à l'installation ne comptent pas comme manqués.
    const created = toISO(new Date(profile.createdAt));
    const start = created > profile.startDate ? created : profile.startDate;
    const statuses = dayStatuses({ start, today, planned, logs, jokers });
    const streak = summarize(statuses, jokers, today);
    const passed = new Set<CheckpointMonth>(checkpoints.filter((c) => c.allPassed).map((c) => c.month));
    const end = programEnd(profile);
    const programDone = !!end && end <= today;
    const rank = currentRank({ heldWeeks: streak.heldWeeks, passed, programDone });
    const phase = phaseAt(profile, today);
    const dueMonth = PHASE_CHECKPOINT[phase];
    const week = weeks.find((w) => w.weekStart === mondayOf(today));
    const sortSessions = (a: PlannedSession, b: PlannedSession) => a.date.localeCompare(b.date) || a.slot - b.slot;

    return {
      status: 'ready' as const,
      today,
      profile,
      weeks,
      planned: [...planned].sort(sortSessions),
      logs,
      checkpoints,
      jokers,
      ranks,
      statuses,
      streak,
      passed,
      programDone,
      rank,
      phase,
      week,
      jokerDays: streak.jokersAvailable > 0 ? jokerCandidates(statuses, today) : [],
      checkpointDue: checkpointOpen(profile, today) && !passed.has(dueMonth) ? dueMonth : null,
    };
  }, [today, profile, weeks, planned, logs, checkpoints, jokers, ranks]);
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
