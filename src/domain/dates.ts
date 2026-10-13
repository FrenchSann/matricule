// Dates locales au format ISO court (YYYY-MM-DD). Les semaines commencent le lundi.

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // midi : évite les décalages d'heure d'été
}

export function today(): ISODate {
  return toISO(new Date());
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addWeeks(iso: ISODate, n: number): ISODate {
  return addDays(iso, n * 7);
}

/** 0 = lundi … 6 = dimanche */
export function weekday(iso: ISODate): number {
  return (fromISO(iso).getDay() + 6) % 7;
}

export function mondayOf(iso: ISODate): ISODate {
  return addDays(iso, -weekday(iso));
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

export function weeksBetween(a: ISODate, b: ISODate): number {
  return Math.floor(daysBetween(mondayOf(a), mondayOf(b)) / 7);
}

export function weekDays(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const DAY_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function formatDay(iso: ISODate): string {
  const d = fromISO(iso);
  return `${DAY_LONG[weekday(iso)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatShort(iso: ISODate): string {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** secondes → "m:ss" ou "h:mm:ss" */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** "mm:ss" ou "h:mm:ss" → secondes (null si illisible) */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return nums[0] * 60;
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return null;
}
