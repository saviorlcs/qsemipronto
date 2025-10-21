// src/pages/GroupView.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { getGroup, getGroupPresence, getGroupRanking, leaveGroup } from "@/lib/groups";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Pill = ({ className="", children }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${className}`}>{children}</span>
);
const statusPill = (s)=> s==="online"
  ? {wrap:"bg-emerald-500/15 text-emerald-300", text:"Online"}
  : s==="away" ? {wrap:"bg-amber-500/15 text-amber-300", text:"Ausente"}
  : {wrap:"bg-zinc-500/15 text-zinc-400", text:"Offline"};

function MemberRow({ m }) {
  const s = statusPill(m.status);
  const handle = m?.nickname && m?.tag ? `${m.nickname}#${m.tag}` : m?.name || m?.id || "membro";
  const sub = m.status==="offline" ? "—"
    : m.timer_state==="focus" ? `Estudando • ${m.studying || ""}`
    : m.timer_state==="paused" ? `Pausado • ${m.studying || ""}`
    : m.timer_state==="break" ? "Intervalo" : "Na página";
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 flex items-center justify-between">
      <div>
        <div className="text-white font-medium">{handle}</div>
        <div className="text-xs text-zinc-400">{sub}</div>
      </div>
      <Pill className={s.wrap}>{s.text}</Pill>
    </div>
  );
}

function RankRow({i, row}) {
  const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 flex items-center justify-between">
      <div className="text-lg">{medal}</div>
      <div className="flex-1 px-3 truncate">
        <div className="text-white font-medium truncate">{row.handle || row.name || row.id}</div>
      </div>
      <div className="text-cyan-300 font-semibold">{row.blocks} blocos</div>
    </div>
  );
}

export default function GroupView() {
  const { id } = useParams();
  const [user, setUser] = useState(undefined);
  const [g, setG] = useState(null);
  const [presence, setPresence] = useState([]);
  const [rank, setRank] = useState([]);
  const [period, setPeriod] = useState("week");
  const navigate = useNavigate();

  useEffect(()=>{ api.get("/auth/me").then(r=>setUser(r.data||null)).catch(()=>setUser(null)); }, []);

  const load = async () => {
    const [info, pres, rk] = await Promise.all([
      getGroup(id),
      getGroupPresence(id),
      getGroupRanking(id, period),
    ]);
    setG(info); setPresence(pres); setRank(rk);
  };

  useEffect(()=>{ load(); const t=setInterval(()=>getGroupPresence(id).then(setPresence), 12000); return ()=>clearInterval(t); }, [id]);
  useEffect(()=>{ getGroupRanking(id, period).then(setRank); }, [id, period]);

  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(g.invite_code); toast.success("Código copiado!"); }
    catch { toast.error("Não foi possível copiar"); }
  };
  const onLeave = async () => {
    await leaveGroup(id);
    toast.success("Você saiu do grupo");
    navigate("/grupos");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900">
      <Header user={user} />
      <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        {!g ? (
          <div className="text-zinc-400">Carregando…</div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-white text-xl font-semibold">{g.name}</h1>
                <div className="text-sm text-zinc-400">{g.description}</div>
                <div className="mt-2 text-xs text-zinc-300">
                  Convite: <code className="px-1.5 py-0.5 rounded bg-slate-700/60">{g.invite_code}</code>
                  <button className="ml-2 text-cyan-300 hover:underline" onClick={copyInvite}>copiar</button>
                </div>
              </div>
              <Button variant="secondary" onClick={onLeave}>Sair do grupo</Button>
            </div>

            <div className="grid md:grid-cols-12 gap-6">
              <section className="md:col-span-6 space-y-3">
                <h3 className="text-white font-medium">Ao vivo</h3>
                {presence.length === 0 ? (
                  <div className="text-zinc-400 text-sm">Ninguém ativo agora.</div>
                ) : presence.map((m)=> <MemberRow key={m.id} m={m} />)}
              </section>

              <section className="md:col-span-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-medium">Ranking do grupo</h3>
                  <div className="flex items-center gap-1">
                    {["day","week","month","all"].map(p=>(
                      <button key={p} onClick={()=>setPeriod(p)}
                        className={`px-2 py-1 rounded-full text-xs border ${period===p?"bg-cyan-600 text-white border-cyan-500":"text-zinc-300 border-slate-700 hover:bg-slate-800/60"}`}>
                        {p==="day"?"Hoje":p==="week"?"Semana":p==="month"?"Mês":"Sempre"}
                      </button>
                    ))}
                  </div>
                </div>
                {rank.length===0 ? (
                  <div className="text-zinc-400 text-sm">Sem dados para o período.</div>
                ) : rank.map((r,i)=><RankRow key={r.id} i={i} row={r} />)}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
