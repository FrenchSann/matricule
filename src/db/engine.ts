// Opérations métier sur la base : semaines du programme, journal, plan, options, bilans, jokers.
import { addWeeks, mondayOf, today as todayISO, type ISODate } from '../domain/dates';
import { planNextWeek, reviewWeek, type WeekReview } from '../domain/cursor';
import { buildWeekSessions, createProfile, sheet } from '../domain/programme';
import { exerciseHistory, suggestLoad } from '../domain/strength';
import type { BilanRecord, Checkin, ExercisePrescription, LogEntry, PlannedSession, Profile, SetEntry, WeekPlan } from '../domain/types';
import { db } from './schema';

export async function createProgram(startDate: ISODate, grapplingDays: number[], entryWeeks: number) {
  await db.profile.put(createProfile(startDate, grapplingDays, entryWeeks));
  await ensureWeeks();
}

/** Bilan de chaque semaine (journal + séances prévues), calculé en mémoire. */
export function reviewer(logs: LogEntry[], planned: PlannedSession[]) {
  return (w: WeekPlan): WeekReview => {
    const end = addWeeks(w.weekStart, 1);
    return reviewWeek(
      logs.filter((l) => l.date >= w.weekStart && l.date < end),
      planned.filter((p) => p.weekStart === w.weekStart),
    );
  };
}

const sessionsTotal = (sessions: PlannedSession[]) => sessions.reduce((sum, s) => sum + (s.targets.durationMin ?? 0), 0);

/** Génère, dans l'ordre, les semaines manquantes jusqu'à la semaine en cours. */
export async function ensureWeeks(now: ISODate = todayISO()): Promise<void> {
  const profile = await db.profile.get('me');
  if (!profile) return;
  const target = [mondayOf(now), profile.startDate].sort().at(-1)!;

  await db.transaction('rw', [db.profile, db.weeks, db.planned, db.logs], async () => {
    const history = await db.weeks.orderBy('weekStart').toArray();
    const [logs, planned] = await Promise.all([db.logs.toArray(), db.planned.toArray()]);
    let next = history.length ? addWeeks(history.at(-1)!.weekStart, 1) : profile.startDate;
    while (next <= target) {
      const week = planNextWeek({ profile, weekStart: next, history, reviewOf: reviewer(logs, planned) });
      if (!week) break; // programme terminé
      const sessions = buildWeekSessions(profile, week);
      if (week.programWeek === 0) week.totalMin = sessionsTotal(sessions);
      await db.weeks.add(week);
      await db.planned.bulkAdd(sessions);
      history.push(week);
      planned.push(...sessions);
      next = addWeeks(next, 1);
    }
  });
}

/** Aperçu (non enregistré) de la semaine suivante, d'après les données actuelles. */
export async function previewWeek(weekStart: ISODate): Promise<{ week: WeekPlan; sessions: PlannedSession[] } | null> {
  const profile = await db.profile.get('me');
  if (!profile) return null;
  const history = (await db.weeks.orderBy('weekStart').toArray()).filter((w) => w.weekStart < weekStart);
  if (!history.length) return null;
  const [logs, planned] = await Promise.all([db.logs.toArray(), db.planned.toArray()]);
  const week = planNextWeek({ profile, weekStart, history, reviewOf: reviewer(logs, planned) });
  if (!week) return null;
  const sessions = buildWeekSessions(profile, week);
  if (week.programWeek === 0) week.totalMin = sessionsTotal(sessions);
  return { week, sessions };
}

/**
 * Décision du dimanche. Si la semaine suivante est déjà générée et pas encore entamée,
 * elle est recalculée avec cette décision.
 */
export async function saveCheckin(weekStart: ISODate, checkin: Checkin) {
  await db.weeks.update(weekStart, { checkin });
  const nextStart = addWeeks(weekStart, 1);
  const next = await db.weeks.get(nextStart);
  if (!next) return;
  const started = await db.planned.where('weekStart').equals(nextStart).filter((p) => p.status === 'done').count();
  const later = await db.weeks.where('weekStart').above(nextStart).count();
  if (started || later) return;
  await db.transaction('rw', db.weeks, db.planned, async () => {
    await db.planned.where('weekStart').equals(nextStart).delete();
    await db.weeks.delete(nextStart);
  });
  await ensureWeeks();
}

