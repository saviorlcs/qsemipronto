import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Trophy, ShoppingBag, Users, Settings, LogOut } from 'lucide-react';
import SealAvatar from './SealAvatar';

function loginGoogle() {
  // tira um /api final, se houver
  const base = (process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:5000').replace(/\/api$/, '');
  window.location.href = `${base}/api/auth/google/login`;
}

export default function Header({ user: userProp }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(userProp ?? null);
  const [loading, setLoading] = useState(userProp === undefined); // se não veio por props, vamos buscar

  // se o pai passar/atualizar user por props, refletimos aqui
  useEffect(() => {
    setUser(userProp ?? null);
    if (userProp === undefined) setLoading(true);
  }, [userProp]);

  // busca /auth/me só se não veio user por props
  useEffect(() => {
    if (userProp !== undefined) return;
    api.get('/auth/me')
      .then((r) => setUser(r.data?.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [userProp]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    setUser(null);
    navigate('/');
  };

  if (loading) return null;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1
            className="text-xl font-bold text-white cursor-pointer hover:text-cyan-400 transition-colors"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            onClick={() => navigate('/dashboard')}
          >
            Ciclos de Estudo 50/10
          </h1>

          {/* Só mostra level/coins se tiver user */}
          {user && (
            <>
              <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/30 px-3 py-1 rounded-lg">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="font-semibold text-yellow-300">Nv {user.level}</span>
              </div>
              <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 px-3 py-1 rounded-lg">
                <span className="font-semibold text-blue-300">{user.coins} coins</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/loja')}
                className="text-gray-300 hover:text-white"
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Loja
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/amigos')}
                className="text-gray-300 hover:text-white"
              >
                <Users className="w-4 h-4 mr-2" />
                Amigos
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/configuracoes')}
                className="text-gray-300 hover:text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                Config
              </Button>
<SealAvatar
  seed={user?.equipped_items?.seal || user?.id}
  size={40}
  label="Seu selo"
/>

              <span className="text-sm text-gray-300">
                {user.nickname ? `${user.nickname}#${user.tag}` : user.name}
              </span>

              <Button
                data-testid="logout-button"
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-300 hover:text-white"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            // NÃO renderiza login quando já está logado
            <Button onClick={loginGoogle} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Entrar com Google
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
