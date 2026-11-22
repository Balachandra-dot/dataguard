import { useState, useEffect } from "react";
import axios from "axios";
import { API, errMsg } from "../api";
import { formatDate } from "../ui";

export default function SettingsPage({ user, theme, onToggleTheme, onSession, onLogout, onHistoryCleared, notify }) {
  const [me, setMe] = useState(null);
  const [name, setName] = useState(user.name || "");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [delPassword, setDelPassword] = useState("");
  const [delError, setDelError] = useState("");

  useEffect(() => {
    axios.get(`${API}/auth/me`).then((r) => setMe(r.data)).catch(() => {});
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy("profile");
    try {
      const res = await axios.patch(`${API}/auth/profile`, { name });
      onSession(res.data.user, res.data.token);
      notify("Profile updated");
    } catch (err) {
      notify(errMsg(err), "error");
    }
    setBusy("");
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError("");
    if (pw.next !== pw.confirm) return setPwError("New passwords do not match.");
    setBusy("password");
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: pw.current,
        new_password: pw.next,
      });
      setPw({ current: "", next: "", confirm: "" });
      notify("Password changed");
    } catch (err) {
      setPwError(errMsg(err));
    }
    setBusy("");
  };

  const clearHistory = async () => {
    if (!window.confirm("Delete ALL your saved analyses? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/analyses`);
      onHistoryCleared();
      notify("History cleared");
    } catch (err) {
      notify(errMsg(err), "error");
    }
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    setDelError("");
    setBusy("delete");
    try {
      await axios.delete(`${API}/auth/account`, { data: { password: delPassword || null } });
      onLogout();
    } catch (err) {
      setDelError(errMsg(err));
      setBusy("");
    }
  };

  const hasPassword = me ? me.has_password : false;

  return (
    <div className="settings-grid">
      {/* Profile */}
      <section className="panel fade-up">
        <h3>Profile</h3>
        <p className="panel-sub">Your name appears in the top bar and on your account.</p>
        <div className="profile-head">
          {user.picture ? (
            <img className="avatar big" src={user.picture} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="avatar big">{(user.name || "?").charAt(0).toUpperCase()}</div>
          )}
          <div>
            <strong>{user.name}</strong>
            <div className="muted">{user.email || user.username}</div>
          </div>
        </div>

        <form onSubmit={saveProfile}>
          <label className="field">
            <span>Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} />
          </label>
          <button className="btn btn-primary btn-sm" type="submit" disabled={busy === "profile" || name.trim() === user.name}>
            {busy === "profile" ? "Saving..." : "Save name"}
          </button>
        </form>

        {me && (
          <dl className="info-grid">
            <dt>Username</dt><dd>{me.username || "—"}</dd>
            <dt>Email</dt><dd>{me.email || "—"}</dd>
            <dt>Phone</dt><dd>{me.phone || "—"}</dd>
            <dt>Sign-in method</dt><dd>{me.provider === "google" ? "Google" : "Password"}</dd>
            <dt>Member since</dt><dd>{formatDate(me.created_at)}</dd>
          </dl>
        )}
      </section>

      {/* Appearance */}
      <section className="panel fade-up">
        <h3>Appearance</h3>
        <p className="panel-sub">Choose how DataGuard looks on this device.</p>
        <div className="setting-row">
          <div>
            <strong>Dark mode</strong>
            <div className="muted">Easier on the eyes in low light.</div>
          </div>
          <button
            className={`switch ${theme === "dark" ? "on" : ""}`}
            onClick={onToggleTheme}
            aria-label="Toggle dark mode"
          />
        </div>
      </section>

      {/* Security */}
      <section className="panel fade-up">
        <h3>Security</h3>
        {me && !hasPassword ? (
          <p className="panel-sub">You sign in with Google, so there is no password to change here.</p>
        ) : (
          <>
            <p className="panel-sub">Use at least 8 characters with letters and numbers.</p>
            <form onSubmit={changePassword}>
              <label className="field">
                <span>Current password</span>
                <input type="password" autoComplete="current-password" value={pw.current}
                  onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
              </label>
              <label className="field">
                <span>New password</span>
                <input type="password" autoComplete="new-password" value={pw.next}
                  onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
              </label>
              <label className="field">
                <span>Confirm new password</span>
                <input type="password" autoComplete="new-password" value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
              </label>
              {pwError && <div className="login-error">{pwError}</div>}
              <button className="btn btn-primary btn-sm" type="submit" disabled={busy === "password" || !me}>
                {busy === "password" ? "Changing..." : "Change password"}
              </button>
            </form>
          </>
        )}
      </section>

      {/* Data */}
      <section className="panel fade-up">
        <h3>Your data</h3>
        <p className="panel-sub">Saved analyses are stored so you can reopen them and download reports later.</p>
        <div className="setting-row">
          <div>
            <strong>Clear analysis history</strong>
            <div className="muted">Deletes every saved analysis and report.</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={clearHistory}>Clear history</button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Sign out</strong>
            <div className="muted">Sign out on this device.</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onLogout}>Sign out</button>
        </div>
      </section>

      {/* Danger */}
      <section className="panel danger-panel fade-up">
        <h3>Delete account</h3>
        <p className="panel-sub">Permanently deletes your account and all saved analyses. This cannot be undone.</p>
        {!showDelete ? (
          <button className="btn btn-danger btn-sm" onClick={() => setShowDelete(true)}>Delete my account</button>
        ) : (
          <form onSubmit={deleteAccount}>
            {hasPassword && (
              <label className="field">
                <span>Enter your password to confirm</span>
                <input type="password" autoComplete="current-password" value={delPassword}
                  onChange={(e) => setDelPassword(e.target.value)} required />
              </label>
            )}
            {delError && <div className="login-error">{delError}</div>}
            <div className="row-actions">
              <button className="btn btn-danger btn-sm" type="submit" disabled={busy === "delete"}>
                {busy === "delete" ? "Deleting..." : "Yes, delete everything"}
              </button>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => setShowDelete(false)}>Cancel</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}