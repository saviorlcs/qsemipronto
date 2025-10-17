import SealAvatar from '../components/SealAvatar';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Plus, Edit2, Trash2, Music } from 'lucide-react';
import Header from '../components/Header';
import MusicPlayer from '../components/MusicPlayer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;


export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({ study_duration: 50, break_duration: 10 });
  const [quests, setQuests] = useState([]);
const [dragIndex, setDragIndex] = useState(null);
  // Study timer state
  const [isStudying, setIsStudying] = useState(false);
  const [currentSubject, setCurrentSubject] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(3000); // Default 50min
  const [isBreak, setIsBreak] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Modals / UI states
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showEditSubject, setShowEditSubject] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: '', color: '#3B82F6', time_goal: 180 });
  const [progressOverrides, setProgressOverrides] = useState({}); // { [subjectId]: minutosDescontados }
  const [openReset, setOpenReset] = useState(false);
// --- ADICIONE ESTES ESTADOS / REFS ---
const [levelUpInfo, setLevelUpInfo] = useState(null); // { oldLevel, newLevel, bonusCoins }
const [animateArcs, setAnimateArcs] = useState(false); // animação do mapa do ciclo
const [mapAnimKey, setMapAnimKey] = useState(0);       // força re-montar paths pra animar

// --- HELPERS ---
const minutesToCoins = (mins) => Math.floor(mins / 5);     // 1 coin a cada 5 min
const formatTotal = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}min`;
};

// níveis “especiais”: 10, 50, 100, 200, 500, 1000… (e vai dobrando / multiplicando por 5)
const milestoneLevels = new Set([10, 50, 100, 200, 500, 1000, 2000, 5000, 10000]);
const isMilestoneLevel = (lvl) => milestoneLevels.has(lvl);

// cor aleatória que NÃO repete nenhuma existente
const uniqueRandomColor = (blocked) => {
  const used = new Set(blocked.map(c => c.toLowerCase()));
  for (let i = 0; i < 999; i++) {
    const hex = `#${Math.floor(Math.random()*0xFFFFFF).toString(16).padStart(6,'0')}`;
    if (!used.has(hex.toLowerCase())) return hex;
  }
  return '#3B82F6';
};


// utilidades para gerar o arco (path) e posicionar o texto
const deg2rad = (deg) => (deg * Math.PI) / 180;
const polar = (cx, cy, r, deg) => {
  const rad = deg2rad(deg);
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};
const arcPath = (cx, cy, r, startDeg, endDeg) => {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
};

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let interval;
    if (isStudying && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((t) => t - 1);
        if (!isBreak) setElapsedTime((e) => e + 1);
      }, 1000);
    } else if (timeLeft === 0 && isStudying) {
      if (!isBreak) {
        setIsBreak(true);
        setTimeLeft(settings.break_duration * 60);
        toast.success('Sessão concluída! Hora da pausa.');
      } else {
        setIsBreak(false);
        setTimeLeft(settings.study_duration * 60);
        toast.success('Pausa concluída! Vamos continuar.');
      }
    }
    return () => clearInterval(interval);
  }, [isStudying, timeLeft, isBreak, settings]);
