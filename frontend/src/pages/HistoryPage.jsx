import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API, errMsg, downloadReport } from "../api";
import { DataTable, ScoreBadge, formatDate } from "../ui";

export default function HistoryPage({ onOpen, notify }) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");

  const load = useCallback(
    async (query) => {
      try {
        const res = await axios.get(`${API}/analyses`, { params: { q: query } });
        setItems(res.data);
      } catch (e) {
        notify(errMsg(e), "error");
        setItems([]);
      }
    },
    [notify]
  );

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const remove = async (a) => {
    if (!window.confirm(`Delete the analysis of "${a.filename}"?`)) return;
    try {
      await axios.delete(`${API}/analyses/${a.id}`);
      notify("Analysis deleted");
      load(q);
    } catch (e) {
      notify(errMsg(e), "error");
    }
  };

  const pdf = async (a) => {
    try {
      await downloadReport(a.id, a.filename);
    } catch (e) {
      notify(errMsg(e), "error");
    }
  };

  return (
    <section className="panel fade-up">
      <div className="toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Search by file name..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="muted">{items ? `${items.length} analyses` : ""}</span>
      </div>

      {items === null ? (
        <div className="skeleton tall" />
      ) : (
        <DataTable
          neutral
          empty={q ? "No analyses match your search." : "No analyses yet. Upload a file on the Data Quality page."}
          columns={[
            { key: "filename", label: "File" },
            { key: "created_at", label: "Date", render: (v) => formatDate(v) },
            { key: "rows", label: "Rows" },
            { key: "score", label: "Score", render: (v) => <ScoreBadge value={v} /> },
            { key: "issues", label: "Issues" },
            {
              key: "actions",
              label: "",
              render: (_, r) => (
                <div className="row-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => onOpen(r.id)}>Open</button>
                  <button className="btn btn-outline btn-sm" onClick={() => pdf(r)}>PDF</button>
                  <button className="btn btn-outline btn-sm" onClick={() => remove(r)}>Delete</button>
                </div>
              ),
            },
          ]}
          rows={items}
        />
      )}
    </section>
  );
}