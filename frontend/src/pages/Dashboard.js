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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://studycycle-1.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({ study_duration: 50, break_duration: 10 });
  const [quests, setQuests] = useState([]);
  
  // Study timer state
  const [isStudying, setIsStudying] = useState(false);
  const [currentSubject, setCurrentSubject] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(3000); // Default 50min
  const [isBreak, setIsBreak] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Modals
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showEditSubject, setShowEditSubject] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: '', color: '#3B82F6', time_goal: 180 });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let interval;
    if (isStudying && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(t => t - 1);
        if (!isBreak) {
          setElapsedTime(e => e + 1);
        }
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

  const loadData = async () => {
    try {
      const [userRes, subjectsRes, statsRes, settingsRes, questsRes] = await Promise.all([
        axios.get(`${API}/auth/me`, { withCredentials: true }),
        axios.get(`${API}/subjects`, { withCredentials: true }),
        axios.get(`${API}/stats`, { withCredentials: true }),
        axios.get(`${API}/settings`, { withCredentials: true }),
        axios.get(`${API}/quests`, { withCredentials: true }),
      ]);
      
      setUser(userRes.data);
      setSubjects(subjectsRes.data);
      setStats(statsRes.data);
      setSettings(settingsRes.data);
      setQuests(questsRes.data);
      setTimeLeft(settingsRes.data.study_duration * 60);
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/');
      }
    }
  };

  const handleAddSubject = async () => {
    try {
      await axios.post(`${API}/subjects`, newSubject, { withCredentials: true });
      toast.success('Matéria adicionada!');
      setShowAddSubject(false);
      setNewSubject({ name: '', color: '#3B82F6', time_goal: 180 });
      loadData();
    } catch (error) {
      toast.error('Erro ao adicionar matéria');
    }
  };

  const handleEditSubject = async () => {
    try {
      await axios.patch(`${API}/subjects/${editingSubject.id}`, {
        name: editingSubject.name,
        color: editingSubject.color,
        time_goal: editingSubject.time_goal
      }, { withCredentials: true });
      toast.success('Matéria atualizada!');
      setShowEditSubject(false);
      setEditingSubject(null);
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar matéria');
    }
  };

  const handleDeleteSubject = async (subjectId) => {
    if (!window.confirm('Tem certeza que deseja deletar esta matéria?')) return;
    try {
      await axios.delete(`${API}/subjects/${subjectId}`, { withCredentials: true });
      toast.success('Matéria removida!');
      loadData();
    } catch (error) {
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
    } catch (error) {
      toast.error('Erro ao iniciar sessão');
    }
  };

  const handleStopStudy = async (skipped = false) => {
    if (!sessionId) return;
    
    try {
      const duration = Math.floor(elapsedTime / 60);
      const res = await axios.post(`${API}/study/end`, {
        session_id: sessionId,
        duration: duration,
        skipped: skipped
      }, { withCredentials: true });
      
      if (!skipped && res.data.coins_earned > 0) {
        toast.success(`+${res.data.coins_earned} coins, +${res.data.xp_earned} XP!`);
      }
      
      setIsStudying(false);
      setCurrentSubject(null);
      setSessionId(null);
      setTimeLeft(settings.study_duration * 60);
      setElapsedTime(0);
      setIsBreak(false);
      
      loadData();
    } catch (error) {
      toast.error('Erro ao finalizar sessão');
    }
  };

  const handleResetCycle = async () => {
    if (!window.confirm('Resetar todo o ciclo? Isso não pode ser desfeito.')) return;
    toast.info('Função de reset em desenvolvimento');
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

  const getSubjectPercentages = () => {
    if (!stats || !stats.subjects || stats.subjects.length === 0) return [];
    const total = stats.subjects.reduce((sum, s) => sum + (s.time_studied || 0), 0);
    if (total === 0) return stats.subjects.map(s => ({ ...s, percentage: 100 / stats.subjects.length }));
    return stats.subjects.map(s => ({
      ...s,
      percentage: ((s.time_studied || 0) / total) * 100
    }));
  };

  if (!user || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900">
        <div className="text-xl text-white">Carregando...</div>
      </div>
    );
  }

  const subjectPercentages = getSubjectPercentages();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900" style={{ fontFamily: 'Inter, sans-serif' }}>
      <Header user={user} />
      
      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Timer & Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Always Visible Timer */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">
                  {isStudying ? (isBreak ? 'Pausa' : 'Estudo') : 'Estudo'}
                </h2>
                {currentSubject && (
                  <p className="text-lg" style={{ color: currentSubject.color }}>
                    {currentSubject.name}
                  </p>
                )}
                {!isStudying && subjects.length > 0 && (
                  <p className="text-gray-400 text-sm">Selecione uma matéria abaixo para começar</p>
                )}
              </div>
              
              <div className="text-8xl font-bold text-white text-center mb-8" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {formatTime(timeLeft)}
              </div>
              
              <div className="text-center text-gray-400 mb-6">
                {settings.study_duration} min
              </div>

              {/* Controls */}
              <div className="flex gap-3 justify-center flex-wrap">
                <Button
                  onClick={() => isStudying ? handleStopStudy(false) : null}
                  disabled={!isStudying}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-6"
                  data-testid="start-button"
                >
                  {isStudying ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                  {isStudying ? 'Finalizar' : 'Iniciar'}
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-600 text-gray-300 hover:bg-slate-700 px-6 py-6"
                >
                  <SkipBack className="w-5 h-5 mr-2" />
                  Bloco anterior
                </Button>
                <Button
                  onClick={() => handleStopStudy(true)}
                  disabled={!isStudying}
                  variant="outline"
                  className="border-slate-600 text-gray-300 hover:bg-slate-700 px-6 py-6"
                >
                  <SkipForward className="w-5 h-5 mr-2" />
                  Pular fase
                </Button>
                <Button
                  onClick={handleResetCycle}
                  variant="outline"
                  className="border-slate-600 text-gray-300 hover:bg-slate-700 px-6 py-6"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Resetar
                </Button>
              </div>
            </div>

            {/* Progress Bars */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-400">Progresso do conteúdo atual</span>
                    <span className="text-sm text-gray-400">0%</span>
                  </div>
                  <Progress value={0} className="h-2 bg-slate-700" />
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
                        <Input
                          type="color"
                          value={newSubject.color}
                          onChange={(e) => setNewSubject({ ...newSubject, color: e.target.value })}
                          className="h-10 bg-slate-700 border-slate-600"
                        />
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
                  <div key={subject.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/30 transition-colors">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }}></div>
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
                ))}
              </div>
            </div>

            {/* About Section */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Sobre o CicloStudy</h3>
              <div className="text-gray-300 space-y-3 text-sm leading-relaxed">
                <p>
                  O <span className="text-cyan-400 font-semibold">CicloStudy</span> é uma plataforma inovadora de estudos que substitui cronogramas rígidos por <strong>ciclos flexíveis</strong>.
                </p>
                <p>
                  Com a técnica <strong>Pomodoro integrada</strong> (padrão 50:10), você estuda sem se preocupar com imprevistos do dia a dia. 
                  Defina uma <span className="text-cyan-400">meta semanal</span> para cada matéria e complete pelo menos <strong>1 ciclo por semana</strong>.
                </p>
                <p>
                  <strong>Gamificação completa:</strong> ganhe XP, suba de nível, conquiste coins estudando (5 min = 1 coin) e desbloqueie itens exclusivos na loja!
                </p>
                <p className="text-xs text-gray-500 mt-4">
                  Proporção recomendada: 5:1 (50 min estudo / 10 min pausa)
                </p>
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
              
              <div className="relative w-64 h-64 mx-auto mb-6">
                <svg viewBox="0 0 100 100" className="transform -rotate-90 transition-all duration-500">
                  {subjectPercentages.length === 0 ? (
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#475569" strokeWidth="12" />
                  ) : (
                    (() => {
                      let offset = 0;
                      return subjectPercentages.map((subject, idx) => {
                        const circumference = 2 * Math.PI * 35;
                        const strokeDasharray = `${(subject.percentage / 100) * circumference} ${circumference}`;
                        const strokeDashoffset = -offset * circumference / 100;
                        offset += subject.percentage;
                        return (
                          <circle
                            key={idx}
                            cx="50"
                            cy="50"
                            r="35"
                            fill="none"
                            stroke={subject.color}
                            strokeWidth="12"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-500"
                          />
                        );
                      });
                    })()
                  )}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Mapa do</p>
                    <p className="text-sm font-bold text-white">Ciclo</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Matérias do ciclo</h4>
                {subjects.map((subject, index) => {
                  const subjectStat = stats.subjects.find(s => s.id === subject.id) || {};
                  return (
                    <div key={subject.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: subject.color }}></div>
                        <span className="text-gray-300">{index + 1}. {subject.name}</span>
                      </div>
                      <span className="text-gray-400">{formatHours(subjectStat.time_studied || 0)} estudo</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quests */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Quests Semanais</h3>
              <div className="space-y-3">
                {quests.slice(0, 4).map(quest => (
                  <div key={quest.id} className="p-3 bg-slate-700/30 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold text-white text-sm">{quest.title}</p>
                      {quest.completed && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Concluída</span>
                      )}
                    </div>
                    <Progress value={(quest.progress / quest.target) * 100} className="h-1.5 mb-2 bg-slate-600" />
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">{quest.progress} / {quest.target}</span>
                      <span className="text-cyan-400">+{quest.coins_reward}c +{quest.xp_reward}xp</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Music Button */}
      <Button
        onClick={() => setShowMusicPlayer(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 shadow-lg z-40"
        data-testid="music-button"
      >
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
                <Input
                  value={editingSubject.name}
                  onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Cor</Label>
                <Input
                  type="color"
                  value={editingSubject.color}
                  onChange={(e) => setEditingSubject({ ...editingSubject, color: e.target.value })}
                  className="h-10 bg-slate-700 border-slate-600"
                />
              </div>
              <div>
                <Label className="text-gray-300">Meta semanal (minutos)</Label>
                <Input
                  type="number"
                  value={editingSubject.time_goal}
                  onChange={(e) => setEditingSubject({ ...editingSubject, time_goal: parseInt(e.target.value) })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <Button onClick={handleEditSubject} className="w-full bg-cyan-500 hover:bg-cyan-600">
                Salvar Alterações
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MusicPlayer isOpen={showMusicPlayer} onClose={() => setShowMusicPlayer(false)} />
    </div>
  );
}