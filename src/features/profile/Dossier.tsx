import { useState } from 'react';
import { saveBilan } from '../../db/engine';
import { addWeeks, formatDay, formatDuration, formatShort, parseDuration } from '../../domain/dates';
import { BILAN_KEYS, BILAN_LABEL, bilanValue, filledCount, prefillFromLogs, trend } from '../../domain/bilans';
import { BILAN_WEEKS, plannedS01, sheet } from '../../domain/programme';
import { RANKS, requirementText } from '../../domain/ranks';
import type { BilanRecord, LoadReps } from '../../domain/types';
import { Insignia } from '../../ui/Insignia';
import { MiniStepper, Rule, Sheet, Stepper } from '../../ui/kit';
import type { Data } from '../../state';
import { ExportButton, RestoreButton } from './Backup';

const bilanName = (n: number) => (n === 0 ? 'Repères de départ' : n === 58 ? 'Bilan final S58' : `Bilan S${String(n).padStart(2, '0')}`);
const TREND = { 1: '↑', 0: '=', [-1]: '↓' } as const;

export function Dossier({ data }: { data: Data }) {
  const [editing, setEditing] = useState<number | null>(null);
  const next = RANKS[data.rank + 1];
  const reached = new Set(data.weeks.map((w) => w.programWeek));
  const byWeek = new Map(data.bilans.map((b) => [b.programWeek, b]));
  const ordered = [0, ...BILAN_WEEKS];

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="kicker num">Dossier individuel</p>
        <h1>Grade et bilans</h1>
      </header>

      <section className="plate plate--brass" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18, alignItems: 'center' }}>
        <Insignia rank={data.rank} size={110} />
        <div className="stack stack--tight">
          <h2>{RANKS[data.rank].name}</h2>
          <p className="small muted">
            {data.streak.heldWeeks} semaine{data.streak.heldWeeks > 1 ? 's' : ''} tenue{data.streak.heldWeeks > 1 ? 's' : ''}, {data.bilansDone.size} bilan
            {data.bilansDone.size > 1 ? 's' : ''} noté{data.bilansDone.size > 1 ? 's' : ''}
          </p>
          {next && (
            <p className="small">
              Prochain grade, <b>{next.name}</b> : {requirementText(next)}.
            </p>
          )}
        </div>
      </section>

      <section className="stack">
        <h2>Bilans</h2>
        <p className="small muted">
          Toutes les huit semaines : mesurer sans épuiser la semaine. Pas de seuil inventé : les objectifs se décident après le
          premier bilan. Ne teste pas si tu es malade, douloureux ou sous-récupéré.
        </p>
        {ordered.map((n, i) => {
          const rec = byWeek.get(n);
          const prev = ordered.slice(0, i).map((k) => byWeek.get(k)).filter(Boolean).at(-1);
          const open = n === 0 || reached.has(n) || !!rec;
          const due = data.bilanDue === n;
          return (
            <article key={n} className={`plate stack stack--tight ${due ? 'plate--brass' : ''}`} style={{ opacity: open ? 1 : 0.5 }}>
              <div className="row row--between">
                <h3>{bilanName(n)}</h3>
                <span className="small muted">
                  {rec ? formatShort(rec.date) : n === 0 ? `avant le ${formatShort(plannedS01(data.profile))}` : `prévu sem. du ${formatShort(sheet(n).from)}`}
                </span>
              </div>
              {rec && filledCount(rec) > 0 && (
                <div className="bilan-grid">
                  {BILAN_KEYS.map((k) => {
                    const v = bilanValue(rec, k);
                    if (v === '—') return null;
                    const t = trend(prev, rec, k);
                    return (
                      <div key={k}>
                        <span className="small muted">{BILAN_LABEL[k]}</span>
                        <span className="num">
                          {v} {t !== null && <span className={`trend trend--${t}`}>{TREND[t]}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {open && (
                <button className={`btn btn--sm ${due ? 'btn--primary' : ''}`} onClick={() => setEditing(n)}>
                  {rec ? 'Modifier' : 'Noter les mesures'}
                </button>
              )}
            </article>
          );
        })}
        <p className="small muted">Ne compare pas un palier Luc Léger et une distance en six minutes. En S58, refais le même test qu'en S56.</p>
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
        <h2>Programme</h2>
        <p className="small muted">
          Programme hybride 58 semaines, démarré le {formatDay(data.profile.startDate).toLowerCase()}
          {data.profile.entryWeeks ? ` avec ${data.profile.entryWeeks} semaines d'adaptation` : ''}. Jours, variantes d'exercices et
          créneaux : onglet Plan, puis Personnaliser le programme.
        </p>
        <p className="small muted">
          Ce plan prépare des qualités physiques utiles à un projet militaire ; ce n'est ni un programme officiel des forces
          spéciales, ni une garantie d'aptitude. Fais vérifier les mouvements lourds par un entraîneur.
        </p>
      </section>

      {editing !== null && <BilanSheet data={data} programWeek={editing} existing={byWeek.get(editing)} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LoadRepsField({ label, value, onChange }: { label: string; value?: LoadReps; onChange: (v: LoadReps) => void }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="grid-2" style={{ gap: 6 }}>
        <MiniStepper label={`${label} : charge`} value={value?.kg} onChange={(kg) => onChange({ ...value, kg })} step={1} decimals={1} suffix="kg" placeholder="kg" />
        <MiniStepper label={`${label} : répétitions`} value={value?.reps} onChange={(reps) => onChange({ ...value, reps })} suffix="reps" />
      </div>
    </div>
  );
}

function BilanSheet({ data, programWeek, existing, onClose }: { data: Data; programWeek: number; existing?: BilanRecord; onClose: () => void }) {
  // Pré-remplissage avec le journal de la semaine de bilan.
  const week = [...data.weeks].reverse().find((w) => w.programWeek === programWeek && w.kind === 'bilan');
  const weekLogs = week ? data.logs.filter((l) => l.date >= week.weekStart && l.date < addWeeks(week.weekStart, 1)) : [];
  const defaultTest: BilanRecord['runTest'] = programWeek > 0 && /Luc Léger/.test(sheet(programWeek).run.thursday.text) ? 'luc-leger' : '6min';

  const [b, setB] = useState<BilanRecord>(
    existing ?? { programWeek, date: data.today, runTest: defaultTest, sleepH: week?.checkin?.sleepH, ...prefillFromLogs(weekLogs) },
  );
  const [swim, setSwim] = useState(b.swim400Sec !== undefined ? formatDuration(b.swim400Sec) : '');
  const set = (patch: Partial<BilanRecord>) => setB((cur) => ({ ...cur, ...patch }));
  const swimInvalid = swim !== '' && parseDuration(swim) === null;

  const save = async () => {
    await saveBilan({ ...b, swim400Sec: parseDuration(swim) ?? undefined });
    onClose();
  };

  return (
    <Sheet title={bilanName(programWeek)} onClose={onClose}>
      <div className="stack" style={{ gap: 16 }}>
        {weekLogs.length > 0 && !existing && <p className="small muted">Pré-rempli avec ton journal de la semaine. Vérifie avant d'enregistrer.</p>}
        <Stepper label="Tractions propres (série de référence)" value={b.pullups} onChange={(pullups) => set({ pullups })} />

        <div className="field">
          <span className="field-label">Course</span>
          <div className="toggle-row">
            <button aria-pressed={b.runTest === '6min'} onClick={() => set({ runTest: '6min' })}>Test de 6 min</button>
            <button aria-pressed={b.runTest === 'luc-leger'} onClick={() => set({ runTest: 'luc-leger' })}>Luc Léger</button>
          </div>
          {b.runTest === '6min' ? (
            <Stepper label="Distance en 6 min" unit="mètres ; vitesse moyenne (km/h) = distance ÷ 100" value={b.runValue} onChange={(runValue) => set({ runValue })} step={10} />
          ) : (
            <Stepper label="Dernier palier validé" unit="palier" value={b.runValue} onChange={(runValue) => set({ runValue })} step={0.5} decimals={1} />
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="swim400">400 m crawl</label>
          <input id="swim400" className="text-input num" style={{ fontSize: 'var(--step-1)' }} inputMode="numeric" placeholder="mm:ss" value={swim} onChange={(e) => setSwim(e.target.value)} />
          {swimInvalid && <span className="small" style={{ color: 'var(--blood-bright)' }}>Format attendu : mm:ss</span>}
        </div>

        <LoadRepsField label="Développé couché" value={b.bench} onChange={(bench) => set({ bench })} />
        <LoadRepsField label="Squat" value={b.squat} onChange={(squat) => set({ squat })} />
        <LoadRepsField label="Développé épaules" value={b.ohp} onChange={(ohp) => set({ ohp })} />
        <LoadRepsField label="Trap bar" value={b.trapbar} onChange={(trapbar) => set({ trapbar })} />
        <p className="small muted">Charge × répétitions à effort sous-maximal comparable. Aucun test de 1RM.</p>

        <Stepper label="Sommeil moyen" unit="heures par nuit" value={b.sleepH} onChange={(sleepH) => set({ sleepH })} step={0.5} decimals={1} />
        <div className="field">
          <label className="field-label" htmlFor="bilan-note">Conditions, ressenti</label>
          <textarea id="bilan-note" className="text-input" value={b.note ?? ''} onChange={(e) => set({ note: e.target.value || undefined })} />
        </div>

        <div className="form-footer">
          <button className="btn btn--primary btn--block" disabled={swimInvalid} onClick={save}>
            Enregistrer le bilan
          </button>
        </div>
      </div>
    </Sheet>
  );
}
