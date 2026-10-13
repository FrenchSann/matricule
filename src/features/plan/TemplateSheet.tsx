import { useState } from 'react';
import { db } from '../../db/schema';
import { applyTemplateToWeek, resetTemplate, saveTemplate } from '../../db/engine';
import { DAY_LONG, DAY_SHORT, type ISODate } from '../../domain/dates';
import { AUTO_DETAILS, itemDuration, PHASES, shareForMinutes, templateFor } from '../../domain/program';
import type { Phase, TemplateItem } from '../../domain/types';
import { Sheet, TYPE_CODE } from '../../ui/kit';
import type { Data } from '../../state';
import { ROMAN } from '../labels';
import { SessionEditor, type EditorValue } from './SessionEditor';

const newId = () => (crypto.randomUUID?.() ?? `t${Date.now()}${Math.random().toString(36).slice(2, 7)}`);

export function TemplateSheet({
  data,
  phase,
  volumeMin,
  weekStart,
  onClose,
}: {
  data: Data;
  phase: Phase;
  /** volume progressif de la semaine en cours, pour traduire les parts en minutes */
  volumeMin: number;
  weekStart: ISODate;
  onClose: () => void;
}) {
  const items = templateFor(data.profile, phase);
  const customized = !!data.profile.templates?.[phase];
  const [editing, setEditing] = useState<TemplateItem | 'new' | null>(null);
  const [applied, setApplied] = useState(false);

  const persist = async (next: TemplateItem[]) => {
    await saveTemplate(phase, next);
    setApplied(false);
  };

  const toValue = (t: TemplateItem): EditorValue => ({
    type: t.type,
    title: t.title,
    details: t.details,
    durationMin: itemDuration(t, items, volumeMin),
    exercises: t.exercises,
    day: t.day,
    progressive: t.share > 0,
    autoLabel: t.auto ? AUTO_DETAILS[t.auto].label : undefined,
    keepAuto: !!t.auto,
  });

  const fromValue = (v: EditorValue, base: TemplateItem): TemplateItem => {
    const minutes = v.durationMin ?? 30;
    const progressive = v.type !== 'repos' && !!v.progressive;
    return {
      ...base,
      day: v.day ?? base.day,
      type: v.type,
      title: v.title,
      details: v.details,
      share: progressive ? shareForMinutes(base, items, volumeMin, minutes) : 0,
      fixedMin: progressive || v.type === 'repos' ? undefined : minutes,
      maxMin: progressive ? Math.max(base.maxMin ?? 0, Math.round(minutes * 1.6)) : undefined,
      auto: v.keepAuto ? base.auto : undefined,
      exercises: v.type === 'force' ? v.exercises : undefined,
    };
  };

  if (editing) {
    const isNew = editing === 'new';
    const base: TemplateItem = isNew ? { id: newId(), day: 0, type: 'course', title: 'Course', share: 0, fixedMin: 30, details: '' } : editing;
    return (
      <Sheet title={isNew ? 'Nouvelle séance type' : 'Séance type'} onClose={() => setEditing(null)}>
        <SessionEditor
          mode="template"
          saveLabel={isNew ? 'Ajouter à la semaine type' : 'Enregistrer'}
          initial={isNew ? { type: 'course', title: 'Course', details: '', durationMin: 30, day: 0, progressive: true } : toValue(editing)}
          onCancel={() => setEditing(null)}
          onSave={async (v) => {
            const item = fromValue(v, base);
            await persist(isNew ? [...items, item] : items.map((t) => (t.id === item.id ? item : t)));
            setEditing(null);
          }}
          onDelete={
            isNew
              ? undefined
              : async () => {
                  await persist(items.filter((t) => t.id !== base.id));
                  setEditing(null);
                }
          }
        />
      </Sheet>
    );
  }

  return (
    <Sheet title={`Semaine type, phase ${ROMAN[phase]}`} onClose={onClose}>
      <div className="stack">
        <p className="small muted">
          {PHASES[phase].name}. Les changements s'appliquent dès la semaine prochaine. Les durées « progressives » suivent le volume
          (+10 % max par semaine, allègements compris).
        </p>

        <div className="field">
          <span className="field-label">Jours de grappling au club</span>
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

        <div>
          {DAY_LONG.map((dayName, day) => {
            const dayItems = items.filter((t) => t.day === day);
            return (
              <div key={day} className="day">
                <div className="day-head">
                  <h3>{dayName}</h3>
                  {data.profile.grapplingDays.includes(day) && <span className="day-status">+ grappling</span>}
                </div>
                {dayItems.length === 0 && <p className="small muted">Repos</p>}
                {dayItems.map((t) => {
                  const minutes = itemDuration(t, items, volumeMin);
                  return (
                    <button key={t.id} className={`mini-session ${t.type === 'repos' ? 'session--repos' : ''}`} onClick={() => setEditing(t)}>
                      <span className="session-code">{TYPE_CODE[t.type]}</span>
                      <span>
                        <span className="title">{t.title}</span>
                        <br />
                        <span className="meta">
                          {[
                            minutes ? `${minutes} min${t.share > 0 ? ', progressive' : ', fixe'}` : '',
                            t.exercises?.length ? `${t.exercises.length} exercices` : '',
                          ]
                            .filter(Boolean)
                            .join(', ') || t.details}
                        </span>
                      </span>
                      <span className="muted" aria-hidden="true">›</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <button className="btn btn--block" onClick={() => setEditing('new')}>
          + Ajouter une séance type
        </button>
        <button
          className="btn btn--brass btn--block"
          disabled={applied}
          onClick={async () => {
            await applyTemplateToWeek(weekStart, data.today);
            setApplied(true);
          }}
        >
          {applied ? 'Appliqué à cette semaine' : "Appliquer aussi à cette semaine, dès aujourd'hui"}
        </button>
        {customized && (
          <button
            className="btn btn--ghost btn--block"
            onClick={async () => {
              await resetTemplate(phase);
              setApplied(false);
            }}
          >
            Rétablir le modèle par défaut
          </button>
        )}
      </div>
    </Sheet>
  );
}
