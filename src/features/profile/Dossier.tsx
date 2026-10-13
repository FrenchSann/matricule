import { useState } from 'react';
import { db } from '../../db/schema';
import { chooseExtension, recordCheckpoint } from '../../db/engine';
import { addWeeks, DAY_SHORT, formatDay, formatDuration, parseDuration } from '../../domain/dates';
import { TEST_KEYS, TEST_LABEL } from '../../domain/checkpoints';
import { CHECKPOINT_PHASE, checkpointDueDate, PHASES, phaseLength } from '../../domain/program';
import { RANKS, requirementText } from '../../domain/ranks';
import type { CheckpointMonth, CheckpointRecord, TestKey, TestResults, TestTargets } from '../../domain/types';
import { Insignia } from '../../ui/Insignia';
import { Rule, Sheet, Stepper } from '../../ui/kit';
import type { Data } from '../../state';
import { ROMAN } from '../labels';
import { ExportButton, RestoreButton } from './Backup';

const MONTHS: CheckpointMonth[] = [4, 8, 12, 14];
const endSentence = (s: string) => (s.endsWith('.') ? s : `${s}.`);

export function targetText(key: TestKey, t: TestTargets): string {
  switch (key) {
    case 'course': return `${t.courseKm} km en ${formatDuration(t.courseSec)} max`;
    case 'tractions': return `${t.tractions} répétitions min`;
    case 'marche': return `${t.marcheKm} km avec ${t.marcheKg} kg en ${formatDuration(t.marcheSec)} max`;
    case 'natation': return `${t.natationM} m en ${formatDuration(t.natationSec)} max`;
    case 'corde': return t.cordeSansJambes ? 'Montée sans les jambes' : 'Montée avec les jambes';
  }
}

function resultText(key: TestKey, r: TestResults): string {
  switch (key) {
    case 'course': return r.courseSec !== undefined ? formatDuration(r.courseSec) : '—';
    case 'tractions': return r.tractions !== undefined ? String(r.tractions) : '—';
    case 'marche': return r.marcheSec !== undefined ? formatDuration(r.marcheSec) : '—';
    case 'natation': return r.natationSec !== undefined ? formatDuration(r.natationSec) : '—';
    case 'corde': return r.corde ? 'Réussie' : 'Échouée';
  }
}

