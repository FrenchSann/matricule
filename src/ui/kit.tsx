import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SessionType } from '../domain/types';

export const TYPE_CODE: Record<SessionType, string> = {
  course: 'CRS',
  grappling: 'GRP',
  force: 'FRC',
  natation: 'NAT',
  marche: 'MAR',
  mobilite: 'MOB',
  repos: 'REP',
};

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden="true">
    {d}
  </svg>
);

export const Icons = {
  today: icon(<><path d="M4 4h16v16H4z" /><path d="M4 9h16M9 13h6M9 16h4" /></>),
  plan: icon(<><path d="M4 5h16M4 10h16M4 15h10M4 20h7" /><path d="M17 15l2 2 3-4" /></>),
  plus: icon(<path d="M12 4v16M4 12h16" />),
  stats: icon(<path d="M5 20V12M10 20V6M15 20v-9M20 20V4M3 20h18" />),
  dossier: icon(<><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /><path d="M8 12l4-2 4 2M8 15l4-2 4 2" /></>),
  check: icon(<path d="M5 12.5l4.5 4.5L19 7" />),
  left: icon(<path d="M15 5l-7 7 7 7" />),
  right: icon(<path d="M9 5l7 7-7 7" />),
  close: icon(<path d="M6 6l12 12M18 6L6 18" />),
};

export function Chevron() {
  return (
    <svg viewBox="0 0 14 8" aria-hidden="true">
      <path d="M1 1l6 5 6-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Rule() {
  return (
    <div className="rule" role="presentation">
      <Chevron />
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1} ref={ref}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Fermer">
            {Icons.close}
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  unit,
  decimals = 0,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  min?: number;
  unit?: string;
  decimals?: number;
}) {
  const bump = (dir: 1 | -1) => {
    const next = Math.max(min, +((value ?? 0) + dir * step).toFixed(decimals));
    onChange(next);
  };
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="stepper">
        <button type="button" onClick={() => bump(-1)} aria-label={`${label} : moins ${step}`}>
          −
        </button>
        <input
          inputMode={decimals ? 'decimal' : 'numeric'}
          aria-label={label}
          value={value ?? ''}
          placeholder="—"
          onChange={(e) => {
            const raw = e.target.value.replace(',', '.');
            if (raw === '') return onChange(undefined);
            const n = Number(raw);
            if (!Number.isNaN(n)) onChange(n);
          }}
        />
        <button type="button" onClick={() => bump(1)} aria-label={`${label} : plus ${step}`}>
          +
        </button>
      </div>
      {unit && <span className="stepper-unit">{unit}</span>}
    </div>
  );
}

const RPE_TEXT = [
  '',
  'Très facile',
  'Facile',
  'Modéré',
  'Assez dur',
  'Dur, mais confortable',
  'Dur',
  'Très dur',
  'Très dur, limite',
  'Quasi maximal',
  'Maximal',
];

export function RpePicker({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <span className="field-label" id="rpe-label">
        Ressenti (RPE)
      </span>
      <div className="rpe" role="group" aria-labelledby="rpe-label">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            data-zone={n > 8 ? 'hard' : undefined}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <span className="rpe-caption">{value ? `${value} : ${RPE_TEXT[value]}` : 'Touche une valeur après la séance.'}</span>
    </div>
  );
}

export function Flame({ lit }: { lit: boolean }) {
  return (
    <svg className={`flame ${lit ? 'flame--lit' : ''}`} viewBox="0 0 34 46" aria-hidden="true">
      <path
        className="flame-outer"
        d="M17 1C19 10 31 17 31 30a14 14 0 0 1-28 0c0-7 4-11 7-14 0 5 2 8 5 9-2-8 0-17 2-24z"
        fill={lit ? '#a88a4a' : '#34333a'}
      />
      <path
        className="flame-inner"
        d="M17 22c1 5 7 8 7 14a7 7 0 0 1-14 0c0-4 3-6 4-8 0 3 1 4 3 5-1-4-1-8 0-11z"
        fill={lit ? '#a8141f' : '#17161a'}
      />
    </svg>
  );
}

/** Petit sélecteur −/+ pour les séries (répétitions, charge). */
export function MiniStepper({
  label,
  value,
  onChange,
  step = 1,
  decimals = 0,
  suffix,
  placeholder = '—',
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  decimals?: number;
  suffix?: string;
  placeholder?: string;
}) {
  // Texte local : permet de taper « 42, » puis « 42,5 » sans perdre la virgule.
  const fmt = (v: number | undefined) => (v === undefined ? '' : String(v).replace('.', ','));
  const parse = (t: string) => (t.trim() === '' ? undefined : Number(t.replace(',', '.')));
  const [text, setText] = useState(fmt(value));
  useEffect(() => {
    if (parse(text) !== value) setText(fmt(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const bump = (dir: 1 | -1) => onChange(Math.max(0, +((value ?? 0) + dir * step).toFixed(decimals)));
  return (
    <div className="mini-stepper">
      <button type="button" onClick={() => bump(-1)} aria-label={`${label} : moins ${step}`}>−</button>
      <label>
        <input
          inputMode={decimals ? 'decimal' : 'numeric'}
          aria-label={label}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            const t = e.target.value;
            const n = parse(t);
            if (n !== undefined && Number.isNaN(n)) return;
            setText(t);
            onChange(n);
          }}
        />
        {suffix && <span>{suffix}</span>}
      </label>
      <button type="button" onClick={() => bump(1)} aria-label={`${label} : plus ${step}`}>+</button>
    </div>
  );
}
