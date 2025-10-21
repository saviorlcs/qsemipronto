// frontend/src/App.js
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Shop from "./pages/Shop";
import Settings from "./pages/Settings";
import Friends from "./pages/Friends";
import NicknameSetup from "./pages/NicknameSetup";
import Agenda from "./pages/Agenda";
import Rankings from "./pages/Rankings";
import Groups from "./pages/Groups";
import GroupView from "./pages/GroupView";
import { Toaster } from "./components/ui/sonner";
import "@/App.css";
import { bootApply } from "@/lib/siteStyle";
import { presenceOpen, presencePing, presenceLeave } from "@/lib/friends";

/* ---------------- Auth / Guard ---------------- */

function AuthHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAuthed, setIsAuthed] = useState(false);

  // carrega /auth/me e faz o roteamento protegido
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get("/auth/me").catch(() => ({ data: null }));
        const u = r?.data?.user ?? r?.data ?? null;

        // header p/ chamadas que precisam de bearer simples
        if (u?.id) {
          api.defaults.headers.common["Authorization"] = `Bearer ${u.id}`;
        } else {
          delete api.defaults.headers.common["Authorization"];
        }

        setUser(u);
        setIsAuthed(!!u?.id);

        // rotas
        const path = location.pathname;
        const hasNick = !!(u?.nickname && u?.tag);

        if (path === "/") {
          if (u?.id) navigate("/dashboard", { replace: true });
        } else if (path === "/setup") {
          if (!u?.id) navigate("/", { replace: true });
          if (u?.id && hasNick) navigate("/dashboard", { replace: true });
        } else {
          if (!u?.id) navigate("/", { replace: true });
        }
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, [location.pathname, navigate]);

  // aplica tema/borda equipados (se houver)
  useEffect(() => {
    if (!user?.equipped_items) return;
    const { theme, border } = user.equipped_items;
    bootApply({
      themeId: theme?.id ?? theme,
      borderId: border?.id ?? border,
      themeEffects: theme?.effects,
      borderEffects: border?.effects,
    });
  }, [user]);

  // presença apenas quando logado
  useEffect(() => {
    if (!isAuthed) return;
    presenceOpen().catch(() => {});
    const t = setInterval(() => presencePing(false), 60_000);
    const mark = () => presencePing(true);
    window.addEventListener("click", mark);
    window.addEventListener("keydown", mark);
    window.addEventListener("scroll", mark);
    presencePing(false);

    return () => {
      clearInterval(t);
      window.removeEventListener("click", mark);
      window.removeEventListener("keydown", mark);
      window.removeEventListener("scroll", mark);
      try {
        const url = `${api.defaults.baseURL}/presence/leave`;
        const body = new Blob([JSON.stringify({})], { type: "application/json" });
        navigator.sendBeacon?.(url, body);
      } catch {
        presenceLeave().catch(() => {});
      }
    };
  }, [isAuthed]);

  if (checking) return null; // splash/loader opcional
  return null;               // não renderiza UI — só guarda e efeitos globais
}

/* ---------------- App ---------------- */

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthHandler />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/setup" element={<NicknameSetup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/grupos" element={<Groups />} />
          <Route path="/grupos/:id" element={<GroupView />} />
          <Route path="/loja" element={<Shop />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/amigos" element={<Friends />} />
          <Route path="/agenda" element={<Agenda />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}
