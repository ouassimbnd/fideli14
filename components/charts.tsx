"use client";

// Graphiques SVG faits maison : pas de dépendance à installer, entièrement stylés
// avec la palette Fideli, et légers à charger pour un tableau de bord commerçant.

type Series = { name: string; color: string; values: number[] };

const W = 640;
const H = 220;
const PAD = { top: 14, right: 10, bottom: 26, left: 10 };

function path(values: number[], max: number) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = PAD.left + i * step;
      const y = PAD.top + innerH - (max ? (v / max) * innerH : 0);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function TrendChart({ labels, series }: { labels: string[]; series: Series[] }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const gridY = [0, 0.25, 0.5, 0.75, 1];
  const shown = labels.map((l, i) => (i % 5 === 0 || i === labels.length - 1 ? l : ""));
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" role="img" aria-label="Évolution des visites et nouveaux clients sur 30 jours">
        {gridY.map((g) => (
          <line key={g} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + g * (H - PAD.top - PAD.bottom)} y2={PAD.top + g * (H - PAD.top - PAD.bottom)} className="chart-grid" />
        ))}
        {series.map((s) => {
          const innerH = H - PAD.top - PAD.bottom;
          const d = path(s.values, max);
          const area = `${d} L${W - PAD.right},${PAD.top + innerH} L${PAD.left},${PAD.top + innerH} Z`;
          return (
            <g key={s.name}>
              <path d={area} fill={s.color} opacity={0.12} />
              <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        {shown.map((l, i) => {
          const innerW = W - PAD.left - PAD.right;
          const step = labels.length > 1 ? innerW / (labels.length - 1) : 0;
          if (!l) return null;
          return (
            <text key={i} x={PAD.left + i * step} y={H - 6} className="chart-axis" textAnchor="middle">
              {l}
            </text>
          );
        })}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DowChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="dow-chart" role="img" aria-label="Visites par jour de la semaine">
      {data.map((d) => (
        <div className="dow-col" key={d.label}>
          <div className="dow-bar-track">
            <div className="dow-bar" style={{ height: `${Math.max(4, (d.value / max) * 100)}%`, background: color }} />
          </div>
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="gauge">
      <svg viewBox="0 0 120 120" width={104} height={104}>
        <circle cx={60} cy={60} r={r} className="gauge-track" />
        <circle
          cx={60}
          cy={60}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={11}
          strokeLinecap="round"
          strokeDasharray={`${c * filled} ${c}`}
          transform="rotate(-90 60 60)"
        />
        <text x={60} y={66} textAnchor="middle" className="gauge-value">
          {Math.round(value)}%
        </text>
      </svg>
      <span>{label}</span>
    </div>
  );
}