// ao abrir o modal de Nova Matéria, escolhe cor aleatória única
useEffect(() => {
  if (showAddSubject) {
    const existing = subjects.map(s => s.color || '');
    setNewSubject(ns => ({ ...ns, color: uniqueRandomColor(existing) }));
  }
}, [showAddSubject, subjects]);
// quando muda a quantidade de matérias, dispara animação do mapa
useEffect(() => {
  setAnimateArcs(false);
  const t = setTimeout(() => {
    setAnimateArcs(true);
    setMapAnimKey(k => k + 1);
  }, 30);
  return () => clearTimeout(t);
}, [subjects.length]);

  const loadData = async () => {
  try {
    const [userRes, subjectsRes, statsRes, settingsRes, questsRes] = await Promise.all([
      axios.get(`${API}/auth/me`, { withCredentials: true }),
      axios.get(`${API}/subjects`, { withCredentials: true }),
      axios.get(`${API}/stats`, { withCredentials: true }),
      axios.get(`${API}/settings`, { withCredentials: true }),
      axios.get(`${API}/quests`, { withCredentials: true }),
    ]);

    const u = userRes.data;
    const subj = subjectsRes.data;
    const st = statsRes.data;
    const set = settingsRes.data;
    const q = questsRes.data;

    setUser(u);
    setSubjects(subj);
    setStats(st);
    setSettings(set);
    setQuests(q);
    setTimeLeft(set.study_duration * 60);

    return { user: u, subjects: subj, stats: st, settings: set, quests: q };
  } catch (error) {
    if (error.response?.status === 401) navigate('/');
    return null;
  }
};


  const handleAddSubject = async () => {
    try {
      await axios.post(`${API}/subjects`, newSubject, { withCredentials: true });
      toast.success('Matéria adicionada!');
      setShowAddSubject(false);
      setNewSubject({ name: '', color: '#3B82F6', time_goal: 180 });
      loadData();
    } catch {
      toast.error('Erro ao adicionar matéria');
    }
  };

  const handleEditSubject = async () => {
    try {
      await axios.patch(
        `${API}/subjects/${editingSubject.id}`,
        {
          name: editingSubject.name,
          color: editingSubject.color,
          time_goal: editingSubject.time_goal,
        },
        { withCredentials: true }
      );
      toast.success('Matéria atualizada!');
      setShowEditSubject(false);
      setEditingSubject(null);
      loadData();
    } catch {
      toast.error('Erro ao atualizar matéria');
    }
  };

  const handleDeleteSubject = async (subjectId) => {
    if (!window.confirm('Tem certeza que deseja deletar esta matéria?')) return;
    try {
      await axios.delete(`${API}/subjects/${subjectId}`, { withCredentials: true });
      toast.success('Matéria removida!');
      loadData();
    } catch {
      toast.error('Erro ao remover matéria');
    }
  };

  const handleStartStudy = async (subject) => {
    try {
      const res = await axios.post(`${API}/study/start`, { subject_id: subject.id }, { withCredentials: true });
      setSessionId(res.data.id);
      setCurrentSubject(subject);
      setIsStudying(true);
      setIsBreak(false);
      setTimeLeft(settings.study_duration * 60);
      setElapsedTime(0);
      toast.success(`Iniciando: ${subject.name}`);
    } catch {
      toast.error('Erro ao iniciar sessão');
    }
  };

  const handleStopStudy = async (skipped = false) => {
  if (!sessionId) return;

  try {
    const duration = Math.floor(elapsedTime / 60);
    const prevLevel = stats?.level ?? user?.level ?? 0;

    const res = await axios.post(
      `${API}/study/end`,
      { session_id: sessionId, duration, skipped },
      { withCredentials: true }
    );

    if (!skipped && res.data.coins_earned > 0) {
      toast.success(`+${res.data.coins_earned} coins, +${res.data.xp_earned} XP!`);
    }

    // reseta o estado do timer
    setIsStudying(false);
    setCurrentSubject(null);
    setSessionId(null);
    setTimeLeft(settings.study_duration * 60);
    setElapsedTime(0);
    setIsBreak(false);

    // recarrega dados e compara nível
    const fresh = await loadData();
    if (fresh?.stats) {
      const newLevel = fresh.stats.level ?? 0;
      if (newLevel > prevLevel) {
        // bônus “especial” em marcos: 10, 50, 100, 200, 500, 1000, 2000, 5000, 10000...
        let bonusCoins = 0;
        if (isMilestoneLevel(newLevel)) {
          // total estudado “até hoje” em minutos — se teu /stats já trouxer isso, usa.
          // fallback: soma por matéria (se for total acumulado).
          const totalMins =
            fresh.stats.total_studied_minutes ??
            (fresh.stats.subjects || []).reduce((s, x) => s + (x.time_total || x.time_studied || 0), 0);

          // 10% das horas convertidas em coins (1 coin/5min) => 10% dos minutos => /50
          bonusCoins = Math.floor(totalMins / 50);
          // tenta creditar no backend (se não existir o endpoint, só ignora)
          try {
            await axios.post(`${API}/rewards/level-bonus`, {
              level: newLevel,
              bonus_coins: bonusCoins,
            }, { withCredentials: true });
          } catch { /* ok se não existir, pelo menos mostramos a mensagem */ }
        }

        setLevelUpInfo({
          oldLevel: prevLevel,
          newLevel,
          bonusCoins,
        });
      }
    }
  } catch (error) {
    toast.error('Erro ao finalizar sessão');
  }
};


  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatHours = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  // % do donut baseado no PLANEJADO (time_goal), não no estudado
  const getPlannedPercentages = () => {
    if (!subjects || subjects.length === 0) return [];
    const totalGoal = subjects.reduce((s, x) => s + (x.time_goal || 0), 0);
    if (totalGoal === 0) return subjects.map((s) => ({ ...s, percentage: 100 / subjects.length }));
    return subjects.map((s) => ({
      ...s,
      percentage: ((s.time_goal || 0) / totalGoal) * 100,
    }));
  };

  // progresso de UMA matéria (considerando desconto visual do "bloco anterior")
  const subjectProgressPct = (subject) => {
    const stat = (stats?.subjects || []).find((s) => s.id === subject.id) || {};
    const studied = Math.max(0, (stat.time_studied || 0) - (progressOverrides[subject.id] || 0));
    return subject.time_goal > 0 ? Math.min(100, (studied / subject.time_goal) * 100) : 0;
  };

  const handleBigStart = async () => {
    if (isStudying) {
      await handleStopStudy(false);
      return;
    }
    const subject = currentSubject || subjects[0];
    if (!subject) {
      toast.error('Adicione uma matéria para começar');
      return;
    }
    await handleStartStudy(subject);
  };

  const handlePrevBlockUI = () => {
    if (!currentSubject) {
      toast.error('Nenhuma matéria ativa');
      return;
    }
    // desconta 1 bloco do planejado
    setProgressOverrides((prev) => ({
      ...prev,
      [currentSubject.id]: (prev[currentSubject.id] || 0) + settings.study_duration,
    }));
    setIsStudying(false);
    setSessionId(null);
    setIsBreak(false);
    setTimeLeft(settings.study_duration * 60);
    setElapsedTime(0);
    toast('Progresso do bloco anterior desconsiderado (XP/coins mantidos).');
  };

  const handleResetBlock = () => {
    setIsStudying(false);
    setSessionId(null);
    setIsBreak(false);
    setTimeLeft(settings.study_duration * 60);
    setElapsedTime(0);
  };

  const handleResetCycleUI = () => {
    setProgressOverrides({});
    setIsStudying(false);
    setSessionId(null);
    setIsBreak(false);
    setTimeLeft(settings.study_duration * 60);
    setElapsedTime(0);
    toast.success('Ciclo resetado visualmente.');
    setOpenReset(false);
  };

  const getSubjectPercentages = () => {
    if (!stats || !stats.subjects || stats.subjects.length === 0) return [];
    const total = stats.subjects.reduce((sum, s) => sum + (s.time_studied || 0), 0);
    if (total === 0) return stats.subjects.map((s) => ({ ...s, percentage: 100 / stats.subjects.length }));
    return stats.subjects.map((s) => ({
      ...s,
      percentage: ((s.time_studied || 0) / total) * 100,
    }));
  };

  if (!user || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900">
        <div className="text-xl text-white">Carregando...</div>
      </div>
    );
  }

  const subjectPercentages = getPlannedPercentages();
