import { describe, expect, it } from 'vitest';
import { addDays, addWeeks, formatDuration, mondayOf, parseDuration } from './dates';
import { advancePhase, evaluate, extendPhase } from './checkpoints';
import { buildWeekSessions, createProfile, phaseAt, taperIndex, DEFAULT_TARGETS } from './program';
import { planNextWeek, reviewWeek, type WeekReview } from './progression';
import { currentRank } from './ranks';
import { dayStatuses, jokerCandidates, summarize } from './streak';
import type { LogEntry, PlannedSession, WeekPlan } from './types';

const START = '2026-10-12'; // lundi
const profile = createProfile(START);

const good: WeekReview = { avgRpe: 6, painCount: 0, completion: 1, done: 10, planned: 10 };

function simulate(weeks: number, review: (i: number) => WeekReview = () => good, p = profile): WeekPlan[] {
  const history: WeekPlan[] = [];
  for (let i = 0; i < weeks; i++) {
    const week = planNextWeek({
      profile: p,
      weekStart: addWeeks(START, i),
      history,
      previous: i === 0 ? null : review(i - 1),
    });
    history.push(week);
  }
  return history;
}

describe('dates', () => {
  it('trouve le lundi et formate les durées', () => {
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(parseDuration('24:30')).toBe(1470);
    expect(parseDuration('abc')).toBeNull();
  });
});

describe('progression', () => {
  it('ne dépasse jamais +10 % de volume de référence par semaine', () => {
    const weeks = simulate(16);
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i].baseVolumeMin).toBeLessThanOrEqual(Math.ceil(weeks[i - 1].baseVolumeMin * 1.1));
    }
  });

  it('allège une semaine sur quatre de 35 %', () => {
    const kinds = simulate(8).map((w) => w.kind);
    expect(kinds).toEqual(['normal', 'normal', 'normal', 'deload', 'normal', 'normal', 'normal', 'deload']);
    const w = simulate(4)[3];
    expect(w.volumeTargetMin / w.baseVolumeMin).toBeCloseTo(0.65, 1);
  });

  it('allège la semaine suivante si le RPE moyen dépasse 8', () => {
    const weeks = simulate(2, () => ({ ...good, avgRpe: 8.4 }));
    expect(weeks[1].kind).toBe('forced-deload');
    expect(weeks[1].reason).toContain('8,4');
  });

  it('allège la semaine suivante après 2 douleurs', () => {
    const weeks = simulate(2, () => ({ ...good, painCount: 2 }));
    expect(weeks[1].kind).toBe('forced-deload');
  });

  it('maintient le volume si le RPE est soutenu ou le plan incomplet', () => {
    expect(simulate(2, () => ({ ...good, avgRpe: 7.5 }))[1].baseVolumeMin).toBe(150);
    expect(simulate(2, () => ({ ...good, completion: 0.5 }))[1].baseVolumeMin).toBe(150);
    expect(simulate(2)[1].baseVolumeMin).toBe(165);
  });

  it('calcule le bilan de semaine', () => {
    const logs = [
      { date: START, type: 'course', rpe: 6, createdAt: 0 },
      { date: START, type: 'force', rpe: 9, pain: { zone: 'genou' }, createdAt: 0 },
    ] as LogEntry[];
    const planned = [{ type: 'course', status: 'done' }, { type: 'force', status: 'planned' }] as PlannedSession[];
    expect(reviewWeek(logs, planned)).toMatchObject({ avgRpe: 7.5, painCount: 1, completion: 0.5 });
  });
});