export function Dossier({ data }: { data: Data }) {
  const [testMonth, setTestMonth] = useState<CheckpointMonth | null>(null);
  const [targetsMonth, setTargetsMonth] = useState<CheckpointMonth | null>(null);
  const next = RANKS[data.rank + 1];

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="kicker num">Dossier individuel</p>
        <h1>Grade et tests</h1>
      </header>

      <section className="plate plate--brass" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18, alignItems: 'center' }}>
        <Insignia rank={data.rank} size={110} />
        <div className="stack stack--tight">
          <h2>{RANKS[data.rank].name}</h2>
          <p className="small muted">{data.streak.heldWeeks} semaine{data.streak.heldWeeks > 1 ? 's' : ''} tenue{data.streak.heldWeeks > 1 ? 's' : ''}</p>
          {next && (
            <p className="small">
              Prochain grade, <b>{next.name}</b> : {requirementText(next)}.
            </p>
          )}
        </div>
      </section>

      <section className="stack">
        <h2>Tests de contrôle</h2>
        {MONTHS.map((m) => {
          const phase = CHECKPOINT_PHASE[m];
          const records = data.checkpoints.filter((c) => c.month === m);
          const last = records.at(-1);
          const passed = data.passed.has(m);
          const due = checkpointDueDate(data.profile, phase);
          const open = data.checkpointDue === m;
          return (
            <article key={m} className={`plate stack stack--tight ${open ? 'plate--brass' : ''}`}>
              <div className="row row--between">
                <h3>Fin du mois {m}</h3>
                <span className={`result-mark ${passed ? 'result-mark--ok' : last ? 'result-mark--ko' : ''}`}>
                  {passed ? 'Validé' : last ? 'À repasser' : open ? 'Ouvert' : ''}
                </span>
              </div>
              <p className="small muted">
                {endSentence(
                  `Phase ${ROMAN[phase]}, ${PHASES[phase].name}` +
                    (data.profile.extensions[phase] ? `, prolongée de ${data.profile.extensions[phase]} semaines` : '') +
                    (due && !passed ? `. Échéance : semaine du ${formatDay(addWeeks(due, -1)).toLowerCase()}` : ''),
                )}
              </p>
              {(last ? TEST_KEYS : []).map((k) => (
                <div key={k} className="result">
                  <span>{TEST_LABEL[k]}<br /><span className="small muted">{targetText(k, data.profile.targets[m])}</span></span>
                  <span className={`result-mark ${last!.passed[k] ? 'result-mark--ok' : 'result-mark--ko'}`}>{resultText(k, last!.results)}</span>
                </div>
              ))}
              {last && !passed && !last.extensionWeeks && <ExtensionChoice record={last} />}
              <div className="grid-2" style={{ marginTop: 6 }}>
                {open && <button className="btn btn--primary btn--sm" onClick={() => setTestMonth(m)}>Saisir les résultats</button>}
                {!passed && <button className="btn btn--sm" onClick={() => setTargetsMonth(m)}>Voir les cibles</button>}
              </div>
            </article>
          );
        })}
        <p className="small muted">Cibles indicatives, modifiables. Vérifie les barèmes officiels auprès du CIRFA.</p>
      </section>

      <section className="stack">
        <h2>Grades</h2>
        <div className="ranks">
          {RANKS.map((r, i) => (
            <div key={r.name} className={`rank-row ${i > data.rank ? 'rank-row--locked' : ''} ${i === data.rank ? 'rank-row--current' : ''}`}>
              <Insignia rank={i} size={56} locked={i > data.rank} />
              <div>
                <div className="rank-name">{r.name}</div>
                <div className="small muted">{i === 0 ? 'Grade de départ' : requirementText(r)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Rule />

      <section className="stack">
        <h2>Sauvegarde</h2>
        <p className="small muted">
          Tes données restent sur ce téléphone. iOS peut les effacer si l'app n'est pas ouverte pendant plusieurs semaines :
          exporte une sauvegarde chaque semaine et range-la dans Fichiers.
          {data.profile.lastExportAt ? ` Dernier export : ${new Date(data.profile.lastExportAt).toLocaleDateString('fr-FR')}.` : ''}
        </p>
        <ExportButton />
        <RestoreButton />
      </section>

      <section className="stack">
        <h2>Réglages</h2>
        <div className="field">
          <span className="field-label">Jours de grappling (appliqué aux prochaines semaines)</span>
          <div className="chips chips--days">
            {DAY_SHORT.map((d, i) => {
              const on = data.profile.grapplingDays.includes(i);
              return (
                <button
                  key={d}
                  className="chip"
                  aria-pressed={on}
                  onClick={() =>
                    db.profile.update('me', {
                      grapplingDays: on ? data.profile.grapplingDays.filter((x) => x !== i) : [...data.profile.grapplingDays, i].sort(),
                    })
                  }
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <p className="small muted">
          Programme démarré le {formatDay(data.profile.startDate).toLowerCase()}. Phase {ROMAN[data.phase]} : {phaseLength(data.profile, data.phase)} semaines prévues.
        </p>
      </section>

      {testMonth && <CheckpointSheet data={data} month={testMonth} onClose={() => setTestMonth(null)} />}
      {targetsMonth && <TargetsSheet data={data} month={targetsMonth} onClose={() => setTargetsMonth(null)} />}
    </div>
  );
}

function ExtensionChoice({ record }: { record: CheckpointRecord }) {
  return (
    <div className="stack stack--tight" style={{ marginTop: 8 }}>
      <p className="small">Un test manqué : prolonge la phase pour consolider, puis repasse les tests.</p>
      <div className="grid-2">
        <button className="btn btn--brass btn--sm" onClick={() => chooseExtension(record, 3)}>+3 semaines</button>
        <button className="btn btn--brass btn--sm" onClick={() => chooseExtension(record, 4)}>+4 semaines</button>
      </div>
    </div>
  );
}

function TimeField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint: string }) {
  const invalid = value !== '' && parseDuration(value) === null;
  return (
    <div className="field">
      <label className="field-label">
        {label}
        <input className="text-input num" style={{ fontSize: 'var(--step-1)' }} inputMode="numeric" placeholder={hint} value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
      {invalid && <span className="small" style={{ color: 'var(--blood-bright)' }}>Format attendu : {hint}</span>}
    </div>
  );
}

function CheckpointSheet({ data, month, onClose }: { data: Data; month: CheckpointMonth; onClose: () => void }) {
  const t = data.profile.targets[month];
  const [course, setCourse] = useState('');
  const [tractions, setTractions] = useState<number | undefined>();
  const [marche, setMarche] = useState('');
  const [natation, setNatation] = useState('');
  const [corde, setCorde] = useState<boolean | null>(null);
  const [result, setResult] = useState<CheckpointRecord | null>(null);

  const submit = async () => {
    const results: TestResults = {
      courseSec: parseDuration(course) ?? undefined,
      tractions,
      marcheSec: parseDuration(marche) ?? undefined,
      natationSec: parseDuration(natation) ?? undefined,
      corde: corde ?? false,
    };
    setResult(await recordCheckpoint(month, data.today, results));
  };

  if (result) {
    return (
      <Sheet title={result.allPassed ? 'Tests validés' : 'Tests à repasser'} onClose={onClose}>
        <div className="stack">
          {TEST_KEYS.map((k) => (
            <div key={k} className="result">
              <span>{TEST_LABEL[k]}</span>
              <span className={`result-mark ${result.passed[k] ? 'result-mark--ok' : 'result-mark--ko'}`}>{result.passed[k] ? 'Réussi' : 'Manqué'}</span>
            </div>
          ))}
          {result.allPassed ? (
            <p>{month === 14 ? "Dernier contrôle validé. Place au pic de forme, puis à l'affûtage." : `La phase ${ROMAN[CHECKPOINT_PHASE[month] + 1]} s'ouvre à la fin de la phase en cours.`}</p>
          ) : (
            <ExtensionChoice record={result} />
          )}
          <button className="btn btn--ghost btn--block" onClick={onClose}>Fermer</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={`Tests du mois ${month}`} onClose={onClose}>
      <div className="stack" style={{ gap: 16 }}>
        <TimeField label={`Course ${t.courseKm} km (cible ${formatDuration(t.courseSec)})`} hint="mm:ss" value={course} onChange={setCourse} />
        <Stepper label={`Tractions strictes (cible ${t.tractions})`} value={tractions} onChange={setTractions} />
        <TimeField label={`Marche ${t.marcheKm} km, ${t.marcheKg} kg (cible ${formatDuration(t.marcheSec)})`} hint="h:mm:ss" value={marche} onChange={setMarche} />
        <TimeField label={`Natation ${t.natationM} m (cible ${formatDuration(t.natationSec)})`} hint="mm:ss" value={natation} onChange={setNatation} />
        <div className="field">
          <span className="field-label">Corde 7 m, {t.cordeSansJambes ? 'sans les jambes' : 'avec les jambes'}</span>
          <div className="toggle-row">
            <button aria-pressed={corde === true} onClick={() => setCorde(true)}>Réussie</button>
            <button className="is-alert" aria-pressed={corde === false} onClick={() => setCorde(false)}>Échouée</button>
          </div>
        </div>
        <div className="form-footer">
          <button className="btn btn--primary btn--block" onClick={submit}>Enregistrer les résultats</button>
        </div>
      </div>
    </Sheet>
  );
}

function TargetsSheet({ data, month, onClose }: { data: Data; month: CheckpointMonth; onClose: () => void }) {
  const [t, setT] = useState<TestTargets>(data.profile.targets[month]);
  const [course, setCourse] = useState(formatDuration(t.courseSec));
  const [marche, setMarche] = useState(formatDuration(t.marcheSec));
  const [natation, setNatation] = useState(formatDuration(t.natationSec));

  const save = async () => {
    const next: TestTargets = {
      ...t,
      courseSec: parseDuration(course) ?? t.courseSec,
      marcheSec: parseDuration(marche) ?? t.marcheSec,
      natationSec: parseDuration(natation) ?? t.natationSec,
    };
    await db.profile.update('me', { targets: { ...data.profile.targets, [month]: next } });
    onClose();
  };

  return (
    <Sheet title={`Cibles du mois ${month}`} onClose={onClose}>
      <div className="stack" style={{ gap: 16 }}>
        <div className="grid-2">
          <Stepper label="Course" unit="km" value={t.courseKm} onChange={(v) => setT({ ...t, courseKm: v ?? 0 })} step={0.5} decimals={1} />
          <TimeField label="Temps max" hint="mm:ss" value={course} onChange={setCourse} />
        </div>
        <Stepper label="Tractions strictes" unit="répétitions" value={t.tractions} onChange={(v) => setT({ ...t, tractions: v ?? 0 })} />
        <div className="grid-2">
          <Stepper label="Marche" unit="km" value={t.marcheKm} onChange={(v) => setT({ ...t, marcheKm: v ?? 0 })} />
          <Stepper label="Sac" unit="kg" value={t.marcheKg} onChange={(v) => setT({ ...t, marcheKg: v ?? 0 })} />
        </div>
        <TimeField label="Marche : temps max" hint="h:mm:ss" value={marche} onChange={setMarche} />
        <div className="grid-2">
          <Stepper label="Natation" unit="mètres" value={t.natationM} onChange={(v) => setT({ ...t, natationM: v ?? 0 })} step={50} />
          <TimeField label="Temps max" hint="mm:ss" value={natation} onChange={setNatation} />
        </div>
        <div className="field">
          <span className="field-label">Corde 7 m</span>
          <div className="toggle-row">
            <button aria-pressed={!t.cordeSansJambes} onClick={() => setT({ ...t, cordeSansJambes: false })}>Avec les jambes</button>
            <button aria-pressed={t.cordeSansJambes} onClick={() => setT({ ...t, cordeSansJambes: true })}>Sans les jambes</button>
          </div>
        </div>
        <div className="form-footer">
          <button className="btn btn--primary btn--block" onClick={save}>Enregistrer les cibles</button>
        </div>
      </div>
    </Sheet>
  );
}
