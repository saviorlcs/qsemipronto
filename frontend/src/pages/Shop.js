import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, CheckCircle2, ShoppingBag } from 'lucide-react';
import Header from '../components/Header';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://studycycle-1.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

export default function Shop() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [equippedItems, setEquippedItems] = useState({ seal: null, border: null, theme: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userRes, shopRes] = await Promise.all([
        axios.get(`${API}/auth/me`, { withCredentials: true }),
        axios.get(`${API}/shop`, { withCredentials: true })
      ]);
      
      setUser(userRes.data);
      setShopItems(shopRes.data);
      setEquippedItems(userRes.data.equipped_items || { seal: null, border: null, theme: null });
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseItem = async (item) => {
    try {
      await axios.post(`${API}/shop/purchase`, { item_id: item.id }, { withCredentials: true });
      toast.success(`${item.name} comprado!`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao comprar item');
    }
  };

  const handleEquipItem = async (itemId, itemType) => {
    try {
      await axios.post(`${API}/shop/equip`, { item_id: itemId, item_type: itemType }, { withCredentials: true });
      setEquippedItems(prev => ({ ...prev, [itemType]: itemId }));
      toast.success('Item equipado!');
    } catch (error) {
      toast.error('Erro ao equipar item');
    }
  };

  const handleUnequipItem = async (itemType) => {
    try {
      await axios.post(`${API}/shop/unequip`, { item_type: itemType }, { withCredentials: true });
      setEquippedItems(prev => ({ ...prev, [itemType]: null }));
      toast.success('Item desequipado!');
    } catch (error) {
      toast.error('Erro ao desequipar item');
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
      
      <div className="container mx-auto px-4 py-8">
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
              <ShoppingBag className="inline w-8 h-8 mr-3 text-cyan-400" />
              Loja
            </h1>
            <p className="text-gray-400 mt-1">Compre e equipe itens exclusivos</p>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
          <Tabs defaultValue="seal" className="w-full">
            <TabsList className="bg-slate-700 mb-6 grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="seal" className="data-[state=active]:bg-cyan-500">Selos</TabsTrigger>
              <TabsTrigger value="border" className="data-[state=active]:bg-cyan-500">Bordas</TabsTrigger>
              <TabsTrigger value="theme" className="data-[state=active]:bg-cyan-500">Temas</TabsTrigger>
            </TabsList>
            
            {['seal', 'border', 'theme'].map(type => (
              <TabsContent key={type} value={type}>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {shopItems.filter(item => item.item_type === type).map(item => {
                    const owned = user.items_owned.includes(item.id);
                    const equipped = equippedItems[type] === item.id;
                    const canAfford = user.coins >= item.price;
                    
                    return (
                      <div
                        key={item.id}
                        className={`border rounded-xl p-4 text-center transition-all ${
                          item.rarity === 'legendary' ? 'border-yellow-400 bg-yellow-500/10' :
                          item.rarity === 'epic' ? 'border-purple-400 bg-purple-500/10' :
                          item.rarity === 'rare' ? 'border-blue-400 bg-blue-500/10' :
                          'border-slate-600 bg-slate-700/50'
                        } ${equipped ? 'ring-2 ring-cyan-400' : ''}`}
                      >
                        <div className="w-16 h-16 bg-slate-600 rounded-full mx-auto mb-3 flex items-center justify-center">
                          {equipped && <CheckCircle2 className="w-8 h-8 text-cyan-400" />}
                        </div>
                        <p className="font-semibold text-sm text-white mb-1">{item.name}</p>
                        <p className="text-xs text-gray-400 mb-3">{item.price} coins</p>
                        {!owned ? (
                          <Button
                            data-testid={`buy-${item.id}`}
                            onClick={() => handlePurchaseItem(item)}
                            disabled={!canAfford}
                            size="sm"
                            className="w-full h-8 text-xs bg-cyan-500 hover:bg-cyan-600"
                          >
                            Comprar
                          </Button>
                        ) : equipped ? (
                          <Button
                            onClick={() => handleUnequipItem(type)}
                            size="sm"
                            className="w-full h-8 text-xs bg-slate-600 hover:bg-slate-500"
                          >
                            Desequipar
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleEquipItem(item.id, type)}
                            size="sm"
                            className="w-full h-8 text-xs bg-green-600 hover:bg-green-500"
                          >
                            Equipar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}