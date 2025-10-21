# backend/shop_seed.py
# Gera 90 itens incríveis: 30 selos, 30 bordas, 30 temas
# Nova curva: 5000h estudo = 60,000 coins
# Raro: 200h+ (2,400+ coins), Especial: 800h+ (9,600+), Lendário: 2000h+ (24,000+)

from math import pow

RARITIES = [("common", 12), ("rare", 9), ("epic", 6), ("legendary", 3)]
ICONS = ["star","sparkle","bolt","flame","crystal","nova","aurora","phoenix","cosmos"]
PATTERNS = ["none", "dots", "grid", "waves", "particles", "spiral", "constellation", "nebula", "fractal"]

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
    # Nova distribuição: 1-12 comum | 13-21 raro | 22-27 épico | 28-30 lendário
    if   i <= 12:  rarity, idx = "common",    i - 1
    elif i <= 21:  rarity, idx = "rare",      i - 13
    elif i <= 27:  rarity, idx = "epic",      i - 19
    else:          rarity, idx = "legendary", i - 28

    # Paletas mais vibrantes e distintas
    if rarity == "common":
        # Gradientes sutis mas bonitos
        hue, s, l = _COMMON_HUES[idx % 12], 70, 58
        icon = ICONS[idx % 3]  # star, sparkle, bolt
        glow = "subtle"
        particles = False
        animation = "none"
        interactive = False
        holographic = False
    elif rarity == "rare":
        # Brilho intenso + movimento
        hue, s, l = _RARE_HUES[idx % 6], 80, 55
        icon = ICONS[3 + (idx % 3)]  # flame, crystal, nova
        glow = "intense"
        particles = True  # partículas leves orbitando
        animation = "pulse"  # pulsa suavemente
        interactive = False
        holographic = False
    elif rarity == "epic":
        # Efeitos geométricos + interatividade
        hue, s, l = _EPIC_HUES[idx % 6], 85, 52
        icon = ICONS[6 + (idx % 3)]  # aurora, phoenix, cosmos
        glow = "radiant"
        particles = True
        animation = "orbit"  # órbitas de partículas
        interactive = True  # hover = explosão de partículas
        holographic = False
    else:  # legendary
        # Prisma holográfico + trilha
        hue, s, l = _LEGEND_HUES[idx % 3], 90, 50
        icon = ICONS[6 + (idx % 3)]
        glow = "prismatic"
        particles = True
        animation = "quantum"  # efeito quântico
        interactive = True
        holographic = True  # efeito holográfico rainbow

    base_hex = hsl_to_hex(hue, s, l)
    accent_hex = hsl_to_hex((hue + 40) % 360, s, max(30, l - 10))

    return {
        "id": f"seal_{i}",
        "name": f"Selo {ICONS[idx % len(ICONS)].title()} #{i}" if rarity != "common" else f"Selo {i}",
        "item_type": "seal",
        "rarity": rarity,
        # Nova curva: comum 50-600, raro 2400-6000, épico 9600-18000, lendário 24000-45000
        "price": price_curve(i, 30, 50, 45000, 2.8),
        "level_required": level_curve(i, 30, 25),
        "effects": {
            "base_color": base_hex,
            "accent_color": accent_hex,
            "icon": icon,
            "glow": glow,
            "particles": particles,
            "animation": animation,
            "interactive": interactive,
            "holographic": holographic,
            "pattern": PATTERNS[idx % len(PATTERNS)]
        },
        "perks": {},
    }


