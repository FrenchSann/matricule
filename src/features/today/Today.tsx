import { addDays, addWeeks, daysBetween, DAY_LONG, formatDay, formatShort, weekday } from '../../domain/dates';
import { blockOf, fourthGrapplingBlocker, sheet } from '../../domain/programme';
import { RANKS } from '../../domain/ranks';
import { exerciseHistory, suggestLoad } from '../../domain/strength';
import { setFourthGrappling, spendJoker, swapAlternative, toggleDone } from '../../db/engine';
import type { ExercisePrescription, LogEntry, PlannedSession } from '../../domain/types';
import { Insignia } from '../../ui/Insignia';
import { Flame, Icons, TYPE_CODE } from '../../ui/kit';
import { useUI, type Data } from '../../state';
import { hours, matricule, prescriptionText, weekLabel, WEEK_KIND } from '../labels';
import { CheckinCard } from './CheckinCard';

export function Today({ data }: { data: Data }) {
  const { today, week, profile, streak, rank, logs } = data;
  const ui = useUI();
  const sessions = data.planned.filter((p) => p.date === today);
  const painLog = [...logs].reverse().find((l) => l.pain && (l.date === today || l.date === addDays(today, -1)));
  const notStarted = profile.startDate > today;
  const exportAge = profile.lastExportAt ? (Date.now() - profile.lastExportAt) / 86_400_000 : Infinity;
  const needsExport = exportAge > 7 && daysBetween(profile.startDate, today) >= 3;
  const todayStatus = data.statuses.get(today);
  const block = week ? blockOf(week.programWeek) : data.block;

  const prevWeek = week ? data.weeks.find((w) => w.weekStart === addWeeks(week.weekStart, -1)) : undefined;
  const fourthBlocker = week ? fourthGrapplingBlocker(week, prevWeek, data.planned) : 'Aucune semaine en cours.';

  return (
    <div className="screen">
      <header className="orders">
        <div>
          <p className="kicker num">Matricule {matricule(week, today)}</p>
          <h1>Ordre du jour</h1>
        </div>
        <Insignia rank={rank} size={78} />
        <div className="orders-meta">
          <span><b>{formatDay(today)}</b></span>
          {week && (
            <>
              <span>{weekLabel(week)}, {block.name}</span>
              <span>{WEEK_KIND[week.kind]}</span>
              <span>{hours(week.totalMin)} prévues</span>
            </>
          )}
          <span>{RANKS[rank].name}</span>
        </div>
      </header>

      {data.programDone && (
        <section className="plate notice notice--brass">
          <h3>Programme terminé</h3>
          <p className="muted">
            58 semaines bouclées. Sans sélection proche : une semaine légère, puis un nouveau bloc choisi selon ton point faible
            mesuré. Sélection proche : garde la fraîcheur et confirme les épreuves exactes.
          </p>
        </section>
      )}

      {notStarted && (
        <section className="plate notice notice--brass">
          <h3>Départ le {formatDay(profile.startDate).toLowerCase()}</h3>
          <p className="muted">
            La semaine 1 est prête dans l'onglet Plan. D'ici là, note tes repères de départ dans Dossier : tractions, 400 m crawl,
            charges au couché et au squat.
          </p>
        </section>
      )}

      {painLog && (
        <section className="plate plate--alert notice" role="status">
          <h3>Douleur signalée : {painLog.pain!.zone || 'zone non précisée'}</h3>
          <p>
            Feu rouge si elle modifie le mouvement : arrête la séance concernée. Repos recommandé, les séances non faites ne cassent
            pas ton streak. Si elle persiste, fais-la évaluer.
          </p>
        </section>
      )}

      {week && (week.kind === 'forced-deload' || week.kind === 'repeat') && (
        <section className="plate plate--alert notice">
          <h3>{week.kind === 'repeat' ? `${weekLabel(week)} répétée` : `Semaine allégée (fiche ${weekLabel(week)})`}</h3>
          <p className="muted">{week.reason}</p>
        </section>
      )}

      {data.bilanDue !== null && (
        <section className="plate notice notice--brass">
          <h3>Semaine de bilan</h3>
          <p className="muted">
            Lundi tractions, mercredi squat, jeudi course, vendredi épaules et trap bar, samedi 400 m crawl. Ne teste pas si tu es
            malade, douloureux ou sous-récupéré.
          </p>
          <button className="btn btn--brass btn--sm" onClick={() => ui.go('dossier')}>
            Noter les mesures
          </button>
        </section>
      )}

      {data.checkin && <CheckinCard week={data.checkin.week} suggestion={data.checkin.suggestion} />}

      <StreakPlate data={data} />

      {data.jokerDays.length > 0 && (
        <section className="plate notice notice--brass">
          <h3>Plan non tenu récemment</h3>
          <p className="muted">
            Un imprévu ? Un joker garde ton streak intact. {streak.jokersAvailable} disponible{streak.jokersAvailable > 1 ? 's' : ''}.
          </p>
          <div className="chips">
            {data.jokerDays.map((d) => (
              <button key={d} className="btn btn--brass btn--sm" onClick={() => spendJoker(d)}>
                Joker pour {DAY_LONG[weekday(d)].toLowerCase()} {formatShort(d)}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="stack">
        <div className="row row--between">
          <h2>Au programme</h2>
          {todayStatus === 'done' && <span className="kicker">Plan du jour tenu</span>}
        </div>
        {sessions.length === 0 && <p className="empty">Rien de prévu. Profite du repos.</p>}
        {sessions.map((s) => (
          <SessionPlate key={s.id} session={s} resting={!!painLog} logs={logs} fourthBlocker={s.slotId === 'thursday' ? fourthBlocker : undefined} />
        ))}
        {week?.fourthGrappling && sessions.some((s) => s.slotId === 'grappling4' && s.status !== 'done') && (
          <button className="btn btn--ghost btn--block" onClick={() => setFourthGrappling(week.weekStart, false)}>
            Revenir à la course du jeudi et à la piscine
          </button>
        )}
      </section>

      {week && week.programWeek > 0 && sheet(week.programWeek).consigne && (
        <section className="plate notice">
          <h3>Consigne de la semaine</h3>
          <p className="muted small">{sheet(week.programWeek).consigne}</p>
        </section>
      )}

      {needsExport && (
        <section className="plate notice">
          <h3>Pense à sauvegarder</h3>
          <p className="muted">
            {profile.lastExportAt ? `Dernier export il y a ${Math.floor(exportAge)} jours.` : 'Aucune sauvegarde pour le moment.'} iOS
            peut effacer les données d'une app peu ouverte.
          </p>
          <button className="btn btn--brass btn--sm" onClick={() => ui.go('dossier')}>
            Aller à la sauvegarde
          </button>
        </section>
      )}
    </div>
  );
}

function StreakPlate({ data }: { data: Data }) {
  const { current, best, jokersAvailable } = data.streak;
  return (
    <section className="plate plate--brass streak" aria-label="Streak">
      <Flame lit={current > 0} />
      <div className="streak-label">
        <span className="num streak-count">{current}</span>
        <p>jour{current > 1 ? 's' : ''} de plan tenu</p>
        <p className="small muted">Record : {best}</p>
      </div>
      <div className="jokers" title="Jokers disponibles">
        <span className="num">{jokersAvailable}</span>
        <span>joker{jokersAvailable > 1 ? 's' : ''}</span>
      </div>
    </section>
  );
}

function SessionPlate({
  session: s,
  resting,
  logs,
  fourthBlocker,
}: {
  session: PlannedSession;
  resting: boolean;
  logs: LogEntry[];
  fourthBlocker?: string | null;
}) {
  const ui = useUI();
  const done = s.status === 'done';
  const isRest = s.type === 'repos';

  const check = async () => {
    await toggleDone(s);
    if (!done) ui.stamp();
  };

  return (
    <article className={`plate session ${done ? 'session--done' : ''} ${isRest ? 'session--repos' : ''}`}>
      <span className="session-code" aria-hidden="true">{TYPE_CODE[s.type]}</span>
      <div className="session-title">
        <span>{s.title}</span>
        {s.targets.durationMin ? <span className="num">{s.targets.durationMin}′</span> : null}
      </div>
      <div className="stack stack--tight">
        {s.time && <p className="small kicker num">{s.time}</p>}
        <p className="session-details">{s.details}</p>
        {s.type === 'marche' && s.targets.loadKg ? <p className="small">Sac {s.targets.loadKg} kg maximum, ou sans charge.</p> : null}
        {s.exercises?.length && !done ? <ExerciseList exercises={s.exercises} history={logs.filter((l) => l.date < s.date)} /> : null}
        {isRest && <p className="small" style={{ color: 'var(--brass-bright)' }}>Repos prévu : le respecter compte comme un jour tenu.</p>}
      </div>
      {!isRest && (
        <div className="session-actions">
          {done ? (
            <button className="btn btn--sm" onClick={() => ui.openLog(s)}>
              Compléter le ressenti
            </button>
          ) : (
            <button className={`btn ${resting ? '' : 'btn--primary'}`} onClick={() => ui.openLog(s)}>
              Consigner
            </button>
          )}
          <button className="check" aria-pressed={done} aria-label={done ? 'Marquer comme non faite' : 'Marquer comme faite'} onClick={check}>
            {Icons.check}
          </button>
        </div>
      )}
      {!done && s.alternative && (
        <button className="btn btn--ghost btn--sm" style={{ gridColumn: '1 / -1' }} onClick={() => swapAlternative(s.id!)}>
          Option : {s.alternative.title.toLowerCase()} à la place
        </button>
      )}
      {!done && fourthBlocker === null && (
        <button className="btn btn--ghost btn--sm" style={{ gridColumn: '1 / -1' }} onClick={() => setFourthGrappling(s.weekStart, true)}>
          Option : 4e grappling (20 h 20) à la place, sans piscine samedi
        </button>
      )}
    </article>
  );
}

/** Exercices prévus, avec la charge et les répétitions visées d'après l'historique. */
function ExerciseList({ exercises, history }: { exercises: ExercisePrescription[]; history: LogEntry[] }) {
  return (
    <ul className="ex-list">
      {exercises.map((e) => {
        const sug = suggestLoad(exerciseHistory(history, e.name), e);
        const seen = exerciseHistory(history, e.name).length > 0;
        return (
          <li key={e.name}>
            <span>{e.name}</span>
            <span className="num">
              {prescriptionText(e)}
              {sug.kg ? ` · ${String(sug.kg).replace('.', ',')} kg` : ''}
              {seen && (e.unit ?? 'reps') === 'reps' ? ` · vise ${sug.reps}` : ''}
              {sug.reason === 'progress' ? ' ↑' : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
