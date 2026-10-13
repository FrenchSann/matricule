// Programme en 4 phases sur 15 mois : calendrier des phases, semaines types, cibles des tests.
import { addWeeks, mondayOf, weekDays, weeksBetween, type ISODate } from './dates';
import type {
  CheckpointMonth,
  Phase,
  PlannedSession,
  Profile,
  SessionType,
  TestTargets,
  WeekPlan,
} from './types';

export const PHASES: Record<Phase, { name: string; months: string; nominalWeeks: number; cap: number; summary: string }> = {
  1: { name: 'Fondations', months: 'Mois 1–4', nominalWeeks: 17, cap: 240, summary: 'Course/marche progressive, force de base, natation technique.' },
  2: { name: 'Développement', months: 'Mois 5–8', nominalWeeks: 17, cap: 300, summary: 'Course zone 2 et fractionné, marche chargée hebdomadaire, corde.' },
  3: { name: 'Spécifique sélection', months: 'Mois 9–12', nominalWeeks: 17, cap: 360, summary: "Simulations d'épreuves, marches longues chargées." },
  4: { name: 'Pic et affûtage', months: 'Mois 13–15', nominalWeeks: 13, cap: 380, summary: 'Pic de forme puis volume réduit de 40 à 60 % sur les 3 dernières semaines.' },
};

/** Volume de départ (minutes de séances progressives) d'un débutant en course. */
export const START_VOLUME = 150;
export const DELOAD_FACTOR = 0.65;
export const TAPER_CUTS = [0.4, 0.5, 0.6];

export const CHECKPOINT_PHASE: Record<CheckpointMonth, Phase> = { 4: 1, 8: 2, 12: 3, 14: 4 };
export const PHASE_CHECKPOINT: Record<Phase, CheckpointMonth> = { 1: 4, 2: 8, 3: 12, 4: 14 };

/** Cibles indicatives, à ajuster d'après les barèmes officiels (CIRFA). */
export const DEFAULT_TARGETS: Record<CheckpointMonth, TestTargets> = {
  4: { courseKm: 5, courseSec: 27 * 60, tractions: 8, marcheKm: 8, marcheKg: 10, marcheSec: 80 * 60, natationM: 200, natationSec: 6 * 60, cordeSansJambes: false },
  8: { courseKm: 5, courseSec: 24 * 60, tractions: 12, marcheKm: 12, marcheKg: 15, marcheSec: 115 * 60, natationM: 400, natationSec: 11 * 60, cordeSansJambes: false },
  12: { courseKm: 5, courseSec: 22 * 60, tractions: 15, marcheKm: 15, marcheKg: 20, marcheSec: 140 * 60, natationM: 800, natationSec: 19 * 60, cordeSansJambes: true },
  14: { courseKm: 5, courseSec: 21 * 60, tractions: 18, marcheKm: 20, marcheKg: 20, marcheSec: 190 * 60, natationM: 1000, natationSec: 23 * 60, cordeSansJambes: true },
};

export function createProfile(startDate: ISODate, grapplingDays: number[] = [0, 2, 4]): Profile {
  const start = mondayOf(startDate);
  return {
    id: 'me',
    startDate: start,
    grapplingDays,
    grapplingMin: 90,
    phaseStarts: { 1: start },
    extensions: {},
    targets: structuredClone(DEFAULT_TARGETS),
    createdAt: Date.now(),
  };
}

export function phaseLength(profile: Profile, phase: Phase): number {
  return PHASES[phase].nominalWeeks + (profile.extensions[phase] ?? 0);
}

export function phaseAt(profile: Profile, date: ISODate): Phase {
  const monday = mondayOf(date);
  let current: Phase = 1;
  for (const p of [1, 2, 3, 4] as Phase[]) {
    const start = profile.phaseStarts[p];
    if (start && start <= monday) current = p;
  }
  return current;
}

export function weekInPhase(profile: Profile, date: ISODate): number {
  const phase = phaseAt(profile, date);
  return weeksBetween(profile.phaseStarts[phase]!, date) + 1;
}

/** Semaine (dans la phase) à la fin de laquelle le test de contrôle est attendu. */
export function checkpointDueWeek(profile: Profile, phase: Phase): number {
  return phase === 4 ? 9 + (profile.extensions[4] ?? 0) : phaseLength(profile, phase);
}

export function checkpointDueDate(profile: Profile, phase: Phase): ISODate | null {
  const start = profile.phaseStarts[phase];
  if (!start) return null;
  return addWeeks(start, checkpointDueWeek(profile, phase)); // lundi suivant la semaine du test
}

/** Le test devient disponible pendant les deux dernières semaines avant l'échéance. */
export function checkpointOpen(profile: Profile, date: ISODate): boolean {
  const phase = phaseAt(profile, date);
  return weekInPhase(profile, date) >= checkpointDueWeek(profile, phase) - 1;
}

