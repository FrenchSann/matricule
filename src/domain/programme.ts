// Programme hybride 58 semaines : fiches hebdomadaires importées du PDF et construction des séances.
import data from '../data/programme.json';
import { addWeeks, mondayOf, weekDays, type ISODate } from './dates';
import type { ExercisePrescription, PlannedSession, Profile, SlotId, WeekKind, WeekPlan } from './types';

export interface GymSheet {
  slot: 'A' | 'B' | 'C';
  day: number;
  time: string;
  title: string;
  durationMin: number;
  exercises: ExercisePrescription[];
}

export interface Sheet {
  n: number;
  from: string;
  block: string;
  kind: string; // Construction | Allégée | Bilan | Affûtage
  rir: string;
  gym: GymSheet[];
  gymNote: string;
  totalMin: number;
  run: {
    thursday: { time: string; durationMin: number; text: string };
    friday: { time: string; durationMin: number; text: string };
    sunday: {
      time: string;
      durationMin: number;
      text: string;
      option: { durationMin: number; load: string; text: string; adjustedTotalMin: number | null } | null;
    };
  };
  swim: { time: string; distanceM: number; durationMin: number; blocks: { label: string; content: string }[] };
  consigne: string;
  fourthGrappling: { totalMin: number | null } | null;
}

export const SHEETS = data.weeks as Sheet[];
export const PROGRAM_WEEKS = SHEETS.length; // 58
export const BILAN_WEEKS = [8, 16, 24, 32, 40, 48, 56, 58];

export const BLOCKS: { name: string; from: number; to: number; goal: string }[] = [
  { name: 'Fondations', from: 1, to: 8, goal: 'Régularité, technique, premières mesures.' },
  { name: 'Construction', from: 9, to: 16, goal: 'Augmenter les répétitions utiles et l’endurance.' },
  { name: 'Force I', from: 17, to: 24, goal: 'Plus lourd, peu de répétitions, réserve conservée.' },
  { name: 'Capacité générale', from: 25, to: 32, goal: 'Consolider la masse musculaire et les efforts prolongés.' },
  { name: 'Force II', from: 33, to: 40, goal: 'Deuxième cycle de force, meilleure maîtrise.' },
  { name: 'Préparation orientée tests', from: 41, to: 48, goal: 'Tractions, navettes et régularité ; volume contrôlé.' },
  { name: 'Consolidation', from: 49, to: 56, goal: 'Maintenir les qualités et identifier les limites.' },
  { name: 'Affûtage', from: 57, to: 57, goal: 'Baisse du volume, gestes familiers, aucune nouveauté.' },
  { name: 'Bilan final', from: 58, to: 58, goal: 'Mesurer les progrès et décider du prochain cycle.' },
];

export const ADAPTATION = {
  name: 'Adaptation',
  goal: 'Version d’entrée : 2 séries par exercice à RIR 4, cardio court et facile.',
};

export function sheet(n: number): Sheet {
  return SHEETS[Math.min(Math.max(n, 1), PROGRAM_WEEKS) - 1];
}

export function blockOf(n: number) {
  if (n <= 0) return { ...ADAPTATION, from: 0, to: 0 };
  return BLOCKS.find((b) => n >= b.from && n <= b.to)!;
}

export function sheetKind(n: number): WeekKind {
  const k = sheet(n).kind;
  return k === 'Allégée' ? 'deload' : k === 'Bilan' ? 'bilan' : k === 'Affûtage' ? 'taper' : 'normal';
}

/** Semaine allégée du bloc qui contient n (S04, S12…), S57 en fin de cycle. */
export function deloadOf(n: number): number {
  if (n >= 57) return 57;
  return Math.floor((Math.max(n, 1) - 1) / 8) * 8 + 4;
}

/** Semaines ordinaires d'un bloc, avant son bilan (S05 à S07 pour le bilan S08). */
export function lastOrdinaryWeeks(bilanWeek: number): number[] {
  return [bilanWeek - 3, bilanWeek - 2, bilanWeek - 1];
}

export const DEFAULT_GRAPPLING_DAYS = [0, 2, 5];
export const GRAPPLING_TIME: Record<number, string> = { 0: '19 h', 2: '20 h 30', 3: '20 h 20', 5: '15 h' };

export function createProfile(startDate: ISODate, grapplingDays = DEFAULT_GRAPPLING_DAYS, entryWeeks = 0): Profile {
  return {
    id: 'me',
    startDate: mondayOf(startDate),
    grapplingDays,
    entryWeeks,
    slotDays: {},
    disabledSlots: [],
    exerciseSubs: {},
    createdAt: Date.now(),
  };
}

