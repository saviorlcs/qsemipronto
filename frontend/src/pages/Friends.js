import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Users, UserPlus, Trash2 } from 'lucide-react';
import Header from '../components/Header';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://studycycle-1.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

export default function Friends() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friendInput, setFriendInput] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userRes, friendsRes] = await Promise.all([
        axios.get(`${API}/auth/me`, { withCredentials: true }),
        axios.get(`${API}/friends`, { withCredentials: true })
      ]);
      setUser(userRes.data);
      setFriends(friendsRes.data);
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    const parts = friendInput.trim().split('#');
    if (parts.length !== 2) {
      toast.error('Formato inválido. Use: nickname#tag');
      return;
    }

    const [nickname, tag] = parts;
    try {
      const res = await axios.post(`${API}/friends/add`, {
        friend_nickname: nickname,
        friend_tag: tag
      }, { withCredentials: true });
      
      toast.success(`${res.data.friend.nickname}#${res.data.friend.tag} adicionado!`);
      setFriendInput('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao adicionar amigo');
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Tem certeza que deseja remover este amigo?')) return;
    
    try {
      await axios.delete(`${API}/friends/${friendId}`, { withCredentials: true });
      toast.success('Amigo removido');
      loadData();
    } catch (error) {
      toast.error('Erro ao remover amigo');
    }
  };

  if (loading || !user) {
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
              <Users className="inline w-8 h-8 mr-3 text-cyan-400" />
              Amigos & Grupos
            </h1>
          </div>
        </div>

        <div className="space-y-6">
          {/* Add Friend */}
          <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                Adicionar Amigo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={friendInput}
                  onChange={(e) => setFriendInput(e.target.value)}
                  placeholder="Digite nickname#tag"
                  className="bg-slate-700 border-slate-600 text-white"
                  data-testid="friend-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddFriend()}
                />
                <Button 
                  onClick={handleAddFriend}
                  className="bg-cyan-500 hover:bg-cyan-600"
                  data-testid="add-friend-button"
                >
                  Adicionar
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Exemplo: joao123#AB12</p>
            </CardContent>
          </Card>

          {/* Friends List */}
          <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Seus Amigos ({friends.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {friends.length === 0 ? (
                <p className="text-center text-gray-400 py-8">
                  Você ainda não adicionou nenhum amigo
                </p>
              ) : (
                <div className="space-y-3">
                  {friends.map(friend => (
                    <div 
                      key={friend.id} 
                      className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">{friend.name?.[0]?.toUpperCase() || 'U'}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-white">{friend.name}</p>
                          <p className="text-sm text-gray-400">{friend.nickname}#{friend.tag}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Nível {friend.level}</p>
                          <p className="text-xs text-gray-500">{friend.coins} coins</p>
                        </div>
                        <Button
                          onClick={() => handleRemoveFriend(friend.id)}
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Groups - Coming Soon */}
          <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Grupos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-400 py-8">
                Sistema de grupos em breve...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}