// --- Quests: sempre exibir 4 -----------------------------------------------
const minutesStudiedSoFar = (stats?.subjects || []).reduce(
  (s, x) => s + (x.time_studied || 0),
  0
);

// matéria menos estudada (pra escolher uma quest focada)
const lowestSubjectInfo = subjects.reduce((acc, subj) => {
  const st = (stats?.subjects || []).find(ss => ss.id === subj.id) || {};
  const studied = st.time_studied || 0;
  if (!acc || studied < acc.studied) return { subject: subj, studied };
  return acc;
}, null);



const onDragStartSubject = (index) => setDragIndex(index);
const onDragOverSubject  = (e) => e.preventDefault(); // necessário para permitir drop
const onDropSubject = async (index) => {
  if (dragIndex === null || dragIndex === index) return;
  const newOrder = [...subjects];
  const [moved] = newOrder.splice(dragIndex, 1);
  newOrder.splice(index, 0, moved);
  setSubjects(newOrder);
  setDragIndex(null);

  // se tiver endpoint pra persistir a ordem, ótimo; se não, só ignora
  try {
    await axios.post(`${API}/subjects/reorder`, { order: newOrder.map(s => s.id) }, { withCredentials: true });
  } catch {}
};


// gera uma quest com recompensa baseada no esforço
// gera uma quest com recompensa baseada no esforço
const genQuest = (key, title, target, progress, difficulty = "medium") => {
  const diffMultMap = { easy: 0.8, medium: 1, hard: 1.5 };
  const diffMult = diffMultMap[difficulty] ?? 1;

  // 1 coin = 5 min; quando não há alvo claro, usamos 60 como base
  const baseCoins = Math.ceil(((target ?? 60) / 5));
  const coins = Math.max(5, Math.round(baseCoins * diffMult));
  const xp = coins * 10;

  return {
    id: `local-${key}`,
    title,
    target,
    progress,
    coins_reward: coins,
    xp_reward: xp,
    completed: progress >= (target ?? 0),
    _difficulty: difficulty, // para fallback em merges
  };
};