/** Index d'affûtage (1 à 3) si la semaine fait partie des 3 dernières de la phase 4. */
export function taperIndex(profile: Profile, date: ISODate): number | null {
  if (phaseAt(profile, date) !== 4) return null;
  const w = weekInPhase(profile, date);
  const len = phaseLength(profile, 4);
  return w > len - 3 && w <= len ? w - (len - 3) : null;
}

export function programEnd(profile: Profile): ISODate | null {
  const start4 = profile.phaseStarts[4];
  return start4 ? addWeeks(start4, phaseLength(profile, 4)) : null;
}

// ─── Semaines types ────────────────────────────────────────────────────────────

interface TemplateItem {
  day: number;
  type: SessionType;
  title: string;
  /** part du volume progressif ; 0 = durée fixe */
  share: number;
  fixedMin?: number;
  maxMin?: number;
  simulation?: boolean;
  details: (w: number, phase: Phase) => string;
}

const runWalk = (w: number) => {
  const run = Math.min(1 + Math.floor(w / 1.5), 12);
  if (run >= 12) return 'Course continue en aisance respiratoire (tu peux parler).';
  const walk = run >= 6 ? 1 : 2;
  return `Alterner ${run} min de course / ${walk} min de marche. Allure facile.`;
};

export function ruckLoad(phase: Phase, w: number): number {
  if (phase === 2) return Math.min(8 + Math.floor((w - 1) / 2), 15);
  if (phase === 3) return Math.min(15 + Math.floor((w - 1) / 3), 20);
  if (phase === 4) return 20;
  return 0;
}

