import { useState } from "react";
import axios from "axios";
import { API, errMsg } from "./api";
import { ShieldIcon, SunIcon, MoonIcon, LogoutIcon, ChartIcon, FileIcon, ClockIcon, GearIcon } from "./icons";
import AnalyzePage from "./pages/AnalyzePage";
import HistoryPage from "./pages/HistoryPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";

const NAV = [
  { id: "analyze", label: "Data Quality", icon: ChartIcon },
  { id: "reports", label: "Reports", icon: FileIcon },
  { id: "history", label: "History", icon: ClockIcon },
  { id: "settings", label: "Settings", icon: GearIcon },
];

const TITLES = {
  analyze: ["Data Quality Analysis", "Upload a dataset to check its quality"],
  reports: ["Reports", "Download audit reports for your analyses"],
  history: ["History", "Every analysis you have run"],
  settings: ["Settings", "Manage your profile, security and data"],
};

export default function Dashboard({ user, onLogout, onSession, theme, onToggleTheme }) {
  const [page, setPage] = useState("analyze");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = (message, type = "ok") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  const openAnalysis = async (id) => {
    try {
      const res = await axios.get(`${API}/analyses/${id}`);
      setResult(res.data);
      setFile(null);
      setPage("analyze");
    } catch (e) {
      notify(errMsg(e), "error");
    }
  };

  const [title, subtitle] = TITLES[page];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="side-logo"><ShieldIcon width={22} height={22} /></span>
          <div>
            <div className="side-title">DataGuard</div>
            <div className="side-sub">Data Quality Platform</div>
          </div>
        </div>

        <nav className="side-nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              onClick={() => setPage(n.id)}
            >
              <n.icon /> {n.label}
            </button>
          ))}
        </nav>

        <div className="side-foot">v1.1 · Internal use</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-sub">{subtitle}</p>
          </div>
          <div className="top-actions">
            <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme" title="Toggle theme">
              {theme === "light" ? <MoonIcon /> : <SunIcon />}
            </button>
            <div className="user">
              {user.picture ? (
                <img className="avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="avatar">{(user.name || "?").charAt(0).toUpperCase()}</div>
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
          {page === "analyze" && (
            <AnalyzePage file={file} setFile={setFile} result={result} setResult={setResult} notify={notify} />
          )}
          {page === "reports" && <ReportsPage onOpen={openAnalysis} notify={notify} />}
          {page === "history" && <HistoryPage onOpen={openAnalysis} notify={notify} />}
          {page === "settings" && (
            <SettingsPage
              user={user}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onSession={onSession}
              onLogout={onLogout}
              onHistoryCleared={() => { setResult(null); setFile(null); }}
              notify={notify}
            />
          )}
        </main>
      </div>

      {/* Phone navigation (the sidebar is hidden on small screens) */}
      <nav className="bottom-nav">
        {NAV.map((n) => (
          <button key={n.id} className={page === n.id ? "active" : ""} onClick={() => setPage(n.id)}>
            <n.icon /> {n.label}
          </button>
        ))}
      </nav>

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}