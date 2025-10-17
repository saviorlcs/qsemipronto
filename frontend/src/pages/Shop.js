import SealAvatar from '../components/SealAvatar';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, CheckCircle2, ShoppingBag } from 'lucide-react';
import Header from '../components/Header';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
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
      axios.get(`${API}/shop`, { withCredentials: true }),
    ]);
    const u = userRes.data?.user ?? null;
    setUser(u);
    setShopItems(shopRes.data ?? []);
    setEquippedItems(u?.equipped_items ?? { seal: null, border: null, theme: null });
  } catch (error) {
    if (error.response?.status === 401) navigate('/');
  } finally {
    setLoading(false); // deixe apenas aqui
  }
};

  

const handlePurchaseItem = async (item) => {
  try {
    await axios.post(`${API}/shop/purchase`, { item_id: item.id }, { withCredentials: true });
    await loadData();
    toast.success(`${item.name} comprado!`);
  } catch (e) {
    toast.error(e?.response?.data?.detail || 'Erro ao comprar item');
  }
};



  const handleUnequipItem = async (itemType) => {
    try {
      await axios.post(
        `${API}/shop/unequip`,
        { item_type: itemType },
        { withCredentials: true }
      );
      setEquippedItems((prev) => ({ ...prev, [itemType]: null }));
      toast.success('Item desequipado!');
    } catch {
      toast.error('Erro ao desequipar item');
    }
  };

  

  // Conjunto seguro de itens já possuídos (ids)
  const itemsOwnedRaw = Array.isArray(user?.items_owned) ? user.items_owned : [];
const ownedIdSet = new Set(
  itemsOwnedRaw
    .map(x => (x && typeof x === 'object' ? x.id : x))
    .filter(Boolean)
);

// ---- UI helpers de raridade e previews ----
// ---- Raridade & helpers visuais ----
// ===== RARIDADE VISUAL =====
const RARITY_LABEL = { common: 'Comum', rare: 'Raro', epic: 'Especial', legendary: 'Lendário' };
const rarityUI = {
  common:     { badge: 'bg-slate-600 text-slate-200', ring: 'ring-slate-500/40', glow: '' },
  rare:       { badge: 'bg-sky-500/15 text-sky-300 border border-sky-400/30', ring: 'ring-sky-400/40', glow: 'shadow-[0_0_16px_rgba(56,189,248,0.18)]' },
  epic:       { badge: 'bg-purple-500/15 text-purple-300 border border-purple-400/30', ring: 'ring-purple-400/50', glow: 'shadow-[0_0_18px_rgba(168,85,247,0.28)]' },
  legendary:  { badge: 'bg-amber-500/15 text-amber-300 border border-amber-400/40', ring: 'ring-amber-400/70', glow: 'shadow-[0_0_22px_rgba(251,191,36,0.35)]' },
};

// ===== SELO (avatar) =====
const gradFor = (seed) => {
  const h = (seed * 37) % 360;
  return {
    from: `hsl(${h} 70% 60%)`,
    to:   `hsl(${(h + 40) % 360} 70% 45%)`,
  };
};
const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || 'U';
};

// ===== THEME (cores do site) =====
const themeFromId = (id) => {
  const n = Number(String(id).split('_')[1] ?? 0) || 0;
  const h = (n * 29) % 360;
  return {
    bg:      `hsl(${h} 40% 10%)`,
    surface: `hsl(${(h+8)%360} 32% 16%)`,
    primary: `hsl(${(h+32)%360} 82% 55%)`,
    accent:  `hsl(${(h+300)%360} 72% 60%)`,
    text:    `#e5e7eb`,
  };
};
const applyThemeVars = (p) => {
  const r = document.documentElement;
  r.style.setProperty('--bg', p.bg);
  r.style.setProperty('--surface', p.surface);
  r.style.setProperty('--primary', p.primary);
  r.style.setProperty('--accent', p.accent);
  r.style.setProperty('--text', p.text);
};

// ===== BORDER (borda global do site) =====
// 5 estilos girando – você pode refinar depois item-a-item
const borderPresetFromId = (id) => {
  const n = Number(String(id).split('_')[1] ?? 0) || 0;
  const mode = n % 5;
  switch (mode) {
    case 0: return { radius: 12, width: 1, color: 'rgba(148,163,184,.35)', glow: '0 0 0 rgba(0,0,0,0)' };
    case 1: return { radius: 18, width: 1, color: 'rgba(56,189,248,.45)',   glow: '0 0 16px rgba(56,189,248,.18)' };
    case 2: return { radius: 22, width: 1, color: 'rgba(168,85,247,.45)',   glow: '0 0 18px rgba(168,85,247,.22)' };
    case 3: return { radius: 16, width: 2, color: 'rgba(251,191,36,.55)',   glow: '0 0 20px rgba(251,191,36,.25)' };
    case 4: return { radius: 14, width: 1, color: 'rgba(34,197,94,.50)',    glow: '0 0 16px rgba(34,197,94,.20)' };
    default: return { radius: 16, width: 1, color: 'rgba(148,163,184,.35)', glow: '0 0 0 rgba(0,0,0,0)' };
  }
};
const applyBorderVars = (b) => {
  const r = document.documentElement;
  r.style.setProperty('--app-radius', `${b.radius}px`);
  r.style.setProperty('--app-border-w', `${b.width}px`);
  r.style.setProperty('--app-border', b.color);
  r.style.setProperty('--app-glow', b.glow);
};

