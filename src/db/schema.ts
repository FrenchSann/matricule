import Dexie, { type EntityTable } from 'dexie';
import type { BilanRecord, JokerUse, LogEntry, PlannedSession, Profile, RankRecord, WeekPlan } from '../domain/types';

export class MatriculeDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  weeks!: EntityTable<WeekPlan, 'weekStart'>;
  planned!: EntityTable<PlannedSession, 'id'>;
  logs!: EntityTable<LogEntry, 'id'>;
  bilans!: EntityTable<BilanRecord, 'id'>;
  jokers!: EntityTable<JokerUse, 'date'>;
  ranks!: EntityTable<RankRecord, 'rank'>;

  constructor(name = 'matricule') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      weeks: 'weekStart',
      planned: '++id, date, weekStart',
      logs: '++id, date, type',
      checkpoints: '++id, month, date',
      jokers: 'date',
      ranks: 'rank',
    });
    // v2 : programme hybride 58 semaines. L'ancien plan (4 phases) est remplacé ; le journal est conservé.
    this.version(2)
      .stores({ checkpoints: null, bilans: 'id, programWeek' })
      .upgrade(async (tx) => {
        await Promise.all(['profile', 'weeks', 'planned', 'jokers', 'ranks'].map((t) => tx.table(t).clear()));
      });
  }
}

export const db = new MatriculeDB();
if (import.meta.env.DEV) (window as unknown as { db: MatriculeDB }).db = db;

export const TABLES = ['profile', 'weeks', 'planned', 'logs', 'bilans', 'jokers', 'ranks'] as const;
export type TableName = (typeof TABLES)[number];

/** Demande à Safari de ne pas purger les données (effet limité sur iOS, d'où l'export). */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
