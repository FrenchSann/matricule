import { describe, expect, it } from 'vitest';
import { epley, exerciseHistory, records, suggestLoad, summarizeSets } from './strength';
import type { LogEntry, SetEntry } from './types';

const sq = (reps: number, kg: number): SetEntry => ({ exercise: 'Squat', reps, kg, unit: 'reps' });
const log = (date: string, sets: SetEntry[], rpe?: number): LogEntry => ({ date, type: 'force', sets, rpe, createdAt: 0 });
const plan = { name: 'Squat', sets: 3, reps: 8, unit: 'reps' as const, kg: 30 };

describe('musculation', () => {
  it('propose la charge de départ sans historique', () => {
    expect(suggestLoad([], plan)).toMatchObject({ kg: 30, reason: 'start' });
  });

  it('monte de 2,5 kg quand toutes les séries sont réussies avec un RPE confortable', () => {
    const h = exerciseHistory([log('2026-10-12', [sq(8, 40), sq(8, 40), sq(8, 40)], 7)], 'Squat');
    expect(suggestLoad(h, plan)).toMatchObject({ kg: 42.5, reason: 'progress' });
  });

  it('garde la charge si une série est manquée ou si le RPE dépasse 8', () => {
    const missed = exerciseHistory([log('2026-10-12', [sq(8, 40), sq(8, 40), sq(6, 40)], 7)], 'Squat');
    expect(suggestLoad(missed, plan)).toMatchObject({ kg: 40, reason: 'hold' });
    const hard = exerciseHistory([log('2026-10-12', [sq(8, 40), sq(8, 40), sq(8, 40)], 9)], 'Squat');
    expect(suggestLoad(hard, plan)).toMatchObject({ kg: 40, reason: 'hold' });
  });

  it('calcule records, 1RM estimé et tonnage', () => {
    const h = exerciseHistory(
      [log('2026-10-12', [sq(8, 40), sq(8, 40)]), log('2026-10-19', [sq(5, 50), sq(5, 50)])],
      'Squat',
    );
    expect(h[1]).toMatchObject({ topKg: 50, topReps: 5, volumeKg: 500 });
    expect(records(h)).toMatchObject({ bestKg: { kg: 50, reps: 5 }, bestReps: { reps: 8 } });
    expect(epley(50, 5)).toBeCloseTo(58.33, 1);
  });

  it('résume les séries', () => {
    expect(summarizeSets([sq(8, 40), sq(8, 40), sq(6, 40)])).toBe('2×8 à 40 kg, 1×6 à 40 kg');
  });
});
