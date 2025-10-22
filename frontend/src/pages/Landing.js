import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api"; // usa a instância com withCredentials
import { Button } from "../components/ui/button";
import { Clock, Target, Trophy, BookOpen } from "lucide-react";

function loginGoogle() {
  // Pega BACKEND do .env e remove o /api pra formar a base
  const base = (process.env.REACT_APP_BACKEND_URL || "http://localhost:5000/api").replace("/api", "");
  // Redireciona pro SEU backend (nada de Emergent)
  window.location.href = `${base}/api/auth/google/login`;
}

export default function Landing() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/auth/me"); // chama seu backend
        if (res.data?.user) {
          navigate("/dashboard");
        } else {
          setIsLoading(false);
        }
      } catch {
        setIsLoading(false);
      }
    })();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-xl font-medium text-gray-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-6" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            CicloStudy
          </h1>
          <p className="text-lg lg:text-xl text-gray-700 max-w-2xl mx-auto mb-8" style={{ fontFamily: "Inter, sans-serif" }}>
            Aprenda sem cronogramas rígidos. Use ciclos de estudo flexíveis com Pomodoro integrado.
          </p>

          {/* Botão CERTINHO de login */}
          <Button
            data-testid="login-button"
            onClick={loginGoogle}
            size="lg"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 text-lg rounded-full shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            Entrar com Google
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Pomodoro Timer
            </h3>
            <p className="text-gray-600" style={{ fontFamily: "Inter, sans-serif" }}>
              Técnica de estudos com intervalos configuráveis (padrão 50:10)
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Ciclos Flexíveis
            </h3>
            <p className="text-gray-600" style={{ fontFamily: "Inter, sans-serif" }}>
              Meta semanal sem cronogramas rígidos. Estude no seu ritmo!
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Trophy className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Gamificação
            </h3>
            <p className="text-gray-600" style={{ fontFamily: "Inter, sans-serif" }}>
              Ganhe XP, suba de nível e desbloqueie itens na loja
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Organização
            </h3>
            <p className="text-gray-600" style={{ fontFamily: "Inter, sans-serif" }}>
              Crie matérias, listas de tarefas e acompanhe seu progresso
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
