import { useMemo, type CSSProperties } from 'react';

/** Générateur pseudo-aléatoire déterministe : les mêmes trous pour la même séance. */
function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10_000) / 10_000;
  };
}

interface HoleShape {
  rim: string;
  petals: string;
  cracks: string[];
  rotate: number;
}

function holeShape(seed: number): HoleShape {
  const r = rng(seed);
  const n = 13;
  const rim: string[] = [];
  const petals: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const inner = 13 + r() * 4;
    const outer = 19 + r() * 9;
    const mid = a + Math.PI / n;
    rim.push(`${(50 + Math.cos(a) * inner).toFixed(1)},${(50 + Math.sin(a) * inner).toFixed(1)}`);
    rim.push(`${(50 + Math.cos(mid) * (inner + 2)).toFixed(1)},${(50 + Math.sin(mid) * (inner + 2)).toFixed(1)}`);
    // Pétales de métal arraché autour du trou
    petals.push(
      `M${(50 + Math.cos(a) * inner).toFixed(1)} ${(50 + Math.sin(a) * inner).toFixed(1)} L${(50 + Math.cos(mid) * outer).toFixed(1)} ${(
        50 +
        Math.sin(mid) * outer
      ).toFixed(1)} L${(50 + Math.cos(a + (2 * Math.PI) / n) * inner).toFixed(1)} ${(50 + Math.sin(a + (2 * Math.PI) / n) * inner).toFixed(1)}`,
    );
  }
  const cracks: string[] = [];
  const count = 5 + Math.floor(r() * 3);
  for (let i = 0; i < count; i++) {
    let a = (i / count) * Math.PI * 2 + r() * 0.6;
    let x = 50 + Math.cos(a) * 22;
    let y = 50 + Math.sin(a) * 22;
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const segs = 3 + Math.floor(r() * 2);
    for (let k = 0; k < segs; k++) {
      a += (r() - 0.5) * 0.7;
      const len = 6 + r() * 7;
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    cracks.push(d);
  }
  return { rim: rim.join(' '), petals: petals.join(' '), cracks, rotate: Math.floor(r() * 360) };
}

/** Un impact de balle en SVG : trou, métal arraché, fissures. */
export function BulletHole({ seed, size = 64, fresh = false, style }: { seed: number; size?: number; fresh?: boolean; style?: CSSProperties }) {
  const shape = useMemo(() => holeShape(seed), [seed]);
  const id = `h${seed}`;
  return (
    <span className={`bullet ${fresh ? 'bullet--fresh' : ''}`} style={{ width: size, height: size, ...style }} aria-hidden="true">
      {fresh && <span className="bullet-flash" />}
      <svg viewBox="0 0 100 100" style={{ transform: `rotate(${shape.rotate}deg)` }}>
        <defs>
          <radialGradient id={`${id}-core`} cx="46%" cy="44%" r="55%">
            <stop offset="0" stopColor="#000" />
            <stop offset="0.6" stopColor="#050405" />
            <stop offset="1" stopColor="#2a2724" />
          </radialGradient>
          <radialGradient id={`${id}-burn`} cx="50%" cy="50%" r="50%">
            <stop offset="0.25" stopColor="#1a1410" stopOpacity="0.9" />
            <stop offset="1" stopColor="#1a1410" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="36" fill={`url(#${id}-burn)`} className="bullet-burn" />
        <g className="bullet-cracks">
          {shape.cracks.map((d, i) => (
            <path key={i} d={d} pathLength={1} />
          ))}
        </g>
        <path d={shape.petals} className="bullet-petals" />
        <polygon points={shape.rim} fill={`url(#${id}-core)`} className="bullet-core" />
        <circle cx="47" cy="46" r="5" fill="#000" />
      </svg>
      {fresh && (
        <span className="bullet-sparks">
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} style={{ '--a': `${(i / 7) * 360 + seed * 13}deg`, '--d': `${26 + ((seed * (i + 3)) % 18)}px` } as CSSProperties} />
          ))}
        </span>
      )}
    </span>
  );
}

/** Groupe d'impacts sur une plaque : positions stables d'une ouverture à l'autre. */
export function Holes({ seed, count = 3, fresh = false }: { seed: number; count?: number; fresh?: boolean }) {
  const holes = useMemo(() => {
    const r = rng(seed + 7);
    return Array.from({ length: count }, (_, i) => ({
      left: 52 + r() * 40,
      top: 12 + r() * 64,
      size: 34 + r() * 20,
      seed: seed * 31 + i,
      delay: i * 90,
    }));
  }, [seed, count]);
  return (
    <span className="holes" aria-hidden="true">
      {holes.map((h) => (
        <BulletHole
          key={h.seed}
          seed={h.seed}
          size={h.size}
          fresh={fresh}
          style={{ left: `${h.left}%`, top: `${h.top}%`, animationDelay: `${h.delay}ms`, '--delay': `${h.delay}ms` } as CSSProperties}
        />
      ))}
    </span>
  );
}
