// frontend/src/context/CycleContext.jsx
import { createContext, useContext, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";

const Ctx = createContext(null);
export const useCycle = () => useContext(Ctx);

export function CycleProvider({ children }) {
  // ---- TIMER (novo) ----
  const [status, setStatus] = useState("idle"); // "idle" | "running" | "paused"
  const [remainingMs, setRemainingMs] = useState(0);
  const timerRef = useRef(null);

  const clearTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const tick = () => {
    setRemainingMs((prev) => {
      const next = Math.max(0, prev - 1000);
      if (next <= 0) {
        clearTimer();
        setStatus("idle");
      }
      return next;
    });
  };

  function startTimer(ms) {
    clearTimer();
    setRemainingMs(ms);
    setStatus("running");
    timerRef.current = setInterval(tick, 1000);
  }
  function pauseTimer() {
    if (status !== "running") return;
    clearTimer();
    setStatus("paused");
  }
  function resumeTimer() {
    if (status !== "paused" || remainingMs <= 0) return;
    clearTimer();
    setStatus("running");
    timerRef.current = setInterval(tick, 1000);
  }

  // ---- ESTUDO (seu modelo antigo, mantido) ----
  const [activeSubject, setActiveSubject] = useState(null); // {id,name,...}
  const [currentBlockMinutes, setCurrentBlockMinutes] = useState(50); // 50/10
  const sessionIdRef = useRef(null);
  const [cycleOverrides, setCycleOverrides] = useState({}); // { [subjectId]: minutosDescontados }

  async function startSubject(subject) {
    // evita start duplicado
    if (activeSubject?.id === subject.id && (status === "running" || status === "paused")) return;

    setActiveSubject(subject);
    setCurrentBlockMinutes(50);

    // abre sessão no backend (se der erro, só ignora)
    try {
      const r = await api.post("/study/start", { subject_id: subject.id });
      sessionIdRef.current = r.data?.id ?? null;
    } catch {}
  }

  async function endCurrentBlock({ skipped = false, minutes = currentBlockMinutes } = {}) {
    if (sessionIdRef.current) {
      try {
        await api.post("/study/end", { session_id: sessionIdRef.current, duration: minutes, skipped });
      } catch {}
    }
    sessionIdRef.current = null;
    clearTimer();
    setStatus("idle");
    setRemainingMs(0);
  }

  /** PULAR BLOCO — funciona mesmo parado */
  async function skipBlock() {
    // para o timer se estiver rodando
    clearTimer();
    setStatus("idle");

    // se tinha sessão aberta, encerra como pulada (sem contar)
    if (sessionIdRef.current) {
      try {
        await api.post("/study/end", { session_id: sessionIdRef.current, duration: 0, skipped: true });
      } catch {}
      sessionIdRef.current = null;
    }

    // prepara o próximo bloco (deixa parado; se quiser, chame startTimer abaixo)
    setRemainingMs(currentBlockMinutes * 60 * 1000);
  }

  /** VOLTAR 1 bloco (apenas visual) */
  function prevBlock() {
    if (!activeSubject) return;
    setCycleOverrides((old) => {
      const m = Math.max(0, (old[activeSubject.id] || 0) + currentBlockMinutes);
      return { ...old, [activeSubject.id]: m };
    });
    clearTimer();
    setStatus("idle");
    sessionIdRef.current = null;
  }

  function resetBlock() {
    clearTimer();
    setStatus("idle");
    sessionIdRef.current = null;
    setRemainingMs(currentBlockMinutes * 60 * 1000);
  }

  function resetCycle() {
    clearTimer();
    setStatus("idle");
    setCycleOverrides({});
    sessionIdRef.current = null;
  }

  const value = useMemo(
    () => ({
      // timer API (usada no Dashboard)
      status,
      remainingMs,
      startTimer,
      pauseTimer,
      resumeTimer,
      skipBlock,
      // estudo / compat
      activeSubject,
      currentBlockMinutes,
      cycleOverrides,
      startSubject,
      endCurrentBlock,
      prevBlock,
      resetBlock,
      resetCycle,
    }),
    [status, remainingMs, activeSubject, currentBlockMinutes, cycleOverrides]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
