// src/lib/groups.js
import { api } from "@/lib/api";

export const createGroup = (name, description="", visibility="public") =>
  api.post("/groups", { name, description, visibility }).then(r => r.data);

export const listMyGroups = () =>
  api.get("/groups/mine").then(r => r.data);

export const searchGroups = (q) =>
  api.get("/groups/search", { params: { q } }).then(r => r.data);

export const joinGroupByInvite = (invite_code) =>
  api.post("/groups/join", { invite_code }).then(r => r.data);

export const leaveGroup = (group_id) =>
  api.post("/groups/leave", { group_id }).then(r => r.data);

export const getGroup = (group_id) =>
  api.get(`/groups/${group_id}`).then(r => r.data);

export const getGroupPresence = (group_id) =>
  api.get(`/groups/${group_id}/presence`).then(r => r.data);

export const getGroupRanking = (group_id, period="week") =>
  api.get(`/rankings/groups/${group_id}`, { params: { period } }).then(r => r.data);
