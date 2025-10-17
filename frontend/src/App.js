// frontend/src/pages/App.js
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Shop from "./pages/Shop";
import Settings from "./pages/Settings";
import Friends from "./pages/Friends";
import NicknameSetup from "./pages/NicknameSetup";
import { Toaster } from "./components/ui/sonner";
import "@/App.css";

function AuthHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        // 1) Checa se está autenticado (cookie HttpOnly)
        const res = await api.get("/auth/me"); // << sem concatenar /api
        const user = res.data?.user;

        // 2) Se está na landing ("/"), decide pra onde ir
        if (location.pathname === "/") {
          if (!user?.nickname || !user?.tag) {
            navigate("/setup", { replace: true });
          } else {
            navigate("/dashboard", { replace: true });
          }
        } else if (location.pathname !== "/setup" && (!user?.nickname || !user?.tag)) {
          // Se tentou entrar em outra rota sem nickname/tag, manda pra setup
          navigate("/setup", { replace: true });
        }
      } catch (err) {
        // Não autenticado
        if (location.pathname !== "/") {
          navigate("/", { replace: true });
        }
      } finally {
        if (alive) setIsChecking(false);
      }
    }

    check();
    return () => { alive = false; };
  }, [navigate, location]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900">
        <div className="text-xl font-medium text-white">Carregando...</div>
      </div>
    );
  }
  return null;
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthHandler />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/setup" element={<NicknameSetup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/loja" element={<Shop />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/amigos" element={<Friends />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}
