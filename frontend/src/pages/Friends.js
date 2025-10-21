// src/pages/Friends.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFriendsPresence,
  listFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  presencePing,
} from "@/lib/friends";
import { api } from "@/lib/api";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Mail,
  Loader2,
  Circle,
  BookOpen,
  PauseCircle,
  Coffee,
} from "lucide-react";

/* ————— UI helpers (mantive sua lógica/estilo) ————— */
const Pill = ({ className = "", children }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${className}`}>
    {children}
  </span>
);
const statusPill = (s) =>
  s === "online"
    ? { wrap: "bg-emerald-500/15 text-emerald-300", dot: "text-emerald-400", text: "Online" }
    : s === "away"
    ? { wrap: "bg-amber-500/15 text-amber-300", dot: "text-amber-400", text: "Ausente" }
    : { wrap: "bg-zinc-500/15 text-zinc-400", dot: "text-zinc-400", text: "Offline" };
const mmss = (sec) => {
  if (sec == null) return null;
  const s = Math.max(0, sec | 0);
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};
const StatusPill = ({ status }) => {
  const m = statusPill(status);
  return (
    <Pill className={m.wrap}>
      <Circle className={`w-2.5 h-2.5 ${m.dot}`} /> {m.text}
    </Pill>
  );
};
const TimerBadge = ({ timer_state, studying, seconds_left }) => {
  const t = mmss(seconds_left);
  if (!timer_state) return null;
  if (timer_state === "focus")
    return (
      <Pill className="bg-sky-500/15 text-sky-300">
        <BookOpen className="w-3.5 h-3.5" /> Estudando {studying ? `• ${studying}` : ""} {t ? `• ${t}` : ""}
      </Pill>
    );
  if (timer_state === "paused")
    return (
      <Pill className="bg-violet-500/15 text-violet-300">
        <PauseCircle className="w-3.5 h-3.5" /> Pausado {studying ? `• ${studying}` : ""} {t ? `• ${t}` : ""}
      </Pill>
    );
  if (timer_state === "break")
    return (
      <Pill className="bg-pink-500/15 text-pink-300">
        <Coffee className="w-3.5 h-3.5" /> Intervalo {t ? `• ${t}` : ""}
      </Pill>
    );
  return null;
};

/* ————— Cards ————— */
function FriendCard({ f }) {
  const handle = f?.nickname && f?.tag ? `${f.nickname}#${f.tag}` : f?.name || "Amigo";
  const [sec, setSec] = useState(typeof f.seconds_left === "number" ? f.seconds_left : null);

  useEffect(() => setSec(typeof f.seconds_left === "number" ? f.seconds_left : null), [f.seconds_left]);
  useEffect(() => {
    if (sec == null || f.status === "offline") return;
    const t = setInterval(() => setSec((s) => (s == null ? null : Math.max(0, s - 1))), 1000);
    return () => clearInterval(t);
  }, [sec, f.status]);

  const subline = useMemo(() => {
    if (f.status === "offline") return "Última atividade desconhecida";
    if (!f.show_timer) return "Na página";
    if (f.timer_state === "focus") return "Na página • estudando";
    if (f.timer_state === "paused") return "Na página • pausado";
    if (f.timer_state === "break") return "Na página • intervalo";
    return "Na página";
  }, [f.status, f.timer_state, f.show_timer]);

  return (
    <div className="group rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800/80 transition-colors p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium truncate max-w-[60vw] sm:max-w-md">
              {handle}
            </span>
            <StatusPill status={f.status} />
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">{subline}</div>
        </div>
        <div className="text-right">{f.show_timer ? <TimerBadge {...f} seconds_left={sec} /> : null}</div>
      </div>
    </div>
  );
}

function RequestRow({ req, type, refresh }) {
  const [loading, setLoading] = useState(false);
  const fromYou = type === "outgoing";
  const onAccept = async () => {
    try {
      setLoading(true);
      await acceptFriendRequest(req.id);
      toast.success("Solicitação aceita");
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao aceitar");
    } finally {
      setLoading(false);
    }
  };
  const onReject = async () => {
    try {
      setLoading(true);
      await rejectFriendRequest(req.id);
      toast.success("Solicitação recusada");
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao recusar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-blue-300" />
        <div className="text-sm text-zinc-200">
          {fromYou ? (
            <>
              Você convidou{" "}
              <span className="font-medium">
                {req.to || `${req.friend_nickname}#${req.friend_tag}`}
              </span>
            </>
          ) : (
            <>
              <span className="font-medium">
                {req.from || `${req.friend_nickname}#${req.friend_tag}`}
              </span>{" "}
              convidou você
            </>
          )}
        </div>
      </div>
      {fromYou ? (
        <Pill className="bg-zinc-500/15 text-zinc-400">Pendente</Pill>
      ) : (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onAccept} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aceitar"}
          </Button>
          <Button size="sm" variant="secondary" onClick={onReject} disabled={loading}>
            Recusar
          </Button>
        </div>
      )}
    </div>
  );
}

