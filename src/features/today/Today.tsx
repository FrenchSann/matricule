import { addDays, daysBetween, formatDay, formatShort, weekday, DAY_LONG } from '../../domain/dates';
import { PHASES } from '../../domain/program';
import { RANKS } from '../../domain/ranks';
import { toggleDone, spendJoker } from '../../db/engine';
import type { PlannedSession } from '../../domain/types';
import { Insignia } from '../../ui/Insignia';
import { Flame, Icons, TYPE_CODE } from '../../ui/kit';
import { useUI, type Data } from '../../state';
import { matricule, ROMAN, sessionMeta, WEEK_KIND } from '../labels';

export function Today({ data }: { data: Data }) {
  const { today, week, profile, streak, rank, logs } = data;
  const sessions = data.planned.filter((p) => p.date === today);
  const painLog = [...logs].reverse().find((l) => l.pain && (l.date === today || l.date === addDays(today, -1)));
  const notStarted = profile.startDate > today;
  const exportAge = profile.lastExportAt ? (Date.now() - profile.lastExportAt) / 86_400_000 : Infinity;
  const needsExport = exportAge > 7 && daysBetween(profile.startDate, today) >= 3;
  const todayStatus = data.statuses.get(today);
  const ui = useUI();

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
              <span>Phase {ROMAN[week.phase]}, {PHASES[week.phase].name}</span>
              <span>Semaine {week.weekInPhase}, {WEEK_KIND[week.kind].toLowerCase()}</span>
            </>
          )}
          <span>{RANKS[rank].name}</span>
        </div>
      </header>

      {notStarted && (
        <section className="plate notice notice--brass">
          <h3>Départ le {formatDay(profile.startDate).toLowerCase()}</h3>
          <p className="muted">Le plan de la semaine 1 est prêt dans l'onglet Plan. D'ici là, repos.</p>
        </section>
      )}

      {painLog && (
        <section className="plate plate--alert notice" role="status">
          <h3>Douleur signalée : {painLog.pain!.zone || 'zone non précisée'}</h3>
          <p>
            Repos recommandé aujourd'hui. Les séances non faites ne cassent pas ton streak. Si la douleur persiste
            plus de quelques jours, consulte un médecin.
          </p>
        </section>
      )}

      {week?.kind === 'forced-deload' && (
        <section className="plate plate--alert notice">
          <h3>Semaine allégée imposée</h3>
          <p className="muted">{week.reason} Volume réduit de 35 %.</p>
        </section>
      )}

      {data.checkpointDue && (
        <section className="plate notice notice--brass">
          <h3>Tests de contrôle du mois {data.checkpointDue}</h3>
          <p className="muted">Passe-les cette semaine, reposé. Leur réussite ouvre la phase suivante.</p>
          <button className="btn btn--brass btn--sm" onClick={() => ui.go('dossier')}>
            Voir les tests
          </button>
        </section>
      )}

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
          <SessionPlate key={s.id} session={s} resting={!!painLog} />
        ))}
      </section>

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

function SessionPlate({ session: s, resting }: { session: PlannedSession; resting: boolean }) {
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
        <p className="session-details">{s.details}</p>
        {sessionMeta(s) && s.type === 'marche' && <p className="small">{sessionMeta(s)}</p>}
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
    </article>
  );
}