/** Lundi prévu de la fiche S01 si tout se déroule sans répétition. */
export function plannedS01(profile: Profile): ISODate {
  return addWeeks(profile.startDate, profile.entryWeeks);
}

export const SLOT_LABEL: Record<SlotId, string> = {
  A: 'Salle A, haut du corps',
  B: 'Salle B, jambes',
  C: 'Salle C, corps entier',
  thursday: 'Course du jeudi',
  friday: 'Footing du vendredi',
  swim: 'Natation',
  sunday: 'Endurance du dimanche',
  mobWed: 'Mobilité du mercredi',
  mobSun: 'Mobilité du dimanche',
  grappling: 'Grappling',
  grappling4: 'Quatrième grappling',
  rest: 'Repos',
  custom: 'Séance ajoutée',
};

/** Jour par défaut de chaque créneau, d'après l'organisation du programme. */
export const SLOT_DAY: Partial<Record<SlotId, number>> = { A: 0, B: 2, C: 4, thursday: 3, friday: 4, swim: 5, sunday: 6, mobWed: 2, mobSun: 6 };
export const MOVABLE_SLOTS: SlotId[] = ['A', 'B', 'C', 'thursday', 'friday', 'swim', 'sunday', 'mobWed', 'mobSun'];

const EPS_NOTE = "EPS à l'école ce jour-là : si elle a été intense, ou jambes lourdes, remplace par 20-30 min faciles, ou repos. Ne reporte pas les fractions.";
const MOBILITY = '2 min chevilles, 2 min hanches, 2 min rotations thoraciques, 2 min glissements des bras au mur, 2 min respiration calme.';

function swimDetails(s: Sheet['swim']): string {
  return s.blocks.map((b) => `${b.label} : ${b.content}`).join('\n') + '\nBassin surveillé, respiration libre, moins de 60 min.';
}

function substitute(profile: Profile, exercises: ExercisePrescription[]): ExercisePrescription[] {
  return exercises.map((e) => ({ ...e, name: profile.exerciseSubs[e.name]?.trim() || e.name }));
}

type Draft = Omit<PlannedSession, 'weekStart' | 'status' | 'date'> & { day: number };

