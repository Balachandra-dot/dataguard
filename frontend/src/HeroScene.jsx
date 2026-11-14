import { useEffect, useState } from "react";

const PERIOD = 7000;

const ROWS = [
  { cells: ["1", "Ravi", "25", "Bengaluru", "50,000"], flag: null },
  { cells: ["2", "Priya", "30", "Mysuru", "62,000"], flag: null },
  { cells: ["3", "Arun", "", "Hubli", "48,000"], flag: "missing" },
  { cells: ["5", "Kiran", "250", "Bengaluru", "52,000"], flag: "outlier" },
  { cells: ["2", "Priya", "30", "Mysuru", "62,000"], flag: "duplicate" },
  { cells: ["8", "Rahul", "35", "Bengaluru", "56,000"], flag: null },
];

const FLAG_TEXT = { missing: "Missing", outlier: "Outlier", duplicate: "Duplicate" };

/* Counts up while the scanner moves, then waits for the next loop */
function useLoopCount(target, period) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = ((now - t0) % period) / period;
      const k = Math.min(p / 0.7, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - k, 3))));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, period]);
  return value;
}

export default function HeroScene() {
  const score = useLoopCount(87, PERIOD);
  const C = 2 * Math.PI * 30;
  const color = score >= 90 ? "#4ade80" : score >= 70 ? "#fbbf24" : "#f87171";

  return (
    <div className="scene" aria-hidden="true">
      <div className="chip chip-csv">CSV</div>
      <div className="chip chip-xlsx">XLSX</div>
      <div className="chip chip-pdf">PDF</div>

      <div className="scene-card">
        <div className="scene-head">
          <span className="dots"><i /><i /><i /></span>
          <span className="scene-file">sample.csv</span>
          <span className="scene-badge">Scanning…</span>
        </div>

        <div className="scene-cols">
          <span>id</span><span>name</span><span>age</span><span>city</span><span>salary</span><span />
        </div>

        <div className="scene-body">
          <div className="scan-line" />
          {ROWS.map((r, i) => (
            <div key={i} className="scene-row" style={{ "--i": i }}>
              {r.flag && <span className={`row-glow ${r.flag}`} />}
              {r.cells.map((c, j) => (
                <span key={j} className="cell">{c || "—"}</span>
              ))}
              <span className="cell">
                {r.flag && <em className={`row-tag ${r.flag}`}>{FLAG_TEXT[r.flag]}</em>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="score-pop">
        <div className="score-ring">
          <svg width="70" height="70" viewBox="0 0 70 70" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
            <circle
              cx="35" cy="35" r="30" fill="none" stroke={color} strokeWidth="6"
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)}
            />
          </svg>
          <div className="score-num">{score}</div>
        </div>
        <div>
          <div className="score-title">Quality score</div>
          <div className="score-sub">Sample data</div>
        </div>
      </div>
    </div>
  );
}