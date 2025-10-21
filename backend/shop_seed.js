// src/lib/shop_seed.js
// Gera 90 itens: 30 selos, 30 bordas, 30 temas
// Raridades por categoria: 12 comuns, 9 raros, 6 épicos, 3 lendários

const RARITIES = [
  { key: "common",    count: 12 },
  { key: "rare",      count:  9 },
  { key: "epic",      count:  6 },
  { key: "legendary", count:  3 },
];

const ICONS = ["dot","bolt","star","diamond","target","flame","leaf","heart","clover","triangle"];

// util
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function hslToHex(h, s = 70, l = 50) {
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2*l - 1)) * s;
  const x = c * (1 - Math.abs((h/60) % 2 - 1));
  const m = l - c/2;
  let [r,g,b] = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x] :
               h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
  r = Math.round((r+m)*255); g = Math.round((g+m)*255); b = Math.round((b+m)*255);
  return `#${((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1)}`;
}

/** Curva de preço
 * - começa em ~50
 * - termina por volta de 5.8k (aproxima “5000h” proporcional)
 * - acelera nos tiers altos (potência 2.2)
 */
function priceCurve(i, total) {
  if (total <= 1) return 50;
  const t = i / (total - 1);              // 0..1
  const curved = Math.pow(t, 2.2);        // aceleração
  return Math.round(50 + 5750 * curved);  // 50 → ~5800
}

function splitByRarity(total) {
  // ex.: 30 → [12,9,6,3]
  const out = [];
  let acc = 0;
  for (const r of RARITIES) {
    const n = r.count;
    out.push({ key: r.key, start: acc, end: acc + n - 1 });
    acc += n;
  }
  // segurança
  if (acc !== total) {
    // reescala proporcional se alguém mudar os counts
    let left = total;
    const rescaled = RARITIES.map((r, idx) => {
      const n = idx < RARITIES.length - 1
        ? Math.round(total * (r.count / acc))
        : left;
      left -= n;
      return { key: r.key, count: n };
    });
    let a = 0;
    return rescaled.map(r => {
      const s = a, e = a + r.count - 1; a += r.count;
      return { key: r.key, start: s, end: e };
    });
  }
  return out;
}

/* --------- SELOS --------- */
function buildSeals() {
  const total = 30;
  const bands = splitByRarity(total);
  const items = [];
  for (let i = 0; i < total; i++) {
    const id = `seal_${i + 1}`;
    const name = `Selo ${i + 1}`;
    const price = priceCurve(i, total);
    const band = bands.find(b => i >= b.start && i <= b.end) || bands[0];
    const rarity = band.key;

    // variações visuais — mais simples nos comuns; cresce até lendário
    const hue = (i * 13 + 210) % 360;
    const base = hslToHex(hue, 72, 56);
    const angle = (i * 17) % 360;
    const icon  = ICONS[i % ICONS.length];

    // efeitos por raridade
    const avatar_style = {
      icon,
      static_color: base,
      angle,
      orbit:   rarity === "rare" ? "slow"  : rarity === "epic" ? "fast" : rarity === "legendary" ? "fast" : "none",
      particles: rarity === "rare" ? "sparks" : rarity !== "common" ? "stardust" : "none",
      trail:  rarity === "epic" || rarity === "legendary",
      pulse:  rarity === "epic" || rarity === "legendary",
      pattern: rarity === "legendary" ? "rings" : "none",
    };

    items.push({
      id, name, item_type: "seal", rarity, price,
      level_required: 1 + Math.floor(i / 3),
      effects: { avatar_style },
    });
  }
  return items;
}

/* --------- BORDAS --------- */
function buildBorders() {
  const total = 30;
  const bands = splitByRarity(total);
  const items = [];
  for (let i = 0; i < total; i++) {
    const id = `border_${i + 1}`;
    const name = `Borda ${i + 1}`;
    const price = priceCurve(i, total);
    const band = bands.find(b => i >= b.start && i <= b.end) || bands[0];
    const rarity = band.key;

    const thickness =
      rarity === "common" ? 2 :
      rarity === "rare" ? 2 :
      rarity === "epic" ? 3 : 4;

    const animated = rarity === "common" ? "" : "rainbow"; // CSS já cobre "rainbow"
    items.push({
      id, name, item_type: "border", rarity, price,
      level_required: 1 + Math.floor(i / 3),
      effects: { thickness, animated, accent_color_sync: rarity !== "common" },
    });
  }
  return items;
}

/* --------- TEMAS --------- */
function buildThemes() {
  const total = 30;
  const bands = splitByRarity(total);
  const items = [];
  for (let i = 0; i < total; i++) {
    const id = `theme_${i + 1}`;
    const name = `Tema ${i + 1}`;
    const price = priceCurve(i, total);
    const band = bands.find(b => i >= b.start && i <= b.end) || bands[0];
    const rarity = band.key;

    const h = (i * 11 + 30) % 360;
    const accent = hslToHex(h, 80, 55);
    const surface = hslToHex((h + 320) % 360, 28, 13);

    items.push({
      id, name, item_type: "theme", rarity, price,
      level_required: 1 + Math.floor(i / 3),
      effects: {
        palette: [accent, surface],
        bg: rarity === "legendary" ? "parallax"
           : rarity === "epic" ? "cycle-reactive"
           : "solid",
        celebrate_milestones: rarity === "legendary",
      },
    });
  }
  return items;
}

/* --------- export --------- */
export function getShopItems() {
  return [...buildSeals(), ...buildBorders(), ...buildThemes()];
}

// também exporta pronto (quem quiser só importar a lista)
const SHOP_ITEMS = getShopItems();
export default SHOP_ITEMS;
