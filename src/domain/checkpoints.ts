// Tests de contrôle (fin des mois 4, 8, 12, 14) et passage de phase.
import { addWeeks, mondayOf, type ISODate } from './dates';
import { CHECKPOINT_PHASE, phaseLength } from './program';
import type { CheckpointMonth, Phase, Profile, TestKey, TestResults, TestTargets } from './types';

export const TEST_KEYS: TestKey[] = ['course', 'tractions', 'marche', 'natation', 'corde'];

export const TEST_LABEL: Record<TestKey, string> = {
  course: 'Course',
  tractions: 'Tractions strictes',
  marche: 'Marche chargée',
  natation: 'Natation',
  corde: 'Corde 7 m',
};

export function evaluate(results: TestResults, t: TestTargets): Record<TestKey, boolean> {
  return {
    course: results.courseSec !== undefined && results.courseSec <= t.courseSec,
    tractions: results.tractions !== undefined && results.tractions >= t.tractions,
    marche: results.marcheSec !== undefined && results.marcheSec <= t.marcheSec,
    natation: results.natationSec !== undefined && results.natationSec <= t.natationSec,
    corde: results.corde === true,
  };
}

/** Phase suivante validée : elle commence au plus tôt à la date prévue, au plus tard le lundi suivant le test. */
export function advancePhase(profile: Profile, month: CheckpointMonth, testDate: ISODate): Profile {
  const phase = CHECKPOINT_PHASE[month];
  if (phase === 4) return profile; // le test du mois 14 ne change pas de phase
  const next = (phase + 1) as Phase;
  if (profile.phaseStarts[next]) return profile;
  const planned = addWeeks(profile.phaseStarts[phase]!, phaseLength(profile, phase));
  const afterTest = addWeeks(mondayOf(testDate), 1);
  const start = planned > afterTest ? planned : afterTest;
  return { ...profile, phaseStarts: { ...profile.phaseStarts, [next]: start } };
}

/** Test manqué : la phase est prolongée de 3 ou 4 semaines avant un nouveau passage. */
export function extendPhase(profile: Profile, month: CheckpointMonth, weeks: 3 | 4): Profile {
  const phase = CHECKPOINT_PHASE[month];
  return { ...profile, extensions: { ...profile.extensions, [phase]: (profile.extensions[phase] ?? 0) + weeks } };
}
