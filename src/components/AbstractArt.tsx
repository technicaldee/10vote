import React from 'react';

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandom(seedStr: string) {
  const seed = xmur3(seedStr)();
  return mulberry32(seed);
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${Math.floor(h)}, ${Math.floor(s)}%, ${Math.floor(l)}%)`;
}

export function AbstractArt({ text, className }: { text: string; className?: string }) {
  const rnd = seededRandom(text);
  const hueBase = rnd() * 360;
  const colors = [
    hsl(hueBase, 65, 50),
    hsl(hueBase + 40, 70, 55),
    hsl(hueBase + 80, 75, 45),
    hsl(hueBase + 120, 60, 50),
  ];
  const layers = Array.from({ length: 6 }).map((_, i) => ({
    x: rnd() * 400,
    y: rnd() * 200,
    r: 30 + rnd() * 90,
    rot: rnd() * 360,
    color: colors[i % colors.length],
    opacity: 0.15 + rnd() * 0.35,
  }));

  return (
    <svg className={className} viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors[0]} stopOpacity="0.6" />
          <stop offset="50%" stopColor={colors[1]} stopOpacity="0.5" />
          <stop offset="100%" stopColor={colors[2]} stopOpacity="0.6" />
        </linearGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="12" /></filter>
      </defs>
      <rect x="0" y="0" width="400" height="200" fill="url(#grad)" />
      {layers.map((l, idx) => (
        <g key={idx} transform={`translate(${l.x} ${l.y}) rotate(${l.rot})`}>
          <circle cx="0" cy="0" r={l.r} fill={l.color} opacity={l.opacity} filter="url(#blur)" />
          <rect x={-l.r} y={-l.r/2} width={l.r*2} height={l.r} rx={l.r/4} fill={colors[(idx+1)%colors.length]} opacity={l.opacity * 0.8} />
        </g>
      ))}
      <rect x="0" y="0" width="400" height="200" fill="black" opacity="0.15" />
    </svg>
  );
}