// garante que toda quest tenha coins/xp mesmo que venha "incompleta" do backend
const ensureRewards = (q) => {
  const diffMultMap = { easy: 0.8, medium: 1, hard: 1.5 };
  const diffMult = diffMultMap[q?._difficulty] ?? 1;
  const baseCoins = Math.ceil(((q?.target ?? 60) / 5));
  const coinsCalc = Math.max(5, Math.round(baseCoins * diffMult));

  if (q.coins_reward == null) q.coins_reward = coinsCalc;
  if (q.xp_reward == null) q.xp_reward = q.coins_reward * 10;
  return q;
};

const buildFourQuests = () => {
  const provided = Array.isArray(quests) ? quests : [];
  const auto = [];

  // 1) completar 1 ciclo
  auto.push(
    genQuest(
      "complete-cycle",
      "Completar 1 ciclo",
      1,
      (stats?.cycle_progress ?? 0) >= 100 ? 1 : 0,
      "medium"
    )
  );

  // 2) estudar 300 min na semana
  auto.push(
    genQuest("study-300", "Estudar 300 min na semana", 300, minutesStudiedSoFar, "medium")
  );

  // 3) focar na matéria menos estudada (se existir)
  if (lowestSubjectInfo?.subject) {
    auto.push(
      genQuest(
        "focus-subject",
        `Estudar ${lowestSubjectInfo.subject.name} por 120 min`,
        120,
        lowestSubjectInfo.studied,
        "hard"
      )
    );
  }

  // 4) concluir 6 sessões de estudo
  auto.push(
    genQuest(
      "sessions-6",
      "Concluir 6 sessões de estudo",
      6,
      stats?.sessions_completed || 0,
      "easy"
    )
  );

  // Prioriza AUTO (tem recompensas) e preenche faltantes das do backend
  const candidates = [
    ...auto,
    ...provided.map(ensureRewards),
  ];

  const seen = new Set();
  const result = [];
  for (const q of candidates) {
    if (!q?.title) continue;
    if (seen.has(q.title)) continue;
    seen.add(q.title);
    result.push(ensureRewards(q));
    if (result.length === 4) break;
  }
  return result;
};


 
// quanto foi estudado (em min) nessa matéria, já considerando o desconto visual
const getSubjectStudiedMins = (subject) => {
  const st = (stats?.subjects || []).find(s => s.id === subject.id) || {};
  return Math.max(0, (st.time_studied || 0) - (progressOverrides[subject.id] || 0));
};

