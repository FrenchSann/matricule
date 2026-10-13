// Grades débloqués par l'assiduité (semaines tenues) et les tests de contrôle réussis.
import type { CheckpointMonth } from './types';

export type InsigniaKind =
  | { kind: 'none' }
  | { kind: 'chevrons'; count: number; color: 'red' | 'brass' }
  | { kind: 'bars'; count: number; red?: 'stripe' | 'edge' | 'dashed'; wide?: boolean };

export interface Rank {
  name: string;
  heldWeeks: number;
  checkpoint?: CheckpointMonth;
  programDone?: boolean;
  insignia: InsigniaKind;
}

export const RANKS: Rank[] = [
  { name: 'Soldat de 2e classe', heldWeeks: 0, insignia: { kind: 'none' } },
  { name: 'Soldat de 1re classe', heldWeeks: 2, insignia: { kind: 'chevrons', count: 1, color: 'red' } },
  { name: 'Caporal', heldWeeks: 4, insignia: { kind: 'chevrons', count: 2, color: 'red' } },
  { name: 'Caporal-chef', heldWeeks: 8, insignia: { kind: 'chevrons', count: 3, color: 'red' } },
  { name: 'Sergent', heldWeeks: 12, checkpoint: 4, insignia: { kind: 'chevrons', count: 2, color: 'brass' } },
  { name: 'Sergent-chef', heldWeeks: 20, insignia: { kind: 'chevrons', count: 3, color: 'brass' } },
  { name: 'Adjudant', heldWeeks: 28, checkpoint: 8, insignia: { kind: 'bars', count: 1, red: 'stripe' } },
  { name: 'Adjudant-chef', heldWeeks: 36, insignia: { kind: 'bars', count: 1, red: 'stripe', wide: true } },
  { name: 'Major', heldWeeks: 44, checkpoint: 12, insignia: { kind: 'bars', count: 1, red: 'edge', wide: true } },
  { name: 'Aspirant', heldWeeks: 50, insignia: { kind: 'bars', count: 1, red: 'dashed' } },
  { name: 'Sous-lieutenant', heldWeeks: 54, checkpoint: 14, insignia: { kind: 'bars', count: 1 } },
  { name: 'Lieutenant', heldWeeks: 58, programDone: true, insignia: { kind: 'bars', count: 2 } },
];

export interface RankProgress {
  heldWeeks: number;
  passed: ReadonlySet<CheckpointMonth>;
  programDone: boolean;
}

export function meets(rank: Rank, p: RankProgress): boolean {
  return (
    p.heldWeeks >= rank.heldWeeks &&
    (!rank.checkpoint || p.passed.has(rank.checkpoint)) &&
    (!rank.programDone || p.programDone)
  );
}

/** Index du grade atteint : les grades s'obtiennent dans l'ordre. */
export function currentRank(p: RankProgress): number {
  let i = 0;
  while (i + 1 < RANKS.length && meets(RANKS[i + 1], p)) i++;
  return i;
}

export function requirementText(rank: Rank): string {
  const parts = [`${rank.heldWeeks} semaines tenues`];
  if (rank.checkpoint) parts.push(`test du mois ${rank.checkpoint} réussi`);
  if (rank.programDone) parts.push('programme terminé');
  return parts.join(', ');
}
