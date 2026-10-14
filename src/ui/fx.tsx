import { useCallback, useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { BulletHole } from './Impact';

/** Fond d'ambiance : cendres qui dérivent, scanlines HUD, vignette. Purement décoratif. */
export function Ambience() {
  const ash = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: (i * 61) % 100,
        size: 1.5 + ((i * 7) % 4) * 0.6,
        dur: 14 + ((i * 13) % 12),
        delay: -((i * 17) % 26),
        drift: ((i % 5) - 2) * 14,
        ember: i % 5 === 0,
      })),
    [],
  );
  return (
    <div className="ambience" aria-hidden="true">
      {ash.map((a, i) => (
        <i
          key={i}
          className={a.ember ? 'ember' : ''}
          style={{ left: `${a.left}%`, width: a.size, height: a.size, animationDuration: `${a.dur}s`, animationDelay: `${a.delay}s`, '--drift': `${a.drift}px` } as CSSProperties}
        />
      ))}
    </div>
  );
}

/** Rafale plein écran : trois impacts, secousse, puis le tampon. */
export function Volley({ text, seed }: { text: string; seed: number }) {
  const shots = useMemo(
    () => [
      { x: 30 + (seed % 17), y: 34 + (seed % 9), s: 92 },
      { x: 58 + (seed % 13), y: 46 + (seed % 11), s: 74 },
      { x: 44 + (seed % 7), y: 60 + (seed % 5), s: 84 },
    ],
    [seed],
  );
  return (
    <div className="volley" aria-live="polite">
      <div className="volley-glass" />
      {shots.map((s, i) => (
        <BulletHole
          key={i}
          seed={seed + i * 101}
          size={s.s}
          fresh
          style={{ left: `${s.x}%`, top: `${s.y}%`, '--delay': `${i * 110}ms`, animationDelay: `${i * 110}ms` } as CSSProperties}
        />
      ))}
      <div className="stamp">{text}</div>
    </div>
  );
}

/** Bascule 3D d'une plaque vers le doigt, au toucher. */
export function usePressTilt(max = 6) {
  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`);
      el.dataset.pressed = 'true';
    },
    [max],
  );
  const release = useCallback((e: PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    delete el.dataset.pressed;
  }, []);
  return { onPointerDown, onPointerUp: release, onPointerLeave: release, onPointerCancel: release };
}

/** Vrai pendant `ms` après le passage de `flag` à vrai : sert à jouer l'impact une seule fois. */
export function useFreshFlag(flag: boolean, ms = 1600) {
  const [fresh, setFresh] = useState(false);
  const [prev, setPrev] = useState(flag);
  if (flag !== prev) {
    setPrev(flag);
    if (flag) setFresh(true);
  }
  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(false), ms);
    return () => clearTimeout(t);
  }, [fresh, ms]);
  return fresh;
}

export type CartridgeState = 'live' | 'spent' | 'pending' | 'joker';

/** Une douille : pleine (jour tenu), percutée (manqué), à venir. */
export function Cartridge({ state, label }: { state: CartridgeState; label: string }) {
  return (
    <span className={`cartridge cartridge--${state}`} title={label}>
      <svg viewBox="0 0 14 40" aria-hidden="true">
        <path className="cart-bullet" d="M3 13 C3 6 5.5 1.5 7 1 C8.5 1.5 11 6 11 13 Z" />
        <rect className="cart-case" x="2.5" y="13" width="9" height="24" rx="1" />
        <rect className="cart-rim" x="1.5" y="35" width="11" height="4" rx="0.8" />
        <circle className="cart-primer" cx="7" cy="37" r="1.4" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
