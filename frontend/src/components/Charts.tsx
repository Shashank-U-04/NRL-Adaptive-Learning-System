"use client";

import { useState, useId } from "react";

// ── Helpers ──────────────────────────────────────────────
interface Pt { x: number; y: number }

function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// ── Sparkline ────────────────────────────────────────────
export function Sparkline({ data, color = "#3B82F6", height = 32 }: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const id = useId();
  const W = 200, H = height, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts: Pt[] = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (W - pad * 2),
    y: H - pad - ((v - min) / range) * (H - pad * 2),
  }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${smoothPath(pts)} L ${pts[pts.length-1].x},${H} L ${pts[0].x},${H} Z`} fill={`url(#spark-${id})`} />
      <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Line chart ───────────────────────────────────────────
export function LineChart({ data, xKey, yKey, color = "#3B82F6", height = 220, yMin = 0, yMax = 100, yFormat = (v: number) => `${v}%` }: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  yMin?: number;
  yMax?: number;
  yFormat?: (v: number) => string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height;
  const padL = 36, padR = 12, padT = 12, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const pts: (Pt & { raw: Record<string, unknown> })[] = data.map((d, i) => ({
    x: padL + (i / (data.length - 1)) * innerW,
    y: padT + (1 - ((d[yKey] as number) - yMin) / (yMax - yMin)) * innerH,
    raw: d,
  }));

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const xPx = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0, bd = Infinity;
          pts.forEach((p, i) => { const dist = Math.abs(p.x - xPx); if (dist < bd) { bd = dist; best = i; } });
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {Array.from({ length: 5 }).map((_, i) => {
          const v = yMin + (i / 4) * (yMax - yMin);
          const y = padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 4" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10">{yFormat(Math.round(v))}</text>
            </g>
          );
        })}
        {data.map((d, i) => (
          <text key={i} x={pts[i].x} y={H - 6} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">{String(d[xKey])}</text>
        ))}
        <path d={`${smoothPath(pts)} L ${pts[pts.length-1].x},${H - padB} L ${pts[0].x},${H - padB} Z`} fill={`url(#lg-${id})`} />
        <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 4 : 2.5} fill={hover === i ? "#fff" : color} stroke={hover === i ? color : "none"} strokeWidth="2" />
        ))}
        {hover != null && (
          <line x1={pts[hover].x} y1={padT} x2={pts[hover].x} y2={H - padB} stroke="rgba(59,130,246,0.4)" strokeDasharray="3 3" />
        )}
      </svg>
      {hover != null && (
        <div style={{ position: "absolute", left: `${(pts[hover].x / W) * 100}%`, top: 8, transform: "translateX(-50%)", background: "rgba(20,22,28,0.95)", border: `1px solid ${color}66`, borderRadius: 8, padding: "6px 10px", fontSize: 12, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10 }}>
          <div style={{ color: "var(--text-3)", fontSize: 10 }}>{String(data[hover][xKey])}</div>
          <div style={{ color: "#fff", fontWeight: 500 }}>{yFormat(data[hover][yKey] as number)}</div>
        </div>
      )}
    </div>
  );
}

// ── Radar chart ──────────────────────────────────────────
export function RadarChart({ data, valueKey, labelKey, max = 100, color = "#3B82F6", size = 220 }: {
  data: Record<string, unknown>[];
  valueKey: string;
  labelKey: string;
  max?: number;
  color?: string;
  size?: number;
}) {
  const cx = size / 2, cy = size / 2;
  const r = size * 0.36;
  const n = data.length;
  const angle = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;
  const pt = (i: number, v: number) => ({
    x: cx + Math.cos(angle(i)) * r * (v / max),
    y: cy + Math.sin(angle(i)) * r * (v / max),
  });
  const rings = [0.25, 0.5, 0.75, 1];
  const polyPoints = data.map((d, i) => { const p = pt(i, d[valueKey] as number); return `${p.x},${p.y}`; }).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", height: size }}>
      {rings.map((rv, i) => (
        <polygon key={i} points={data.map((_, j) => { const a = angle(j); return `${cx + Math.cos(a) * r * rv},${cy + Math.sin(a) * r * rv}`; }).join(" ")} fill="none" stroke="rgba(255,255,255,0.07)" />
      ))}
      {data.map((_, i) => {
        const a = angle(i);
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke="rgba(255,255,255,0.06)" />;
      })}
      <polygon points={polyPoints} fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => { const p = pt(i, d[valueKey] as number); return <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />; })}
      {data.map((d, i) => {
        const a = angle(i);
        const lr = r + 16;
        return <text key={i} x={cx + Math.cos(a) * lr} y={cy + Math.sin(a) * lr + 3} textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="10">{String(d[labelKey])}</text>;
      })}
    </svg>
  );
}

// ── Stacked bar ──────────────────────────────────────────
export function StackedBar({ data, keys, colors, xKey, height = 220 }: {
  data: Record<string, unknown>[];
  keys: string[];
  colors: string[];
  xKey: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height;
  const padL = 28, padR = 8, padT = 12, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const totals = data.map(d => keys.reduce((a, k) => a + ((d[k] as number) || 0), 0));
  const max = Math.max(...totals) * 1.15;
  const bw = innerW / data.length * 0.6;
  const gap = innerW / data.length;

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
        {[0, 0.5, 1].map((f, i) => {
          const y = padT + (1 - f) * innerH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.05)" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10">{Math.round(max * f)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = padL + gap * (i + 0.5);
          let acc = 0;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {keys.map((k, ki) => {
                const v = (d[k] as number) || 0;
                const h = (v / max) * innerH;
                const y = padT + innerH - acc - h;
                acc += h;
                return (
                  <rect key={k} x={cx - bw / 2} y={y} width={bw} height={Math.max(0, h - 1)} fill={colors[ki]} rx={ki === keys.length - 1 ? 3 : 0} opacity={hover != null && hover !== i ? 0.4 : 1} />
                );
              })}
              <text x={cx} y={H - 6} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">{String(d[xKey])}</text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div style={{ position: "absolute", left: `${((padL + gap * (hover + 0.5)) / W) * 100}%`, top: 8, transform: "translateX(-50%)", background: "rgba(20,22,28,0.95)", border: "1px solid rgba(59,130,246,0.5)", borderRadius: 8, padding: "8px 10px", fontSize: 11, pointerEvents: "none", minWidth: 130, zIndex: 10 }}>
          <div style={{ color: "var(--text-3)", fontSize: 10, marginBottom: 4 }}>{String(data[hover][xKey])}</div>
          {keys.map((k, ki) => (
            <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[ki], display: "inline-block" }} />{k}
              </span>
              <span style={{ fontWeight: 600 }}>{(data[hover][k] as number) || 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Donut ────────────────────────────────────────────────
export function Donut({ data, size = 180, thickness = 30 }: {
  data: { name: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const cx = size / 2, cy = size / 2;
  const r = (size - thickness) / 2;
  const total = data.reduce((a, d) => a + d.value, 0);
  let acc = -Math.PI / 2;
  const arcs = data.map(d => {
    const frac = d.value / total;
    const a0 = acc;
    const a1 = acc + frac * Math.PI * 2;
    acc = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return {
      d: `M ${cx + Math.cos(a0) * r} ${cy + Math.sin(a0) * r} A ${r} ${r} 0 ${large} 1 ${cx + Math.cos(a1) * r} ${cy + Math.sin(a1) * r}`,
      color: d.color,
    };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", height: size }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
      {arcs.map((a, i) => (
        <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={thickness} strokeLinecap="butt" />
      ))}
    </svg>
  );
}
