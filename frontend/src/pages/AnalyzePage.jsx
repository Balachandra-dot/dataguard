import { useState } from "react";
import axios from "axios";
import { API, errMsg, saveBlob, downloadReport } from "../api";
import { UploadIcon } from "../icons";
import { DataTable, Ring, Metric, StatTile, Skeleton, scoreColor, scoreLabel, formatDate } from "../ui";

export default function AnalyzePage({ file, setFile, result, setResult, notify }) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("missing");
  const [dragging, setDragging] = useState(false);

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
      const form = new FormData();
      form.append("file", file);
      const res = await axios.post(`${API}/analyze`, form);
      setResult(res.data);
      setTab("missing");
      notify("Analysis saved to History");
    } catch (e) {
      setResult(null);
      setError(errMsg(e));
    }
    setLoading(false);
  };

  const getPdf = async () => {
    setBusy("report");
    try {
      await downloadReport(result.analysis_id, result.filename);
    } catch (e) {
      notify(errMsg(e), "error");
    }
    setBusy("");
  };

  const getCleaned = async () => {
    setBusy("clean");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await axios.post(`${API}/clean`, form, { responseType: "blob" });
      saveBlob(res.data, `cleaned_${file.name.replace(/\.[^.]+$/, "")}.csv`);
      notify("Cleaned CSV downloaded");
    } catch (e) {
      notify(errMsg(e), "error");
    }
    setBusy("");
  };

  const missingRows = result
    ? Object.entries(result.missing.columns).map(([col, v]) => ({
        column: col, count: v.missing_count, percent: v.missing_percent,
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
        { id: "preview", label: "Data preview", count: result.preview ? result.preview.length : "–" },
        { id: "profile", label: "Columns", count: result.profile ? result.profile.length : "–" },
      ]
    : [];

  return (
    <>
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
              <div className="drop-sub">CSV, Excel (.xlsx) or PDF with a table · up to 25 MB</div>
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
            <>
              <button className="btn btn-outline" onClick={getPdf} disabled={busy === "report"}>
                {busy === "report" ? "Generating..." : "⬇ Audit report (PDF)"}
              </button>
              <button
                className="btn btn-outline"
                onClick={getCleaned}
                disabled={!file || busy === "clean"}
                title={file ? "" : "Upload the file again to clean it"}
              >
                {busy === "clean" ? "Cleaning..." : "⬇ Cleaned data (CSV)"}
              </button>
            </>
          )}
        </div>

        {result && (
          <p className="muted hint">
            Cleaning removes duplicate rows, fills missing numbers with the median and missing text with
            "Unknown". Outliers are only flagged, never changed, so review them yourself.
          </p>
        )}
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
          {result.created_at && (
            <div className="banner">Saved analysis from {formatDate(result.created_at)}</div>
          )}

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

              {tab === "preview" && (
                <DataTable
                  neutral
                  empty="Preview not available for this older analysis."
                  columns={result.columns.map((c) => ({ key: c, label: c }))}
                  rows={result.preview}
                />
              )}

              {tab === "profile" && (
                <DataTable
                  neutral
                  empty="Column details not available for this older analysis."
                  columns={[
                    { key: "column", label: "Column" },
                    { key: "type", label: "Type" },
                    { key: "unique", label: "Unique" },
                    { key: "missing", label: "Missing" },
                    { key: "min", label: "Min" },
                    { key: "max", label: "Max" },
                    { key: "mean", label: "Mean" },
                  ]}
                  rows={result.profile}
                />
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}