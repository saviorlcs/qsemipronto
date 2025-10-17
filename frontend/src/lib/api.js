// frontend/src/lib/api.js
import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

export const api = axios.create({
  baseURL: `${BACKEND}/api`,   // <-- garante o /api
  withCredentials: true,       // <-- manda o cookie
});


// ⚠️ Remova QUALQUER interceptor que coloque Authorization do localStorage.
// Ex.: se você tinha algo como abaixo, APAGUE:
// api.interceptors.request.use((config) => {
//   const uid = localStorage.getItem("backend_user_id");
//   if (uid) config.headers.Authorization = `Bearer ${uid}`;
//   return config;
// });
