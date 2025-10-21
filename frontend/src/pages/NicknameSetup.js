// frontend/src/pages/NicknameSetup.js
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export default function NicknameSetup() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [tag, setTag] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
useEffect(() => {
  let alive = true;
  (async () => {
    try {
      await api.get("/auth/me");   // 200 = logado
      if (!alive) return;
      navigate("/dashboard", { replace: true });
    } catch {
      // não logado -> permanece no /setup
    }
  })();
  return () => { alive = false; };
}, [navigate]);

  // ❗️Se já estiver logado, NÃO deixa ficar no /setup
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await api.get("/auth/me"); // 200 = logado
        if (!alive) return;
        navigate("/dashboard", { replace: true });
      } catch {
        // não logado -> permanece no /setup
      }
    })();
    return () => { alive = false; };
  }, [navigate]);

  const validateNickname = (v) => /^[A-Za-z0-9]{4,16}$/.test(v);
  const validateTag = (v) => /^[A-Za-z0-9]{3,4}$/.test(v);

  const checkAvailability = async () => {
    const n = nickname.trim();
    const t = tag.trim();
    if (!validateNickname(n)) return toast.error("Nickname deve ter 4-16 caracteres alfanuméricos");
    if (!validateTag(t)) return toast.error("Tag deve ter 3-4 caracteres alfanuméricos");

    setIsChecking(true);
    try {
      const res = await api.get("/user/nickname/check", { params: { nickname: n, tag: t } });
      res.data?.available
        ? toast.success("Este nickname#tag está disponível!")
        : toast.error(res.data?.reason || "Este nickname#tag já está em uso");
    } catch {
      toast.error("Erro ao verificar disponibilidade");
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = nickname.trim();
    const t = tag.trim();
    if (!validateNickname(n)) return toast.error("Nickname deve ter 4-16 caracteres alfanuméricos");
    if (!validateTag(t)) return toast.error("Tag deve ter 3-4 caracteres alfanuméricos");

    setIsSubmitting(true);
    try {
      await api.post("/user/nickname", { nickname: n, tag: t });
      // Depois de criar, manda direto pro dashboard
      toast.success(`Nickname criado: ${n}#${t}`);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Erro ao criar nickname#tag");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/50 backdrop-blur border-slate-700">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            Bem-vindo ao CicloStudy!
          </CardTitle>
          <CardDescription className="text-gray-400 mt-2">
            Primeiro, escolha seu nickname#tag único
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label className="text-gray-300 mb-2 block">Nickname</Label>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                placeholder="4-16 caracteres"
                maxLength={16}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Apenas letras e números (4-16 caracteres)</p>
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">Tag</Label>
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                placeholder="3-4 caracteres"
                maxLength={4}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Apenas letras e números (3-4 caracteres)</p>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
              <p className="text-sm text-cyan-300 text-center font-semibold">
                {nickname && tag ? `${nickname}#${tag}` : "seu_nickname#tag"}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={checkAvailability}
                disabled={!nickname || !tag || isChecking}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white"
              >
                {isChecking ? "Verificando..." : "Verificar"}
              </Button>

              <Button
                type="submit"
                disabled={!nickname || !tag || isSubmitting}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                {isSubmitting ? "Criando..." : "Criar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
