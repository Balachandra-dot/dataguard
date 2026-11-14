import { useState, useEffect } from "react";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { ShieldIcon, EyeIcon, EyeOffIcon } from "./icons";
import HeroScene from "./HeroScene";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const WORDS = ["missing values", "duplicates", "anomalies", "bad records"];
const PILLS = ["Missing values", "Duplicates", "ML anomaly detection", "PDF audit reports"];

const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["#dc2626", "#dc2626", "#f59e0b", "#84cc16", "#16a34a"];

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return pw ? s : 0;
}

const errMsg = (e) => {
  const d = e.response?.data?.detail;
  if (typeof d === "string") return d;
  if (e.response) return "Please check your details and try again.";
  return "Could not reach the server. Is the backend running?";
};

function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % WORDS.length), 2400);
    return () => clearInterval(t);
  }, []);
  return <span key={i} className="rot-word">{WORDS[i]}</span>;
}

function PasswordField({ label, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="pw-wrap">
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required
        />
        <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label="Show or hide password">
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    identifier: "", name: "", username: "", email: "", phone: "", password: "", confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const fail = (message) => {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const finish = (user, token) => {
    setDone(user);
    setTimeout(() => onLogin(user, token), 1100);
  };

  const switchMode = (m) => {
    setMode(m);
    setError("");
    setForm({ ...form, password: "", confirm: "" });
  };

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (mode === "register" && form.password !== form.confirm) {
      return fail("Passwords do not match.");
    }
    setLoading(true);
    try {
      const res =
        mode === "login"
          ? await axios.post(`${API}/auth/login`, {
              identifier: form.identifier,
              password: form.password,
            })
          : await axios.post(`${API}/auth/register`, {
              name: form.name,
              username: form.username,
              email: form.email,
              phone: form.phone,
              password: form.password,
            });
      finish(res.data.user, res.data.token);
    } catch (err) {
      fail(errMsg(err));
      setLoading(false);
    }
  };

  const googleSuccess = async (response) => {
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/google`, { credential: response.credential });
      finish(res.data.user, res.data.token);
    } catch (err) {
      fail(errMsg(err));
      setLoading(false);
    }
  };

  const s = strength(form.password);

  return (
    <div className="login-page">
      <section className="login-hero" onMouseMove={onMove}>
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="hero-grid" />
        <div className="hero-spot" />

        <div className="hero-content">
          <div className="hero-brand fade-up">
            <span className="hero-logo"><ShieldIcon width={26} height={26} /></span>
            <span>DataGuard</span>
          </div>

          <h1 className="hero-title fade-up" style={{ animationDelay: "0.1s" }}>
            Catch <RotatingWord /> before they reach your decisions.
          </h1>
          <p className="hero-text fade-up" style={{ animationDelay: "0.2s" }}>
            Upload a CSV, Excel or PDF table and get a full data quality report in seconds.
          </p>

          <div className="fade-up" style={{ animationDelay: "0.3s" }}>
            <HeroScene />
          </div>

          <div className="hero-pills fade-up" style={{ animationDelay: "0.45s" }}>
            {PILLS.map((p) => <span key={p} className="pill">{p}</span>)}
          </div>
        </div>
      </section>

      <section className="login-side">
        <div className="mobile-brand">
          <span className="hero-logo dark"><ShieldIcon width={22} height={22} /></span>
          <strong>DataGuard</strong>
        </div>

        {done ? (
          <div className="login-card success">
            <svg className="check" viewBox="0 0 52 52">
              <circle className="check-circle" cx="26" cy="26" r="24" />
              <path className="check-mark" d="M14 27l8 8 16-17" />
            </svg>
            <h2>Welcome{done.name ? `, ${done.name.split(" ")[0]}` : ""}!</h2>
            <p className="login-sub">Taking you to your dashboard…</p>
          </div>
        ) : (
          <form
            className={`login-card ${mode === "register" ? "wide compact" : ""} ${shake ? "shake" : ""}`}
            onSubmit={submit}
          >
            <div className="auth-tabs">
              <button type="button" className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>
                Sign in
              </button>
              <button type="button" className={`auth-tab ${mode === "register" ? "active" : ""}`} onClick={() => switchMode("register")}>
                Create account
              </button>
            </div>

            {mode === "login" ? (
              <>
                <label className="field">
                  <span>Username, email or phone</span>
                  <input
                    type="text"
                    placeholder="e.g. balu_k, you@gmail.com or +919876543210"
                    value={form.identifier}
                    onChange={set("identifier")}
                    autoComplete="username"
                    required
                  />
                </label>
                <PasswordField
                  label="Password"
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </>
            ) : (
              <>
                <label className="field">
                  <span>Full name</span>
                  <input type="text" placeholder="Your name" value={form.name} onChange={set("name")} autoComplete="name" required />
                </label>
                <label className="field">
                  <span>Username</span>
                  <input type="text" placeholder="e.g. balu_k" value={form.username} onChange={set("username")} autoComplete="username" required />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input type="email" placeholder="you@gmail.com" value={form.email} onChange={set("email")} autoComplete="email" required />
                </label>
                <label className="field">
                  <span>Phone <em className="optional">(optional)</em></span>
                  <input type="tel" placeholder="+919876543210" value={form.phone} onChange={set("phone")} autoComplete="tel" />
                </label>
                <PasswordField
                  label="Password"
                  value={form.password}
                  onChange={set("password")}
                  placeholder="At least 8 characters, letters and numbers"
                  autoComplete="new-password"
                />
                {form.password && (
                  <div className="strength">
                    <div className="bar">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${(s / 4) * 100}%`,
                          background: STRENGTH_COLORS[s],
                          transition: "width 0.3s, background 0.3s",
                        }}
                      />
                    </div>
                    <small>{STRENGTH_LABELS[s]}</small>
                  </div>
                )}
                <PasswordField
                  label="Confirm password"
                  value={form.confirm}
                  onChange={set("confirm")}
                  placeholder="Type the password again"
                  autoComplete="new-password"
                />
              </>
            )}

            {error && <div className="login-error">{error}</div>}

            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? (
                <><span className="spinner" /> Please wait...</>
              ) : mode === "login" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </button>

            <div className="divider">or continue with</div>

            <div className="google-wrap">
              <GoogleLogin
                onSuccess={googleSuccess}
                onError={() => fail("Google sign-in failed. Please try again.")}
                theme="outline"
                size="large"
                shape="pill"
                text="continue_with"
                width="320"
              />
            </div>

            <button type="button" className="social-btn facebook" disabled>
              <strong>f</strong> Continue with Facebook <em>Soon</em>
            </button>

            <p className="login-note">
              Passwords are stored as secure hashes. DataGuard can never read them.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}