// src/pages/AuthCallback.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Aguarda 1 segundo para garantir que o cookie foi setado
    setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 1000);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center">
        <div className="mb-4">
          <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-white text-lg">Autenticando...</p>
        <p className="text-gray-400 text-sm mt-2">Aguarde um momento</p>
      </div>
    </div>
  );
}
