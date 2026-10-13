import type { ISODate } from './dates';

export type SessionType = 'course' | 'grappling' | 'force' | 'natation' | 'marche' | 'mobilite' | 'repos';

export const SESSION_LABEL: Record<SessionType, string> = {
  course: 'Course',
  grappling: 'Grappling',
  force: 'Force',
  natation: 'Natation',
  marche: 'Marche',
  mobilite: 'Mobilité',
  repos: 'Repos',
};

export interface Pain {
  zone: string;
}

/** Unité d'une série : répétitions, secondes (chaise de Killy) ou mètres (porté fermier). */
export type SetUnit = 'reps' | 's' | 'm';

export interface SetEntry {
  exercise: string;
  reps: number;
  kg?: number;
  unit?: SetUnit;
}

/** Exercice prescrit : séries × plage de répétitions (reps = haut de plage). */
export interface ExercisePrescription {
  name: string;
  sets: number;
  reps: number;
  repsMin?: number;
  unit?: SetUnit;
  /** « par jambe », « par côté » */
  perSide?: string;
  rest?: string;
  note?: string;
  /** série de référence d'une semaine de bilan */
  bilan?: boolean;
  /** charge de départ, si l'historique est vide */
  kg?: number;
}

/** Séance consignée dans le journal. Les champs présents dépendent du type. */
export interface LogEntry {
  id?: number;
  date: ISODate;
  type: SessionType;
  durationMin?: number;
  distanceKm?: number;
  loadKg?: number;
  sets?: SetEntry[];
  rpe?: number;
  pain?: Pain | null;
  note?: string;
  plannedId?: number;
  createdAt: number;
}

export interface PlannedTargets {
  durationMin?: number;
  distanceKm?: number;
  loadKg?: number;
}

export type PlannedStatus = 'planned' | 'done' | 'skipped';

/** Créneaux de la semaine type du programme. */
export type SlotId = 'A' | 'B' | 'C' | 'thursday' | 'friday' | 'swim' | 'sunday' | 'mobWed' | 'mobSun' | 'grappling' | 'grappling4' | 'rest' | 'custom';

/** Variante proposée par la fiche (ex. marche à la place de la course du dimanche). */
export interface SessionAlternative {
  type: SessionType;
  title: string;
  details: string;
  targets: PlannedTargets;
}

export interface PlannedSession {
  id?: number;
  weekStart: ISODate;
  date: ISODate;
  /** ordre d'affichage dans la journée */
  slot: number;
  slotId?: SlotId;
  /** horaire indicatif (« 16 h ») */
  time?: string;
  type: SessionType;
  title: string;
  details: string;
  targets: PlannedTargets;
  exercises?: ExercisePrescription[];
  alternative?: SessionAlternative;
  status: PlannedStatus;
  logId?: number;
}

/** Décision du dimanche, telle que décrite dans le programme. */
export type Decision = 'advance' | 'repeat' | 'lighten';

export interface Checkin {
  sleepH?: number;
  fatigue?: number; // sur 10
  decision: Decision;
  note?: string;
  at: number;
}

export type WeekKind = 'adaptation' | 'normal' | 'deload' | 'bilan' | 'taper' | 'forced-deload' | 'repeat';

export interface WeekPlan {
  weekStart: ISODate;
  /** fiche utilisée (0 = semaines d'adaptation, 1 à 58) */
  programWeek: number;
  /** fiche prévue la semaine suivante si on avance */
  nextProgramWeek: number;
  kind: WeekKind;
  reason: string;
  /** volume estimé par la fiche (minutes, EPS exclue) */
  totalMin: number;
  /** semaines d'adaptation restantes, celle-ci comprise */
  entryLeft?: number;
  fourthGrappling?: boolean;
  checkin?: Checkin;
}

/** Charge × répétitions notée en bilan (effort sous-maximal comparable). */
export interface LoadReps {
  kg?: number;
  reps?: number;
}

export interface BilanRecord {
  /** « S00 » à « S58 » (une clé texte : Dexie ne suit pas les clés numériques à 0) */
  id?: string;
  /** semaine de bilan (0 = repères de départ) */
  programWeek: number;
  date: ISODate;
  pullups?: number;
  runTest?: '6min' | 'luc-leger';
  /** mètres en 6 min, ou palier Luc Léger */
  runValue?: number;
  swim400Sec?: number;
  bench?: LoadReps;
  squat?: LoadReps;
  ohp?: LoadReps;
  trapbar?: LoadReps;
  sleepH?: number;
  note?: string;
}

export interface Profile {
  id: 'me';
  /** lundi de la première semaine (adaptation comprise) */
  startDate: ISODate;
  grapplingDays: number[]; // 0 = lundi
  /** semaines d'adaptation (« version d'entrée ») avant S01 */
  entryWeeks: number;
  /** jour choisi pour un créneau, s'il diffère de la fiche */
  slotDays: Partial<Record<SlotId, number>>;
  disabledSlots: SlotId[];
  /** variante choisie pour un exercice (ex. squat → goblet squat) */
  exerciseSubs: Record<string, string>;
  lastExportAt?: number;
  createdAt: number;
}

export interface JokerUse {
  date: ISODate;
  usedAt: number;
}

export interface RankRecord {
  rank: number;
  unlockedAt: number;
}
