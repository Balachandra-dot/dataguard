import { useState, useEffect } from "react";
import axios from "axios";
import { API, errMsg, downloadReport } from "../api";
import { FileIcon } from "../icons";
import { ScoreBadge, formatDate } from "../ui";

export default function ReportsPage({ onOpen, notify }) {
  const [items, setItems] = useState(null);
  const [sort, setSort] = useState("new");

  useEffect(() => {
    axios
      .get(`${API}/analyses`)
      .then((r) => setItems(r.data))
      .catch((e) => {
        notify(errMsg(e), "error");
        setItems([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = items
    ? [...items].sort((a, b) =>
        sort === "high" ? b.score - a.score : sort === "low" ? a.score - b.score : 0
      )
    : [];

  const pdf = async (a) => {
    try {
      await downloadReport(a.id, a.filename);
    } catch (e) {
      notify(errMsg(e), "error");
    }
  };

  return (
    <>
      <div className="toolbar">
        <span className="muted">One audit report per analysis. Reports are rebuilt from saved results.</span>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="new">Newest first</option>
          <option value="high">Highest score</option>
          <option value="low">Lowest score</option>
        </select>
      </div>

      {items === null && <div className="skeleton tall" />}

      {items && items.length === 0 && (
        <div className="placeholder">No reports yet. Analyze a file and its report will appear here.</div>
      )}

      <div className="report-grid">
        {sorted.map((a) => (
          <div className="report-card fade-up" key={a.id}>
            <div className="report-top">
              <div className="report-icon"><FileIcon /></div>
              <ScoreBadge value={a.score} />
            </div>
            <div className="report-name" title={a.filename}>{a.filename}</div>
            <div className="muted">{formatDate(a.created_at)}</div>
            <div className="report-meta">{a.rows} rows · {a.issues} issues</div>
            <div className="report-actions">
              <button className="btn btn-primary btn-sm" onClick={() => pdf(a)}>⬇ PDF report</button>
              <button className="btn btn-outline btn-sm" onClick={() => onOpen(a.id)}>View</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}