# --------- BORDAS (30) ---------
def make_border(i: int) -> dict:
    # Nova distribuição: 1-12 comum | 13-21 raro | 22-27 épico | 28-30 lendário
    if   i <= 12:  rarity = "common"
    elif i <= 21:  rarity = "rare"
    elif i <= 27:  rarity = "epic"
    else:          rarity = "legendary"

    hue = (i * 29) % 360
    
    if rarity == "common":
        # Borda básica com brilho sutil
        color = hsl_to_hex(hue, 68, 60)
        thickness = 2
        radius = 16
        animation = "static-glow"  # brilho estático
        particles = False
        interactive = False
        glow_intensity = "low"
    elif rarity == "rare":
        # Borda animada com movimento
        color = hsl_to_hex(hue, 75, 58)
        thickness = 3
        radius = 18
        animation = "rotating-glow"  # brilho que rota
        particles = False
        interactive = False
        glow_intensity = "medium"
    elif rarity == "epic":
        # Borda com partículas + interatividade
        color = hsl_to_hex(hue, 82, 55)
        thickness = 4
        radius = 20
        animation = "pulse-wave"  # ondas de energia
        particles = True  # partículas ao redor
        interactive = True  # hover = explosão de partículas
        glow_intensity = "high"
    else:  # legendary
        # Borda holográfica prisma
        color = hsl_to_hex(hue, 90, 52)
        thickness = 5
        radius = 24
        animation = "prismatic-rainbow"  # arco-íris holográfico
        particles = True
        interactive = True
        glow_intensity = "extreme"

    return {
        "id": f"border_{i}",
        "name": f"Borda {'Cosmic' if rarity=='legendary' else ('Epic' if rarity=='epic' else ('Rare' if rarity=='rare' else 'Common'))} #{i}",
        "item_type": "border",
        "rarity": rarity,
        # Nova curva: comum 60-700, raro 2500-7000, épico 10000-20000, lendário 25000-50000
        "price": price_curve(i, 30, 60, 50000, 2.8),
        "level_required": level_curve(i, 30, 25),
        "effects": {
            "thickness": thickness,
            "radius": radius,
            "color": color,
            "animation": animation,
            "particles": particles,
            "interactive": interactive,
            "glow_intensity": glow_intensity,
        },
        "perks": {},
    }

# --------- TEMAS (30) ---------
def make_theme(i: int) -> dict:
    # Nova distribuição: 1-12 comum | 13-21 raro | 22-27 épico | 28-30 lendário
    if   i <= 12:  rarity = "common"
    elif i <= 21:  rarity = "rare"
    elif i <= 27:  rarity = "epic"
    else:          rarity = "legendary"

    h = (i * 23) % 360
    
    if rarity == "common":
        # Paleta simples mas bonita
        p0 = hsl_to_hex(h, 75, 58)
        p1 = hsl_to_hex((h + 200) % 360, 65, 15)
        bg_effect = "solid"
        timer_reactive = False
        celebrate = False
        ambient_particles = False
    elif rarity == "rare":
        # Gradientes animados
        p0 = hsl_to_hex(h, 82, 55)
        p1 = hsl_to_hex((h + 180) % 360, 72, 16)
        bg_effect = "animated-gradient"
        timer_reactive = False
        celebrate = False
        ambient_particles = False
    elif rarity == "epic":
        # Reativo ao timer
        p0 = hsl_to_hex(h, 88, 52)
        p1 = hsl_to_hex((h + 170) % 360, 78, 17)
        bg_effect = "dynamic-gradient"
        timer_reactive = True  # cor muda conforme progresso
        celebrate = False
        ambient_particles = True  # partículas ambiente
    else:  # legendary
        # Parallax + celebrações
        p0 = hsl_to_hex(h, 92, 50)
        p1 = hsl_to_hex((h + 160) % 360, 85, 18)
        bg_effect = "parallax-nebula"
        timer_reactive = True
        celebrate = True  # fogos quando completa sessão
        ambient_particles = True

    palette = [p0, p1, hsl_to_hex((h + 90) % 360, 70, 22)]

    return {
        "id": f"theme_{i}",
        "name": f"Tema {'Cosmic' if rarity=='legendary' else ('Epic' if rarity=='epic' else ('Rare' if rarity=='rare' else 'Classic'))} #{i}",
        "item_type": "theme",
        "rarity": rarity,
        # Nova curva: comum 100-1000, raro 3000-9000, épico 12000-25000, lendário 30000-60000
        "price": price_curve(i, 30, 100, 60000, 2.9),
        "level_required": level_curve(i, 30, 25),
        "effects": {
            "palette": palette,
            "bg_effect": bg_effect,
            "timer_reactive": timer_reactive,
            "celebrate_milestones": celebrate,
            "ambient_particles": ambient_particles,
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
