# backend/shop_seed.py
# Gera 90 itens: 30 selos, 30 bordas, 30 temas — com efeitos usados no front

from math import pow

RARITIES = [("common", 12), ("rare", 9), ("epic", 6), ("legendary", 3)]
ICONS = ["dot","triangle","star","bolt","diamond","target","leaf","heart","clover"]

def hsl_to_hex(h: int, s: int, l: int) -> str:
    # HSL -> HEX (inteiro, sem libs externas)
    s /= 100.0; l /= 100.0
    c = (1 - abs(2*l - 1)) * s
    x = c * (1 - abs((h/60.0) % 2 - 1))
    m = l - c/2.0
    if   h < 60:  r,g,b = c,x,0
    elif h < 120: r,g,b = x,c,0
    elif h < 180: r,g,b = 0,c,x
    elif h < 240: r,g,b = 0,x,c
    elif h < 300: r,g,b = x,0,c
    else:         r,g,b = c,0,x
    R = round((r+m)*255); G = round((g+m)*255); B = round((b+m)*255)
    return f"#{R:02x}{G:02x}{B:02x}"

def ease(t: float, p: float = 2.15) -> float:
    return 1 - pow(1 - t, p)

def price_curve(i: int, n: int, min_price: int, max_price: int, pw: float) -> int:
    if n <= 1: return min_price
    t = (i - 1) / (n - 1)
    v = min_price + ease(t, pw) * (max_price - min_price)
    return int(round(v))

def level_curve(i: int, n: int, max_lvl: int) -> int:
    if n <= 1: return 1
    t = (i - 1) / (n - 1)
    return max(1, min(max_lvl, 1 + round(t * max_lvl)))

# --------- SELOS (30) ---------
# --- SUBSTITUA SUA make_seal POR ESTA ---

def _ring_hues(n: int, start: int = 0, spread: int = 360) -> list[int]:
    return [int((start + spread * k / n) % 360) for k in range(n)]

# paletas por raridade (hues bem espaçados)
_COMMON_HUES    = _ring_hues(12, start=14)         # 12 cores pelo círculo inteiro (sutis)
_RARE_HUES      = _ring_hues(6,  start=4)          # 6 cores mais vivas
_EPIC_HUES      = _ring_hues(9,  start=8)          # 9 cores intensas
_LEGEND_HUES    = [48, 195, 275]                   # dourado, ciano, violeta

def make_seal(i: int) -> dict:
    # 1–12 comum | 13–18 raro | 19–27 épico | 28–30 lendário
    if   i <= 12:  rarity, idx = "common",    i - 1
    elif i <= 18:  rarity, idx = "rare",      i - 13
    elif i <= 27:  rarity, idx = "epic",      i - 19
    else:          rarity, idx = "legendary", i - 28

    # HUE + saturação/luminância por raridade
    if rarity == "common":
        hue, s, l = _COMMON_HUES[idx % 12], 72, 54
        icon_pool = ["dot", "triangle"]
        pulse = False
        orbit = "none"
        pattern = "none"
        trail = False
    elif rarity == "rare":
        hue, s, l = _RARE_HUES[idx % 6], 78, 52
        icon_pool = ["star", "bolt"]
        pulse = False
        orbit = "slow"
        pattern = "none"
        trail = False
    elif rarity == "epic":
        hue, s, l = _EPIC_HUES[idx % 9], 82, 50
        icon_pool = ["diamond", "target"]
        pulse = True
        orbit = "slow"
        pattern = "rings"
        trail = False
    else:  # legendary
        hue, s, l = _LEGEND_HUES[idx % 3], 88, 52
        icon_pool = ["leaf", "heart", "clover"]
        pulse = True
        orbit = "slow"
        pattern = "flare"
        trail = True

    base_hex = hsl_to_hex(hue, s, l)
    icon = icon_pool[i % len(icon_pool)]
    angle = (i * 17) % 360

    return {
        "id": f"seal_{i}",
        "name": f"Selo {i}",
        "item_type": "seal",
        "rarity": rarity,
        "price": price_curve(i, 30, 50, 2800, 2.2),
        "level_required": level_curve(i, 30, 18),
        "effects": {
            "avatar_style": {
                "static_color": base_hex,
                "icon": icon,
                "angle": angle,
                "pulse": pulse,
                "pattern": pattern,
                "orbit": orbit,
                "trail": trail,
            }
        },
        "perks": {},
    }


# --------- BORDAS (30) ---------
def make_border(i: int) -> dict:
    rarity = "common"
    if 11 <= i <= 16: rarity = "rare"
    elif 17 <= i <= 26: rarity = "epic"
    elif i >= 27: rarity = "legendary"

    hue = (i * 23) % 360
    color = hsl_to_hex(hue, 70, 65 if rarity == "common" else 58)
    thickness = 2 if rarity in ("common","rare") else 3 if rarity == "epic" else 4
    radius = 16 if rarity == "common" else 18 if rarity == "rare" else 20 if rarity == "epic" else 24
    animated = "none" if rarity == "common" else "soft-glow" if rarity == "rare" else "circuit" if rarity == "epic" else "prism"

    return {
        "id": f"border_{i}",
        "name": f"Borda {i}",
        "item_type": "border",
        "rarity": rarity,
        "price": price_curve(i, 30, 60, 3200, 2.0),
        "level_required": level_curve(i, 30, 20),
        "effects": {
            "thickness": thickness,
            "radius": radius,
            "color": color,
            "animated": animated,          # lido no siteStyle/applyBorderEffects
            "accent_color_sync": rarity != "common",
        },
        "perks": {},
    }

# --------- TEMAS (30) ---------
def make_theme(i: int) -> dict:
    rarity = "common"
    if 13 <= i <= 18: rarity = "rare"
    elif 19 <= i <= 27: rarity = "epic"
    elif i >= 28: rarity = "legendary"

    h = (i * 19) % 360
    p0 = hsl_to_hex(h, 85, 58 if rarity == "legendary" else 55)
    p1 = hsl_to_hex((h + 210) % 360, 70, 14)
    palette = [p0, hsl_to_hex((h + 180) % 360, 75, 18)] if rarity == "legendary" else [p0, p1]

    return {
        "id": f"theme_{i}",
        "name": f"Tema {i}",
        "item_type": "theme",
        "rarity": rarity,
        "price": price_curve(i, 30, 100, 5500, 2.25),
        "level_required": level_curve(i, 30, 22),
        "effects": {
            "palette": palette,            # usado nos previews + applyThemeEffects
            "bg": "parallax" if rarity == "legendary" else ("cycle-reactive" if rarity == "epic" else "solid"),
            "celebrate_milestones": True if rarity == "legendary" else False,
        },
        "perks": {},
    }

def build_items() -> list[dict]:
    items = []
    items += [make_seal(i+1) for i in range(30)]
    items += [make_border(i+1) for i in range(30)]
    items += [make_theme(i+1) for i in range(30)]
    return items

# Export
SHOP_ITEMS = build_items()