/** Séances d'une fiche, avant placement dans le calendrier. */
export function sheetSessions(profile: Profile, week: Pick<WeekPlan, 'programWeek' | 'kind' | 'fourthGrappling'>): Draft[] {
  const adaptation = week.programWeek === 0;
  const sh = sheet(week.programWeek || 1);
  const drafts: Draft[] = [];

  for (const g of sh.gym) {
    let exercises = substitute(profile, g.exercises);
    if (adaptation) exercises = exercises.map((e) => ({ ...e, sets: Math.min(e.sets, 2) }));
    const rir = adaptation ? '4' : sh.rir;
    drafts.push({
      day: g.day,
      slot: 0,
      slotId: g.slot,
      time: g.time,
      type: 'force',
      title: g.title,
      details: `RIR ${rir} sur les séries ordinaires. Échauffement 8-12 min inclus. ${adaptation ? 'Adaptation : 2 séries par exercice.' : sh.gymNote}`,
      targets: { durationMin: adaptation ? Math.min(g.durationMin, 50) : g.durationMin },
      exercises,
    });
  }

  const thu = sh.run.thursday;
  const isTest = /Luc Léger|6 min mesurées/.test(thu.text);
  drafts.push({
    day: 3,
    slot: 0,
    slotId: 'thursday',
    time: thu.time,
    type: 'course',
    title: adaptation ? 'Course facile' : isTest ? 'Course : test du bilan' : /RPE [6-8]|navettes|côtes/.test(thu.text) ? 'Course qualité' : 'Course facile',
    details: adaptation ? '20 min faciles à RPE 2-3, les 5 premières très lentes.' : `${thu.text}\n${EPS_NOTE}`,
    targets: { durationMin: adaptation ? 20 : thu.durationMin },
  });

  if (!adaptation) {
    const fri = sh.run.friday;
    drafts.push({
      day: 4,
      slot: 1,
      slotId: 'friday',
      time: fri.time,
      type: 'course',
      title: 'Footing court',
      details: fri.text,
      targets: { durationMin: fri.durationMin },
    });
  }

  const swim = sh.swim;
  drafts.push({
    day: 5,
    slot: 0,
    slotId: 'swim',
    time: swim.time,
    type: 'natation',
    title: adaptation ? 'Natation souple' : `Natation ${swim.distanceM} m`,
    details: adaptation ? '800 à 1 000 m souples, crawl relâché, repos à volonté.' : swimDetails(swim),
    targets: { durationMin: adaptation ? 30 : swim.durationMin, distanceKm: (adaptation ? 900 : swim.distanceM) / 1000 },
  });

  const sun = sh.run.sunday;
  const opt = sun.option;
  drafts.push({
    day: 6,
    slot: 0,
    slotId: 'sunday',
    time: sun.time,
    type: 'course',
    title: 'Endurance facile',
    details: adaptation ? '30 min faciles à RPE 2-3.' : sun.text,
    targets: { durationMin: adaptation ? 30 : sun.durationMin },
    alternative:
      opt && !adaptation
        ? {
            type: 'marche',
            title: `Marche ${opt.durationMin} min`,
            details: `${opt.text} Terrain facile, conversation possible. Ne monte durée ou charge qu'après deux marches bien tolérées.`,
            targets: { durationMin: opt.durationMin, loadKg: Number(opt.load.match(/(\d+)\s*kg/)?.[1] ?? 0) || undefined },
          }
        : undefined,
  });

  drafts.push(
    { day: 2, slot: 1, slotId: 'mobWed', type: 'mobilite', title: 'Mobilité', details: MOBILITY, targets: { durationMin: 10 } },
    { day: 6, slot: 1, slotId: 'mobSun', type: 'mobilite', title: 'Mobilité', details: MOBILITY, targets: { durationMin: 10 } },
  );

  for (const day of profile.grapplingDays) {
    drafts.push({
      day,
      slot: 2,
      slotId: 'grappling',
      time: GRAPPLING_TIME[day],
      type: 'grappling',
      title: 'Grappling',
      details:
        week.kind === 'bilan'
          ? 'Semaine de bilan : privilégie un cours technique, en accord avec le coach.'
          : 'Contenu et intensité décidés avec ton entraîneur.',
      targets: { durationMin: 90 },
    });
  }

  // Quatrième grappling : remplace la course du jeudi ET la piscine du samedi.
  let out = drafts;
  if (week.fourthGrappling) {
    out = out.filter((d) => d.slotId !== 'thursday' && d.slotId !== 'swim');
    out.push({
      day: 3,
      slot: 2,
      slotId: 'grappling4',
      time: GRAPPLING_TIME[3],
      type: 'grappling',
      title: 'Grappling (4e séance)',
      details: 'Remplace la course du jeudi et la piscine du samedi. Les deux footings faciles restent en place.',
      targets: { durationMin: 100 },
    });
  }

  // Personnalisation : créneaux déplacés ou retirés.
  return out
    .filter((d) => !d.slotId || !profile.disabledSlots.includes(d.slotId))
    .map((d) => ({ ...d, day: (d.slotId && profile.slotDays[d.slotId]) ?? d.day }));
}

/** Séances datées de la semaine, avec un repos sur les jours sans séance (le mardi d'ordinaire). */
export function buildWeekSessions(profile: Profile, week: WeekPlan): PlannedSession[] {
  const days = weekDays(week.weekStart);
  const sessions: PlannedSession[] = sheetSessions(profile, week).map(({ day, ...d }) => ({
    ...d,
    weekStart: week.weekStart,
    date: days[day],
    status: 'planned',
  }));
  for (const date of days) {
    if (sessions.some((s) => s.date === date)) continue;
    sessions.push({
      weekStart: week.weekStart,
      date,
      slot: 0,
      slotId: 'rest',
      type: 'repos',
      title: 'Repos sportif',
      details: 'Marche habituelle seulement. Aucune séance à rattraper.',
      targets: {},
      status: 'planned',
    });
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date) || a.slot - b.slot);
}

/** Tous les noms d'exercices du programme (pour choisir ses variantes). */
export function programExercises(): string[] {
  const names = new Set<string>();
  for (const s of SHEETS) for (const g of s.gym) for (const e of g.exercises) names.add(e.name);
  return [...names];
}

/** Quatrième grappling : semaine ordinaire, pas la semaine précédente, course du jeudi et piscine pas encore faites. */
export function fourthGrapplingBlocker(week: WeekPlan, prev: WeekPlan | undefined, sessions: PlannedSession[]): string | null {
  if (week.programWeek === 0 || !sheet(week.programWeek).fourthGrappling || !['normal', 'repeat'].includes(week.kind)) {
    return 'Pas de quatrième grappling en semaine allégée, de bilan ou d’adaptation.';
  }
  if (prev?.fourthGrappling) return 'Déjà pris la semaine dernière : une semaine sur deux au maximum.';
  if (sessions.some((p) => p.weekStart === week.weekStart && (p.slotId === 'thursday' || p.slotId === 'swim') && p.status === 'done')) {
    return 'La course du jeudi ou la piscine est déjà faite cette semaine.';
  }
  return null;
}
