import { weekday, type ISODate } from '../domain/dates';
import type { PlannedSession, WeekKind, WeekPlan } from '../domain/types';
import type { DayStatus } from '../domain/streak';

export const ROMAN = ['', 'I', 'II', 'III', 'IV'];

export const WEEK_KIND: Record<WeekKind, string> = {
  normal: 'Charge',
  deload: 'Allégée',
  'forced-deload': 'Allègement imposé',
  taper: 'Affûtage',
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

/** Matricule de séance : S-P{phase}-{semaine}-{jour} */
export function matricule(week: WeekPlan | undefined, date: ISODate): string {
  if (!week) return 'S-P0-00-0';
  return `S-P${week.phase}-${String(week.weekInPhase).padStart(2, '0')}-${weekday(date) + 1}`;
}

export function sessionMeta(s: PlannedSession): string {
  const parts: string[] = [];
  if (s.targets.durationMin) parts.push(`${s.targets.durationMin} min`);
  if (s.targets.distanceKm) parts.push(`${String(s.targets.distanceKm).replace('.', ',')} km`);
  if (s.targets.loadKg) parts.push(`${s.targets.loadKg} kg`);
  return parts.join(', ');
}
