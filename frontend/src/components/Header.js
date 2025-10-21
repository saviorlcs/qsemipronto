// src/components/Header.js
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Trophy, ShoppingBag, Users, Settings, LogOut, ListOrdered } from "lucide-react";
import SealAvatar from "./SealAvatar";

function loginGoogle() {
  const root = (api?.defaults?.baseURL || (process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000"))
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
  window.location.href = `${root}/api/auth/google/login`;
}

export default function Header({ user: userProp }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(userProp ?? null);
  const [loading, setLoading] = useState(userProp === undefined);

  const handle = user?.nickname && user?.tag ? `${user.nickname}#${user.tag}` : null;
  const displayName = handle || user?.name || "Usuário";

  // ...imports e estado (user, loading) iguais

useEffect(() => {
  setUser(userProp ?? null);
  if (userProp === undefined) setLoading(true);
}, [userProp]);

useEffect(() => {
  if (userProp !== undefined) return;
  (async () => {
    try {
      const r = await api.get("/auth/me");
      setUser(r.data || null);
      // 👉 salva credenciais p/ os interceptors usarem
      if (r?.data?.id)   localStorage.setItem("backend_user_id", r.data.id);
      if (r?.data?.token) localStorage.setItem("backend_token", r.data.token);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  })();
}, [userProp]);

const handleLogout = async () => {
  try {
    await api.post("/auth/logout");
  } catch {}
  // limpa headers e credenciais locais
  delete api.defaults.headers.common["Authorization"];
  localStorage.removeItem("backend_user_id");
  localStorage.removeItem("backend_token");
  setUser(null);
  navigate("/");
};


  if (loading) return null;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 grid grid-cols-12 items-center gap-3">
        {/* ESQUERDA — Marca */}
        <div className="col-span-4 sm:col-span-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xl tracking-wide font-extrabold text-white hover:text-cyan-300 transition-colors"
            style={{ fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.5px" }}
            aria-label="Ir para o painel"
          >
            POMOCICLO
          </button>

          {/* Token leves (se logado) */}
          {user && (
            <>
              <div className="hidden lg:flex items-center gap-2 bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 rounded-lg">
                <Trophy className="w-4 h-4 text-amber-300" />
                <span className="text-amber-200 text-sm font-semibold">Nv {user.level}</span>
              </div>
              <div className="hidden lg:flex items-center gap-2 bg-blue-500/15 border border-blue-400/30 px-2.5 py-1 rounded-lg">
                <span className="text-blue-200 text-sm font-semibold">{user.coins} coins</span>
              </div>
            </>
          )}
        </div>

        {/* CENTRO — Navegação principal (Agenda em destaque) */}
        <nav className="col-span-8 sm:col-span-6 flex items-center justify-center gap-2">
          <Link
            to="/agenda"
            className="px-3 py-2 rounded-xl text-sm font-semibold text-white
                       bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500
                       shadow-sm shadow-cyan-900/40"
          >
            Agenda
          </Link>
          <Link
            to="/rankings"
            className="px-3 py-2 rounded-xl text-sm font-semibold text-cyan-200 border border-cyan-700/40 hover:bg-slate-800/60"
          >
            <span className="inline-flex items-center gap-2">
              <ListOrdered className="w-4 h-4" />
              Rankings
            </span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/loja")}
            className="text-gray-300 hover:text-white"
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            Loja
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/amigos")}
            className="text-gray-300 hover:text-white"
          >
            <Users className="w-4 h-4 mr-2" />
            Amigos
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/configuracoes")}
            className="text-gray-300 hover:text-white"
          >
            <Settings className="w-4 h-4 mr-2" />
            Config
          </Button>
          <Button
  variant="ghost" size="sm"
  onClick={() => navigate("/grupos")}
  className="text-gray-300 hover:text-white"
>
  Grupos
</Button>

        </nav>

        {/* DIREITA — Usuário */}
        <div className="col-span-12 sm:col-span-3 flex items-center justify-end gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-2">
                <SealAvatar
  size={44}
  user={user} // objeto retornado do /auth/me (com nickname e tag)
  equippedSeal={user?.equipped_items?.seal}
/>

                <div className="leading-tight text-right">
                  <div className="text-[11px] text-gray-400">{handle || "—"}</div>
                  <div className="text-white font-semibold">{user?.name || "Usuário"}</div>
                </div>
              </div>
              <Button
                data-testid="logout-button"
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-300 hover:text-white"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button onClick={loginGoogle} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Entrar com Google
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