// ─── Journal ───────────────────────────────────────────────────────────────────

export async function saveLog(entry: Omit<LogEntry, 'createdAt'>): Promise<number> {
  return db.transaction('rw', db.logs, db.planned, async () => {
    const record: LogEntry = { ...entry, createdAt: Date.now() };
    if (record.id === undefined) delete record.id; // laisse IndexedDB générer la clé
    const id = (await db.logs.put(record)) as number;
    if (entry.plannedId) await db.planned.update(entry.plannedId, { status: 'done', logId: id });
    return id;
  });
}

export async function deleteLog(id: number) {
  await db.transaction('rw', db.logs, db.planned, async () => {
    const log = await db.logs.get(id);
    if (log?.plannedId) await db.planned.update(log.plannedId, { status: 'planned', logId: undefined });
    await db.logs.delete(id);
  });
}

/** Séries prévues, avec la charge et les répétitions proposées d'après l'historique. */
export function prescribedSets(exercises: ExercisePrescription[], history: LogEntry[]): SetEntry[] {
  return exercises.flatMap((e) => {
    const s = suggestLoad(exerciseHistory(history, e.name), e);
    return Array.from({ length: e.sets }, () => ({ exercise: e.name, reps: s.reps, kg: s.kg, unit: e.unit ?? 'reps' }));
  });
}

/** Cocher une séance prévue : la consigne avec les valeurs prévues (RPE à compléter). */
export async function toggleDone(session: PlannedSession) {
  if (session.status === 'done') {
    if (session.logId) await deleteLog(session.logId);
    else await db.planned.update(session.id!, { status: 'planned' });
    return;
  }
  const before = session.exercises?.length ? await db.logs.where('date').below(session.date).toArray() : [];
  await saveLog({
    date: session.date,
    type: session.type,
    durationMin: session.targets.durationMin,
    distanceKm: session.targets.distanceKm,
    loadKg: session.targets.loadKg,
    sets: session.exercises ? prescribedSets(session.exercises, before) : undefined,
    plannedId: session.id,
  });
}

// ─── Modification du plan ──────────────────────────────────────────────────────

const restDay = (weekStart: ISODate, date: ISODate, details: string): PlannedSession => ({
  weekStart,
  date,
  slot: 0,
  slotId: 'rest',
  type: 'repos',
  title: 'Repos',
  details,
  targets: {},
  status: 'planned',
});

export async function moveSession(id: number, date: ISODate) {
  await db.transaction('rw', db.planned, async () => {
    const s = await db.planned.get(id);
    if (!s || s.date === date) return;
    // Une séance déplacée sur un jour de repos remplace ce repos.
    const restOnTarget = await db.planned.where('date').equals(date).filter((p) => p.type === 'repos').primaryKeys();
    await db.planned.bulkDelete(restOnTarget);
    await db.planned.update(id, { date, weekStart: mondayOf(date) });
    if ((await db.planned.where('date').equals(s.date).count()) > 0) return;
    await db.planned.add(restDay(s.weekStart, s.date, 'Jour libéré par un déplacement de séance.'));
  });
}

export async function updateSession(id: number, patch: Partial<PlannedSession>) {
  await db.planned.update(id, patch);
}

export async function addSession(session: Omit<PlannedSession, 'id' | 'weekStart' | 'status' | 'slot'>) {
  await db.transaction('rw', db.planned, async () => {
    if (session.type !== 'repos') {
      const rest = await db.planned.where('date').equals(session.date).filter((p) => p.type === 'repos').primaryKeys();
      await db.planned.bulkDelete(rest);
    }
    const count = await db.planned.where('date').equals(session.date).count();
    await db.planned.add({ slotId: 'custom', ...session, weekStart: mondayOf(session.date), slot: count, status: 'planned' });
  });
}