const TEMPLATES: Record<Phase, TemplateItem[]> = {
  1: [
    { day: 0, type: 'force', title: 'Force A', share: 1, maxMin: 60, details: () => 'Tractions strictes (élastique si besoin) 4×max-1 · Pompes 4×12 · Squat 4×10 · Gainage 3×45 s' },
    { day: 1, type: 'course', title: 'Course / marche', share: 1, details: runWalk },
    { day: 2, type: 'natation', title: 'Natation technique', share: 0.9, maxMin: 60, details: () => 'Éducatifs crawl, respiration bilatérale. 8×50 m récup. 30 s.' },
    { day: 2, type: 'mobilite', title: 'Mobilité', share: 0, fixedMin: 15, details: () => 'Hanches, chevilles, épaules.' },
    { day: 3, type: 'course', title: 'Course / marche', share: 1, details: runWalk },
    { day: 4, type: 'force', title: 'Force B', share: 1, maxMin: 60, details: () => 'Rowing inversé 4×10 · Dips 3×8 · Fentes 3×10 par jambe · Suspension barre 3×30 s' },
    { day: 5, type: 'course', title: 'Sortie longue course / marche', share: 1.4, details: (w) => `${runWalk(w)} Rester en aisance.` },
    { day: 5, type: 'mobilite', title: 'Mobilité', share: 0, fixedMin: 20, details: () => 'Étirements doux, respiration.' },
    { day: 6, type: 'repos', title: 'Repos complet', share: 0, details: () => 'Récupération : sommeil, hydratation.' },
  ],
  2: [
    { day: 0, type: 'force', title: 'Force + corde', share: 1, maxMin: 70, details: () => 'Tractions strictes 5×5 · Corde 4 montées · Pompes 4×15 · Gainage 3×1 min' },
    { day: 1, type: 'course', title: 'Course zone 2', share: 1.1, details: () => 'Allure conversationnelle, fréquence cardiaque basse.' },
    { day: 2, type: 'natation', title: 'Natation', share: 0.9, maxMin: 60, details: () => 'Échauffement 200 m · 6×100 m récup. 20 s · Retour au calme.' },
    { day: 2, type: 'mobilite', title: 'Mobilité', share: 0, fixedMin: 15, details: () => 'Hanches, chevilles, épaules.' },
    { day: 3, type: 'course', title: 'Fractionné', share: 0.8, maxMin: 60, details: (w) => `Échauffement 15 min · ${4 + Math.min(Math.floor(w / 3), 4)}×3 min vite / 2 min trot · Retour au calme.` },
    { day: 4, type: 'force', title: 'Force B', share: 1, maxMin: 70, details: () => 'Soulevé de terre 4×5 · Dips 4×10 · Fentes chargées 3×10 · Farmer walk 4×40 m' },
    { day: 5, type: 'marche', title: 'Marche chargée', share: 1.4, maxMin: 150, details: (w) => `Sac de ${ruckLoad(2, w)} kg. Allure soutenue, sans courir.` },
    { day: 6, type: 'repos', title: 'Repos complet', share: 0, details: () => 'Récupération : sommeil, hydratation.' },
  ],
  3: [
    { day: 0, type: 'force', title: 'Force + corde', share: 1, maxMin: 70, details: () => 'Tractions 5×max-2 · Corde 7 m : 5 montées sans les jambes · Pompes lestées 4×12 · Gainage' },
    { day: 1, type: 'course', title: 'Fractionné', share: 0.8, maxMin: 60, details: () => 'Échauffement 15 min · 5×1000 m allure test, récup. 2 min · Retour au calme.' },
    { day: 2, type: 'natation', title: 'Natation', share: 0.9, maxMin: 60, details: () => 'Endurance : 4×200 m · Apnée technique encadrée uniquement.' },
    { day: 2, type: 'mobilite', title: 'Mobilité', share: 0, fixedMin: 15, details: () => 'Hanches, chevilles, épaules.' },
    { day: 3, type: 'course', title: 'Course zone 2', share: 1.1, details: () => 'Allure conversationnelle.' },
    { day: 4, type: 'force', title: "Simulation d'épreuves", share: 1, maxMin: 90, simulation: true, details: () => 'Enchaîner : 5 km chrono · tractions max · corde 7 m · 200 m nage. Noter les temps.' },
    { day: 5, type: 'marche', title: 'Marche longue chargée', share: 2, maxMin: 240, details: (w) => `Sac de ${ruckLoad(3, w)} kg. Terrain varié, gestion de l'allure.` },
    { day: 6, type: 'repos', title: 'Repos complet', share: 0, details: () => 'Récupération : sommeil, hydratation.' },
  ],
  4: [
    { day: 0, type: 'force', title: 'Force + corde', share: 1, maxMin: 70, details: () => 'Tractions 5×max-2 · Corde 7 m sans les jambes · Gainage' },
    { day: 1, type: 'course', title: 'Fractionné', share: 0.8, maxMin: 60, details: () => 'Échauffement · 6×800 m allure test · Retour au calme.' },
    { day: 2, type: 'natation', title: 'Natation', share: 0.9, maxMin: 60, details: () => 'Allure test sur 4×250 m.' },
    { day: 2, type: 'mobilite', title: 'Mobilité', share: 0, fixedMin: 15, details: () => 'Hanches, chevilles, épaules.' },
    { day: 3, type: 'course', title: 'Course zone 2', share: 1.1, details: () => 'Allure conversationnelle.' },
    { day: 4, type: 'force', title: "Simulation d'épreuves", share: 1, maxMin: 90, simulation: true, details: () => 'Conditions réelles : épreuves dans l’ordre de la sélection.' },
    { day: 5, type: 'marche', title: 'Marche longue chargée', share: 2, maxMin: 240, details: () => `Sac de ${ruckLoad(4, 1)} kg. Allure de sélection.` },
    { day: 6, type: 'repos', title: 'Repos complet', share: 0, details: () => 'Récupération : sommeil, hydratation.' },
  ],
};

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Construit les séances d'une semaine à partir de la phase et du volume cible. */
export function buildWeekSessions(profile: Profile, week: WeekPlan): PlannedSession[] {
  const template = TEMPLATES[week.phase];
  const shares = template.reduce((sum, t) => sum + t.share, 0);
  const days = weekDays(week.weekStart);
  const light = week.kind !== 'normal';
  const sessions: PlannedSession[] = [];

  for (const t of template) {
    const scalable = t.share > 0;
    const durationMin = scalable
      ? Math.min(round5((week.volumeTargetMin * t.share) / shares), t.maxMin ?? 180)
      : t.fixedMin;
    const targets: PlannedSession['targets'] = { durationMin };
    if (t.type === 'marche') {
      targets.loadKg = week.kind === 'taper' ? Math.max(ruckLoad(week.phase, week.weekInPhase) - 5, 10) : ruckLoad(week.phase, week.weekInPhase);
      targets.distanceKm = Math.round(((durationMin ?? 60) / 60) * 5.5 * 2) / 2;
    }
    let details = t.details(week.weekInPhase, week.phase);
    if (light && scalable) details += ' Semaine allégée : intensité modérée.';
    sessions.push({
      weekStart: week.weekStart,
      date: days[t.day],
      slot: 0,
      type: t.type,
      title: t.title,
      details,
      targets,
      scalable,
      simulation: t.simulation,
      status: 'planned',
    });
  }

  for (const day of profile.grapplingDays) {
    sessions.push({
      weekStart: week.weekStart,
      date: days[day],
      slot: 1,
      type: 'grappling',
      title: 'Grappling',
      details: light ? 'Séance au club, sans sparring à fond.' : 'Séance au club.',
      targets: { durationMin: profile.grapplingMin },
      scalable: false,
      status: 'planned',
    });
  }

  // Un jour de grappling sur le jour de repos : le repos disparaît.
  const busyDays = new Set(sessions.filter((s) => s.type !== 'repos').map((s) => s.date));
  return sessions
    .filter((s) => s.type !== 'repos' || !busyDays.has(s.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot - b.slot);
}
