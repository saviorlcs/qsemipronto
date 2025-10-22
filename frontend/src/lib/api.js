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
  withCredentials: true, // Importante: permite envio de cookies
});

// Função auxiliar para obter CSRF token do cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// ---------- interceptors ----------
// Adiciona o CSRF token automaticamente em requisições que precisam
api.interceptors.request.use(
  (config) => {
    // Para métodos que modificam dados, adiciona o CSRF token
    if (["post", "put", "patch", "delete"].includes((config.method || "get").toLowerCase())) {
      const csrfToken = getCookie('csrf_token');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Trata erros 401 redirecionando para login se necessário
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Se receber 401, o usuário não está autenticado
      // Você pode redirecionar para a página de login aqui se necessário
      console.log('Usuário não autenticado');
    }
    return Promise.reject(error);
  }
);

// Auth helper simplificado - agora usa cookies, não localStorage
export const Auth = {
  // O backend gerencia a autenticação via cookies
  // Não precisamos mais armazenar tokens manualmente
  clear() {
    // Opcional: chamar endpoint de logout para limpar cookies no servidor
    api.post('/auth/logout').catch(() => {});
  },
};