// ===== PREVIEWS =====
const SealPreview = ({ seed, userName, size = 64 }) => {
  const { from, to } = gradFor(seed);
  const initials = getInitials(userName);
  return (
    <div className="rounded-full mx-auto relative overflow-hidden"
         style={{ width: size, height: size, background: `linear-gradient(135deg, ${from}, ${to})` }}>
      <div className="absolute inset-0 flex items-center justify-center text-white/95 font-bold">
        {initials}
      </div>
    </div>
  );
};

const BorderPreview = ({ id }) => {
  const p = borderPresetFromId(id);
  return (
    <div
      className="mx-auto w-28 h-16"
      style={{
        background: 'var(--surface)',
        borderRadius: p.radius,
        border: `${p.width}px solid ${p.color}`,
        boxShadow: p.glow,
      }}
    />
  );
};

const ThemePreview = ({ palette }) => {
  const { bg, surface, primary, accent } = palette;
  return (
    <div className="mx-auto w-28 rounded-lg overflow-hidden"
         style={{ border: '1px solid var(--app-border)' }}>
      <div className="h-3" style={{ background: primary }} />
      <div className="px-1 py-1" style={{ background: bg }}>
        <div className="h-8 rounded mb-1" style={{ background: surface }} />
        <div className="flex gap-1">
          <div className="h-2 flex-1 rounded" style={{ background: accent }} />
          <div className="h-2 w-6 rounded" style={{ background: primary }} />
        </div>
      </div>
    </div>
  );
};

const ItemPreview = ({ item, idx, userName }) => {
  if (item.item_type === 'border') return <BorderPreview id={item.id} />;
  if (item.item_type === 'theme')  return <ThemePreview palette={themeFromId(item.id)} />;
  return <SealPreview seed={idx} userName={userName} />; // selo = avatar
};

// utilidades
const findItem = (items, id) => items.find(i => i.id === id);



// quando tema equipado muda, aplica
useEffect(() => {
  const themeId = equippedItems?.theme;
  if (themeId) applyThemeVars(themeFromId(themeId));
}, [equippedItems?.theme]);

// quando borda equipada muda, aplica
useEffect(() => {
  const borderId = equippedItems?.border;
  if (borderId) applyBorderVars(borderPresetFromId(borderId));
}, [equippedItems?.border]);

// ao equipar:
const handleEquipItem = async (itemId, itemType) => {
  try {
    await axios.post(`${API}/shop/equip`, { item_id: itemId, item_type: itemType }, { withCredentials: true });
    setEquippedItems(prev => ({ ...prev, [itemType]: itemId }));
    toast.success('Item equipado!');
    if (itemType === 'theme')  applyThemeVars(themeFromId(itemId));
    if (itemType === 'border') applyBorderVars(borderPresetFromId(itemId));
  } catch {
    toast.error('Erro ao equipar item');
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
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
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
            <h1
              className="text-3xl font-bold text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              <ShoppingBag className="inline w-8 h-8 mr-3 text-cyan-400" />
              Loja
            </h1>
            <p className="text-gray-400 mt-1">Compre e equipe itens exclusivos</p>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
          <Tabs defaultValue="seal" className="w-full">
            <TabsList className="bg-slate-700 mb-6 grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="seal" className="data-[state=active]:bg-cyan-500">
                Selos
              </TabsTrigger>
              <TabsTrigger value="border" className="data-[state=active]:bg-cyan-500">
                Bordas
              </TabsTrigger>
              <TabsTrigger value="theme" className="data-[state=active]:bg-cyan-500">
                Temas
              </TabsTrigger>
            </TabsList>

            {['seal', 'border', 'theme'].map((type) => (
              <TabsContent key={type} value={type}>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {shopItems
  .filter(item => item.item_type === type)
  .map((item, idx) => {
    const owned = ownedIdSet.has(item.id);
    const equipped  = (equippedItems?.[type] ?? null) === item.id;
    const canAfford = (user?.coins ?? 0) >= (item.price ?? 0);
    const rui = rarityUI[item.rarity] ?? rarityUI.common;

    return (
      <div
        key={item.id}
        className={`relative group app-surface border border-slate-600/40 rounded-2xl p-4 text-center transition-all ${rui.glow} ${equipped ? `ring-2 ${rui.ring}` : ''}`}
      >
        <div className={`absolute left-2 top-2 text-[10px] px-2 py-0.5 rounded-full ${rui.badge}`}>
          {RARITY_LABEL[item.rarity] || 'Comum'}
        </div>

        {/* PREVIEW correta para cada tipo */}
        <div className="mb-3">
          <SealAvatar seed={item.id} size={64} label={item.name} />
        </div>

        <p className="font-semibold text-sm text-white mb-0.5">{item.name}</p>
        <p className="text-xs text-gray-400 mb-3">C${item.price}</p>

        {!owned ? (
          <Button onClick={() => handlePurchaseItem(item)}
                  disabled={!canAfford}
                  size="sm"
                  className="w-full h-8 text-xs bg-[var(--primary)] hover:brightness-110 disabled:opacity-50">
            Comprar por C${item.price}
          </Button>
        ) : equipped ? (
          <Button onClick={() => handleUnequipItem(type)}
                  size="sm"
                  className="w-full h-8 text-xs bg-slate-600 hover:bg-slate-500">
            Desequipar
          </Button>
        ) : (
          <Button onClick={() => handleEquipItem(item.id, type)}
                  size="sm"
                  className="w-full h-8 text-xs bg-green-600 hover:bg-green-500">
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
