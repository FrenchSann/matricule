import type { ISODate } from './dates';

export type SessionType = 'course' | 'grappling' | 'force' | 'natation' | 'marche' | 'mobilite' | 'repos';

export const SESSION_LABEL: Record<SessionType, string> = {
  course: 'Course',
  grappling: 'Grappling',
  force: 'Force',
  natation: 'Natation',
  marche: 'Marche chargée',
  mobilite: 'Mobilité',
  repos: 'Repos',
};

export type Phase = 1 | 2 | 3 | 4;

export type WeekKind = 'normal' | 'deload' | 'forced-deload' | 'taper';

export interface Pain {
  zone: string;
}

/** Unité d'une série : répétitions, secondes (gainage) ou mètres (farmer walk). */
export type SetUnit = 'reps' | 's' | 'm';

export interface SetEntry {
  exercise: string;
  reps: number;
  kg?: number;
  unit?: SetUnit;
}

/** Exercice prescrit dans une séance de force. */
export interface ExercisePrescription {
  name: string;
  sets: number;
  reps: number;
  unit?: SetUnit;
  /** charge de départ, si l'historique est vide */
  kg?: number;
}

/** Ajustement automatique du contenu d'une séance selon la semaine. */
export type AutoDetails = 'runWalk' | 'intervals' | 'ruck';

/** Élément de la semaine type d'une phase (modifiable). */
export interface TemplateItem {
  id: string;
  day: number; // 0 = lundi
  type: SessionType;
  title: string;
  /** part du volume progressif ; 0 = durée fixe */
  share: number;
  fixedMin?: number;
  maxMin?: number;
  details: string;
  auto?: AutoDetails;
  exercises?: ExercisePrescription[];
  simulation?: boolean;
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

export interface PlannedSession {
  id?: number;
  weekStart: ISODate;
  date: ISODate;
  /** ordre d'affichage dans la journée */
  slot: number;
  type: SessionType;
  title: string;
  details: string;
  targets: PlannedTargets;
  /** séance dont la durée suit la progression (≠ grappling, mobilité) */
  scalable: boolean;
  exercises?: ExercisePrescription[];
  /** séance spécifique simulation d'épreuves */
  simulation?: boolean;
  status: PlannedStatus;
  logId?: number;
}

export interface WeekPlan {
  weekStart: ISODate;
  phase: Phase;
  weekInPhase: number; // 1-based
  kind: WeekKind;
  /** volume cible (minutes) des séances progressives */
  volumeTargetMin: number;
  /** volume de référence avant réduction (pour reprendre après un allègement) */
  baseVolumeMin: number;
  reason: string;
}

export type TestKey = 'course' | 'tractions' | 'marche' | 'natation' | 'corde';

export interface TestTargets {
  /** course : temps max (s) sur courseKm */
  courseKm: number;
  courseSec: number;
  tractions: number;
  marcheKm: number;
  marcheKg: number;
  marcheSec: number;
  natationM: number;
  natationSec: number;
  /** corde 7 m : sans les jambes ? */
  cordeSansJambes: boolean;
}

export interface TestResults {
  courseSec?: number;
  tractions?: number;
  marcheSec?: number;
  natationSec?: number;
  corde?: boolean;
}

export type CheckpointMonth = 4 | 8 | 12 | 14;

export interface CheckpointRecord {
  id?: number;
  month: CheckpointMonth;
  date: ISODate;
  results: TestResults;
  passed: Record<TestKey, boolean>;
  allPassed: boolean;
  /** semaines de prolongation choisies après un échec */
  extensionWeeks?: number;
}

export interface Profile {
  id: 'me';
  startDate: ISODate; // lundi de la semaine 1
  grapplingDays: number[]; // 0 = lundi
  grapplingMin: number;
  /** début effectif de chaque phase (la phase 1 = startDate) */
  phaseStarts: Partial<Record<Phase, ISODate>>;
  /** semaines ajoutées à chaque phase après un test manqué */
  extensions: Partial<Record<Phase, number>>;
  targets: Record<CheckpointMonth, TestTargets>;
  /** semaines types personnalisées (sinon modèle par défaut) */
  templates?: Partial<Record<Phase, TemplateItem[]>>;
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