const weeklyQuests = buildFourQuests();
// ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900" style={{ fontFamily: 'Inter, sans-serif' }}>
      <Header user={user} />
<div className="app-card p-3 mb-4 flex items-center gap-3">
  <SealAvatar
    seed={user?.equipped_items?.seal || user?.id}
    size={48}
    label="Seu selo"
  />
  <div>
    <div className="text-white font-semibold">
      {user?.nickname ? `${user.nickname}#${user.tag}` : user?.name}
    </div>
    <div className="text-xs text-gray-400">
      {/* coloque aqui o que quiser: nível, C$, etc. */}
    </div>
  </div>
</div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Timer & Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timer */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8">
              {/* Avatar do usuário (selo equipado) */}
{(() => {
  // compat: pode ser user.user.equipped_items ou user.equipped_items, dependendo de como você setou o estado
  const eq = (user?.user?.equipped_items) || (user?.equipped_items) || {};
  const sealId = eq.seal ?? 'seal_0';
  const displayName = (user?.user?.nickname && user?.user?.tag)
    ? `${user.user.nickname}#${user.user.tag}`
    : (user?.user?.name || user?.name || 'Usuário');

  return (
    <div className="flex justify-center mb-4">
      <SealAvatar seed={sealId} size={72} label={displayName} />

    </div>
  );
})()}

              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">{isStudying ? (isBreak ? 'Pausa' : 'Estudo') : 'Estudo'}</h2>
                {currentSubject && (
                  <p className="text-lg" style={{ color: currentSubject.color }}>
                    {currentSubject.name}
                  </p>
                )}
                {!isStudying && subjects.length > 0 && <p className="text-gray-400 text-sm">Selecione uma matéria abaixo para começar</p>}
              </div>

              <div className="text-8xl font-bold text-white text-center mb-8" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {formatTime(timeLeft)}
              </div>

              <div className="text-center text-gray-400 mb-6">{settings.study_duration} min</div>

              {/* Controls */}
              <div className="flex gap-3 justify-center flex-wrap">
                <Button
                  onClick={handleBigStart}
                  disabled={!isStudying && subjects.length === 0}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-6"
                  data-testid="start-button"
                >
                  {isStudying ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                  {isStudying ? 'Finalizar' : 'Iniciar'}
                </Button>

                <Button
  variant="outline"
  onClick={handlePrevBlockUI}
  disabled={
    !currentSubject ||
    getSubjectStudiedMins(currentSubject) < settings.study_duration // 1º bloco: não deixa voltar
  }
  className="border-slate-600 text-gray-300 px-6 py-6 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
>
  <SkipBack className="w-5 h-5 mr-2" />
  Bloco anterior
</Button>

<Button
  onClick={() => handleStopStudy(true)}   // encerra a sessão atual como "pulo"
  disabled={!isStudying || isBreak}       // só durante ESTUDO, não na pausa
  variant="outline"
  className="border-slate-600 text-gray-300 px-6 py-6 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
>
  <SkipForward className="w-5 h-5 mr-2" />
  Pular bloco
</Button>


                <Button onClick={() => setOpenReset(true)} variant="outline" className="border-slate-600 text-gray-300 hover:bg-slate-700 px-6 py-6">
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Resetar
                </Button>
              </div>
            </div>

            {/* Progress Bars */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <div className="space-y-4">
                <div>
                  {(() => {
                    const s = currentSubject;
                    const pct = s ? subjectProgressPct(s) : 0;
                    return (
                      <>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-400">Progresso do conteúdo atual</span>
                          <span className="text-sm text-gray-400">{Math.round(pct)}%</span>
                        </div>
                        <Progress value={pct} className="h-2 bg-slate-700" />
                      </>
                    );
                  })()}
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-400">Progresso do ciclo</span>
                    <span className="text-sm text-cyan-400">{Math.round(stats.cycle_progress)}%</span>
                  </div>
                  <Progress value={stats.cycle_progress} className="h-2 bg-slate-700" />
                </div>
              </div>
            </div>

            {/* Subjects Queue */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Fila de conteúdos</h3>
                <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-cyan-500 hover:bg-cyan-600">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-800 border-slate-700 text-white">
                    <DialogHeader>
                      <DialogTitle>Nova Matéria</DialogTitle>
                      <DialogDescription className="text-gray-400">Adicione uma nova matéria ao ciclo</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-300">Nome</Label>
                        <Input
                          value={newSubject.name}
                          onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                          placeholder="Ex: Matemática"
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-gray-300">Cor</Label>
                        <Input type="color" value={newSubject.color} onChange={(e) => setNewSubject({ ...newSubject, color: e.target.value })} className="h-10 bg-slate-700 border-slate-600" />
                      </div>
                      <div>
                        <Label className="text-gray-300">Meta semanal (minutos)</Label>
                        <Input
                          type="number"
                          value={newSubject.time_goal}
                          onChange={(e) => setNewSubject({ ...newSubject, time_goal: parseInt(e.target.value) })}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <Button onClick={handleAddSubject} className="w-full bg-cyan-500 hover:bg-cyan-600">
                        Adicionar Matéria
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
  {subjects.map((subject, index) => (
    <div
      key={subject.id}
      className={`w-full p-3 rounded-lg hover:bg-slate-700/30 transition-colors cursor-grab ${dragIndex === index ? 'opacity-50' : ''}`}
      draggable
      onDragStart={() => onDragStartSubject(index)}
      onDragOver={onDragOverSubject}   
      onDrop={() => onDropSubject(index)}
    >
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
        <span className="flex-1 text-white">{subject.name}</span>
        <span className="text-gray-400 text-sm">{formatHours(subject.time_goal)}</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-cyan-400 hover:bg-cyan-500/10"
            onClick={() => handleStartStudy(subject)}
          >
            <Play className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-400 hover:bg-slate-600"
            onClick={() => {
              setEditingSubject(subject);
              setShowEditSubject(true);
            }}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-400 hover:bg-red-500/10"
            onClick={() => handleDeleteSubject(subject.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* barra de progresso desta matéria */}
      <div className="mt-2">
        <Progress value={subjectProgressPct(subject)} className="h-2 bg-slate-700" />
      </div>
    </div>
  ))}
</div>

            </div>

            {/* About Section */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Sobre o CicloStudy</h3>
              <div className="text-gray-300 space-y-3 text-sm leading-relaxed">
                <p>
                  O <span className="text-cyan-400 font-semibold">CicloStudy</span> substitui cronogramas rígidos por <strong>ciclos flexíveis</strong>.
                </p>
                <p>
                  Técnica <strong>Pomodoro integrada</strong> (padrão 50:10). Defina uma <span className="text-cyan-400">meta semanal</span> por matéria e complete pelo menos <strong>1 ciclo por semana</strong>.
                </p>
                <p>
                  <strong>Gamificação:</strong> ganhe XP, suba de nível, conquiste coins (5 min = 1 coin) e desbloqueie itens.
                </p>
                <p className="text-xs text-gray-500 mt-4">Proporção recomendada: 5:1 (50/10)</p>
              </div>
            </div>
          </div>

          {/* Right Panel - Cycle Map & Stats */}
          <div className="space-y-6">
            {/* Cycle Map */}
            

            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white">Mapa do ciclo</h3>
              </div>

              <div className="relative w-72 h-72 md:w-80 md:h-80 mx-auto mb-6 max-w-[320px]">
  <svg viewBox="0 0 100 100" className="transition-all duration-300">
    {/* defs com paths dos arcos */}
    <defs>
      {(() => {
        let offset = 0; // em %
        return subjectPercentages.map((subject, idx) => {
          const startDeg = -90 + (offset * 360) / 100;
          const sweep = (subject.percentage * 360) / 100;
          const endDeg = startDeg + sweep;
          offset += subject.percentage;

          const id = `arc-${subject.id}-${mapAnimKey}`;
          const d = arcPath(50, 50, 40, startDeg, endDeg);

          return <path key={id} id={id} d={d} pathLength="100" />;
        });
      })()}
    </defs>

    {/* Arcos coloridos (animados + clique para selecionar matéria) */}
{subjectPercentages.map((subject) => {
  const id = `arc-${subject.id}-${mapAnimKey}`;
  const isActive = currentSubject?.id === subject.id;
  return (
    <use
      key={`stroke-${id}`}
      href={`#${id}`}
      stroke={subject.color}
      strokeWidth={isActive ? 16 : 14}
      fill="none"
      pathLength="100"
      onClick={() => setCurrentSubject(subject)}
      style={{
        cursor: 'pointer',
        filter: isActive ? 'drop-shadow(0 0 6px rgba(0,0,0,.6))' : 'none',
        strokeDasharray: animateArcs ? '100 0' : '0 100',
        transition: 'stroke-dasharray 700ms ease-out, stroke-width 200ms ease'
      }}
    />
  );
})}



    {/* nomes curvados, centralizados no arco */}
    {(() => {
      let offset = 0;
      return subjectPercentages.map((subject, idx) => {
        const id = `arc-${subject.id}-${mapAnimKey}`;
        offset += subject.percentage;

        return (
          <text key={`text-${id}`} fontSize="3" fill="#fff">
            <textPath
  href={`#${id}`}
  startOffset="50%"
  textAnchor="middle"
  onClick={() => setCurrentSubject(subject)}
  style={{ fontSize: 4, fontWeight: 700, cursor: 'pointer' }}
>
  {subject.name}
</textPath>

          </text>
        );
      });
    })()}
  </svg>

  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div className="text-center">
      <p className="text-xs text-gray-400">Mapa do</p>
      <p className="text-sm font-bold text-white">Ciclo</p>
    </div>
  </div>
</div>


              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Matérias do ciclo</h4>
                {subjects.map((subject, index) => (
                  <div key={subject.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: subject.color }} />
                      <span className="text-gray-300">
                        {index + 1}. {subject.name}
                      </span>
                    </div>
                    <span className="text-gray-400">{formatHours(subject.time_goal)} planejado</span>
                  </div>
                ))}
                <div className="pt-3 text-right text-xs text-gray-400 space-y-1">
  {(() => {
    const totalPlanned = subjects.reduce((s, x) => s + (x.time_goal || 0), 0);
    return <>Tempo total do ciclo (planejado): <b className="text-cyan-300">{formatHours(totalPlanned)}</b></>;
  })()}
  <br />
  {(() => {
    const totalStudied =
      (stats?.total_studied_minutes) ??
      (stats?.subjects || []).reduce((s, x) => s + (x.time_total || x.time_studied || 0), 0);
    return <>Tempo total de estudo (todas matérias): <b className="text-emerald-300">{formatHours(totalStudied)}</b></>;
  })()}
</div>

              </div>
            </div>  

            {/* Quests */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Quests Semanais</h3>
              <div className="space-y-3">
  {weeklyQuests.map((quest, i) => (
    <div key={quest.id ?? i} className="p-3 bg-slate-700/30 rounded-lg">
      <div className="flex justify-between items-start mb-2">
        <p className="font-semibold text-white text-sm">{quest.title}</p>
        {quest.completed && (
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
            Concluída
          </span>
        )}
      </div>

      <Progress
        value={(quest.progress / quest.target) * 100}
        className="h-1.5 mb-2 bg-slate-600"
      />

      <div className="flex justify-between text-xs">
        <span className="text-gray-400">
          {quest.progress} / {quest.target}
        </span>
        <span className="text-cyan-400">
  +C${quest.coins_reward} +{quest.xp_reward} XP
</span>

      </div>
    </div>
  ))}
</div>

            </div>
          </div>
          {/* end Right Panel */}
        </div>
        {/* end grid */}
      </div>
      {/* end container */}

      {/* Floating Music Button (fora do container, mas dentro do min-h-screen) */}
      <Button onClick={() => setShowMusicPlayer(true)} className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 shadow-lg z-40" data-testid="music-button">
        <Music className="w-6 h-6" />
      </Button>

      {/* Edit Subject Dialog */}
      <Dialog open={showEditSubject} onOpenChange={setShowEditSubject}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Editar Matéria</DialogTitle>
            <DialogDescription className="text-gray-400">Altere as informações da matéria</DialogDescription>
          </DialogHeader>
          {editingSubject && (
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300">Nome</Label>
                <Input value={editingSubject.name} onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <div>
                <Label className="text-gray-300">Cor</Label>
                <Input type="color" value={editingSubject.color} onChange={(e) => setEditingSubject({ ...editingSubject, color: e.target.value })} className="h-10 bg-slate-700 border-slate-600" />
              </div>
              <div>
                <Label className="text-gray-300">Meta semanal (minutos)</Label>
                <Input type="number" value={editingSubject.time_goal} onChange={(e) => setEditingSubject({ ...editingSubject, time_goal: parseInt(e.target.value) })} className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <Button onClick={handleEditSubject} className="w-full bg-cyan-500 hover:bg-cyan-600">
                Salvar Alterações
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Dialog */}
      <Dialog open={openReset} onOpenChange={setOpenReset}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Resetar</DialogTitle>
            <DialogDescription className="text-gray-400">Escolha o que deseja resetar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button onClick={handleResetCycleUI} className="w-full bg-cyan-600 hover:bg-cyan-500">
              🔁 Resetar ciclo (100%)
            </Button>
            <Button onClick={handleResetBlock} variant="secondary" className="w-full">
              ✨ Resetar bloco atual
            </Button>
          </div>
        </DialogContent>
      </Dialog>
<Dialog open={!!levelUpInfo} onOpenChange={() => setLevelUpInfo(null)}>
  <DialogContent className="bg-slate-900 border-slate-700 text-white text-center">
    <DialogHeader>
      <DialogTitle className="text-2xl">🎉 Subiu de nível!</DialogTitle>
      <DialogDescription className="text-gray-400">
        {levelUpInfo
          ? <>Você passou do nível <b>{levelUpInfo.oldLevel}</b> para <b>{levelUpInfo.newLevel}</b>!</>
          : null}
      </DialogDescription>
    </DialogHeader>

    {levelUpInfo?.bonusCoins > 0 ? (
      <div className="mt-3">
        <p className="text-lg">
          🌟 <b>Nível especial!</b> Você ganhou um bônus de <b className="text-cyan-300">{levelUpInfo.bonusCoins} C$</b> <br />
          (10% de todas as horas estudadas até hoje).
        </p>
      </div>
    ) : (
      <p className="text-lg mt-3">Continue assim — cada sessão te deixa mais forte. 🚀</p>
    )}

    <div className="mt-4">
      <Button onClick={() => setLevelUpInfo(null)} className="bg-cyan-600 hover:bg-cyan-500">Bora estudar mais!</Button>
    </div>
  </DialogContent>
</Dialog>

      <MusicPlayer isOpen={showMusicPlayer} onClose={() => setShowMusicPlayer(false)} />
    </div>
  );
}
