import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import Header from '../components/Header';

export default function Settings() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ study_duration: 50, break_duration: 10 });

  const [nickname, setNickname] = useState('');
  const [tag, setTag] = useState('');

  const [canChangeNickname, setCanChangeNickname] = useState(true);
  const [daysUntilChange, setDaysUntilChange] = useState(0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        const [userRes, settingsRes] = await Promise.all([
          api.get('/auth/me'),
          api.get('/settings'),
        ]);

        // compat: funciona se o backend mandar { user: {...} } OU {...}
       const u = userRes.data || null;

        if (!alive) return;

        setUser(u);

        setSettings({
          study_duration: Number(settingsRes?.data?.study_duration ?? 50),
          break_duration: Number(settingsRes?.data?.break_duration ?? 10),
        });

        setNickname(u?.nickname ?? '');
        setTag(u?.tag ?? '');

        if (u?.last_nickname_change) {
          const lastChange = new Date(u.last_nickname_change);
          const now = new Date();
          const daysSince = Math.floor((now - lastChange) / (1000 * 60 * 60 * 24));
          if (daysSince < 60) {
            setCanChangeNickname(false);
            setDaysUntilChange(60 - daysSince);
          }
        }
      } catch (error) {
        if (error?.response?.status === 401) {
          navigate('/', { replace: true });
          return;
        }
        toast.error(error?.response?.data?.detail || 'Falha ao carregar configurações');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();
    return () => { alive = false; };
  }, [navigate]);

  async function handleSaveSettings() {
    try {
      // Se o seu backend usa PATCH, troque para api.patch('/settings', settings)
      await api.post('/settings', {
        study_duration: Number(settings.study_duration),
        break_duration: Number(settings.break_duration),
      });
      toast.success('Configurações salvas!');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Erro ao salvar configurações');
    }
  }

  async function handleChangeNickname() {
    try {
      await api.post('/user/nickname', { nickname, tag });
      toast.success('Nickname#tag atualizado!');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Erro ao atualizar nickname#tag');
    }
  }

  // **IMPORTANTE**: não bloqueie pelo "!user", só pelo loading.
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 flex items-center justify-center">
        <div className="text-xl text-white">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900" style={{ fontFamily: 'Inter, sans-serif' }}>
      <Header user={user} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              <SettingsIcon className="inline w-8 h-8 mr-3 text-cyan-400" />
              Configurações
            </h1>
          </div>
        </div>

        <div className="space-y-6">
          {/* Nickname#Tag */}
          <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Nickname#Tag</CardTitle>
              <CardDescription className="text-gray-400">
                {canChangeNickname
                  ? 'Você pode alterar seu nickname#tag'
                  : `Você poderá alterar novamente em ${daysUntilChange} dias`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-300">Nickname</Label>
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  maxLength={16}
                  disabled={!canChangeNickname}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Tag</Label>
                <Input
                  value={tag}
                  onChange={(e) => setTag(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  maxLength={4}
                  disabled={!canChangeNickname}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
  <p className="text-cyan-300 font-semibold">
    {(nickname && tag)
      ? `${nickname}#${tag}`
      : (user?.nickname && user?.tag ? `${user.nickname}#${user.tag}` : 'nick#tag')}
  </p>
</div>

              <Button
                onClick={handleChangeNickname}
                disabled={!canChangeNickname}
                className="w-full bg-cyan-500 hover:bg-cyan-600"
              >
                Salvar Nickname#Tag
              </Button>
            </CardContent>
          </Card>

          {/* Pomodoro Settings */}
          <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Configurações do Pomodoro</CardTitle>
              <CardDescription className="text-gray-400">
                Personalize os tempos de estudo e pausa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-300">Tempo de Estudo (minutos)</Label>
                <Input
                  type="number"
                  value={settings.study_duration}
                  onChange={(e) => setSettings({ ...settings, study_duration: Number(e.target.value) })}
                  min={1}
                  max={120}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Tempo de Pausa (minutos)</Label>
                <Input
                  type="number"
                  value={settings.break_duration}
                  onChange={(e) => setSettings({ ...settings, break_duration: Number(e.target.value) })}
                  min={1}
                  max={60}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <Button
                onClick={handleSaveSettings}
                className="w-full bg-cyan-500 hover:bg-cyan-600"
              >
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
