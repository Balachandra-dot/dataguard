import { useState, useEffect } from "react";
import axios from "axios";
import Login from "./Login";
import Dashboard from "./Dashboard";
import "./App.css";

const savedUser = () => {
  try {
    return JSON.parse(localStorage.getItem("dg_user"));
  } catch {
    return null;
  }
};

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("dg_token"));
  const [user, setUser] = useState(savedUser);
  const [theme, setTheme] = useState(() => localStorage.getItem("dg_theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dg_theme", theme);
  }, [theme]);

  // Send the token with every request
  useEffect(() => {
    if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete axios.defaults.headers.common.Authorization;
  }, [token]);

  // If the backend says "401", the session expired, so sign out
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (r) => r,
      (err) => {
        if (err.response?.status === 401) logout();
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  const login = (u, t) => {
    localStorage.setItem("dg_token", t);
    localStorage.setItem("dg_user", JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem("dg_token");
    localStorage.removeItem("dg_user");
    setToken(null);
    setUser(null);
  };

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return token && user ? (
    <Dashboard user={user} onLogout={logout} theme={theme} onToggleTheme={toggleTheme} />
  ) : (
    <Login onLogin={login} />
  );
}