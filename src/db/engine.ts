// Opérations métier sur la base : génération des semaines, journal, plan, tests, jokers.
import { addWeeks, mondayOf, today as todayISO, type ISODate } from '../domain/dates';
import { advancePhase, evaluate, extendPhase } from '../domain/checkpoints';
import { buildWeekSessions, createProfile, CHECKPOINT_PHASE } from '../domain/program';
import { planNextWeek, reviewWeek } from '../domain/progression';
import { exerciseHistory, suggestLoad } from '../domain/strength';
import type { CheckpointMonth, CheckpointRecord, ExercisePrescription, LogEntry, Phase, PlannedSession, SetEntry, TemplateItem, TestResults, WeekPlan } from '../domain/types';
import { db } from './schema';

export async function createProgram(startDate: ISODate, grapplingDays: number[]) {
  await db.profile.put(createProfile(startDate, grapplingDays));
  await ensureWeeks();
}

/** Génère, dans l'ordre, toutes les semaines manquantes jusqu'à la semaine en cours. */
export async function ensureWeeks(now: ISODate = todayISO()): Promise<void> {
  const profile = await db.profile.get('me');
  if (!profile) return;
  const target = [mondayOf(now), profile.startDate].sort().at(-1)!;

  await db.transaction('rw', [db.profile, db.weeks, db.planned, db.logs], async () => {
    const history = await db.weeks.orderBy('weekStart').toArray();
    let next = history.length ? addWeeks(history.at(-1)!.weekStart, 1) : profile.startDate;
    while (next <= target) {
      const week = await planWeek(next, history);
      await db.weeks.add(week);
      await db.planned.bulkAdd(buildWeekSessions(profile, week));
      history.push(week);
      next = addWeeks(next, 1);
    }
  });
}

async function planWeek(weekStart: ISODate, history: WeekPlan[]): Promise<WeekPlan> {
  const profile = (await db.profile.get('me'))!;
  const prev = history.at(-1);
  const previous = prev ? await reviewOf(prev.weekStart) : null;
  return planNextWeek({ profile, weekStart, history, previous });
}

export async function reviewOf(weekStart: ISODate) {
  const end = addWeeks(weekStart, 1);
  const [logs, planned] = await Promise.all([
    db.logs.where('date').between(weekStart, end, true, false).toArray(),
    db.planned.where('weekStart').equals(weekStart).toArray(),
  ]);
  return reviewWeek(logs, planned);
}

