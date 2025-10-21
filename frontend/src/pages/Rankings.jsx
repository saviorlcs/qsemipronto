// src/pages/Rankings.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import Header from "@/components/Header";
import { Users, Globe2, Shield } from "lucide-react"; // Group não existe; use um ícone qualquer, ex.: Users
import { Link } from "react-router-dom";

const PeriodPill = ({ value, current, onChange, children }) => (
  <button
    onClick={() => onChange(value)}
    className={`px-2.5 py-1 rounded-full text-xs border ${
      current === value ? "bg-cyan-600 text-white border-cyan-500" : "text-zinc-300 border-slate-700 hover:bg-slate-800/60"
    }`}
  >
    {children}
  </button>
);

function RankRow({ i, item }) {
  const rank = i + 1;
  const medal =
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
  return (
    <div className="grid grid-cols-12 items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3">
      <div className="col-span-2 sm:col-span-1 text-lg text-center">{medal}</div>
      <div className="col-span-6 sm:col-span-7 truncate">
        <div className="text-white font-medium truncate">{item.handle || item.name || "Usuário"}</div>
        <div className="text-xs text-zinc-400 truncate">{item.group_name || item.subtitle || ""}</div>
      </div>
      <div className="col-span-4 sm:col-span-4 text-right">
        <div className="text-cyan-300 font-semibold">{item.blocks} blocos</div>
        <div className="text-[11px] text-zinc-400">{item.minutes} min</div>
      </div>
    </div>
  );
}

export default function Rankings() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState("global"); // global | friends | groups
  const [period, setPeriod] = useState("week"); // day | week | month | all
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // carrega usuário pro Header
  useEffect(() => {
    api.get("/auth/me").then((r) => setUser(r.data || null)).catch(() => setUser(null));
  }, []);

  const fetchers = {
    global: () => api.get("/rankings/global", { params: { period } }),
    friends: () => api.get("/rankings/friends", { params: { period } }),
    groups: () => api.get("/rankings/groups", { params: { period } }),
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (fetchers[tab]() || Promise.resolve({ data: [] }))
      .then((r) => {
        if (!alive) return;
        // Esperado do backend: [{handle, name, blocks, minutes, group_name?}, ...]
        setData(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => alive && setData([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tab, period]);

  const title =
    tab === "global" ? "Ranking Global"
      : tab === "friends" ? "Ranking entre Amigos"
      : "Ranking por Grupos";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900">
      <Header user={user} />
      <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("global")}
            className={`px-3 py-2 rounded-xl text-sm ${
              tab === "global" ? "bg-slate-700/70 text-white" : "text-zinc-300 hover:bg-slate-800/60"
            }`}
          >
            🌍 Global
          </button>
          <button
            onClick={() => setTab("friends")}
            className={`px-3 py-2 rounded-xl text-sm ${
              tab === "friends" ? "bg-slate-700/70 text-white" : "text-zinc-300 hover:bg-slate-800/60"
            }`}
          >
            👥 Amigos
          </button>
          <button
            onClick={() => setTab("groups")}
            className={`px-3 py-2 rounded-xl text-sm ${
              tab === "groups" ? "bg-slate-700/70 text-white" : "text-zinc-300 hover:bg-slate-800/60"
            }`}
          >
            🛡️ Grupos
          </button>

          <div className="ml-auto flex items-center gap-1">
            <PeriodPill value="day" current={period} onChange={setPeriod}>Hoje</PeriodPill>
            <PeriodPill value="week" current={period} onChange={setPeriod}>Semana</PeriodPill>
            <PeriodPill value="month" current={period} onChange={setPeriod}>Mês</PeriodPill>
            <PeriodPill value="all" current={period} onChange={setPeriod}>Sempre</PeriodPill>
          </div>
        </div>

        {/* Título */}
        <div className="flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
          <div className="text-xs text-zinc-400">Conta apenas <b>blocos completos</b> (resetar/pular não contam).</div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-zinc-400 text-sm">Carregando…</div>
        ) : data.length === 0 ? (
          <div className="text-zinc-400 text-sm">Ainda não há dados para este período.</div>
        ) : (
          <div className="space-y-2">
            {data.map((row, i) => <RankRow key={`${row.id || row.handle}-${i}`} i={i} item={row} />)}
          </div>
        )}
// onde monta os cards do tab "groups"
<div className="space-y-2">
  {data.map((row, i) => (
    <Link key={row.group_id} to={`/grupos/${row.group_id}`} className="block">
      {/* seu card aqui */}
    </Link>
  ))}
</div>

        {/* CTA de grupos (opcional) */}
        {tab === "groups" && (
  <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-zinc-300">
    Quer competir com seu time? <Link to="/grupos" className="text-cyan-300 hover:underline">crie ou entre em um grupo</Link>.
  </div>
)}

      </div>
    </div>
  );
}