/** Supprime une séance prévue ; ce qui a déjà été consigné reste dans le journal. */
export async function deleteSession(id: number) {
  await db.transaction('rw', db.planned, db.logs, async () => {
    const s = await db.planned.get(id);
    if (!s) return;
    if (s.logId) await db.logs.update(s.logId, { plannedId: undefined });
    await db.planned.delete(id);
    if ((await db.planned.where('date').equals(s.date).count()) === 0) await db.planned.add(restDay(s.weekStart, s.date, 'Séance retirée du plan.'));
  });
}

/** Prend l'option de la fiche (marche au lieu de la course du dimanche), ou revient à la séance prévue. */
export async function swapAlternative(id: number) {
  const s = await db.planned.get(id);
  if (!s?.alternative || s.status === 'done') return;
  const { alternative } = s;
  await db.planned.update(id, {
    type: alternative.type,
    title: alternative.title,
    details: alternative.details,
    targets: alternative.targets,
    alternative: { type: s.type, title: s.title, details: s.details, targets: s.targets },
  });
}

/** Le 4e grappling remplace la course du jeudi et la piscine (voir fourthGrapplingBlocker). */
export async function setFourthGrappling(weekStart: ISODate, on: boolean) {
  await db.transaction('rw', [db.profile, db.weeks, db.planned], async () => {
    const profile = (await db.profile.get('me'))!;
    const week = (await db.weeks.get(weekStart))!;
    const sh = sheet(week.programWeek || 1);
    const updated: WeekPlan = { ...week, fourthGrappling: on, totalMin: on ? (sh.fourthGrappling?.totalMin ?? week.totalMin) : sh.totalMin };
    await db.weeks.put(updated);
    // Retire les créneaux concernés encore à faire, puis reconstruit ceux de la nouvelle version.
    const slots = ['thursday', 'swim', 'grappling4'];
    const current = await db.planned.where('weekStart').equals(weekStart).toArray();
    await db.planned.bulkDelete(current.filter((p) => slots.includes(p.slotId ?? '') && p.status !== 'done').map((p) => p.id!));
    await db.planned.bulkAdd(buildWeekSessions(profile, updated).filter((s) => slots.includes(s.slotId ?? '')));
  });
}

/** Personnalisation (variantes, jours, créneaux retirés) : effet dès la semaine prochaine. */
export async function saveCustomization(patch: Partial<Pick<Profile, 'slotDays' | 'disabledSlots' | 'exerciseSubs' | 'grapplingDays'>>) {
  await db.profile.update('me', patch);
}

/**
 * Reconstruit la fin de la semaine en cours avec la personnalisation actuelle :
 * les jours passés, les séances faites et les séances ajoutées à la main ne bougent pas.
 */
export async function applyToWeek(weekStart: ISODate, from: ISODate) {
  await db.transaction('rw', [db.profile, db.weeks, db.planned], async () => {
    const profile = (await db.profile.get('me'))!;
    const week = await db.weeks.get(weekStart);
    if (!week) return;
    const current = await db.planned.where('weekStart').equals(weekStart).toArray();
    const keep = current.filter((p) => p.date < from || p.status === 'done' || p.slotId === 'custom');
    await db.planned.bulkDelete(current.filter((p) => !keep.includes(p)).map((p) => p.id!));
    // Une séance déjà faite n'est pas reprogrammée (le grappling, lui, revient plusieurs fois par semaine).
    const fresh = buildWeekSessions(profile, week).filter((s) => {
      const unique = s.slotId !== 'grappling' && s.slotId !== 'rest';
      return s.date >= from && !keep.some((k) => k.slotId === s.slotId && (k.date === s.date || (unique && k.status === 'done')));
    });
    await db.planned.bulkAdd(fresh.filter((s) => s.type !== 'repos' || !keep.some((k) => k.date === s.date)));
  });
}

// ─── Bilans et jokers ──────────────────────────────────────────────────────────

export const bilanId = (programWeek: number) => `S${String(programWeek).padStart(2, '0')}`;

export async function saveBilan(record: BilanRecord) {
  await db.bilans.put({ ...record, id: bilanId(record.programWeek) });
}

export async function spendJoker(date: ISODate) {
  await db.jokers.put({ date, usedAt: Date.now() });
}
