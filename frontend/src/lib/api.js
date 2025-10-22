// src/lib/api.js
import axios from "axios";

// Escolhe a URL do backend de forma segura (Vite, CRA ou fallback)
function pickBackendURL() {
  // Vite
  const viteUrl =
    (typeof import.meta !== "undefined" && import.meta.env)
      ? import.meta.env.VITE_BACKEND_URL
      : undefined;

  // CRA
  const craUrl =
    (typeof process !== "undefined" && process.env)
      ? process.env.REACT_APP_BACKEND_URL
      : undefined;

  // (opcional) Global injetado no index.html
  const globalUrl =
    (typeof window !== "undefined")
      ? (window.__BACKEND_URL__ || window.BACKEND_URL)
      : undefined;

  const raw = globalUrl || viteUrl || craUrl || "http://localhost:5000";
  const base = raw.replace(/\/+$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}


export const api = axios.create({
  baseURL: pickBackendURL(),
  withCredentials: true,
});

// ---------- helpers de identidade ----------
const LS_UID = "backend_user_id";
const LS_TOKEN = "backend_token";

async function ensureAuthIdentity() {
  const token = localStorage.getItem(LS_TOKEN);
  const uid = localStorage.getItem(LS_UID);
  if (token || uid) return { token, uid };

  try {
    const r = await api.get("/auth/me").catch(() => ({ data: null }));
    const u = r?.data?.user ?? r?.data ?? null;
    
    if (u?.token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${u.token}`;
    } else {
      delete api.defaults.headers.common["Authorization"];
    }

    // ✅ persista a identidade (id/token) para os interceptors usarem
    if (u?.id) {
      Auth.setUser(u);
    } else {
      Auth.clear();
    }
    
    if (r?.data?.id) localStorage.setItem(LS_UID, r.data.id);
    if (r?.data?.token) localStorage.setItem(LS_TOKEN, r.data.token);
    return { token: r?.data?.token || null, uid: r?.data?.id || null };
  } catch {
    return { token: null, uid: null };
  }
}

// ---------- interceptors ----------
api.interceptors.request.use(async (config) => {
  const needsAuth =
    ["post", "put", "patch", "delete"].includes((config.method || "get").toLowerCase()) ||
    (config.url && (config.url.startsWith("/groups") || config.url.startsWith("/rankings")));

  if (needsAuth) await ensureAuthIdentity();

  const token = localStorage.getItem(LS_TOKEN);
  const uid = localStorage.getItem(LS_UID);

  if (token) config.headers.Authorization = `Bearer ${token}`;
  else if (uid) config.headers.Authorization = `Bearer ${uid}`;

  if (uid) config.headers["X-User-Id"] = uid;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const status = err?.response?.status;
    if (status === 401 && !err.config.__retried) {
      err.config.__retried = true;
      await ensureAuthIdentity();
      return api.request(err.config);
    }
    return Promise.reject(err);
  }
);

export const Auth = {
  setUser(user) {
    if (!user) return;
    if (user.id) localStorage.setItem(LS_UID, user.id);
    if (user.token) localStorage.setItem(LS_TOKEN, user.token);
  },
  clear() {
    localStorage.removeItem(LS_UID);
    localStorage.removeItem(LS_TOKEN);
  },
};
