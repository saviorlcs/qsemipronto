import { createContext, useContext, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";

const Ctx = createContext(null);
export const useCycle = () => useContext(Ctx);

/**
 * Guarda o assunto ativo, a fila de blocos do assunto atual
 * e funções de controle que tanto o botão pequeno (na lista)
 * quanto os botões GRANDES vão usar em comum.
 */
export function CycleProvider({ children }) {
  const [activeSubject, setActiveSubject] = useState(null);      // {id, name, time_goal, ...}
  const [isRunning, setIsRunning] = useState(false);
  const [currentBlockMinutes, setCurrentBlockMinutes] = useState(50); // 50/10 padrão
  const sessionIdRef = useRef(null);

  // “desconto” visual de progresso (ponto 2)
  const [cycleOverrides, setCycleOverrides] = useState({}); // { [subjectId]: minutesToSubtract }

  async function startSubject(subject) {
    // evita start duplo
    if (isRunning && activeSubject?.id === subject.id) return;

    setActiveSubject(subject);
    setIsRunning(true);
    setCurrentBlockMinutes(50);

    // abre sessão no backend
    const r = await api.post("/study/start", { subject_id: subject.id });
    sessionIdRef.current = r.data.id;
  }

  async function endCurrentBlock({ skipped = false, minutes = currentBlockMinutes }) {
    if (!sessionIdRef.current) return;

    await api.post("/study/end", {
      session_id: sessionIdRef.current,
      duration: minutes,
      skipped
    });

    // prepara próxima sessão (mesmo assunto)
    sessionIdRef.current = null;
    setIsRunning(false);
  }

  /** pula o bloco atual (marca como skipped, não dá coins/xp) */
  async function skipBlock() {
    await endCurrentBlock({ skipped: true, minutes: 0 });
  }

  /**
   * volta um bloco:
   * - PARA O UI do ciclo a gente “desconta” o progresso do assunto
   * - NÃO mexemos em coins/xp (ponto 2)
   */
  function prevBlock() {
    if (!activeSubject) return;
    setCycleOverrides((old) => {
      const m = Math.max(0, (old[activeSubject.id] || 0) + currentBlockMinutes);
      return { ...old, [activeSubject.id]: m };
    });
    // visualmente paramos o timer
    setIsRunning(false);
    sessionIdRef.current = null;
  }

  /** reseta só o bloco atual (para e zera timer) */
  function resetBlock() {
    setIsRunning(false);
    sessionIdRef.current = null;
  }

  /** reseta TODO ciclo (remove overrides visuais) */
  function resetCycle() {
    setCycleOverrides({});
    setIsRunning(false);
    sessionIdRef.current = null;
  }

  const value = useMemo(
    () => ({
      activeSubject,
      isRunning,
      currentBlockMinutes,
      cycleOverrides,
      startSubject,
      endCurrentBlock,
      skipBlock,
      prevBlock,
      resetBlock,
      resetCycle,
    }),
    [activeSubject, isRunning, currentBlockMinutes, cycleOverrides]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
