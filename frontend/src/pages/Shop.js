// frontend/src/pages/Shop.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import {
   applyThemeEffects,
   applyBorderEffects,
   bootApply,
   applyThemeById,
   applyBorderById,
 } from "@/lib/siteStyle";
import SealAvatar from "@/components/SealAvatar";
import AdvancedSealAvatar from "@/components/AdvancedSealAvatar";
import AdvancedBorderPreview from "@/components/AdvancedBorderPreview";
import AdvancedThemePreview from "@/components/AdvancedThemePreview";

/* CSS inline para animações */
const shopStyles = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

/* ---------- helpers de chamadas ---------- */
async function getAnyShopList(apiClient) {
  const endpoints = ["/shop/list", "/shop/items", "/shop", "/shop/all"];
  let lastErr = null;
  for (const ep of endpoints) {
    try {
      const r = await apiClient.get(ep);
      return { endpoint: ep, data: r.data };
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (payload && typeof payload === "object") {
    const arrays = Object.values(payload).filter(v => Array.isArray(v));
    for (const arr of arrays) {
      if (arr.length && typeof arr[0] === "object" && ("id" in arr[0] || "item_type" in arr[0])) return arr;
    }
  }
  return [];
}
async function postAny(paths, body) {
  let lastErr = null;
  for (const p of paths) {
    try { return await api.post(p, body); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const RARITY_LABEL = { common: "Comum", rare: "Raro", epic: "Especial", legendary: "Lendário" };
const rarityUI = {
  common:    { badge: "bg-slate-600 text-slate-200", ring: "ring-slate-500/40", glow: "" },
  rare:      { badge: "bg-sky-500/15 text-sky-300 border border-sky-400/30", ring: "ring-sky-400/40", glow: "shadow-[0_0_16px_rgba(56,189,248,0.18)]" },
  epic:      { badge: "bg-purple-500/15 text-purple-300 border border-purple-400/30", ring: "ring-purple-400/50", glow: "shadow-[0_0_18px_rgba(168,85,247,0.28)]" },
  legendary: { badge: "bg-amber-500/15 text-amber-300 border border-amber-400/40", ring: "ring-amber-400/70", glow: "shadow-[0_0_22px_rgba(251,191,36,0.35)]" },
};

const ItemPreview = ({ item, user }) => {
  if (item.item_type === "border") return <AdvancedBorderPreview effects={item?.effects} size={120} />;
  if (item.item_type === "theme")  return <AdvancedThemePreview effects={item?.effects} size={120} />;
  // Selo avançado com todos os efeitos
  return <AdvancedSealAvatar user={user} item={item} size={80} />;
};


/* ---------- componente ---------- */
export default function Shop() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [equippedItems, setEquippedItems] = useState({ seal: null, border: null, theme: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  // injeta o CSS dos efeitos (selos, temas e bordas)
  bootApply();

  (async () => {
    try {
      const me = await api.get("/auth/me");
      const { data } = await getAnyShopList(api);
      const items = extractItems(data);

      setUser(me.data);
      setShopItems(items);

      // mapa por id para converter ids -> objetos
      const byId = Object.fromEntries(items.map(it => [it.id, it]));
      const eq = me.data?.equipped_items ?? { seal:null, border:null, theme:null };

      // guarda o equipado como OBJETO (mantém id se não achar o item na lista)
      const equippedObj = {
        seal:   byId[eq.seal]   || eq.seal   || null,
        border: byId[eq.border] || eq.border || null,
        theme:  byId[eq.theme]  || eq.theme  || null,
      };
      setEquippedItems(equippedObj);

      // aplica os efeitos reais do equipado assim que a tela abre
      bootApply({
        themeEffects:  byId[eq.theme]?.effects  || null,
        borderEffects: byId[eq.border]?.effects || null,
      });
    } catch (e) {
      console.error("[Shop] load error:", e?.response?.status, e?.response?.data || e?.message);
      toast.error("Erro ao carregar a loja");
    } finally {
      setLoading(false);
    }
  })();
}, []);

useEffect(() => { bootApply(); }, []); // injeta o CSS base

  useEffect(() => {
    if (!user) return;
    bootApply({
      themeId:  user?.equipped_items?.theme  || null,
      borderId: user?.equipped_items?.border || null,
    });
  }, [user]);

  // guarda de carregamento (É AQUI!)
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 flex items-center justify-center">
        <div className="text-xl text-white">Carregando...</div>
      </div>
    );
  }

  // estado “sem itens”
  if (shopItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 flex items-center justify-center">
        <div className="text-white/90 text-center space-y-2">
          <div className="text-lg">Não foi possível carregar os itens da loja.</div>
          <div className="opacity-70 text-sm">Confira se o backend está rodando e as rotas /shop/list, /shop ou /shop/items existem.</div>
        </div>
      </div>
    );
  }

  const itemsOwnedRaw = Array.isArray(user?.items_owned) ? user.items_owned : [];
  const ownedIdSet = new Set(itemsOwnedRaw.map(x => (x && typeof x === "object" ? x.id : x)).filter(Boolean));

  async function handleBuy(item) {
    try {
      await postAny(["/shop/purchase", "/shop/buy", "/user/shop/purchase"], { item_id: item.id });
      setUser(prev => ({
        ...prev,
        coins: (prev?.coins || 0) - (item.price || 0),
        items_owned: [ ...(prev?.items_owned || []), item.id ],
      }));
      toast.success(`${item.name} comprado!`);
    } catch (err) {
      console.error("[Shop] buy error:", err?.response?.status, err?.response?.data || err?.message);
      toast.error(err?.response?.data?.detail || "Falha ao comprar");
    }
  }
  async function handleEquip(item, setEquippedItems) {
  await postAny(["/shop/equip", "/shop/equip_item", "/user/shop/equip"], { item_id: item.id });

  // atualiza estados locais
  setEquippedItems(prev => ({ ...prev, [item.item_type]: item }));
  setUser(prev => ({
    ...prev,
    equipped_items: { ...(prev?.equipped_items || {}), [item.item_type]: item }
  }));

  // reflete visualmente na hora
  if (item.item_type === "theme")  applyThemeEffects(item.effects);
  if (item.item_type === "border") applyBorderEffects(item.effects);

  // compat com estilos antigos (opcional)
  bootApply({
    themeId:   item.item_type === "theme"  ? item.id      : undefined,
    borderId:  item.item_type === "border" ? item.id      : undefined,
    themeEffects:   item.item_type === "theme"  ? item.effects : undefined,
    borderEffects:  item.item_type === "border" ? item.effects : undefined,
  });

  toast.success("Item equipado!");
}


  async function handleUnequipItem(itemType) {
    try {
      await postAny(["/shop/unequip", "/user/unequip", "/items/unequip"], { item_type: itemType });
    setEquippedItems(prev => ({ ...prev, [itemType]: null }));
      if (itemType === "theme")  applyThemeById(null);
      if (itemType === "border") applyBorderById(null);
      toast.success("Item desequipado!");
    } catch (err) {
      console.error("[Shop] unequip error:", err?.response?.status, err?.response?.data || err?.message);
      toast.error(err?.response?.data?.detail || "Falha ao desequipar");
    }
  }

function previewItem(item) {
  if (!item) return;
  if (item.item_type === "theme")  applyThemeEffects(item.effects);
  if (item.item_type === "border") applyBorderEffects(item.effects);
  // selos já pré-visualizam sozinhos via <SealAvatar item={item} />
}
function restoreEquipped(equipped) {
  applyThemeEffects(equipped?.theme?.effects || null);
  applyBorderEffects(equipped?.border?.effects || null);
}


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{shopStyles}</style>
      <Header user={user} />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
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

            {["seal", "border", "theme"].map((type) => (
              <TabsContent key={type} value={type}>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {shopItems
                    .filter(item => item.item_type === type)
                    .map((item, idx) => {
                      const owned     = ownedIdSet.has(item.id);
                      const ref = equippedItems?.[type] ?? null;
 const equipped = !!ref && (typeof ref === "string" ? ref === item.id : ref.id === item.id);
                      const meetsLevel = (user?.level ?? 1) >= (item.level_required ?? 1);
                      const canAfford  = (user?.coins ?? 0) >= (item.price ?? 0);
                      const rui = rarityUI[item.rarity] ?? rarityUI.common;

                      return (
                        <div
                          key={item.id}
                          className={`relative group app-surface border border-slate-600/40 rounded-2xl p-4 text-center transition-all ${rui.glow} ${equipped ? `ring-2 ${rui.ring}` : ""}`}
                          onMouseEnter={() => previewItem(item)}
                          onMouseLeave={() => restoreEquipped(equippedItems)}
                        >
                          <div className={`absolute left-2 top-2 text-[10px] px-2 py-0.5 rounded-full ${rui.badge}`}>
                            {RARITY_LABEL[item.rarity] || "Comum"}
                          </div>

                          <div className="mb-3">
  <ItemPreview item={item} user={user} />
</div>

<p className="font-semibold text-sm text-white mb-0.5">{item.name}</p>
<p className="text-xs text-gray-400 mb-3">C${item.price}</p>




                          {!owned ? (
                            <Button
                              disabled={!canAfford || !meetsLevel}
                              onClick={() => handleBuy(item)}
                              className="w-full h-8 text-xs"
                            >
                              {canAfford && meetsLevel
                                ? `Comprar por C$${item.price}`
                                : !meetsLevel
                                  ? `Requer nível ${item.level_required}`
                                  : `Moedas insuficientes`}
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
                            <Button onClick={() => handleEquip(item, setEquippedItems)}>Equipar</Button>

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
