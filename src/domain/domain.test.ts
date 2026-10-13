import { describe, expect, it } from 'vitest';
import { addDays, addWeeks, formatDuration, mondayOf, parseDuration } from './dates';
import { planNextWeek, reviewWeek, suggestDecision, type WeekReview } from './cursor';
import { buildWeekSessions, createProfile, deloadOf, PROGRAM_WEEKS, sheet, SHEETS } from './programme';
import { currentRank } from './ranks';
import { dayStatuses, jokerCandidates, summarize } from './streak';
import { trend } from './bilans';
import type { Checkin, LogEntry, PlannedSession, Profile, WeekPlan } from './types';

const START = '2026-10-19'; // lundi, S01 du PDF
const profile = createProfile(START);

const ok: WeekReview = { avgRpe: 6, painCount: 0, completion: 1, done: 10, planned: 10 };

/** Simule des semaines successives ; `review` et `checkin` décrivent chaque semaine terminée. */
function simulate(
  weeks: number,
  review: (w: WeekPlan, i: number) => WeekReview = () => ok,
  p: Profile = profile,
  checkin?: (w: WeekPlan, i: number) => Checkin | undefined,
): WeekPlan[] {
  const history: WeekPlan[] = [];
  const reviews = new Map<WeekPlan, WeekReview>();
  for (let i = 0; i < weeks; i++) {
    const w = planNextWeek({ profile: p, weekStart: addWeeks(START, i), history, reviewOf: (x) => reviews.get(x)! });
    if (!w) break;
    w.checkin = checkin?.(w, i);
    reviews.set(w, review(w, i));
    history.push(w);
  }
  return history;
}

describe('fiches du programme', () => {
  it('contient 58 semaines fidèles au PDF', () => {
    expect(PROGRAM_WEEKS).toBe(58);
    expect(sheet(1).totalMin).toBe(601); // 10 h 01
    expect(sheet(4).kind).toBe('Allégée');
    expect(sheet(8).kind).toBe('Bilan');
    expect(sheet(57).kind).toBe('Affûtage');
    expect(SHEETS.every((s) => s.gym.length === 3)).toBe(true);
  });

  it('organise la semaine : 3 salles, 3 grapplings, mardi repos', () => {
    const [w] = simulate(1);
    const s = buildWeekSessions(profile, w);
    expect(s.filter((x) => x.type === 'force')).toHaveLength(3);
    expect(s.filter((x) => x.type === 'grappling').map((x) => x.date)).toEqual([START, addDays(START, 2), addDays(START, 5)]);
    expect(s.filter((x) => x.date === addDays(START, 1)).map((x) => x.type)).toEqual(['repos']);
    const a = s.find((x) => x.slotId === 'A')!;
    expect(a.exercises?.[0]).toMatchObject({ name: 'Développé couché', sets: 3, repsMin: 6, reps: 8 });
  });

  it('applique variantes, créneaux déplacés et quatrième grappling', () => {
    const p = { ...profile, exerciseSubs: { 'Squat (variante conservée)': 'Squat barre' }, slotDays: { swim: 6 as number } };
    const [w] = simulate(1, undefined, p);
    const s = buildWeekSessions(p, { ...w, fourthGrappling: true });
    expect(s.find((x) => x.slotId === 'B')!.exercises![0].name).toBe('Squat barre');
    expect(s.some((x) => x.slotId === 'swim' || x.slotId === 'thursday')).toBe(false);
    expect(s.find((x) => x.slotId === 'grappling4')).toMatchObject({ targets: { durationMin: 100 } });
  });

  it('propose la marche en option à partir de S25', () => {
    const s = buildWeekSessions(profile, { weekStart: START, programWeek: 25, nextProgramWeek: 26, kind: 'normal', reason: '', totalMin: 0 });
    expect(s.find((x) => x.slotId === 'sunday')!.alternative).toMatchObject({ type: 'marche', title: 'Marche 45 min' });
  });
});

