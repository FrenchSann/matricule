import { weekday, type ISODate } from '../domain/dates';
import type { ExercisePrescription, PlannedSession, WeekKind, WeekPlan } from '../domain/types';
import type { DayStatus } from '../domain/streak';
import { UNIT_LABEL } from '../domain/strength';

export const WEEK_KIND: Record<WeekKind, string> = {
  adaptation: 'Adaptation',
  normal: 'Construction',
  deload: 'Allégée',
  bilan: 'Bilan',
  taper: 'Affûtage',
  'forced-deload': 'Allègement décidé',
  repeat: 'Semaine répétée',
};

export const DAY_STATUS: Record<DayStatus, string> = {
  done: 'Tenu',
  rest: 'Repos tenu',
  excused: 'Excusé (douleur)',
  joker: 'Joker',
  missed: 'Manqué',
  'rest-broken': 'Repos non respecté',
  pending: 'En cours',
  future: '',
};

/** Numéro de fiche : « S07 », « Adapt. » pour la version d'entrée. */
export function weekLabel(w: Pick<WeekPlan, 'programWeek'> | undefined): string {
  if (!w) return 'S—';
  return w.programWeek === 0 ? 'Adaptation' : `S${String(w.programWeek).padStart(2, '0')}`;
}

/** Matricule de séance : S{fiche}-{jour} */
export function matricule(week: WeekPlan | undefined, date: ISODate): string {
  if (!week) return 'S00-0';
  return `S${String(week.programWeek).padStart(2, '0')}-${weekday(date) + 1}`;
}

export function hours(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

export function sessionMeta(s: PlannedSession): string {
  const parts: string[] = [];
  if (s.time) parts.push(s.time);
  if (s.targets.durationMin) parts.push(`${s.targets.durationMin} min`);
  if (s.targets.distanceKm) parts.push(s.type === 'natation' ? `${Math.round(s.targets.distanceKm * 1000)} m` : `${String(s.targets.distanceKm).replace('.', ',')} km`);
  if (s.targets.loadKg) parts.push(`sac ${s.targets.loadKg} kg max`);
  return parts.join(', ');
}

/** « 3 × 6-8 », « 2 × 8-10 par jambe », « 3 × 30 m » */
export function prescriptionText(e: ExercisePrescription): string {
  const range = e.repsMin && e.repsMin !== e.reps ? `${e.repsMin}-${e.reps}` : `${e.reps}`;
  const unit = e.unit && e.unit !== 'reps' ? ` ${UNIT_LABEL[e.unit]}` : '';
  return `${e.sets} × ${range}${unit}${e.perSide ? ` ${e.perSide}` : ''}`;
}
