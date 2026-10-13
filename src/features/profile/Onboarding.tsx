import { useState } from 'react';
import { createProgram } from '../../db/engine';
import { addWeeks, DAY_SHORT, formatDay, mondayOf, today } from '../../domain/dates';
import { PHASES } from '../../domain/program';
import { Insignia } from '../../ui/Insignia';
import { Rule } from '../../ui/kit';
import { RestoreButton } from './Backup';

export function Onboarding() {
  const thisMonday = mondayOf(today());
  const [start, setStart] = useState(thisMonday);
  const [days, setDays] = useState<number[]>([0, 2, 4]);
  const [busy, setBusy] = useState(false);

  const toggle = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  const begin = async () => {
    setBusy(true);
    await createProgram(start, days);
  };

  return (
    <main className="app">
      <div className="screen">
        <header className="screen-head" style={{ justifyItems: 'center', textAlign: 'center', paddingTop: 24 }}>
          <Insignia rank={0} size={96} />
          <h1 style={{ fontSize: 'var(--step-4)' }}>Matricule</h1>
          <p className="muted">Carnet de préparation à la sélection. Quinze mois, quatre phases.</p>
        </header>

        <Rule />

        <ol className="stack" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {([1, 2, 3, 4] as const).map((p) => (
            <li key={p} className="row" style={{ alignItems: 'baseline' }}>
              <span className="num kicker" style={{ minWidth: 28 }}>{['I', 'II', 'III', 'IV'][p - 1]}</span>
              <span>
                <b>{PHASES[p].name}</b> <span className="muted small">{PHASES[p].months}</span>
              </span>
            </li>
          ))}
        </ol>

        <section className="plate stack">
          <div className="field">
            <span className="field-label">Début du programme</span>
            <div className="toggle-row">
              <button aria-pressed={start === thisMonday} onClick={() => setStart(thisMonday)}>
                Cette semaine
              </button>
              <button aria-pressed={start === addWeeks(thisMonday, 1)} onClick={() => setStart(addWeeks(thisMonday, 1))}>
                Lundi prochain
              </button>
            </div>
            <span className="small muted">Semaine 1 : à partir du {formatDay(start).toLowerCase()}</span>
          </div>

          <div className="field">
            <span className="field-label">Jours de grappling au club</span>
            <div className="chips chips--days">
              {DAY_SHORT.map((d, i) => (
                <button key={d} className="chip" aria-pressed={days.includes(i)} onClick={() => toggle(i)}>
                  {d}
                </button>
              ))}
            </div>
            <span className="small muted">Le plan s'organise autour de ces séances. Modifiable plus tard.</span>
          </div>
        </section>

        <button className="btn btn--primary btn--block" onClick={begin} disabled={busy || days.length === 0}>
          Ouvrir le carnet
        </button>
        <RestoreButton label="Restaurer une sauvegarde" />
      </div>
    </main>
  );
}
