import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://studycycle-1.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

export default function NicknameSetup() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [tag, setTag] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateNickname = (value) => {
    const regex = /^[a-zA-Z0-9]{4,16}$/;
    return regex.test(value);
  };

  const validateTag = (value) => {
    const regex = /^[a-zA-Z0-9]{3,4}$/;
    return regex.test(value);
  };

  const checkAvailability = async () => {
    if (!validateNickname(nickname)) {
      toast.error('Nickname deve ter 4-16 caracteres alfanuméricos');
      return;
    }
    if (!validateTag(tag)) {
      toast.error('Tag deve ter 3-4 caracteres alfanuméricos');
      return;
    }

    setIsChecking(true);
    try {
      const res = await axios.get(`${API}/user/nickname/check?nickname=${nickname}&tag=${tag}`);
      if (res.data.available) {
        toast.success('Este nickname#tag está disponível!');
      } else {
        toast.error(res.data.reason || 'Este nickname#tag já está em uso');
      }
    } catch (error) {
      toast.error('Erro ao verificar disponibilidade');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateNickname(nickname)) {
      toast.error('Nickname deve ter 4-16 caracteres alfanuméricos');
      return;
    }
    if (!validateTag(tag)) {
      toast.error('Tag deve ter 3-4 caracteres alfanuméricos');
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${API}/user/nickname`, { nickname, tag }, { withCredentials: true });
      toast.success('Nickname#tag criado com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar nickname#tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/50 backdrop-blur border-slate-700">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
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
                data-testid="nickname-input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                placeholder="4-16 caracteres"
                maxLength={16}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Apenas letras e números (4-16 caracteres)</p>
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">Tag</Label>
              <Input
                data-testid="tag-input"
                value={tag}
                onChange={(e) => setTag(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                placeholder="3-4 caracteres"
                maxLength={4}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Apenas letras e números (3-4 caracteres)</p>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
              <p className="text-sm text-cyan-300 text-center font-semibold">
                {nickname && tag ? `${nickname}#${tag}` : 'seu_nickname#tag'}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={checkAvailability}
                disabled={!nickname || !tag || isChecking}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white"
                data-testid="check-button"
              >
                {isChecking ? 'Verificando...' : 'Verificar'}
              </Button>
              <Button
                type="submit"
                disabled={!nickname || !tag || isSubmitting}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
                data-testid="submit-button"
              >
                {isSubmitting ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}