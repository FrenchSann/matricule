// Grades débloqués par l'assiduité (semaines tenues) et les bilans réalisés.

export type InsigniaKind =
  | { kind: 'none' }
  | { kind: 'chevrons'; count: number; color: 'red' | 'brass' }
  | { kind: 'bars'; count: number; red?: 'stripe' | 'edge' | 'dashed'; wide?: boolean };

export interface Rank {
  name: string;
  heldWeeks: number;
  /** semaine de bilan qui doit être réalisée */
  bilan?: number;
  programDone?: boolean;
  insignia: InsigniaKind;
}

export const RANKS: Rank[] = [
  { name: 'Soldat de 2e classe', heldWeeks: 0, insignia: { kind: 'none' } },
  { name: 'Soldat de 1re classe', heldWeeks: 2, insignia: { kind: 'chevrons', count: 1, color: 'red' } },
  { name: 'Caporal', heldWeeks: 4, insignia: { kind: 'chevrons', count: 2, color: 'red' } },
  { name: 'Caporal-chef', heldWeeks: 7, bilan: 8, insignia: { kind: 'chevrons', count: 3, color: 'red' } },
  { name: 'Sergent', heldWeeks: 12, bilan: 16, insignia: { kind: 'chevrons', count: 2, color: 'brass' } },
  { name: 'Sergent-chef', heldWeeks: 18, bilan: 24, insignia: { kind: 'chevrons', count: 3, color: 'brass' } },
  { name: 'Adjudant', heldWeeks: 24, bilan: 32, insignia: { kind: 'bars', count: 1, red: 'stripe' } },
  { name: 'Adjudant-chef', heldWeeks: 30, bilan: 40, insignia: { kind: 'bars', count: 1, red: 'stripe', wide: true } },
  { name: 'Major', heldWeeks: 36, bilan: 48, insignia: { kind: 'bars', count: 1, red: 'edge', wide: true } },
  { name: 'Aspirant', heldWeeks: 42, insignia: { kind: 'bars', count: 1, red: 'dashed' } },
  { name: 'Sous-lieutenant', heldWeeks: 46, bilan: 56, insignia: { kind: 'bars', count: 1 } },
  { name: 'Lieutenant', heldWeeks: 50, bilan: 58, programDone: true, insignia: { kind: 'bars', count: 2 } },
];

export interface RankProgress {
  heldWeeks: number;
  /** semaines de bilan réalisées */
  bilans: ReadonlySet<number>;
  programDone: boolean;
}

export function meets(rank: Rank, p: RankProgress): boolean {
  return (
    p.heldWeeks >= rank.heldWeeks &&
    (!rank.bilan || p.bilans.has(rank.bilan)) &&
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
  if (rank.bilan) parts.push(`bilan S${String(rank.bilan).padStart(2, '0')} réalisé`);
  if (rank.programDone) parts.push('programme terminé');
  return parts.join(', ');
}
