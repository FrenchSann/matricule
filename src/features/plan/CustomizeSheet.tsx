import { useState } from 'react';
import { applyToWeek, saveCustomization } from '../../db/engine';
import { DAY_LONG, DAY_SHORT, type ISODate } from '../../domain/dates';
import { MOVABLE_SLOTS, programExercises, SLOT_DAY, SLOT_LABEL } from '../../domain/programme';
import type { SlotId } from '../../domain/types';
import { Sheet } from '../../ui/kit';
import type { Data } from '../../state';

const VARIANT_HINT: Record<string, string> = {
  'Squat (variante conservée)': 'Choisis dès S01 une variante adaptée à ta mobilité (barre, goblet ou presse), puis garde-la.',
  'Trap bar / kettlebell surélevée': 'Sans trap bar : soulevé de terre kettlebell surélevé, même RIR.',
  'Tractions pronation / assistées': 'Machine assistée ou poulie haute si moins de 4 tractions propres.',
};

/** Personnalisation du programme : jours des créneaux, créneaux retirés, variantes d'exercices, grappling. */
export function CustomizeSheet({ data, weekStart, onClose }: { data: Data; weekStart?: ISODate; onClose: () => void }) {
  const { profile } = data;
  const [applied, setApplied] = useState(false);
  const changed = () => setApplied(false);

  const setDay = async (slot: SlotId, day: number) => {
    const slotDays = { ...profile.slotDays };
    if (day === SLOT_DAY[slot]) delete slotDays[slot];
    else slotDays[slot] = day;
    await saveCustomization({ slotDays });
    changed();
  };
  const toggleSlot = async (slot: SlotId) => {
    const off = profile.disabledSlots.includes(slot);
    await saveCustomization({ disabledSlots: off ? profile.disabledSlots.filter((s) => s !== slot) : [...profile.disabledSlots, slot] });
    changed();
  };
  const setSub = async (name: string, value: string) => {
    const exerciseSubs = { ...profile.exerciseSubs };
    if (!value.trim() || value.trim() === name) delete exerciseSubs[name];
    else exerciseSubs[name] = value.trim();
    await saveCustomization({ exerciseSubs });
    changed();
  };

  return (
    <Sheet title="Personnaliser" onClose={onClose}>
      <div className="stack" style={{ gap: 20 }}>
        <p className="small muted">
          Les fiches du programme restent la référence. Ces réglages s'appliquent dès la semaine prochaine ; tu peux aussi les
          appliquer à la fin de la semaine en cours.
        </p>

        <div className="field">
          <span className="field-label">Jours de grappling au club</span>
          <div className="chips chips--days">
            {DAY_SHORT.map((d, i) => {
              const on = profile.grapplingDays.includes(i);
              return (
                <button
                  key={d}
                  className="chip"
                  aria-pressed={on}
                  onClick={async () => {
                    await saveCustomization({ grapplingDays: on ? profile.grapplingDays.filter((x) => x !== i) : [...profile.grapplingDays, i].sort() });
                    changed();
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Créneaux de la semaine</span>
          {MOVABLE_SLOTS.map((slot) => {
            const off = profile.disabledSlots.includes(slot);
            const day = profile.slotDays[slot] ?? SLOT_DAY[slot]!;
            return (
              <div key={slot} className="slot-row">
                <span className={off ? 'muted' : ''}>{SLOT_LABEL[slot]}</span>
                <select className="text-input" aria-label={`Jour : ${SLOT_LABEL[slot]}`} value={day} disabled={off} onChange={(e) => setDay(slot, Number(e.target.value))}>
                  {DAY_LONG.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <button className="chip" aria-pressed={!off} aria-label={`${off ? 'Remettre' : 'Retirer'} : ${SLOT_LABEL[slot]}`} onClick={() => toggleSlot(slot)}>
                  {off ? 'Retiré' : 'Actif'}
                </button>
              </div>
            );
          })}
          <p className="small muted">
            Natation : peut passer au dimanche si elle remplace une partie de la course. Footing du vendredi : à retirer en cas de
            jambes lourdes persistantes.
          </p>
        </div>

        <div className="field">
          <span className="field-label">Variantes d'exercices</span>
          {programExercises().map((name) => (
            <div key={name} className="stack stack--tight" style={{ padding: '6px 0' }}>
              <label className="small" htmlFor={`sub-${name}`}>{name}</label>
              <input
                id={`sub-${name}`}
                className="text-input"
                placeholder="Même exercice"
                defaultValue={profile.exerciseSubs[name] ?? ''}
                onBlur={(e) => setSub(name, e.target.value)}
              />
              {VARIANT_HINT[name] && <span className="small muted">{VARIANT_HINT[name]}</span>}
            </div>
          ))}
        </div>

        {weekStart && (
          <button
            className="btn btn--brass btn--block"
            disabled={applied}
            onClick={async () => {
              await applyToWeek(weekStart, data.today);
              setApplied(true);
            }}
          >
            {applied ? 'Appliqué à cette semaine' : "Appliquer aussi à cette semaine, dès aujourd'hui"}
          </button>
        )}
        <button className="btn btn--ghost btn--block" onClick={onClose}>
          Fermer
        </button>
      </div>
    </Sheet>
  );
}
