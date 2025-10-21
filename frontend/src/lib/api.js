// src/lib/api.js
import axios from "axios";

const RAW = (process.env.REACT_APP_BACKEND_URL && process.env.REACT_APP_BACKEND_URL.trim())
  || "http://127.0.0.1:5000";
const baseURL = RAW.endsWith("/api") ? RAW : `${RAW}/api`;

export const api = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true, // mantém cookies se o backend usar
});

// -------------- helpers --------------
const LS_UID = "backend_user_id";
const LS_TOKEN = "backend_token";

async function ensureAuthIdentity() {
  // se já temos algo, ok
  const token = localStorage.getItem(LS_TOKEN);
  const uid = localStorage.getItem(LS_UID);
  if (token || uid) return { token, uid };

  // tenta obter via /auth/me e salvar
  try {
    const r = await api.get("/auth/me");
    if (r?.data?.id) localStorage.setItem(LS_UID, r.data.id);
    if (r?.data?.token) localStorage.setItem(LS_TOKEN, r.data.token);
    return { token: r?.data?.token || null, uid: r?.data?.id || null };
  } catch {
    return { token: null, uid: null };
  }
}

// -------------- interceptors --------------
api.interceptors.request.use(async (config) => {
  // garanta que temos identidade na 1ª request sensível
  const needsAuth = ["post", "put", "patch", "delete"].includes((config.method||"get").toLowerCase())
                 || (config.url && config.url.startsWith("/groups"))
                 || (config.url && config.url.startsWith("/rankings"));
  if (needsAuth) await ensureAuthIdentity();

  const token = localStorage.getItem(LS_TOKEN);
  const uid = localStorage.getItem(LS_UID);

  if (token) config.headers.Authorization = `Bearer ${token}`;
  else if (uid) config.headers.Authorization = `Bearer ${uid}`; // muitos backends aceitam assim

  // fallback extra (alguns backends leem outro header)
  if (uid) config.headers["X-User-Id"] = uid;

  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    // se 401, tente 1x renovar identidade via /auth/me e repita a request
    const status = err?.response?.status;
    if (status === 401 && !err.config.__retried) {
      err.config.__retried = true;
      await ensureAuthIdentity();
      return api.request(err.config);
    }
    return Promise.reject(err);
  }
);

// exporte helpers para login/logout quando precisar
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
