import { useState } from 'react';
import { saveCheckin } from '../../db/engine';
import { DECISION_LABEL, type Suggestion } from '../../domain/cursor';
import type { Decision, WeekPlan } from '../../domain/types';
import { Stepper } from '../../ui/kit';
import { useUI } from '../../state';
import { weekLabel } from '../labels';

const DECISIONS: Decision[] = ['advance', 'repeat', 'lighten'];
const DECISION_HINT: Record<Decision, string> = {
  advance: 'Passer à la fiche suivante.',
  repeat: 'Refaire cette fiche la semaine prochaine.',
  lighten: 'Prendre la semaine allégée du bloc, puis reprendre.',
};

/** Décision du dimanche : sommeil, fatigue, puis avancer / répéter / alléger. */
export function CheckinCard({ week, suggestion }: { week: WeekPlan; suggestion: Suggestion }) {
  const ui = useUI();
  const [sleep, setSleep] = useState<number | undefined>();
  const [fatigue, setFatigue] = useState<number | undefined>();
  const [decision, setDecision] = useState<Decision>(suggestion.decision);
  const [note, setNote] = useState('');

  const save = async () => {
    await saveCheckin(week.weekStart, { sleepH: sleep, fatigue, decision, note: note.trim() || undefined, at: Date.now() });
    ui.stamp('Décidé');
  };

  return (
    <section className="plate plate--brass stack" aria-labelledby="checkin-title">
      <div className="row row--between">
        <h3 id="checkin-title">Décision du dimanche</h3>
        <span className="kicker num">{weekLabel(week)}</span>
      </div>
      <p className="small muted">Une minute pour la semaine écoulée : la décision se prend sur plusieurs jours, pas sur une séance isolée.</p>

      <div className="grid-2">
        <Stepper label="Sommeil moyen" unit="heures par nuit" value={sleep} onChange={setSleep} step={0.5} decimals={1} />
        <div className="field">
          <span className="field-label">Fatigue</span>
          <div className="rpe" role="group" aria-label="Fatigue sur 10" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" aria-pressed={fatigue === n} data-zone={n >= 8 ? 'hard' : undefined} onClick={() => setFatigue(n)} style={{ minHeight: 40, fontSize: 17 }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="field">
        <span className="field-label">Semaine prochaine</span>
        <div className="toggle-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {DECISIONS.map((d) => (
            <button key={d} type="button" aria-pressed={decision === d} onClick={() => setDecision(d)}>
              {DECISION_LABEL[d]}
              {d === suggestion.decision ? ' *' : ''}
            </button>
          ))}
        </div>
        <p className="small">{DECISION_HINT[decision]}</p>
        <p className="small muted">* Conseillé : {suggestion.reason}</p>
        {(fatigue ?? 0) >= 8 && decision === 'advance' && (
          <p className="small" style={{ color: 'var(--blood-bright)' }}>Fatigue élevée : le programme conseille d'alléger plutôt que d'avancer.</p>
        )}
      </div>

      <input className="text-input" placeholder="En une phrase : pourquoi ?" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn--brass btn--block" onClick={save}>
        Valider : {DECISION_LABEL[decision].toLowerCase()}
      </button>
    </section>
  );
}
