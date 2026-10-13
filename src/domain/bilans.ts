// Bilans toutes les huit semaines : mesurer sans épuiser la semaine, comparer au bilan précédent.
import { formatDuration } from './dates';
import type { BilanRecord, LoadReps, LogEntry } from './types';

export type BilanKey = 'pullups' | 'run' | 'swim400Sec' | 'bench' | 'squat' | 'ohp' | 'trapbar' | 'sleepH';

export const BILAN_LABEL: Record<BilanKey, string> = {
  pullups: 'Tractions propres',
  run: 'Course : 6 min ou palier',
  swim400Sec: '400 m crawl',
  bench: 'Couché : kg × reps',
  squat: 'Squat : kg × reps',
  ohp: 'Développé épaules : kg × reps',
  trapbar: 'Trap bar : kg × reps',
  sleepH: 'Sommeil moyen',
};

export const BILAN_KEYS: BilanKey[] = ['pullups', 'run', 'swim400Sec', 'bench', 'squat', 'ohp', 'trapbar', 'sleepH'];

/** Exercices du journal utilisés pour pré-remplir les charges. */
const LIFTS: Record<'bench' | 'squat' | 'ohp' | 'trapbar', RegExp> = {
  bench: /^développé couché/i,
  squat: /squat(?!.*goblet)/i,
  ohp: /développé épaules|développé militaire/i,
  trapbar: /trap bar|kettlebell surélevée/i,
};

const lr = (v?: LoadReps) => (v?.kg || v?.reps ? `${v.kg ? `${String(v.kg).replace('.', ',')} kg` : 'PDC'} × ${v.reps ?? '?'}` : '—');

export function bilanValue(b: BilanRecord, key: BilanKey): string {
  switch (key) {
    case 'pullups': return b.pullups !== undefined ? String(b.pullups) : '—';
    case 'run':
      if (b.runValue === undefined) return '—';
      return b.runTest === 'luc-leger' ? `palier ${String(b.runValue).replace('.', ',')}` : `${b.runValue} m`;
    case 'swim400Sec': return b.swim400Sec !== undefined ? formatDuration(b.swim400Sec) : '—';
    case 'sleepH': return b.sleepH !== undefined ? `${String(b.sleepH).replace('.', ',')} h` : '—';
    default: return lr(b[key]);
  }
}

/** Charge × répétitions comparables : on compare l'estimation Epley. */
const strength = (v?: LoadReps) => (v?.kg && v.reps ? v.kg * (1 + Math.min(v.reps, 12) / 30) : v?.reps ?? undefined);

function numeric(b: BilanRecord, key: BilanKey): number | undefined {
  switch (key) {
    case 'pullups': return b.pullups;
    case 'run': return b.runValue;
    case 'swim400Sec': return b.swim400Sec;
    case 'sleepH': return b.sleepH;
    default: return strength(b[key]);
  }
}

/** Progression par rapport au bilan précédent : 1 mieux, -1 moins bien, 0 stable, null non comparable. */
export function trend(prev: BilanRecord | undefined, cur: BilanRecord, key: BilanKey): -1 | 0 | 1 | null {
  if (!prev) return null;
  if (key === 'run' && prev.runTest !== cur.runTest) return null; // 6 min et Luc Léger ne se comparent pas
  const a = numeric(prev, key);
  const b = numeric(cur, key);
  if (a === undefined || b === undefined) return null;
  if (Math.abs(a - b) < 1e-9) return 0;
  const better = key === 'swim400Sec' ? b < a : b > a;
  return better ? 1 : -1;
}

/** Nombre de mesures renseignées (hors sommeil). */
export function filledCount(b: BilanRecord): number {
  return BILAN_KEYS.filter((k) => k !== 'sleepH' && bilanValue(b, k) !== '—').length;
}

/** Pré-remplit un bilan à partir du journal de la semaine de bilan. */
export function prefillFromLogs(logs: LogEntry[]): Partial<BilanRecord> {
  const out: Partial<BilanRecord> = {};
  const sets = logs.flatMap((l) => l.sets ?? []);
  const pull = sets.find((s) => /^tractions/i.test(s.exercise));
  if (pull) out.pullups = pull.reps; // la première série est la série de référence
  for (const key of Object.keys(LIFTS) as (keyof typeof LIFTS)[]) {
    const best = sets
      .filter((s) => LIFTS[key].test(s.exercise) && s.reps > 0)
      .sort((a, b) => (b.kg ?? 0) - (a.kg ?? 0) || b.reps - a.reps)[0];
    if (best) out[key] = { kg: best.kg, reps: best.reps };
  }
  const swim = logs.find((l) => l.type === 'natation' && l.note && /400/.test(l.note));
  if (swim?.note) {
    const m = swim.note.match(/(\d+):(\d\d)/);
    if (m) out.swim400Sec = Number(m[1]) * 60 + Number(m[2]);
  }
  return out;
}