/** Aperçu (non enregistré) de la semaine suivante, d'après la semaine en cours. */
export async function previewWeek(weekStart: ISODate): Promise<{ week: WeekPlan; sessions: PlannedSession[] } | null> {
  const profile = await db.profile.get('me');
  if (!profile) return null;
  const history = (await db.weeks.orderBy('weekStart').toArray()).filter((w) => w.weekStart < weekStart);
  if (!history.length) return null;
  const week = await planWeek(weekStart, history);
  return { week, sessions: buildWeekSessions(profile, week) };
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

/** Séries prévues, avec la charge proposée d'après l'historique. */
export function prescribedSets(exercises: ExercisePrescription[], history: LogEntry[]): SetEntry[] {
  return exercises.flatMap((e) => {
    const s = suggestLoad(exerciseHistory(history, e.name), e);
    return Array.from({ length: e.sets }, () => ({ exercise: e.name, reps: e.reps, kg: s.kg, unit: e.unit ?? 'reps' }));
  });
}

export async function moveSession(id: number, date: ISODate) {
  await db.transaction('rw', db.planned, async () => {
    const s = await db.planned.get(id);
    if (!s || s.date === date) return;
    // Une séance déplacée sur un jour de repos remplace ce repos.
    const restOnTarget = await db.planned.where('date').equals(date).filter((p) => p.type === 'repos').primaryKeys();
    await db.planned.bulkDelete(restOnTarget);
    await db.planned.update(id, { date, weekStart: mondayOf(date) });
    // Le jour quitté, s'il est vide, devient un jour de repos.
    if ((await db.planned.where('date').equals(s.date).count()) > 0) return;
    await db.planned.add({
      weekStart: s.weekStart,
      date: s.date,
      slot: 0,
      type: 'repos',
      title: 'Repos',
      details: 'Jour libéré par un déplacement de séance.',
      targets: {},
      scalable: false,
      status: 'planned',
    });
  });
}

export async function updateSession(id: number, patch: Partial<PlannedSession>) {
  await db.planned.update(id, patch);
}

// ─── Tests de contrôle ─────────────────────────────────────────────────────────

export async function recordCheckpoint(month: CheckpointMonth, date: ISODate, results: TestResults): Promise<CheckpointRecord> {
  const profile = (await db.profile.get('me'))!;
  const passed = evaluate(results, profile.targets[month]);
  const allPassed = Object.values(passed).every(Boolean);
  const record: CheckpointRecord = { month, date, results, passed, allPassed };
  record.id = await db.checkpoints.add(record);
  if (allPassed) await db.profile.put(advancePhase(profile, month, date));
  return record;
}

export async function chooseExtension(record: CheckpointRecord, weeks: 3 | 4) {
  const profile = (await db.profile.get('me'))!;
  await db.profile.put(extendPhase(profile, record.month, weeks));
  await db.checkpoints.update(record.id!, { extensionWeeks: weeks });
}

export const checkpointPhase = (m: CheckpointMonth) => CHECKPOINT_PHASE[m];

// ─── Jokers ────────────────────────────────────────────────────────────────────

export async function spendJoker(date: ISODate) {
  await db.jokers.put({ date, usedAt: Date.now() });
}

// ─── Modification du plan ──────────────────────────────────────────────────────

export async function addSession(session: Omit<PlannedSession, 'id' | 'weekStart' | 'status' | 'slot'>) {
  await db.transaction('rw', db.planned, async () => {
    // Une séance ajoutée sur un jour de repos remplace ce repos.
    if (session.type !== 'repos') {
      const rest = await db.planned.where('date').equals(session.date).filter((p) => p.type === 'repos').primaryKeys();
      await db.planned.bulkDelete(rest);
    }
    const count = await db.planned.where('date').equals(session.date).count();
    await db.planned.add({ ...session, weekStart: mondayOf(session.date), slot: count, status: 'planned' });
  });
}

/** Supprime une séance prévue ; ce qui a déjà été consigné reste dans le journal. */
export async function deleteSession(id: number) {
  await db.transaction('rw', db.planned, db.logs, async () => {
    const s = await db.planned.get(id);
    if (!s) return;
    if (s.logId) await db.logs.update(s.logId, { plannedId: undefined });
    await db.planned.delete(id);
  });
}

export async function saveTemplate(phase: Phase, items: TemplateItem[]) {
  const profile = (await db.profile.get('me'))!;
  await db.profile.put({ ...profile, templates: { ...profile.templates, [phase]: items } });
}

export async function resetTemplate(phase: Phase) {
  const profile = (await db.profile.get('me'))!;
  const templates = { ...profile.templates };
  delete templates[phase];
  await db.profile.put({ ...profile, templates });
}

/**
 * Reconstruit la fin de la semaine en cours à partir de la semaine type :
 * les jours passés et les séances déjà faites ne bougent pas.
 */
export async function applyTemplateToWeek(weekStart: ISODate, from: ISODate) {
  await db.transaction('rw', [db.profile, db.weeks, db.planned], async () => {
    const profile = (await db.profile.get('me'))!;
    const week = await db.weeks.get(weekStart);
    if (!week) return;
    const current = await db.planned.where('weekStart').equals(weekStart).toArray();
    const keep = current.filter((p) => p.date < from || p.status === 'done');
    await db.planned.bulkDelete(current.filter((p) => !keep.includes(p)).map((p) => p.id!));
    const fresh = buildWeekSessions(profile, week).filter(
      (s) => s.date >= from && !keep.some((k) => k.date === s.date && k.type === s.type),
    );
    await db.planned.bulkAdd(fresh);
  });
}
