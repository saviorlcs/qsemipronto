// src/pages/Groups.jsx
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { createGroup, listMyGroups, searchGroups, joinGroupByInvite } from "@/lib/groups";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Groups() {
  const [user, setUser] = useState(undefined);
  const [mine, setMine] = useState([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [invite, setInvite] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/auth/me").then(r => setUser(r.data || null)).catch(()=>setUser(null));
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const [m] = await Promise.all([listMyGroups()]);
      setMine(m || []);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    refresh();
  }, []);

  const onCreate = async () => {
    if (!name.trim()) return toast.error("Dê um nome ao grupo");
    try {
      const g = await createGroup(name, desc, "public");
      toast.success("Grupo criado!");
      navigate(`/grupos/${g.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao criar");
    }
  };
  const onJoin = async () => {
    if (!invite.trim()) return toast.error("Cole o código de convite");
    try {
      const r = await joinGroupByInvite(invite.trim());
      toast.success("Você entrou no grupo!");
      navigate(`/grupos/${r.group_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Convite inválido");
    }
  };
  const onSearch = async () => {
    const data = await searchGroups(q.trim());
    setResults(data || []);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900">
      <Header user={user} />
      <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
        <h1 className="text-white text-xl font-semibold">Grupos</h1>

        <div className="grid md:grid-cols-12 gap-6">
          <div className="md:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 space-y-3">
              <h3 className="text-white font-medium">Criar grupo</h3>
              <Input placeholder="Nome do grupo" value={name} onChange={(e)=>setName(e.target.value)} />
              <Input placeholder="Descrição (opcional)" value={desc} onChange={(e)=>setDesc(e.target.value)} />
              <Button onClick={onCreate}>Criar</Button>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 space-y-3">
              <h3 className="text-white font-medium">Entrar por convite</h3>
              <Input placeholder="Código de convite" value={invite} onChange={(e)=>setInvite(e.target.value)} />
              <Button onClick={onJoin}>Entrar</Button>
            </div>
          </div>

          <div className="md:col-span-7 space-y-6">
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
              <div className="flex items-center gap-2">
                <Input placeholder="Buscar grupos públicos…" value={q} onChange={e=>setQ(e.target.value)}
                  onKeyDown={(e)=>e.key==="Enter" && onSearch()} />
                <Button onClick={onSearch}>Buscar</Button>
              </div>
              <div className="mt-3 space-y-2">
                {results.length === 0 ? (
                  <div className="text-zinc-400 text-sm">Use a busca para descobrir grupos públicos.</div>
                ) : results.map(g => (
                  <div key={g.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{g.name}</div>
                      <div className="text-xs text-zinc-400">{g.description}</div>
                    </div>
                    <Link to={`/grupos/${g.id}`} className="text-cyan-300 text-sm hover:underline">Ver</Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
              <h3 className="text-white font-medium mb-3">Meus grupos</h3>
              {loading ? (
                <div className="text-zinc-400 text-sm">Carregando…</div>
              ) : mine.length === 0 ? (
                <div className="text-zinc-400 text-sm">Você ainda não participa de nenhum grupo.</div>
              ) : (
                <div className="space-y-2">
                  {mine.map(g => (
                    <div key={g.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">{g.name}</div>
                        <div className="text-xs text-zinc-400">{g.description}</div>
                      </div>
                      <Link to={`/grupos/${g.id}`} className="text-cyan-300 text-sm hover:underline">Abrir</Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
