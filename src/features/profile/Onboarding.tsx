import { useState } from 'react';
import { createProgram } from '../../db/engine';
import { addWeeks, DAY_SHORT, formatDay, mondayOf, today } from '../../domain/dates';
import { BLOCKS, DEFAULT_GRAPPLING_DAYS, sheet } from '../../domain/programme';
import { Insignia } from '../../ui/Insignia';
import { Rule } from '../../ui/kit';
import { RestoreButton } from './Backup';

export function Onboarding() {
  const thisMonday = mondayOf(today());
  const nextMonday = addWeeks(thisMonday, 1);
  const pdfStart = sheet(1).from; // lundi 19 octobre 2026
  const [start, setStart] = useState(pdfStart > thisMonday ? pdfStart : nextMonday);
  const [entry, setEntry] = useState(0);
  const [days, setDays] = useState<number[]>(DEFAULT_GRAPPLING_DAYS);
  const [busy, setBusy] = useState(false);

  const toggle = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
  const s01 = addWeeks(start, entry);

  return (
    <main className="app">
      <div className="screen">
        <header className="screen-head" style={{ justifyItems: 'center', textAlign: 'center', paddingTop: 24 }}>
          <div className="intro">
            <svg className="intro-reticle" viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="92" pathLength={1} />
              <circle cx="100" cy="100" r="64" pathLength={1} />
              <path d="M100 0v46M100 154v46M0 100h46M154 100h46" pathLength={1} />
              <path d="M88 30h24M88 170h24M30 88v24M170 88v24" pathLength={1} />
            </svg>
            <Insignia rank={0} size={96} motion="idle" />
          </div>
          <h1 className="intro-title" style={{ fontSize: 'var(--step-4)' }}>Matricule</h1>
          <p className="muted">Programme hybride : 58 semaines pour construire, mesurer, ajuster.</p>
        </header>

        <Rule />

        <ol className="stack stack--tight" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {BLOCKS.map((b) => (
            <li key={b.name} className="row" style={{ alignItems: 'baseline' }}>
              <span className="num kicker" style={{ minWidth: 64 }}>
                {b.from === b.to ? `S${b.from}` : `S${String(b.from).padStart(2, '0')}-${String(b.to).padStart(2, '0')}`}
              </span>
              <span>
                <b>{b.name}</b> <span className="muted small">{b.goal}</span>
              </span>
            </li>
          ))}
        </ol>

        <section className="plate stack">
          <div className="field">
            <span className="field-label">Début</span>
            <div className="toggle-row">
              <button aria-pressed={start === thisMonday} onClick={() => setStart(thisMonday)}>
                Cette semaine
              </button>
              <button aria-pressed={start === nextMonday} onClick={() => setStart(nextMonday)}>
                Lundi prochain
              </button>
            </div>
          </div>

          <div className="field">
            <span className="field-label">Version d'entrée avant S01</span>
            <div className="chips chips--days" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {[0, 2, 3, 4].map((n) => (
                <button key={n} className="chip" aria-pressed={entry === n} onClick={() => setEntry(n)}>
                  {n === 0 ? 'Aucune' : `${n} sem.`}
                </button>
              ))}
            </div>
            <span className="small muted">
              Si tu ne tiens pas encore 3 salles, 3 grapplings, 20-25 min de footing et environ 1 200 m de natation : 2 séries
              par exercice à RIR 4 et cardio court pendant 2 à 4 semaines.
            </span>
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
            <span className="small muted">Programme : lundi 19 h, mercredi 20 h 30, samedi 15 h.</span>
          </div>

          <p className="small">
            S01 commence le <b>{formatDay(s01).toLowerCase()}</b>
            {s01 === pdfStart ? ', comme prévu par le programme.' : '. Les dates du programme se décalent d’autant.'}
          </p>
        </section>

        <button
          className="btn btn--primary btn--block"
          onClick={async () => {
            setBusy(true);
            await createProgram(start, days, entry);
          }}
          disabled={busy || days.length === 0}
        >
          Ouvrir le carnet
        </button>
        <RestoreButton label="Restaurer une sauvegarde" />
      </div>
    </main>
  );
}
