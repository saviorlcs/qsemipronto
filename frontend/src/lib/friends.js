// src/lib/friends.js
import { api } from "@/lib/api";

// --- Solicitações ---
export const sendFriendRequest = (nickname, tag) =>
  api.post("/friends/requests", { friend_nickname: nickname, friend_tag: tag });

export const listFriendRequests = () =>
  api.get("/friends/requests").then(r => r.data);

export const acceptFriendRequest = (requestId) =>
  api.post(`/friends/requests/${requestId}/accept`);

export const rejectFriendRequest = (requestId) =>
  api.post(`/friends/requests/${requestId}/reject`);

// --- Amigos + presença ---
// >>> AGORA usando a rota nova
export const getFriendsPresence = () =>
  api.get("/friends/list").then(r => r.data);

// --- Presença ---
export const presenceOpen  = () => api.post("/presence/open",  {}, { withCredentials: true });
export const presencePing  = (active=false) => api.post("/presence/ping",  { active }, { withCredentials: true });
export const presenceLeave = () => api.post("/presence/leave", {}, { withCredentials: true });

// Timer do usuário atual (para o backend saber seu estado)
export const setTimerState = (state, seconds_left = null) =>
  api.post("/study/timer/state", { state, seconds_left });
