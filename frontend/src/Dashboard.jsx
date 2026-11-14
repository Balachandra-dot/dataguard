import { useState, useEffect } from "react";
import axios from "axios";
import {
  ShieldIcon, UploadIcon, SunIcon, MoonIcon, LogoutIcon,
  ChartIcon, FileIcon, ClockIcon, GearIcon,
} from "./icons";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const scoreColor = (v) => (v >= 90 ? "#16a34a" : v >= 70 ? "#f59e0b" : "#dc2626");
const scoreLabel = (v) => (v >= 90 ? "Excellent" : v >= 70 ? "Needs attention" : "Poor");

/* Smoothly counts a number up from 0 */
function useCountUp(target, duration = 1000) {
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

function DataTable({ columns, rows, empty }) {
  if (!rows || rows.length === 0) return <div className="empty">✓ {empty}</div>;
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
                <td key={c.key}>{c.render ? c.render(r[c.key]) : (r[c.key] ?? "—")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ring({ value }) {
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

function Metric({ label, value }) {
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

function StatTile({ label, value, text }) {
  const n = useCountUp(typeof value === "number" ? value : 0, 900);
  return (
    <div className="stat fade-up">
      <span>{label}</span>
      <strong title={text}>{text ?? Math.round(n)}</strong>
    </div>
  );
}

function Skeleton() {
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

export default function Dashboard({ user, onLogout, theme, onToggleTheme }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("missing");
  const [dragging, setDragging] = useState(false);

  const send = (path, config = {}) => {
    const form = new FormData();
    form.append("file", file);
    return axios.post(`${API}${path}`, form, config);
  };

  const pickFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError("");
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const res = await send("/analyze");
      setResult(res.data);
      setTab("missing");
    } catch (e) {
      setResult(null);
      setError(e.response?.data?.detail || "Could not reach the server. Is the backend running?");
    }
    setLoading(false);
  };

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const res = await send("/report", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit_report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not generate the report.");
    }
    setDownloading(false);
  };

  const missingRows = result
    ? Object.entries(result.missing.columns).map(([col, v]) => ({
        column: col,
        count: v.missing_count,
        percent: v.missing_percent,
      }))
    : [];

  const issues = result
    ? result.missing.total_missing_cells + result.duplicates.duplicate_count + result.anomalies.anomaly_count
    : 0;

  const tabs = result
    ? [
        { id: "missing", label: "Missing values", count: result.missing.total_missing_cells },
        { id: "duplicates", label: "Duplicates", count: result.duplicates.duplicate_count },
        { id: "anomalies", label: "Outliers", count: result.anomalies.anomaly_count },
        { id: "ml", label: "ML anomalies", count: result.ml_anomalies.ran ? result.ml_anomalies.anomaly_count : "–" },
        { id: "recs", label: "Recommendations", count: result.recommendations.length },
      ]
    : [];

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="side-brand">
          <span className="side-logo"><ShieldIcon width={22} height={22} /></span>
          <div>
            <div className="side-title">DataGuard</div>
            <div className="side-sub">Data Quality Platform</div>
          </div>
        </div>

        <nav className="side-nav">
          <div className="nav-item active"><ChartIcon /> Data Quality</div>
          <div className="nav-item disabled"><FileIcon /> Reports <em>Soon</em></div>
          <div className="nav-item disabled"><ClockIcon /> History <em>Soon</em></div>
          <div className="nav-item disabled"><GearIcon /> Settings <em>Soon</em></div>
        </nav>

        <div className="side-foot">v1.0 · Internal use</div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div>
            <h1 className="page-title">Data Quality Analysis</h1>
            <p className="page-sub">Upload a dataset to check its quality</p>
          </div>
          <div className="top-actions">
            <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme" title="Toggle theme">
              {theme === "light" ? <MoonIcon /> : <SunIcon />}
            </button>
                        <div className="user">
              {user.picture ? (
                <img className="avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="avatar">{user.name?.charAt(0).toUpperCase()}</div>
              )}
              <div className="user-text">
                <span>{user.name}</span>
                               <small>{user.email || user.username}</small>
              </div>
            </div>
            <button className="icon-btn" onClick={onLogout} aria-label="Log out" title="Log out">
              <LogoutIcon />
            </button>
          </div>
        </header>

        <main className="content">
          {/* Upload */}
          <section className="panel fade-up">
            <div
              className={`dropzone ${dragging ? "active" : ""} ${file ? "has-file" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files[0]);
              }}
            >
              <div className="drop-icon"><UploadIcon width={34} height={34} /></div>
              {file ? (
                <>
                  <div className="drop-title">{file.name}</div>
                  <div className="drop-sub">{(file.size / 1024).toFixed(1)} KB · ready to analyze</div>
                </>
              ) : (
                <>
                  <div className="drop-title">Drag and drop your file here</div>
                  <div className="drop-sub">CSV, Excel (.xlsx) or PDF with a table</div>
                </>
              )}
              <label className="btn btn-secondary">
                Browse file
                <input type="file" accept=".csv,.xlsx,.pdf" hidden onChange={(e) => pickFile(e.target.files[0])} />
              </label>
            </div>

            <div className="actions">
              <button className="btn btn-primary" onClick={analyze} disabled={!file || loading}>
                {loading ? <><span className="spinner" /> Analyzing...</> : "Analyze data"}
              </button>
              {result && (
                <button className="btn btn-outline" onClick={downloadReport} disabled={downloading}>
                  {downloading ? "Generating..." : "⬇ Download audit report"}
                </button>
              )}
            </div>

            {error && <div className="error">⚠ {error}</div>}
          </section>

          {loading && <Skeleton />}

          {!loading && !result && !error && (
            <div className="placeholder fade-up">
              Upload a file and click <strong>Analyze data</strong> to see your data quality report.
            </div>
          )}

          {!loading && result && (
            <>
              <section className="summary">
                <StatTile label="File" text={result.filename} />
                <StatTile label="Rows" value={result.rows} />
                <StatTile label="Columns" value={result.columns.length} />
                <StatTile label="Issues found" value={issues} />
              </section>

              <section className="panel score-grid fade-up">
                <div className="ring-card">
                  <Ring value={result.score.overall} />
                  <div className="ring-label" style={{ color: scoreColor(result.score.overall) }}>
                    {scoreLabel(result.score.overall)}
                  </div>
                  <div className="muted">Overall quality score</div>
                </div>
                <div className="metrics">
                  <Metric label="Completeness" value={result.score.completeness} />
                  <Metric label="Uniqueness" value={result.score.uniqueness} />
                  <Metric label="Validity" value={result.score.validity} />
                  <div className="muted">{result.score.flagged_rows} rows flagged as suspicious</div>
                </div>
              </section>

              <section className="panel fade-up">
                <div className="tabs">
                  {tabs.map((t) => (
                    <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                      {t.label}
                      <span className="tab-count">{t.count}</span>
                    </button>
                  ))}
                </div>

                <div className="tab-body" key={tab}>
                  {tab === "missing" && (
                    <div className="bars">
                      {missingRows.map((r) => (
                        <div className="bar-row" key={r.column}>
                          <div className="bar-name">{r.column}</div>
                          <div className="bar big">
                            <div
                              className="bar-fill grow"
                              style={{
                                "--w": `${r.percent}%`,
                                background: r.percent > 20 ? "#dc2626" : r.percent > 0 ? "#f59e0b" : "#16a34a",
                              }}
                            />
                          </div>
                          <div className="bar-num">{r.count} missing · {r.percent}%</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === "duplicates" && (
                    <DataTable
                      empty="No duplicate records found."
                      columns={[{ key: "row_number", label: "Row" }, ...result.columns.map((c) => ({ key: c, label: c }))]}
                      rows={result.duplicates.rows}
                    />
                  )}

                  {tab === "anomalies" && (
                    <DataTable
                      empty="No outliers found."
                      columns={[
                        { key: "row_number", label: "Row" },
                        { key: "column", label: "Column" },
                        { key: "value", label: "Value" },
                        { key: "range", label: "Expected range" },
                      ]}
                      rows={result.anomalies.anomalies.map((a) => ({
                        ...a,
                        range: `${a.expected_range[0]} to ${a.expected_range[1]}`,
                      }))}
                    />
                  )}

                  {tab === "ml" &&
                    (result.ml_anomalies.ran ? (
                      <DataTable
                        empty="No unusual records found."
                        columns={[
                          { key: "row_number", label: "Row" },
                          { key: "anomaly_score", label: "Anomaly score" },
                          { key: "vals", label: "Values" },
                        ]}
                        rows={result.ml_anomalies.anomalies.map((a) => ({
                          ...a,
                          vals: Object.entries(a.values).map(([k, v]) => `${k}: ${v}`).join(" · "),
                        }))}
                      />
                    ) : (
                      <div className="empty neutral">ML analysis not run: {result.ml_anomalies.reason}</div>
                    ))}

                  {tab === "recs" && (
                    <DataTable
                      empty="No issues to fix."
                      columns={[
                        { key: "severity", label: "Severity", render: (v) => <span className={`badge ${v}`}>{v}</span> },
                        { key: "target", label: "Where" },
                        { key: "detail", label: "Problem" },
                        { key: "action", label: "Suggested fix" },
                      ]}
                      rows={result.recommendations}
                    />
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}