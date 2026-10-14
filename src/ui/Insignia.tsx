import { useId } from 'react';
import { RANKS } from '../domain/ranks';

const BRASS = '#cfae68';
const BRASS_DARK = '#8a6f38';
const RED = '#a8141f';

/** Fourreau d'épaule (galons obliques pour la troupe et les sous-officiers, barrettes au-delà). */
export function Insignia({ rank, size = 64, locked = false, motion = 'none' }: { rank: number; size?: number; locked?: boolean; motion?: 'none' | 'idle' | 'spin' }) {
  const ins = RANKS[rank].insignia;
  const uid = useId().replace(/:/g, '');
  const shapes: React.ReactNode[] = [];

  if (ins.kind === 'chevrons') {
    const color = ins.color === 'red' ? RED : BRASS;
    for (let i = 0; i < ins.count; i++) {
      const y = 70 - i * 15;
      shapes.push(<path key={i} d={`M6 ${y} L42 ${y - 14} L42 ${y - 6} L6 ${y + 8} Z`} fill={color} />);
    }
  }

  if (ins.kind === 'bars') {
    const h = ins.wide ? 14 : 9;
    for (let i = 0; i < ins.count; i++) {
      const y = 58 - i * (h + 7);
      shapes.push(<rect key={`b${i}`} x={6} y={y} width={36} height={h} fill={BRASS} />);
      if (ins.red === 'stripe') shapes.push(<rect key={`r${i}`} x={6} y={y + h / 2 - 1.5} width={36} height={3} fill={RED} />);
      if (ins.red === 'edge') {
        shapes.push(<rect key={`e1${i}`} x={6} y={y} width={36} height={2.5} fill={RED} />);
        shapes.push(<rect key={`e2${i}`} x={6} y={y + h - 2.5} width={36} height={2.5} fill={RED} />);
      }
      if (ins.red === 'dashed') {
        for (let k = 0; k < 4; k++) shapes.push(<rect key={`d${i}${k}`} x={8 + k * 9} y={y + h / 2 - 1.5} width={5} height={3} fill={RED} />);
      }
    }
  }

  const svg = (
    <svg
      className="insignia"
      width={size * 0.67}
      height={size}
      viewBox="0 0 48 96"
      role="img"
      aria-label={`Insigne : ${RANKS[rank].name}`}
      style={locked ? { filter: 'grayscale(1)' } : undefined}
    >
      <defs>
        <linearGradient id={`${uid}-f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2c2a32" />
          <stop offset="0.5" stopColor="#18171c" />
          <stop offset="1" stopColor="#0c0b0e" />
        </linearGradient>
        <linearGradient id={`${uid}-s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}-c`}>
          <path d="M2 18 L24 2 L46 18 V94 H2 Z" />
        </clipPath>
      </defs>
      <path d="M2 18 L24 2 L46 18 V94 H2 Z" fill={`url(#${uid}-f)`} stroke={BRASS_DARK} strokeWidth="1.5" />
      <circle cx="24" cy="15" r="3.2" fill={BRASS_DARK} />
      <line x1="2" y1="84" x2="46" y2="84" stroke={BRASS_DARK} strokeWidth="1" />
      {shapes}
      {motion !== 'none' && !locked && (
        <g clipPath={`url(#${uid}-c)`}>
          <g transform="rotate(18)">
            <rect className="sheen" x="-10" y="-10" width="18" height="120" fill={`url(#${uid}-s)`} />
          </g>
        </g>
      )}
    </svg>
  );
  if (motion === 'none') return svg;
  return <span className={`coin ${motion === 'idle' ? 'coin--idle' : ''}`}>{svg}</span>;
}
