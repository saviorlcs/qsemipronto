// frontend/src/pages/Shop.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { applyThemeEffects, applyBorderEffects, bootApply } from "@/lib/siteStyle";
import SealAvatar from "@/components/SealAvatar";

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

/* ---------- UI helpers ---------- */
const RARITY_LABEL = { common: "Comum", rare: "Raro", epic: "Especial", legendary: "Lendário" };
const rarityUI = {
  common:    { badge: "bg-slate-600 text-slate-200", ring: "ring-slate-500/40", glow: "" },
  rare:      { badge: "bg-sky-500/15 text-sky-300 border border-sky-400/30", ring: "ring-sky-400/40", glow: "shadow-[0_0_16px_rgba(56,189,248,0.18)]" },
  epic:      { badge: "bg-purple-500/15 text-purple-300 border border-purple-400/30", ring: "ring-purple-400/50", glow: "shadow-[0_0_18px_rgba(168,85,247,0.28)]" },
  legendary: { badge: "bg-amber-500/15 text-amber-300 border border-amber-400/40", ring: "ring-amber-400/70", glow: "shadow-[0_0_22px_rgba(251,191,36,0.35)]" },
};
const gradFor = (seed) => {
  const h = (Number(seed || 0) * 37) % 360;
  return { from: `hsl(${h} 70% 60%)`, to: `hsl(${(h + 40) % 360} 70% 45%)` };
};
const getInitials = (name = "") =>
  (String(name).trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("")) || "U";
const SealPreview = ({ seed, userName, size = 64 }) => {
  const { from, to } = gradFor(seed);
  const initials = getInitials(userName);
  return (
    <div className="rounded-full mx-auto relative overflow-hidden"
         style={{ width: size, height: size, background: `linear-gradient(135deg, ${from}, ${to})` }}>
      <div className="absolute inset-0 flex items-center justify-center text-white/95 font-bold">{initials}</div>
    </div>
  );
};
const themeFromId = (id) => {
  const n = Number(String(id).split("_")[1] ?? 0) || 0;
  const h = (n * 29) % 360;
  return {
    bg:      `hsl(${h} 40% 10%)`,
    surface: `hsl(${(h + 8) % 360} 32% 16%)`,
    primary: `hsl(${(h + 32) % 360} 82% 55%)`,
    accent:  `hsl(${(h + 300) % 360} 72% 60%)`,
  };
};
// --- PREVIEWs ---
const ThemePreview = ({ palette }) => {
  const [p0, p1] = palette || [];
  return (
    <div className="mx-auto w-28 rounded-lg overflow-hidden" style={{ border: "1px solid var(--app-border)" }}>
      <div className="h-3" style={{ background: p0 || "#0ea5e9" }} />
      <div className="px-1 py-1" style={{ background: p1 || "#0b1020" }}>
        <div className="h-8 rounded mb-1" style={{ background: "rgba(255,255,255,.06)" }} />
        <div className="flex gap-1">
          <div className="h-2 flex-1 rounded" style={{ background: p0 || "#0ea5e9" }} />
          <div className="h-2 w-6 rounded"  style={{ background: p0 || "#0ea5e9" }} />
        </div>
      </div>
    </div>
  );
};

const borderPresetFromId = () => ({ radius: 16, width: 2, color: "rgba(148,163,184,.35)", glow: "0 0 0 rgba(0,0,0,0)" });
const BorderPreview = () => {
  const p = borderPresetFromId();
  return (
    <div className="mx-auto w-28 h-16"
         style={{ background: "var(--surface)", borderRadius: p.radius, border: `${p.width}px solid ${p.color}`, boxShadow: p.glow }} />
  );
};

const ItemPreview = ({ item, user }) => {
  if (item.item_type === "border") return <BorderPreview />;
  if (item.item_type === "theme")  return <ThemePreview palette={item?.effects?.palette} />;
  // selo = foto de perfil a partir do nick#tag com os efeitos do item
  return <SealAvatar user={user} item={item} size={76} />;
};


/* ---------- componente ---------- */
export default function Shop() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [equippedItems, setEquippedItems] = useState({ seal: null, border: null, theme: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get("/auth/me");
        setUser(me.data);
        const { endpoint, data } = await getAnyShopList(api);
        const items = extractItems(data);
        if (!items.length) throw new Error(`Lista vazia no endpoint ${endpoint}`);
        setShopItems(items);
        setEquippedItems(me.data?.equipped_items ?? { seal: null, border: null, theme: null });
      } catch (e) {
        console.error("[Shop] load error:", e?.response?.status, e?.response?.data || e?.message);
        toast.error("Erro ao carregar a loja");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900" style={{ fontFamily: "Inter, sans-serif" }}>
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
                        >
                          <div className={`absolute left-2 top-2 text-[10px] px-2 py-0.5 rounded-full ${rui.badge}`}>
                            {RARITY_LABEL[item.rarity] || "Comum"}
                          </div>

                          <div className="mb-3">
                           <ItemPreview item={item} user={user} />
                          </div>

                          <p className="font-semibold text-sm text-white mb-0.5">{item.name}</p>
                          <p className="text-xs text-gray-400 mb-3">C${item.price}</p>

{item.item_type === "seal" && (
  <SealAvatar user={user} item={item} size={76} />
)}

{item.item_type === "border" && (
  <div className="bordered p-3 rounded-2xl"
       data-border={item.effects?.animated || ""}
       style={{ borderWidth: (item.effects?.thickness || 2) + "px" }}>
    <div className="text-xs opacity-80">Preview da Borda</div>
  </div>
)}

{item.item_type === "theme" && (
  <div className="cycle-bg h-16 rounded-xl"
       style={{
         // Mostra a paleta do tema no bloco
         background: `linear-gradient(135deg, ${(item.effects?.palette||[])[0]||'#0ea5e9'}, ${(item.effects?.palette||[])[1]||'#111827'})`
       }} />
)}


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
