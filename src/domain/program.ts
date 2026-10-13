// Programme en 4 phases sur 15 mois : calendrier des phases, semaines types, cibles des tests.
import { addWeeks, mondayOf, weekDays, weeksBetween, type ISODate } from './dates';
import type {
  AutoDetails,
  CheckpointMonth,
  ExercisePrescription,
  Phase,
  PlannedSession,
  Profile,
  TemplateItem,
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

/** Contenu qui évolue avec la semaine, placé devant le texte libre de la séance. */
export const AUTO_DETAILS: Record<AutoDetails, { label: string; text: (w: number, phase: Phase) => string }> = {
  runWalk: { label: 'Course/marche progressive', text: (w) => runWalk(w) },
  intervals: {
    label: 'Fractionné progressif',
    text: (w) => `Échauffement 15 min · ${4 + Math.min(Math.floor(w / 3), 4)}×3 min vite / 2 min trot · Retour au calme.`,
  },
  ruck: { label: 'Charge du sac progressive', text: (w, phase) => `Sac de ${ruckLoad(phase, w) || 10} kg.` },
};

const ex = (name: string, sets: number, reps: number, extra: Partial<ExercisePrescription> = {}): ExercisePrescription => ({
  name,
  sets,
  reps,
  unit: 'reps',
  ...extra,
});

const MOBILITY = 'Hanches, chevilles, épaules.';
const REST = 'Récupération : sommeil, hydratation.';

type Draft = Omit<TemplateItem, 'id'>;

const DEFAULT_TEMPLATES: Record<Phase, Draft[]> = {
  1: [
    { day: 0, type: 'force', title: 'Force A', share: 1, maxMin: 60, details: 'Élastique sur les tractions si besoin.', exercises: [ex('Tractions strictes', 4, 6), ex('Pompes', 4, 12), ex('Squat goblet', 4, 10, { kg: 12 }), ex('Gainage', 3, 45, { unit: 's' })] },
    { day: 1, type: 'course', title: 'Course / marche', share: 1, details: '', auto: 'runWalk' },
    { day: 2, type: 'natation', title: 'Natation technique', share: 0.9, maxMin: 60, details: 'Éducatifs crawl, respiration bilatérale. 8×50 m récup. 30 s.' },
    { day: 2, type: 'mobilite', title: 'Mobilité', share: 0, fixedMin: 15, details: MOBILITY },
    { day: 3, type: 'course', title: 'Course / marche', share: 1, details: '', auto: 'runWalk' },
    { day: 4, type: 'force', title: 'Force B', share: 1, maxMin: 60, details: '', exercises: [ex('Rowing inversé', 4, 10), ex('Dips', 3, 8), ex('Fentes', 3, 10), ex('Suspension barre', 3, 30, { unit: 's' })] },
    { day: 5, type: 'course', title: 'Sortie longue course / marche', share: 1.4, details: 'Rester en aisance.', auto: 'runWalk' },
    { day: 5, type: 'mobilite', title: 'Mobilité', share: 0, fixedMin: 20, details: 'Étirements doux, respiration.' },
    { day: 6, type: 'repos', title: 'Repos complet', share: 0, details: REST },
  ],
  2: [
    { day: 0, type: 'force', title: 'Force + corde', share: 1, maxMin: 70, details: '', exercises: [ex('Tractions strictes', 5, 5), ex('Corde (montées)', 4, 1), ex('Pompes', 4, 15), ex('Gainage', 3, 60, { unit: 's' })] },
    { day: 1, type: 'course', title: 'Course zone 2', share: 1.1, details: 'Allure conversationnelle, fréquence cardiaque basse.' },
    { day: 2, type: 'natation', title: 'Natation', share: 0.9, maxMin: 60, details: 'Échauffement 200 m · 6×100 m récup. 20 s · Retour au calme.' },
    { day: 2, type: 'mobilite', title: 'Mobilité', share: 0, fixedMin: 15, details: MOBILITY },
    { day: 3, type: 'course', title: 'Fractionné', share: 0.8, maxMin: 60, details: '', auto: 'intervals' },
    { day: 4, type: 'force', title: 'Force B', share: 1, maxMin: 70, details: '', exercises: [ex('Soulevé de terre', 4, 5, { kg: 60 }), ex('Squat', 4, 6, { kg: 40 }), ex('Dips', 4, 10), ex('Farmer walk', 4, 40, { unit: 'm', kg: 20 })] },
    { day: 5, type: 'marche', title: 'Marche chargée', share: 1.4, maxMin: 150, details: 'Allure soutenue, sans courir.', auto: 'ruck' },
    { day: 6, type: 'repos', title: 'Repos complet', share: 0, details: REST },
  ],
  3: [
    { day: 0, type: 'force', title: 'Force + corde', share: 1, maxMin: 70, details: 'Corde 7 m sans les jambes.', exercises: [ex('Tractions strictes', 5, 6), ex('Corde (montées)', 5, 1), ex('Soulevé de terre', 4, 5, { kg: 80 }), ex('Pompes lestées', 4, 12, { kg: 10 }), ex('Gainage', 3, 60, { unit: 's' })] },
    { day: 1, type: 'course', title: 'Fractionné', share: 0.8, maxMin: 60, details: 'Échauffement 15 min · 5×1000 m allure test, récup. 2 min · Retour au calme.' },
    { day: 2, type: 'natation', title: 'Natation', share: 0.9, maxMin: 60, details: 'Endurance : 4×200 m · Apnée technique encadrée uniquement.' },
    { day: 2, type: 'mobilite', title: 'Mobilité', share: 0, fixedMin: 15, details: MOBILITY },
    { day: 3, type: 'course', title: 'Course zone 2', share: 1.1, details: 'Allure conversationnelle.' },
    { day: 4, type: 'force', title: "Simulation d'épreuves", share: 1, maxMin: 90, simulation: true, details: 'Enchaîner : 5 km chrono · tractions max · corde 7 m · 200 m nage. Noter les temps.' },
    { day: 5, type: 'marche', title: 'Marche longue chargée', share: 2, maxMin: 240, details: "Terrain varié, gestion de l'allure.", auto: 'ruck' },
    { day: 6, type: 'repos', title: 'Repos complet', share: 0, details: REST },
  ],
  4: [
    { day: 0, type: 'force', title: 'Force + corde', share: 1, maxMin: 70, details: 'Corde 7 m sans les jambes.', exercises: [ex('Tractions strictes', 5, 6), ex('Corde (montées)', 5, 1), ex('Soulevé de terre', 3, 5, { kg: 80 }), ex('Gainage', 3, 60, { unit: 's' })] },
    { day: 1, type: 'course', title: 'Fractionné', share: 0.8, maxMin: 60, details: 'Échauffement · 6×800 m allure test · Retour au calme.' },
    { day: 2, type: 'natation', title: 'Natation', share: 0.9, maxMin: 60, details: 'Allure test sur 4×250 m.' },
    { day: 2, type: 'mobilite', title: 'Mobilité', share: 0, fixedMin: 15, details: MOBILITY },
    { day: 3, type: 'course', title: 'Course zone 2', share: 1.1, details: 'Allure conversationnelle.' },
    { day: 4, type: 'force', title: "Simulation d'épreuves", share: 1, maxMin: 90, simulation: true, details: "Conditions réelles : épreuves dans l'ordre de la sélection." },
    { day: 5, type: 'marche', title: 'Marche longue chargée', share: 2, maxMin: 240, details: 'Allure de sélection.', auto: 'ruck' },
    { day: 6, type: 'repos', title: 'Repos complet', share: 0, details: REST },
  ],
};

export function defaultTemplate(phase: Phase): TemplateItem[] {
  return DEFAULT_TEMPLATES[phase].map((t, i) => structuredClone({ ...t, id: `p${phase}-${i}` }));
}

/** Semaine type en vigueur : personnalisée si elle existe, sinon le modèle par défaut. */
export function templateFor(profile: Profile, phase: Phase): TemplateItem[] {
  return profile.templates?.[phase] ?? defaultTemplate(phase);
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Durée d'un élément de la semaine type pour un volume progressif donné. */
export function itemDuration(item: TemplateItem, items: TemplateItem[], volumeMin: number): number | undefined {
  if (item.share <= 0) return item.fixedMin;
  const shares = items.reduce((sum, t) => sum + Math.max(0, t.share), 0);
  return Math.min(round5((volumeMin * item.share) / shares), item.maxMin ?? 240);
}

/**
 * Part à donner à un élément pour qu'il dure `minutes` avec ce volume,
 * les autres gardant leur part (leurs durées s'ajustent un peu).
 */
export function shareForMinutes(item: TemplateItem, items: TemplateItem[], volumeMin: number, minutes: number): number {
  const others = items.filter((t) => t.id !== item.id).reduce((sum, t) => sum + Math.max(0, t.share), 0);
  const m = Math.min(minutes, volumeMin * 0.9);
  return others > 0 ? +((m * others) / (volumeMin - m)).toFixed(3) : 1;
}

export function itemDetails(item: TemplateItem, w: number, phase: Phase): string {
  const auto = item.auto ? AUTO_DETAILS[item.auto].text(w, phase) : '';
  return [auto, item.details].filter(Boolean).join(' ');
}

/** Construit les séances d'une semaine à partir de la semaine type et du volume cible. */
export function buildWeekSessions(profile: Profile, week: WeekPlan): PlannedSession[] {
  const template = templateFor(profile, week.phase);
  const days = weekDays(week.weekStart);
  const light = week.kind !== 'normal';
  const sessions: PlannedSession[] = [];

  for (const t of template) {
    const scalable = t.share > 0;
    const durationMin = itemDuration(t, template, week.volumeTargetMin);
    const targets: PlannedSession['targets'] = { durationMin };
    if (t.type === 'marche') {
      const load = ruckLoad(week.phase, week.weekInPhase) || 10;
      targets.loadKg = week.kind === 'taper' ? Math.max(load - 5, 10) : load;
      targets.distanceKm = Math.round(((durationMin ?? 60) / 60) * 5.5 * 2) / 2;
    }
    let details = itemDetails(t, week.weekInPhase, week.phase);
    if (light && scalable) details += ' Semaine allégée : intensité modérée.';
    // Semaine allégée : une série de moins par exercice.
    const exercises = t.exercises?.map((e) => ({ ...e, sets: light ? Math.max(1, e.sets - 1) : e.sets }));
    sessions.push({
      weekStart: week.weekStart,
      date: days[t.day],
      slot: 0,
      type: t.type,
      title: t.title,
      details,
      targets,
      scalable,
      exercises: exercises?.length ? exercises : undefined,
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
