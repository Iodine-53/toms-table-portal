"use client";

// Deterministic, tasteful SVG "overhead plate" illustration per meal.
// No external imagery — pure inline SVG so the static export is self-contained.

const PALETTES = [
  { food: ["#d98a4b", "#a8562a"], plate: "#f4ecdb", rim: "#e3d5b8", garnish: ["#5c7a4e", "#e8c96a", "#fff8ea"] },
  { food: ["#7ba05b", "#4a6a36"], plate: "#eef0e1", rim: "#d9dfc2", garnish: ["#d9a441", "#c4663b", "#fff8ea"] },
  { food: ["#e0a458", "#bd7c2c"], plate: "#f7edda", rim: "#e7d6b4", garnish: ["#2e4b3f", "#b3402e", "#fff8ea"] },
  { food: ["#c9726a", "#a0473f"], plate: "#f4e5df", rim: "#e6cfc4", garnish: ["#5c7a4e", "#e8c96a", "#fff8ea"] },
  { food: ["#93a05e", "#5f6e3a"], plate: "#eaefdf", rim: "#d5dcc0", garnish: ["#d98a4b", "#f0e0b8", "#fff8ea"] },
  { food: ["#b57e4e", "#8a5a30"], plate: "#f3e9d8", rim: "#e2d1b2", garnish: ["#2e4b3f", "#d9a441", "#fff8ea"] },
];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function MealArt({ name, className }) {
  const pal = PALETTES[hashStr(name) % PALETTES.length];
  const rnd = mulberry32(hashStr(name + "::dots"));
  const gid = `g${hashStr(name) % 100000}`;

  // scatter garnish dots inside the food ellipse
  const dots = [];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.25 + rnd() * 0.6;
    const x = 200 + Math.cos(a) * 62 * r;
    const y = 132 + Math.sin(a) * 44 * r;
    dots.push({
      x: x.toFixed(1),
      y: y.toFixed(1),
      r: (3 + rnd() * 5).toFixed(1),
      c: pal.garnish[i % pal.garnish.length],
    });
  }
  // herb strokes
  const herbs = [];
  for (let i = 0; i < 4; i++) {
    const x = 160 + rnd() * 80;
    const y = 105 + rnd() * 55;
    herbs.push({ x: x.toFixed(1), y: y.toFixed(1), rot: (rnd() * 70 - 35).toFixed(0) });
  }

  return (
    <svg viewBox="0 0 400 250" className={className} role="img" aria-label={`${name} illustration`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={gid} cx="42%" cy="38%" r="75%">
          <stop offset="0%" stopColor={pal.food[0]} />
          <stop offset="100%" stopColor={pal.food[1]} />
        </radialGradient>
        <linearGradient id={`${gid}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#faf5ea" />
          <stop offset="100%" stopColor="#f0e6d2" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill={`url(#${gid}bg)`} />
      {/* steam */}
      <g stroke="#b9ab90" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.45">
        <path d="M168 52 q 8 -12 0 -24 q -8 -12 0 -24" />
        <path d="M206 58 q 8 -12 0 -24 q -8 -12 0 -24" />
        <path d="M242 52 q 8 -12 0 -24 q -8 -12 0 -24" />
      </g>
      {/* plate */}
      <ellipse cx="200" cy="140" rx="128" ry="92" fill={pal.plate} />
      <ellipse cx="200" cy="140" rx="128" ry="92" fill="none" stroke={pal.rim} strokeWidth="3" />
      <ellipse cx="200" cy="140" rx="102" ry="72" fill={pal.rim} opacity="0.55" />
      {/* food */}
      <ellipse cx="200" cy="136" rx="74" ry="53" fill={`url(#${gid})`} />
      <ellipse cx="200" cy="136" rx="74" ry="53" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="2" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity="0.92" />
      ))}
      {herbs.map((h, i) => (
        <g key={`h${i}`} transform={`translate(${h.x} ${h.y}) rotate(${h.rot})`}>
          <rect x="-9" y="-1.6" width="18" height="3.2" rx="1.6" fill="#4a6a36" opacity="0.85" />
        </g>
      ))}
      {/* plate shadow */}
      <ellipse cx="200" cy="228" rx="110" ry="10" fill="rgba(42,36,28,0.08)" />
    </svg>
  );
}
