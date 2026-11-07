import React from 'react';
import { brand } from '../brand';

const CENTER = 300;
const NODES = [
  { r: 130, a: -70, d: 0 },
  { r: 130, a: 40, d: 0.6 },
  { r: 130, a: 160, d: 1.2 },
  { r: 205, a: -20, d: 0.3 },
  { r: 205, a: 85, d: 0.9 },
  { r: 205, a: 200, d: 1.5 },
  { r: 205, a: 270, d: 2.1 },
  { r: 275, a: -50, d: 0.5 },
  { r: 275, a: 15, d: 1.1 },
  { r: 275, a: 120, d: 1.7 },
  { r: 275, a: 235, d: 0.2 },
].map((n) => {
  const rad = (n.a * Math.PI) / 180;
  return { ...n, x: CENTER + n.r * Math.cos(rad), y: CENTER + n.r * Math.sin(rad) };
});

/** Decorative device-network illustration: a hub radiating to connected nodes. */
export const NetworkArt: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 600 600' className={className} aria-hidden role='presentation'>
    <defs>
      <radialGradient id='vx-hub' cx='50%' cy='50%' r='50%'>
        <stop offset='0%' stopColor='var(--accent)' stopOpacity='0.35' />
        <stop offset='100%' stopColor='var(--accent)' stopOpacity='0' />
      </radialGradient>
    </defs>

    <circle cx={CENTER} cy={CENTER} r='190' fill='url(#vx-hub)' />
    {[130, 205, 275].map((r) => (
      <circle
        key={r}
        cx={CENTER}
        cy={CENTER}
        r={r}
        fill='none'
        stroke='white'
        strokeOpacity='0.1'
        strokeDasharray='2 7'
      />
    ))}

    {NODES.map((n, i) => (
      <line
        key={`l${i}`}
        x1={CENTER}
        y1={CENTER}
        x2={n.x}
        y2={n.y}
        stroke='var(--accent)'
        strokeOpacity='0.35'
        strokeDasharray='4 8'
        className='animate-flow'
        style={{ animationDelay: `${n.d}s` }}
      />
    ))}

    {NODES.map((n, i) => (
      <g key={`n${i}`}>
        <circle
          cx={n.x}
          cy={n.y}
          r='9'
          fill='var(--accent)'
          className='animate-pulse-ring'
          style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDelay: `${n.d}s` }}
        />
        <circle cx={n.x} cy={n.y} r='4.5' fill='#0e0e11' stroke='var(--accent)' strokeWidth='1.6' />
      </g>
    ))}

    <image href={brand.iconDark} x={CENTER - 46} y={CENTER - 46} width='92' height='92' />
  </svg>
);
