import { describe, expect, it } from 'vitest';
import { epley, exerciseHistory, records, suggestLoad, summarizeSets } from './strength';
import type { ExercisePrescription, LogEntry, SetEntry } from './types';

const set = (exercise: string, reps: number, kg: number): SetEntry => ({ exercise, reps, kg, unit: 'reps' });
const log = (date: string, sets: SetEntry[], rpe?: number): LogEntry => ({ date, type: 'force', sets, rpe, createdAt: 0 });
const squat: ExercisePrescription = { name: 'Squat (variante conservée)', sets: 3, repsMin: 6, reps: 8, unit: 'reps' };
const bench: ExercisePrescription = { name: 'Développé couché', sets: 3, repsMin: 6, reps: 8, unit: 'reps' };
const sq = (reps: number, kg: number) => set(squat.name, reps, kg);

describe('double progression du programme', () => {
  it('sans historique, demande une charge qui laisse la réserve', () => {
    expect(suggestLoad([], squat)).toMatchObject({ reason: 'start', reps: 6 });
  });

  it("monte d'abord les répétitions dans la plage", () => {
    const h = exerciseHistory([log('2026-10-19', [sq(6, 60), sq(6, 60), sq(6, 60)], 7)], squat.name);
    expect(suggestLoad(h, squat)).toMatchObject({ kg: 60, reps: 7, reason: 'reps' });
  });

  it('attend deux séances au haut de plage avant de monter la charge', () => {
    const once = exerciseHistory([log('2026-10-19', [sq(8, 60), sq(8, 60), sq(8, 60)], 7)], squat.name);
    expect(suggestLoad(once, squat)).toMatchObject({ kg: 60, reason: 'confirm' });
    const twice = exerciseHistory(
      [log('2026-10-19', [sq(8, 60), sq(8, 60), sq(8, 60)], 7), log('2026-10-26', [sq(8, 60), sq(8, 60), sq(8, 60)], 7)],
      squat.name,
    );
    expect(suggestLoad(twice, squat)).toMatchObject({ kg: 62.5, reps: 6, reason: 'progress' });
  });

  it('ajoute un palier plus petit en haut du corps', () => {
    const b = (r: number) => set(bench.name, r, 40);
    const h = exerciseHistory([log('2026-10-19', [b(8), b(8), b(8)], 7), log('2026-10-26', [b(8), b(8), b(8)], 7)], bench.name);
    expect(suggestLoad(h, bench).kg).toBe(41);
  });

  it('garde la charge si la séance était trop dure (RPE > 8)', () => {
    const h = exerciseHistory([log('2026-10-19', [sq(7, 60), sq(6, 60), sq(6, 60)], 9)], squat.name);
    expect(suggestLoad(h, squat)).toMatchObject({ kg: 60, reason: 'hold' });
  });

  it('calcule records, 1RM estimé et tonnage', () => {
    const h = exerciseHistory([log('2026-10-19', [sq(8, 40), sq(8, 40)]), log('2026-10-26', [sq(5, 50), sq(5, 50)])], squat.name);
    expect(h[1]).toMatchObject({ topKg: 50, topReps: 5, volumeKg: 500 });
    expect(records(h)).toMatchObject({ bestKg: { kg: 50, reps: 5 }, bestReps: { reps: 8 } });
    expect(epley(50, 5)).toBeCloseTo(58.33, 1);
  });

  it('résume les séries', () => {
    expect(summarizeSets([sq(8, 40), sq(8, 40), sq(6, 40)])).toBe('2×8 à 40 kg, 1×6 à 40 kg');
  });
});