/* ————— Página Friends com navegação “Discord-like” ————— */
export default function Friends() {
  const navigate = useNavigate();

  // views: available | all | pending | add
  const [view, setView] = useState("available");

  // header/user
  const [user, setUser] = useState(null);

  // presença e requisições
  const [friends, setFriends] = useState([]);
  const [loadingPresence, setLoadingPresence] = useState(true);
  const [reqIn, setReqIn] = useState([]);
  const [reqOut, setReqOut] = useState([]);
  const [loadingReq, setLoadingReq] = useState(false);

  // adicionar amigo
  const [handle, setHandle] = useState("");
  const [sending, setSending] = useState(false);

  // carregamento do usuário para Header (mantém padrão visual do site)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get("/auth/me");
        if (!alive) return;
        setUser(r?.data || null);
      } catch {
        navigate("/", { replace: true });
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  const refreshPresence = async () => {
    try {
      setLoadingPresence(true);
      const data = await getFriendsPresence();
      setFriends(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[presence]", e?.response?.data || e);
    } finally {
      setLoadingPresence(false);
    }
  };
  const refreshRequests = async () => {
    try {
      setLoadingReq(true);
      const all = await listFriendRequests();
      setReqIn(all?.incoming || []);
      setReqOut(all?.outgoing || []);
    } catch (e) {
      console.error("[requests]", e?.response?.data || e);
    } finally {
      setLoadingReq(false);
    }
  };

  useEffect(() => {
    presencePing(true).catch(() => {});
    refreshPresence();
    refreshRequests();
    const t = setInterval(refreshPresence, 12_000);
    return () => clearInterval(t);
  }, []);

  // filtros e contadores
  const friendsOnline = friends.filter((f) => f.status === "online" || f.status === "away");
  const friendsOffline = friends.filter((f) => f.status === "offline");
  const pendingCount = (reqIn?.length || 0) + (reqOut?.length || 0);

  // ordena “todos”: disponíveis primeiro
  const allSorted = useMemo(() => {
    const sortKey = (s) => (s === "online" ? 0 : s === "away" ? 1 : 2);
    return [...friends].sort((a, b) => sortKey(a.status) - sortKey(b.status));
  }, [friends]);

  const onSend = async () => {
    if (sending) return;
    try {
      setSending(true);
      const [nickname, tag] = (handle || "").split("#");
      if (!nickname || !tag) {
        toast.error("Use o formato nick#tag");
        return;
      }
      await sendFriendRequest(nickname.trim(), tag.trim());
      toast.success("Solicitação enviada!");
      setHandle("");
      await refreshRequests();
      setView("pending");
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Não foi possível enviar";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  // item do menu lateral
  const NavItem = ({ id, icon: Icon, label, badge }) => {
    const active = view === id;
    return (
      <button
        onClick={() => setView(id)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition
        ${active ? "bg-slate-700/70 text-white" : "text-zinc-300 hover:bg-slate-700/40"}`}
      >
        <span className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-semibold tracking-wide">{label}</span>
        </span>
        {badge != null && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-cyan-500/20 text-cyan-300" : "bg-zinc-600/30 text-zinc-300"}`}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900" style={{ fontFamily: "Inter, sans-serif" }}>
      <Header user={user} />

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid md:grid-cols-12 gap-6">
          {/* — Lateral / Navegação — */}
          <aside className="md:col-span-3 space-y-3">
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
              <div className="text-zinc-400 text-xs font-semibold uppercase mb-2">Amigos</div>

              <div className="space-y-2">
                <NavItem id="available" icon={Circle} label="DISPONÍVEL" badge={friendsOnline.length} />
                <NavItem id="all" icon={Users} label="TODOS" badge={friends.length} />
                <NavItem id="pending" icon={Mail} label="PENDENTE" badge={pendingCount} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
              <div className="text-zinc-400 text-xs font-semibold uppercase mb-2">Ações</div>
              <NavItem id="add" icon={UserPlus} label="ADICIONAR AMIGO" />
            </div>
          </aside>

          {/* — Conteúdo — */}
          <main className="md:col-span-9 space-y-6">
            {/* DISPONÍVEL */}
            {view === "available" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Circle className="w-4 h-4 text-emerald-400" /> Disponível
                  </h2>
                  {loadingPresence && (
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" /> atualizando…
                    </span>
                  )}
                </div>

                {friendsOnline.length === 0 ? (
                  <div className="text-zinc-400 text-sm">Ninguém disponível agora.</div>
                ) : (
                  <div className="grid gap-3">{friendsOnline.map((f) => <FriendCard key={f.id} f={f} />)}</div>
                )}
              </div>
            )}

            {/* TODOS */}
            {view === "all" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4" /> Todos
                  </h2>
                  {loadingPresence && (
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" /> atualizando…
                    </span>
                  )}
                </div>

                {allSorted.length === 0 ? (
                  <div className="text-zinc-400 text-sm">Você ainda não tem amigos adicionados.</div>
                ) : (
                  <div className="grid gap-3">{allSorted.map((f) => <FriendCard key={f.id} f={f} />)}</div>
                )}
              </div>
            )}

            {/* PENDENTE */}
            {view === "pending" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Solicitações
                  </h2>
                  {loadingReq && (
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" /> carregando…
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-zinc-300 text-sm">Recebidas</h3>
                  {reqIn.length === 0 ? (
                    <div className="text-zinc-400 text-sm">Você não tem solicitações recebidas.</div>
                  ) : (
                    reqIn.map((r) => (
                      <RequestRow key={r.id} req={r} type="incoming" refresh={refreshRequests} />
                    ))
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-zinc-300 text-sm">Enviadas</h3>
                  {reqOut.length === 0 ? (
                    <div className="text-zinc-400 text-sm">Você não enviou solicitações.</div>
                  ) : (
                    reqOut.map((r) => (
                      <RequestRow key={r.id} req={r} type="outgoing" refresh={refreshRequests} />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ADICIONAR AMIGO */}
            {view === "add" && (
              <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 space-y-3">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> Adicionar amigo
                </h2>
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="nick#tag"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSend();
                      }
                    }}
                    className="bg-slate-900/60 text-white placeholder:text-zinc-500"
                  />
                  <Button onClick={onSend} disabled={sending}>
                    <UserPlus className="w-4 h-4 mr-2" /> Enviar
                  </Button>
                </div>
                <div className="text-xs text-zinc-400">
                  Convide pelo identificador completo (ex.: <span className="text-zinc-300">seuNick#1234</span>).
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
