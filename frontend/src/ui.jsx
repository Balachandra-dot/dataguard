import { useState, useEffect } from "react";

export const scoreColor = (v) => (v >= 90 ? "#16a34a" : v >= 70 ? "#f59e0b" : "#dc2626");
export const scoreLabel = (v) => (v >= 90 ? "Excellent" : v >= 70 ? "Needs attention" : "Poor");

export const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

/* Counts a number up from 0 */
export function useCountUp(target, duration = 1000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function DataTable({ columns, rows, empty, neutral }) {
  if (!rows || rows.length === 0) {
    return <div className={`empty ${neutral ? "neutral" : ""}`}>{neutral ? "" : "✓ "}{empty}</div>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="row-in" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(r[c.key], r) : (r[c.key] ?? "—")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScoreBadge({ value }) {
  const c = scoreColor(value);
  return <span className="score-badge" style={{ color: c, background: `${c}1f` }}>{value}</span>;
}

export function Ring({ value }) {
  const v = useCountUp(value, 1200);
  const color = scoreColor(value);
  return (
    <div className="ring" style={{ background: `conic-gradient(${color} ${v * 3.6}deg, var(--track) 0deg)` }}>
      <div className="ring-inner">
        <div className="ring-value" style={{ color }}>{v.toFixed(1)}</div>
        <div className="ring-sub">out of 100</div>
      </div>
    </div>
  );
}

export function Metric({ label, value }) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="bar">
        <div className="bar-fill grow" style={{ "--w": `${value}%`, background: scoreColor(value) }} />
      </div>
    </div>
  );
}

export function StatTile({ label, value, text }) {
  const n = useCountUp(typeof value === "number" ? value : 0, 900);
  return (
    <div className="stat fade-up">
      <span>{label}</span>
      <strong title={text}>{text ?? Math.round(n)}</strong>
    </div>
  );
}

export function Skeleton() {
  return (
    <div className="skeleton-wrap">
      <div className="skeleton-row">
        <div className="skeleton" /><div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
      </div>
      <div className="skeleton tall" />
      <div className="skeleton tall" />
    </div>
  );
}