describe('phases et tests', () => {
  it('reste en phase 1 tant que le test du mois 4 n’est pas réussi', () => {
    expect(phaseAt(profile, addWeeks(START, 20))).toBe(1);
  });

  it('passe en phase 2 à la date prévue quand le test est réussi', () => {
    const p = advancePhase(profile, 4, addWeeks(START, 16));
    expect(p.phaseStarts[2]).toBe(addWeeks(START, 17));
    expect(phaseAt(p, addWeeks(START, 17))).toBe(2);
  });

  it('prolonge la phase après un test manqué', () => {
    const p = extendPhase(profile, 4, 3);
    expect(p.extensions[1]).toBe(3);
    const passed = advancePhase(p, 4, addWeeks(START, 19));
    expect(passed.phaseStarts[2]).toBe(addWeeks(START, 20));
  });

  it('compare les résultats aux cibles', () => {
    const r = evaluate({ courseSec: 26 * 60, tractions: 7, marcheSec: 70 * 60, natationSec: 300, corde: true }, DEFAULT_TARGETS[4]);
    expect(r).toEqual({ course: true, tractions: false, marche: true, natation: true, corde: true });
  });

  it('affûte les 3 dernières semaines de la phase 4 de 40 à 60 %', () => {
    const p = { ...profile, phaseStarts: { 1: START, 2: addWeeks(START, 17), 3: addWeeks(START, 34), 4: addWeeks(START, 51) } };
    expect(taperIndex(p, addWeeks(START, 51 + 9))).toBeNull();
    expect(taperIndex(p, addWeeks(START, 51 + 10))).toBe(1);
    expect(taperIndex(p, addWeeks(START, 51 + 12))).toBe(3);
    const history = simulate(3, () => good, p);
    const w = planNextWeek({ profile: p, weekStart: addWeeks(START, 51 + 12), history, previous: good });
    expect(w.kind).toBe('taper');
    expect(w.volumeTargetMin / w.baseVolumeMin).toBeCloseTo(0.4, 1);
  });

  it('génère une semaine avec grappling et un jour de repos', () => {
    const [week] = simulate(1);
    const sessions = buildWeekSessions(profile, week);
    expect(sessions.filter((s) => s.type === 'grappling')).toHaveLength(3);
    expect(sessions.filter((s) => s.type === 'repos')).toHaveLength(1);
  });
});

describe('streak', () => {
  const s = (date: string, status: PlannedSession['status'], type: PlannedSession['type'] = 'course') =>
    ({ date, status, type, weekStart: mondayOf(date) }) as PlannedSession;

  it('compte un repos respecté comme un jour réussi', () => {
    const st = dayStatuses({ start: START, today: addDays(START, 1), planned: [s(START, 'done')], logs: [], jokers: [] });
    expect(st.get(START)).toBe('done');
    expect(st.get(addDays(START, 1))).toBe('rest');
    expect(summarize(st, [], addDays(START, 1)).current).toBe(2);
  });

  it('ne casse jamais le streak quand une douleur est signalée', () => {
    const pain = { date: START, type: 'repos', pain: { zone: 'genou' }, createdAt: 0 } as LogEntry;
    const planned = [s(START, 'planned'), s(addDays(START, 1), 'planned')];
    const st = dayStatuses({ start: START, today: addDays(START, 2), planned, logs: [pain], jokers: [] });
    expect(st.get(START)).toBe('excused');
    expect(st.get(addDays(START, 1))).toBe('excused');
    expect(summarize(st, [], addDays(START, 2)).current).toBe(3);
  });

  it('casse le streak sur un jour manqué, sauf joker', () => {
    const planned = [s(START, 'planned')];
    const st = dayStatuses({ start: START, today: addDays(START, 1), planned, logs: [], jokers: [] });
    expect(st.get(START)).toBe('missed');
    expect(jokerCandidates(st, addDays(START, 1))).toEqual([START]);
    const withJoker = dayStatuses({ start: START, today: addDays(START, 1), planned, logs: [], jokers: [{ date: START, usedAt: 0 }] });
    expect(withJoker.get(START)).toBe('joker');
  });

  it('donne un joker toutes les 2 semaines complètes', () => {
    const today = addWeeks(START, 4);
    const st = dayStatuses({ start: START, today, planned: [], logs: [], jokers: [] });
    expect(summarize(st, [], today)).toMatchObject({ perfectWeeks: 4, jokersEarned: 2, jokersAvailable: 2 });
  });

  it("ne compte pas un jour de repos où l'on s'est entraîné", () => {
    const log = { date: START, type: 'course', createdAt: 0 } as LogEntry;
    const st = dayStatuses({ start: START, today: addDays(START, 1), planned: [], logs: [log], jokers: [] });
    expect(st.get(START)).toBe('rest-broken');
  });
});

describe('grades', () => {
  it('exige le test du mois 4 pour passer sergent', () => {
    expect(currentRank({ heldWeeks: 15, passed: new Set(), programDone: false })).toBe(3);
    expect(currentRank({ heldWeeks: 15, passed: new Set([4]), programDone: false })).toBe(4);
  });
});
