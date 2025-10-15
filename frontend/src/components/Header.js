import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from './ui/button';
import { Trophy, ShoppingBag, Users, Settings, LogOut } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://studycycle-1.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

export default function Header({ user }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

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
          <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/30 px-3 py-1 rounded-lg">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="font-semibold text-yellow-300">Nv {user.level}</span>
          </div>
          <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 px-3 py-1 rounded-lg">
            <span className="font-semibold text-blue-300">{user.coins} coins</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
          <span className="text-sm text-gray-300">{user.nickname ? `${user.nickname}#${user.tag}` : user.name}</span>
          <Button
            data-testid="logout-button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-300 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}