describe('décision du dimanche', () => {
  it('avance semaine après semaine quand tout est bien toléré', () => {
    const weeks = simulate(10);
    expect(weeks.map((w) => w.programWeek)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(weeks.map((w) => w.kind).slice(0, 8)).toEqual(['normal', 'normal', 'normal', 'deload', 'normal', 'normal', 'normal', 'bilan']);
  });

  it('allège après 2 douleurs ou un RPE moyen > 8, puis reprend la fiche prévue', () => {
    const weeks = simulate(4, (_, i) => (i === 1 ? { ...ok, painCount: 2 } : ok));
    expect(weeks.map((w) => [w.programWeek, w.kind])).toEqual([[1, 'normal'], [2, 'normal'], [4, 'forced-deload'], [3, 'normal']]);
    expect(weeks[2].reason).toContain('2 douleurs');
    const rpe = simulate(3, (_, i) => (i === 0 ? { ...ok, avgRpe: 8.4 } : ok));
    expect(rpe[1].kind).toBe('forced-deload');
  });

  it('répète la semaine légère si la fatigue persiste', () => {
    const weeks = simulate(4, (_, i) => (i >= 1 ? { ...ok, painCount: 2 } : ok));
    expect(weeks.map((w) => w.kind)).toEqual(['normal', 'normal', 'forced-deload', 'forced-deload']);
  });

  it('reprend en douceur après une semaine interrompue', () => {
    const weeks = simulate(3, (_, i) => (i === 1 ? { ...ok, done: 0, completion: 0 } : ok));
    expect(weeks[2].kind).toBe('forced-deload');
  });

  it('au bilan, répète la dernière semaine bien tolérée si moins de 2 sur 3', () => {
    const weeks = simulate(10, (w) => (w.programWeek === 6 || w.programWeek === 7 ? { ...ok, painCount: 1 } : ok));
    expect(weeks[8]).toMatchObject({ programWeek: 5, kind: 'repeat', nextProgramWeek: 9 });
    expect(weeks[9].programWeek).toBe(9);
  });

  it('suit la décision notée le dimanche', () => {
    const weeks = simulate(3, undefined, profile, (_, i) => (i === 0 ? { decision: 'repeat', at: 0 } : undefined));
    expect(weeks.map((w) => [w.programWeek, w.kind])).toEqual([[1, 'normal'], [1, 'repeat'], [2, 'normal']]);
  });

  it("enchaîne les semaines d'adaptation puis S01, et s'arrête après S58", () => {
    const p = { ...profile, entryWeeks: 2 };
    expect(simulate(4, undefined, p).map((w) => w.programWeek)).toEqual([0, 0, 1, 2]);
    expect(simulate(70)).toHaveLength(58);
    expect(deloadOf(13)).toBe(12);
  });

  it('calcule le bilan de semaine', () => {
    const logs = [
      { date: START, type: 'course', rpe: 6, createdAt: 0 },
      { date: START, type: 'force', rpe: 9, pain: { zone: 'genou' }, createdAt: 0 },
    ] as LogEntry[];
    const planned = [{ type: 'course', status: 'done' }, { type: 'force', status: 'planned' }] as PlannedSession[];
    expect(reviewWeek(logs, planned)).toMatchObject({ avgRpe: 7.5, painCount: 1, completion: 0.5 });
    const [w] = simulate(1);
    expect(suggestDecision(w, [w], () => ({ ...ok, avgRpe: 9 })).decision).toBe('lighten');
  });
});

describe('streak', () => {
  const s = (date: string, status: PlannedSession['status'], type: PlannedSession['type'] = 'course') =>
    ({ date, status, type, weekStart: mondayOf(date) }) as PlannedSession;

  it('compte un repos respecté comme un jour réussi', () => {
    const st = dayStatuses({ start: START, today: addDays(START, 1), planned: [s(START, 'done')], logs: [], jokers: [] });
    expect(st.get(addDays(START, 1))).toBe('rest');
    expect(summarize(st, [], addDays(START, 1)).current).toBe(2);
  });

  it('ne casse jamais le streak quand une douleur est signalée', () => {
    const pain = { date: START, type: 'repos', pain: { zone: 'genou' }, createdAt: 0 } as LogEntry;
    const st = dayStatuses({ start: START, today: addDays(START, 2), planned: [s(START, 'planned'), s(addDays(START, 1), 'planned')], logs: [pain], jokers: [] });
    expect(st.get(START)).toBe('excused');
    expect(summarize(st, [], addDays(START, 2)).current).toBe(3);
  });

  it('casse le streak sur un jour manqué, sauf joker', () => {
    const st = dayStatuses({ start: START, today: addDays(START, 1), planned: [s(START, 'planned')], logs: [], jokers: [] });
    expect(jokerCandidates(st, addDays(START, 1))).toEqual([START]);
    const j = dayStatuses({ start: START, today: addDays(START, 1), planned: [s(START, 'planned')], logs: [], jokers: [{ date: START, usedAt: 0 }] });
    expect(j.get(START)).toBe('joker');
  });

  it('donne un joker toutes les 2 semaines complètes', () => {
    const today = addWeeks(START, 4);
    const st = dayStatuses({ start: START, today, planned: [], logs: [], jokers: [] });
    expect(summarize(st, [], today)).toMatchObject({ perfectWeeks: 4, jokersAvailable: 2 });
  });
});

describe('grades et bilans', () => {
  it('exige le bilan S16 pour passer sergent', () => {
    expect(currentRank({ heldWeeks: 15, bilans: new Set([8]), programDone: false })).toBe(3);
    expect(currentRank({ heldWeeks: 15, bilans: new Set([8, 16]), programDone: false })).toBe(4);
  });

  it('compare un bilan au précédent, sans mélanger 6 min et Luc Léger', () => {
    const a = { programWeek: 8, date: START, pullups: 6, runTest: '6min' as const, runValue: 1400, swim400Sec: 480 };
    const b = { programWeek: 16, date: START, pullups: 8, runTest: 'luc-leger' as const, runValue: 9, swim400Sec: 470 };
    expect(trend(a, b, 'pullups')).toBe(1);
    expect(trend(a, b, 'swim400Sec')).toBe(1);
    expect(trend(a, b, 'run')).toBeNull();
  });
});

describe('dates', () => {
  it('trouve le lundi et formate les durées', () => {
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(parseDuration('7:45')).toBe(465);
  });
});
