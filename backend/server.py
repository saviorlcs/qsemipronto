from fastapi import FastAPI, APIRouter, HTTPException, Cookie, Response, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
# --- GOOGLE OAUTH (LOGIN DIRETO, SEM EMERGENT) ---
import secrets, jwt
from fastapi.responses import RedirectResponse
# pseudo-código python (FastAPI) – coloque num cron semanal ou no /quests/refresh
import random
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    nickname: Optional[str] = None  # 4-16 chars, alphanumeric
    tag: Optional[str] = None  # 3-4 chars, alphanumeric
    last_nickname_change: Optional[datetime] = None
    level: int = 1
    coins: int = 0
    xp: int = 0
    items_owned: List[str] = Field(default_factory=list)
    equipped_items: dict = Field(default_factory=lambda: {"seal": None, "border": None, "theme": None})
    online_status: str = "offline"  # online, away, offline
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Subject(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    color: str
    order: int
    time_goal: int  # minutes per cycle
    total_time_studied: int = 0  # total minutes studied
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubjectCreate(BaseModel):
    name: str
    color: str
    time_goal: int

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    time_goal: Optional[int] = None
    order: Optional[int] = None

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subject_id: str
    title: str
    completed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TaskCreate(BaseModel):
    subject_id: str
    title: str

class StudySession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subject_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: int = 0  # minutes
    completed: bool = False
    skipped: bool = False
    coins_earned: int = 0
    xp_earned: int = 0

class StudySessionStart(BaseModel):
    subject_id: str

class StudySessionEnd(BaseModel):
    session_id: str
    duration: int  # actual minutes studied
    skipped: bool = False

class Cycle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    week_start: datetime
    week_end: datetime
    status: str = "active"  # active, completed
    total_time_goal: int = 0
    total_time_studied: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Quest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    xp_reward: int
    coins_reward: int
    quest_type: str  # daily, weekly, special
    target: int  # target value to complete

class UserQuest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    quest_id: str
    progress: int = 0
    completed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShopItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str                          # ex.: 'seal_focus_dot_01'
    item_type: str                   # 'seal' | 'border' | 'theme'
    name: str
    price: int
    rarity: str                      # 'common' | 'epic' | 'rare' | 'legendary'
    level_required: int = 1
    tags: List[str] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    effects: dict = Field(default_factory=dict)   # detalhes visuais / animações
    perks: dict = Field(default_factory=dict)     # “vantagens” cosméticas ou QoL
    image_url: Optional[str] = None


class PurchaseItem(BaseModel):
    item_id: str

class Settings(BaseModel):
    study_duration: int = 50  # minutes
    break_duration: int = 10  # minutes

class UserSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    study_duration: int = 50
    break_duration: int = 10

class NicknameTagCreate(BaseModel):
    nickname: str
    tag: str

class NicknameTagUpdate(BaseModel):
    nickname: str
    tag: str

DIFFS = [
    ("Tranquila", 1.0, 1.0),   # baixo esforço
    ("Média",     1.6, 1.8),
    ("Difícil",   2.4, 2.6),
    ("Desafio",   3.4, 3.8),   # alto esforço
]

TEMPLATES = [
    "Estudar {m} minutos de {subject}",
    "Concluir {b} blocos de {subject}",
    "Revisar {m} minutos de {subject}",
    "Estudar {m} minutos de matéria teórica",
    "Estudar {m} minutos de matéria de exatas",
    # nunca usar “pausa”
]

def generate_weekly_quests(user, subjects):
    quests = []
    baseCoins = 60   # ~5h → 60 coins; ajuste como quiser
    baseXP    = 120  # XP base

    for diff_name, c_mult, x_mult in DIFFS:
        subject = random.choice(subjects) if subjects else None
        minutes_target = random.choice([60, 90, 120, 150])  # alvo em minutos
        blocks_target = minutes_target // user.settings.study_duration

        title = random.choice(TEMPLATES).format(
            m=minutes_target, b=blocks_target, subject=subject.name if subject else "qualquer matéria"
        )

        quests.append({
            "title": title,
            "target": minutes_target,  # sempre em minutos para simplificar
            "progress": 0,
            "coins_reward": int(baseCoins * c_mult),
            "xp_reward": int(baseXP * x_mult),
            "completed": False,
            "difficulty": diff_name,
            "week_start": datetime.utcnow().date().isoformat(),
        })

    return quests  # salve no DB e retorne 4

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:3000")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:5000")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"


def set_session_cookie(resp, token: str):
    resp.set_cookie(
        "session_token",
        token,
        max_age=60*60*24*30,
        httponly=True,
        secure=COOKIE_SECURE,              # em dev: false; em produção/HTTPS: true
        samesite="none" if COOKIE_SECURE else "lax",
        path="/",
    )

def make_cookie(response: RedirectResponse | JSONResponse, token: str):
    # Em produção: Secure=True e SameSite=None (cross-site)
    response.set_cookie(
        "session_token",
        token,
        max_age=60*60*24*30,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="none" if COOKIE_SECURE else "lax",
        path="/",
    )

@api_router.get("/auth/google/login")
async def google_login(request: Request):
    # gera state e grava num cookie simples
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/api/auth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "include_granted_scopes": "true",
        "state": state,
        "prompt": "consent",
    }
    from urllib.parse import urlencode
    url = f"{GOOGLE_AUTH}?{urlencode(params)}"
    resp = RedirectResponse(url, status_code=302)
    resp.set_cookie("oauth_state", state, max_age=600, httponly=True, samesite="lax", path="/")
    return resp

@api_router.get("/auth/google/callback")
async def google_callback(request: Request, code: str | None = None, state: str | None = None, oauth_state: str | None = Cookie(None)):
    if not code or not state or not oauth_state or state != oauth_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    # troca code por tokens
    async with httpx.AsyncClient(timeout=15) as client:
        token_res = await client.post(GOOGLE_TOKEN, data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": f"{BACKEND_URL}/api/auth/google/callback",
        })
    if token_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Token exchange failed")
    tokens = token_res.json()
    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="No access token")

    # pega userinfo
    async with httpx.AsyncClient(timeout=15) as client:
        ui = await client.get(GOOGLE_USERINFO, headers={"Authorization": f"Bearer {access_token}"})
    if ui.status_code != 200:
        raise HTTPException(status_code=400, detail="Userinfo failed")
    info = ui.json()  # {"sub": "...", "email": "...", "name": "...", "picture": "..."}
    google_id = info.get("sub")
    if not google_id:
        raise HTTPException(status_code=400, detail="No sub in userinfo")

    # cria/atualiza usuário no Mongo
    uid = f"google:{google_id}"
    user_doc = {
        "id": uid,
        "email": info.get("email"),
        "name": info.get("name") or "User",
        "avatar": info.get("picture"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one({"id": uid}, {"$setOnInsert": {"coins": 0, "xp": 0, "level": 1}, "$set": user_doc}, upsert=True)

    # JWT e cookie
    payload = {"sub": uid, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    resp = RedirectResponse(FRONTEND_URL, status_code=302)
    make_cookie(resp, token)
    # limpa state
    resp.delete_cookie("oauth_state", path="/")
    return resp

@api_router.post("/admin/seed-shop")
async def admin_seed_shop():
    # cuidado: reseta a coleção
    await db.shop_items.delete_many({})
    from pathlib import Path
    # usa a mesma função que já existe
    items = await initialize_shop()
    return {"ok": True, "count": len(items)}


@api_router.get("/auth/me")
async def auth_me(session_token: str | None = Cookie(None)):
    try:
        if not session_token:
            return JSONResponse({"authenticated": False}, status_code=401)
        data = jwt.decode(session_token, JWT_SECRET, algorithms=["HS256"])
        uid = data.get("sub")
        user = await db.users.find_one({"id": uid}, {"_id": 0})
        if not user:
            return JSONResponse({"authenticated": False}, status_code=401)
        return {
            "authenticated": True,
            "user": {
                "id": user["id"],
                "name": user.get("name"),
                "email": user.get("email"),
                "avatar": user.get("avatar"),
                "nickname": user.get("nickname"),
                "tag": user.get("tag"),
                # >>> ADICIONE:
                "equipped_items": user.get("equipped_items", {"seal": None, "border": None, "theme": None}),

            }
        }
    except Exception:
        return JSONResponse({"authenticated": False}, status_code=401)


        return {
            "authenticated": True,
            "user": {
                "id": user["id"],
                "name": user.get("name"),
                "email": user.get("email"),
                "avatar": user.get("avatar"),
                "nickname": user.get("nickname"),
                "tag": user.get("tag"),

                # >>> adicionados (com defaults para nunca vir null)
                "level": user.get("level", 1),
                "coins": user.get("coins", 0),
                "xp": user.get("xp", 0),
                "items_owned": user.get("items_owned", []),
                "equipped_items": user.get(
                    "equipped_items",
                    {"seal": None, "border": None, "theme": None}
                ),
            }
        }
    except Exception:
        return JSONResponse({"authenticated": False}, status_code=401)



@api_router.post("/auth/logout")
async def auth_logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("session_token", path="/")
    return resp

# Root Route
@api_router.get("/")
async def root():
    return {"message": "CicloStudy API", "status": "ok"}

# Auth Helper
async def get_current_user(request: Request, session_token: str | None = Cookie(None)):
    if not session_token:
        raise HTTPException(status_code=401, detail="no-session")
    try:
        data = jwt.decode(session_token, JWT_SECRET, algorithms=["HS256"])
        uid = data.get("sub")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid-token")

    user = await db.users.find_one({"id": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="invalid-user")

    await db.users.update_one(
        {"id": uid},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )

    class CurrentUser: ...
    cu = CurrentUser()
    cu.id = user["id"]
    cu.email = user.get("email")
    cu.name = user.get("name")
    cu.level = user.get("level", 1)
    cu.coins = user.get("coins", 0)
    cu.xp = user.get("xp", 0)
    cu.items_owned = user.get("items_owned", [])
    cu.equipped_items = user.get("equipped_items", {"seal": None, "border": None, "theme": None})
    cu.nickname = user.get("nickname")
    cu.tag = user.get("tag")
    cu.last_nickname_change = user.get("last_nickname_change")  # <-- ADICIONE ESTA LINHA
    return cu



# >>> NEW: helpers de semana e recompensa
from random import Random

def get_week_bounds(now: datetime) -> tuple[datetime, datetime, str]:
    """
    Segunda 00:00:00 até próxima segunda, e um week_id estável (ISO-week).
    """
    now = now.astimezone(timezone.utc)
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    # week_id: YYYY-WW (ISO week)
    week_id = f"{week_start.isocalendar().year}-W{week_start.isocalendar().week:02d}"
    return week_start, week_end, week_id

async def grant_reward(user_id: str, coins: int, xp: int):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user: 
        return
    # reaproveita mesma curva de level do /study/end
    def calculate_xp_for_level(level:int):
        base_xp = 100
        return int(base_xp * (1.25 ** (level - 1)) + 0.999)
    new_xp = user.get("xp", 0) + max(0, xp)
    new_level = user.get("level", 1)
    need = calculate_xp_for_level(new_level)
    while new_xp >= need:
        new_xp -= need
        new_level += 1
        need = calculate_xp_for_level(new_level)
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"coins": max(0, coins)}, "$set": {"xp": new_xp, "level": new_level}}
    )

# >>> NEW: geração/obtenção das quests da semana do usuário
async def ensure_weekly_quests(user_id: str):
    now = datetime.now(timezone.utc)
    week_start, week_end, week_id = get_week_bounds(now)

    # já existe doc desta semana?
    doc = await db.weekly_quests.find_one({"user_id": user_id, "week_id": week_id}, {"_id": 0})
    if doc:
        return doc

    # doc da semana anterior (para evitar repetição)
    prev = await db.weekly_quests.find_one({"user_id": user_id}, sort=[("created_at", -1)])
    prev_keys = set(prev.get("quest_keys", [])) if prev else set()

    subjects = await db.subjects.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    total_goal = sum(s.get("time_goal", 0) for s in subjects) or 300

    # pool de quests variáveis (personalizadas)
    pool = []
    for s in subjects:
        # minutos por matéria (60% da meta ou no mínimo 60min)
        target_min = max(60, int(round(s["time_goal"] * 0.6)))
        pool.append({
            "key": f"min:{s['id']}",
            "id": f"Q_MIN_{s['id']}",
            "type": "study_minutes_subject",
            "title": f"Estudar {target_min} min de {s['name']}",
            "description": f"Some {target_min} minutos de estudo em {s['name']} nesta semana",
            "target": target_min,
            "subject_id": s["id"],
            "reward": {"coins": 30, "xp": 120}
        })
        # sessões por matéria (2 sessões)
        pool.append({
            "key": f"ses:{s['id']}",
            "id": f"Q_SES_{s['id']}",
            "type": "study_sessions_subject",
            "title": f"Fazer 2 sessões de {s['name']}",
            "description": f"Conclua 2 sessões de estudo em {s['name']} nesta semana",
            "target": 2,
            "subject_id": s["id"],
            "reward": {"coins": 20, "xp": 80}
        })

    # quest de minutos totais na semana (ex.: 70% do total_goal ou 300min, o que for maior)
    total_target = max(300, int(round(total_goal * 0.7)))
    pool.append({
        "key": "week_total",
        "id": "Q_WEEK_TOTAL",
        "type": "study_minutes_week",
        "title": f"Estudar {total_target} min na semana",
        "description": f"Some {total_target} minutos de estudo no total nesta semana",
        "target": total_target,
        "reward": {"coins": 40, "xp": 160}
    })

    # fixa: completar 1 ciclo
    fixed = {
        "key": "cycle_one",
        "id": "Q_CYCLE_ONE",
        "type": "complete_cycle",
        "title": "Completar 1 ciclo",
        "description": "Complete 1 ciclo semanal (atingir 100% da sua meta somada)",
        "target": 1,
        "reward": {"coins": 50, "xp": 200}
    }

    # selecionar 3 do pool sem repetir as da semana anterior
    rng = Random(f"{user_id}-{week_id}")
    candidates = [q for q in pool if q["key"] not in prev_keys]
    if len(candidates) < 3:
        candidates = pool[:]  # fallback se não tiver variedade
    rng.shuffle(candidates)
    chosen = candidates[:3]

    quests = [fixed] + chosen
    quest_payload = [{
        "qid": q["id"],
        "type": q["type"],
        "title": q["title"],
        "description": q["description"],
        "target": q["target"],
        "progress": 0,
        "done": False,
        "reward": q["reward"],
        "subject_id": q.get("subject_id")
    } for q in quests]

    doc = {
        "user_id": user_id,
        "week_id": week_id,
        "created_at": now.isoformat(),
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "quests": quest_payload,
        "quest_keys": [q["key"] for q in quests],
        "fixed_always": "Q_CYCLE_ONE"
    }
    await db.weekly_quests.insert_one(doc)
    return doc

async def get_current_week_quests(user_id: str):
    now = datetime.now(timezone.utc)
    _, _, week_id = get_week_bounds(now)
    doc = await db.weekly_quests.find_one({"user_id": user_id, "week_id": week_id}, {"_id": 0})
    if not doc:
        doc = await ensure_weekly_quests(user_id)
    return doc

# >>> NEW: atualizar progresso após cada estudo
async def update_weekly_quests_after_study(user_id: str, subject_id: str, duration: int, completed: bool):
    doc = await get_current_week_quests(user_id)
    if not doc: 
        return

    quests = doc.get("quests", [])
    changed = False

    # somatório semanal atual (pra detectar "completar 1 ciclo")
    subjects = await db.subjects.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    total_goal = sum(s.get("time_goal", 0) for s in subjects) or 1

    # minutos acumulados na semana
    now = datetime.now(timezone.utc)
    week_start, _, _ = get_week_bounds(now)
    sessions = await db.study_sessions.find(
        {"user_id": user_id, "completed": True}, {"_id": 0}
    ).to_list(10000)
    week_minutes = sum(
        s.get("duration", 0) for s in sessions
        if s.get("start_time") and datetime.fromisoformat(s["start_time"]) >= week_start
    )

    for q in quests:
        if q.get("done"): 
            continue

        if q["type"] == "study_minutes_subject" and q.get("subject_id") == subject_id:
            q["progress"] = min(q["target"], q.get("progress", 0) + max(0, duration))
            if q["progress"] >= q["target"]:
                q["done"] = True
                await grant_reward(user_id, q["reward"]["coins"], q["reward"]["xp"])
                changed = True

        elif q["type"] == "study_sessions_subject" and q.get("subject_id") == subject_id and completed:
            q["progress"] = min(q["target"], q.get("progress", 0) + 1)
            if q["progress"] >= q["target"]:
                q["done"] = True
                await grant_reward(user_id, q["reward"]["coins"], q["reward"]["xp"])
                changed = True

        elif q["type"] == "study_minutes_week":
            # atualiza pelo total da semana (robusto a múltiplas abas)
            q["progress"] = min(q["target"], week_minutes)
            if q["progress"] >= q["target"]:
                q["done"] = True
                await grant_reward(user_id, q["reward"]["coins"], q["reward"]["xp"])
                changed = True

        elif q["type"] == "complete_cycle":
            cycle_progress = min(100.0, (week_minutes / total_goal) * 100.0)
            q["progress"] = 1 if cycle_progress >= 100.0 else 0
            if q["progress"] >= q["target"]:
                q["done"] = True
                await grant_reward(user_id, q["reward"]["coins"], q["reward"]["xp"])
                changed = True

    if changed:
        await db.weekly_quests.update_one(
            {"user_id": user_id, "week_id": doc["week_id"]},
            {"$set": {"quests": quests}}
        )
class ReorderSubjectsPayload(BaseModel):
    order: List[str]  # lista de IDs na nova ordem

@api_router.post("/subjects/reorder")
async def reorder_subjects(payload: ReorderSubjectsPayload, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)

    # valida IDs pertencentes ao usuário
    user_subjects = await db.subjects.find({"user_id": user.id}, {"_id": 0, "id": 1}).to_list(1000)
    owned = {s["id"] for s in user_subjects}
    invalid = [sid for sid in payload.order if sid not in owned]
    if invalid:
        raise HTTPException(status_code=400, detail=f"IDs inválidos: {invalid}")

    # atualiza 1 a 1 (simples e compatível com Motor)
    for idx, sid in enumerate(payload.order):
        await db.subjects.update_one({"id": sid, "user_id": user.id}, {"$set": {"order": idx}})

    return {"success": True}

# >>> PATCH: substituir o endpoint /quests atual por este
@api_router.get("/quests")
async def get_quests(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    doc = await get_current_week_quests(user.id)
    return doc["quests"]



# Nickname#Tag Routes
@api_router.post("/user/nickname")
async def create_or_update_nickname(input: NicknameTagCreate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    # Validate nickname (4-16 chars, alphanumeric)
    import re
    if not re.match(r'^[a-zA-Z0-9]{4,16}$', input.nickname):
        raise HTTPException(status_code=400, detail="Nickname deve ter 4-16 caracteres alfanuméricos")
    
    # Validate tag (3-4 chars, alphanumeric)
    if not re.match(r'^[a-zA-Z0-9]{3,4}$', input.tag):
        raise HTTPException(status_code=400, detail="Tag deve ter 3-4 caracteres alfanuméricos")
    
    # Check if nickname#tag already exists (case insensitive)
    existing = await db.users.find_one({
        "nickname": {"$regex": f"^{input.nickname}$", "$options": "i"},
        "tag": {"$regex": f"^{input.tag}$", "$options": "i"},
        "id": {"$ne": user.id}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Este nickname#tag já está em uso")
    
    # Check if user can change (60 days cooldown)
    if user.last_nickname_change:
        last_change = datetime.fromisoformat(user.last_nickname_change) if isinstance(user.last_nickname_change, str) else user.last_nickname_change
        if last_change.tzinfo is None:
            last_change = last_change.replace(tzinfo=timezone.utc)
        days_since_change = (datetime.now(timezone.utc) - last_change).days
        if days_since_change < 60:
            days_remaining = 60 - days_since_change
            raise HTTPException(status_code=400, detail=f"Você pode mudar seu nickname#tag novamente em {days_remaining} dias")
    
    # Update nickname and tag
    await db.users.update_one(
        {"id": user.id},
        {"$set": {
            "nickname": input.nickname,
            "tag": input.tag,
            "last_nickname_change": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "nickname": input.nickname, "tag": input.tag}

@api_router.get("/user/nickname/check")
async def check_nickname_available(nickname: str, tag: str):
    # Validate format
    import re
    if not re.match(r'^[a-zA-Z0-9]{4,16}$', nickname):
        return {"available": False, "reason": "Formato inválido de nickname"}
    
    if not re.match(r'^[a-zA-Z0-9]{3,4}$', tag):
        return {"available": False, "reason": "Formato inválido de tag"}
    
    # Check if exists (case insensitive)
    existing = await db.users.find_one({
        "nickname": {"$regex": f"^{nickname}$", "$options": "i"},
        "tag": {"$regex": f"^{tag}$", "$options": "i"}
    })
    
    return {"available": not bool(existing)}

# Subject Routes
@api_router.get("/subjects", response_model=List[Subject])
async def get_subjects(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    subjects = await db.subjects.find({"user_id": user.id}, {"_id": 0}).sort("order", 1).to_list(100)
    return subjects

@api_router.post("/subjects", response_model=Subject)
async def create_subject(input: SubjectCreate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    # Get current max order
    subjects = await db.subjects.find({"user_id": user.id}).to_list(1000)
    max_order = max([s.get("order", 0) for s in subjects], default=-1)
    
    subject = Subject(
        user_id=user.id,
        name=input.name,
        color=input.color,
        time_goal=input.time_goal,
        order=max_order + 1
    )
    subject_dict = subject.model_dump()
    subject_dict["created_at"] = subject_dict["created_at"].isoformat()
    await db.subjects.insert_one(subject_dict)
    return subject

@api_router.patch("/subjects/{subject_id}")
async def update_subject(subject_id: str, input: SubjectUpdate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    subject = await db.subjects.find_one({"id": subject_id, "user_id": user.id})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.subjects.update_one({"id": subject_id}, {"$set": update_data})
    
    return {"success": True}

@api_router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    result = await db.subjects.delete_one({"id": subject_id, "user_id": user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"success": True}

# Task Routes
@api_router.get("/tasks/{subject_id}", response_model=List[Task])
async def get_tasks(subject_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    tasks = await db.tasks.find({"user_id": user.id, "subject_id": subject_id}, {"_id": 0}).to_list(1000)
    return tasks

@api_router.post("/tasks", response_model=Task)
async def create_task(input: TaskCreate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    task = Task(user_id=user.id, subject_id=input.subject_id, title=input.title)
    task_dict = task.model_dump()
    task_dict["created_at"] = task_dict["created_at"].isoformat()
    await db.tasks.insert_one(task_dict)
    return task

@api_router.patch("/tasks/{task_id}")
async def toggle_task(task_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    task = await db.tasks.find_one({"id": task_id, "user_id": user.id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.tasks.update_one({"id": task_id}, {"$set": {"completed": not task["completed"]}})
    return {"success": True}

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    result = await db.tasks.delete_one({"id": task_id, "user_id": user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}

# Study Session Routes
@api_router.post("/study/start", response_model=StudySession)
async def start_study_session(input: StudySessionStart, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    session = StudySession(
        user_id=user.id,
        subject_id=input.subject_id,
        start_time=datetime.now(timezone.utc)
    )
    session_dict = session.model_dump()
    session_dict["start_time"] = session_dict["start_time"].isoformat()
    if session_dict["end_time"]:
        session_dict["end_time"] = session_dict["end_time"].isoformat()
    await db.study_sessions.insert_one(session_dict)
    
    # Update user online status
    await db.users.update_one({"id": user.id}, {"$set": {"online_status": "online"}})
    
    return session

logger = logging.getLogger(__name__)

@api_router.post("/study/end")
async def end_study_session(input: StudySessionEnd, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    # Busca a sessão
    session = await db.study_sessions.find_one({"id": input.session_id, "user_id": user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Recompensas (5 min = 1 coin; XP = minutos) se não foi pulada
    coins = (input.duration // 5) if not input.skipped else 0
    xp = input.duration if not input.skipped else 0
    
    # Atualiza sessão
    await db.study_sessions.update_one(
        {"id": input.session_id},
        {"$set": {
            "end_time": datetime.now(timezone.utc).isoformat(),
            "duration": input.duration,
            "completed": not input.skipped,
            "skipped": input.skipped,
            "coins_earned": coins,
            "xp_earned": xp
        }}
    )

    # Atualiza a matéria (tempo acumulado / contagem de sessões)
    subject_id = session.get("subject_id")
    if subject_id:
        await db.subjects.update_one(
            {"id": subject_id, "user_id": user.id},
            {
                "$inc": {
                    "time_spent": (input.duration if not input.skipped else 0),
                    "sessions_count": (0 if input.skipped else 1),
                },
                "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}
            },
            upsert=True
        )

    # Atualiza usuário (coins/xp/level)
    if coins or xp:
        udoc = await db.users.find_one({"id": user.id}, {"_id": 0}) or {"id": user.id, "coins": 0, "xp": 0, "level": 1}

        def calculate_xp_for_level(level: int) -> int:
            base_xp = 100
            # mesma curva usada no resto do projeto
            return int(base_xp * (1.25 ** (level - 1)) + 0.999)

        new_xp = udoc.get("xp", 0) + xp
        new_level = udoc.get("level", 1)
        need = calculate_xp_for_level(new_level)
        while new_xp >= need:
            new_xp -= need
            new_level += 1
            need = calculate_xp_for_level(new_level)

        await db.users.update_one(
            {"id": user.id},
            {
                "$inc": {"coins": coins},
                "$set": {"xp": new_xp, "level": new_level}
            },
            upsert=True
        )

    # >>> AQUI: atualiza progresso das quests semanais (e paga recompensa das concluídas)
    try:
        await update_weekly_quests_after_study(
            user_id=user.id,
            subject_id=subject_id,
            duration=input.duration,
            completed=not input.skipped
        )
    except Exception as e:
        logger.warning(f"update_weekly_quests_after_study warning: {e}")

    # Resposta simples e estável
    return {
        "ok": True,
        "session_id": input.session_id,
        "coins_earned": int(coins),
        "xp_earned": int(xp),
        "skipped": bool(input.skipped),
    }

# Shop Routes
@api_router.get("/shop", response_model=List[ShopItem])
async def get_shop_items():
    items = await db.shop_items.find({}, {"_id": 0}).to_list(1000)
    if not items:
        # Initialize shop with default items
        items = await initialize_shop()
    return items

@api_router.post("/shop/purchase")
async def purchase_item(input: PurchaseItem, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)

    item = await db.shop_items.find_one({"id": input.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if user.level < item.get("level_required", 1):
        raise HTTPException(status_code=400, detail="Nível insuficiente para este item")

    if user.coins < item["price"]:
        raise HTTPException(status_code=400, detail="Not enough coins")
    if input.item_id in (user.items_owned or []):
        raise HTTPException(status_code=400, detail="Item already owned")

    await db.users.update_one({"id": user.id},
                              {"$inc": {"coins": -item["price"]}, "$push": {"items_owned": input.item_id}})
    return {"success": True}


class EquipItem(BaseModel):
    item_id: str
    item_type: str  # seal, border, theme

class UnequipItem(BaseModel):
    item_type: str

@api_router.post("/shop/equip")
async def equip_item(input: EquipItem, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    if input.item_id not in user.items_owned:
        raise HTTPException(status_code=400, detail="Item not owned")
    
    equipped_items = user.equipped_items or {"seal": None, "border": None, "theme": None}
    equipped_items[input.item_type] = input.item_id
    
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"equipped_items": equipped_items}}
    )
    
    return {"success": True}

@api_router.post("/shop/unequip")
async def unequip_item(input: UnequipItem, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    equipped_items = user.equipped_items or {"seal": None, "border": None, "theme": None}
    equipped_items[input.item_type] = None
    
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"equipped_items": equipped_items}}
    )
    
    return {"success": True}

# Stats Routes
@api_router.get("/stats")
async def get_stats(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    # Get current week cycle
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Total study time
    sessions = await db.study_sessions.find({"user_id": user.id, "completed": True}, {"_id": 0}).to_list(10000)
    total_time = sum(s.get("duration", 0) for s in sessions)
    
    # Week time
    week_sessions = [s for s in sessions if datetime.fromisoformat(s["start_time"]) >= week_start]
    week_time = sum(s.get("duration", 0) for s in week_sessions)
    
    # Subject breakdown
    subjects = await db.subjects.find({"user_id": user.id}, {"_id": 0}).to_list(100)
    subject_stats = []
    for subject in subjects:
        subject_sessions = [s for s in sessions if s["subject_id"] == subject["id"]]
        subject_time = sum(s.get("duration", 0) for s in subject_sessions)
        subject_stats.append({
            "id": subject["id"],
            "name": subject["name"],
            "color": subject["color"],
            "time_goal": subject["time_goal"],
            "time_studied": subject_time,
            "progress": min(100, (subject_time / subject["time_goal"]) * 100) if subject["time_goal"] > 0 else 0
        })
    
    # Cycle progress
    total_goal = sum(s["time_goal"] for s in subjects)
    cycle_progress = min(100, (week_time / total_goal) * 100) if total_goal > 0 else 0
    
    sessions_completed = sum(1 for s in sessions if s.get("completed"))
    total_studied_minutes = total_time  # alias mais claro

    return {
        "total_time": total_time,
        "total_studied_minutes": total_studied_minutes,
        "week_time": week_time,
        "cycle_progress": cycle_progress,
        "subjects": subject_stats,
        "level": user.level,
        "xp": user.xp,
        "coins": user.coins,
        "sessions_completed": sessions_completed
    }

# Settings Routes
@api_router.get("/settings")
async def get_settings(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    settings = await db.user_settings.find_one({"user_id": user.id}, {"_id": 0})
    if not settings:
        return {"study_duration": 50, "break_duration": 10}
    return settings

@api_router.post("/settings")
async def update_settings(input: Settings, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    await db.user_settings.update_one(
        {"user_id": user.id},
        {"$set": {"study_duration": input.study_duration, "break_duration": input.break_duration}},
        upsert=True
    )
    return {"success": True}

# Quests Routes


def _rarity_for_index(i: int) -> str:
    # 0..9   -> common (10)
    # 10..19 -> epic (10)   == "especial"
    # 20..26 -> rare (7)
    # 27..29 -> legendary (3)
    if i >= 27: return "legendary"
    if i >= 20: return "rare"
    if i >= 10: return "epic"
    return "common"

def _price(base: int, i: int) -> int:
    # progressão suave por posição dentro do tipo
    # começa em base e cresce ~12% por item
    return int(base * (1.12 ** i) + 0.999)

def _level_required(rarity: str, i: int) -> int:
    # pequenos degraus de requisito
    return {
        "common": 1,
        "epic": 5,
        "rare": 12,
        "legendary": 20
    }[rarity]

def _seal_effects_perks(rarity: str, idx: int) -> tuple[dict, dict, str]:
    # efeitos visuais + perks “cosméticos/QoL”. Escala por raridade.
    icons = ["dot","bolt","star","diamond","target","flame","leaf","heart","clover","triangle"]
    icon = icons[idx % len(icons)]

    if rarity == "common":
        effects = {"icon": icon, "static_color": "#60a5fa"}                 # azul
        perks = {}
        name = f"Ponto de Foco {idx+1:02d}"
    elif rarity == "epic":   # especial
        effects = {"icon": icon, "gradient": ["#60a5fa","#34d399"], "pulse": True}
        perks = {"session_hint": True}  # mostra dica curta ao iniciar sessão
        name = f"Selo Especial {idx-9:02d}"
    elif rarity == "rare":
        effects = {"icon": icon, "gradient": ["#a78bfa","#22d3ee"], "glow": True, "particles": "sparks"}
        perks = {"session_start_sound": "focus_bell", "quick_start": True}  # botão iniciar ganha micro-highlight
        name = f"Selo Raro {idx-19:02d}"
    else:  # legendary
        effects = {"icon": icon, "animated_gradient": True, "aura": "cyber", "trail": "stardust"}
        perks = {"celebrate_level_up": True, "auto_theme_sync": True}       # confete ao subir nível / combina com tema ativo
        name = f"Selo Lendário {idx-26:02d}"

    return effects, perks, name

def _border_effects_perks(rarity: str, idx: int) -> tuple[dict, dict, str]:
    styles = ["soft","rounded","cut","double","neon","glass"]
    style = styles[idx % len(styles)]

    if rarity == "common":
        effects = {"style": style, "thickness": 1}
        perks = {}
        name = f"Borda {style.capitalize()} {idx+1:02d}"
    elif rarity == "epic":
        effects = {"style": style, "thickness": 2, "glow": True}
        perks = {"hover_reactive": True}
        name = f"Borda Especial {idx-9:02d}"
    elif rarity == "rare":
        effects = {"style": style, "thickness": 2, "animated": "pulse"}
        perks = {"accent_color_sync": True}
        name = f"Borda Rara {idx-19:02d}"
    else:
        effects = {"style": style, "thickness": 3, "animated": "rainbow", "corner_fx": "sparkle"}
        perks = {"celebrate_milestones": True}
        name = f"Borda Lendária {idx-26:02d}"

    return effects, perks, name

def _theme_effects_perks(rarity: str, idx: int) -> tuple[dict, dict, str]:
    palettes = [
        ["#0ea5e9","#111827"], ["#a78bfa","#0f172a"], ["#10b981","#0b1020"],
        ["#f472b6","#0f172a"], ["#f59e0b","#111827"], ["#22d3ee","#0b1020"]
    ]
    palette = palettes[idx % len(palettes)]

    if rarity == "common":
        effects = {"palette": palette, "bg": "subtle", "contrast": "normal"}
        perks = {}
        name = f"Tema {idx+1:02d}"
    elif rarity == "epic":
        effects = {"palette": palette, "bg": "gradient", "contrast": "high"}
        perks = {"ambient_particles": "tiny"}    # partículas leves no header
        name = f"Tema Especial {idx-9:02d}"
    elif rarity == "rare":
        effects = {"palette": palette, "bg": "animated_gradient", "contrast": "high"}
        perks = {"ambient_particles": "waves", "focus_ring_boost": True}
        name = f"Tema Raro {idx-19:02d}"
    else:
        effects = {"palette": palette, "bg": "dynamic", "accent_anim": "breath"}
        perks = {"level_up_scene": "confetti", "badge_shine": True}
        name = f"Tema Lendário {idx-26:02d}"

    return effects, perks, name

async def initialize_shop():
    items = []

    # SEALS (base 50)
    for i in range(30):
        rarity = _rarity_for_index(i)
        effects, perks, name = _seal_effects_perks(rarity, i)
        items.append({
            "id": f"seal_{i}",
            "item_type": "seal",
            "name": name,
            "price": _price(50, i),
            "rarity": rarity,
            "level_required": _level_required(rarity, i),
            "tags": ["selo"],
            "description": "Personalize seu ponto de foco.",
            "effects": effects,
            "perks": perks
        })

    # BORDERS (base 60)
    for i in range(30):
        rarity = _rarity_for_index(i)
        effects, perks, name = _border_effects_perks(rarity, i)
        items.append({
            "id": f"border_{i}",
            "item_type": "border",
            "name": name,
            "price": _price(60, i),
            "rarity": rarity,
            "level_required": _level_required(rarity, i),
            "tags": ["borda"],
            "description": "Realce os cartões e paineis.",
            "effects": effects,
            "perks": perks
        })

    # THEMES (base 100)
    for i in range(30):
        rarity = _rarity_for_index(i)
        effects, perks, name = _theme_effects_perks(rarity, i)
        items.append({
            "id": f"theme_{i}",
            "item_type": "theme",
            "name": name,
            "price": _price(100, i),
            "rarity": rarity,
            "level_required": _level_required(rarity, i),
            "tags": ["tema"],
            "description": "Tema completo do app.",
            "effects": effects,
            "perks": perks
        })

    await db.shop_items.insert_many(items)
    return items


async def initialize_quests():
    quests = [
        {"id": "q1", "title": "Primeira Sessão", "description": "Complete sua primeira sessão de estudos", "xp_reward": 50, "coins_reward": 50, "quest_type": "daily", "target": 1},
        {"id": "q2", "title": "Estudioso", "description": "Estude por 60 minutos", "xp_reward": 100, "coins_reward": 100, "quest_type": "daily", "target": 60},
        {"id": "q3", "title": "Dedicação", "description": "Complete 5 sessões de estudo", "xp_reward": 200, "coins_reward": 200, "quest_type": "weekly", "target": 5},
        {"id": "q4", "title": "Mestre", "description": "Estude por 300 minutos em uma semana", "xp_reward": 500, "coins_reward": 500, "quest_type": "weekly", "target": 300},
    ]
    await db.quests.insert_many(quests)
    return quests

# Friends Routes
class FriendRequest(BaseModel):
    friend_nickname: str
    friend_tag: str

@api_router.post("/friends/add")
async def add_friend(input: FriendRequest, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    # Find friend by nickname#tag
    friend = await db.users.find_one({
        "nickname": {"$regex": f"^{input.friend_nickname}$", "$options": "i"},
        "tag": {"$regex": f"^{input.friend_tag}$", "$options": "i"}
    }, {"_id": 0})
    
    if not friend:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if friend["id"] == user.id:
        raise HTTPException(status_code=400, detail="Você não pode adicionar a si mesmo")
    
    # Check if already friends
    existing = await db.friends.find_one({
        "$or": [
            {"user_id": user.id, "friend_id": friend["id"]},
            {"user_id": friend["id"], "friend_id": user.id}
        ]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Vocês já são amigos")
    
    # Create friendship
    await db.friends.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "friend_id": friend["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "friend": {"nickname": friend["nickname"], "tag": friend["tag"], "name": friend["name"]}}

@api_router.get("/friends")
async def get_friends(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    # Get all friendships
    friendships = await db.friends.find({
        "$or": [
            {"user_id": user.id},
            {"friend_id": user.id}
        ]
    }, {"_id": 0}).to_list(1000)
    
    # Get friend IDs
    friend_ids = []
    for friendship in friendships:
        if friendship["user_id"] == user.id:
            friend_ids.append(friendship["friend_id"])
        else:
            friend_ids.append(friendship["user_id"])
    
    # Get friend details
    friends = await db.users.find({"id": {"$in": friend_ids}}, {"_id": 0, "email": 0}).to_list(1000)
    
    return friends

@api_router.delete("/friends/{friend_id}")
async def remove_friend(friend_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    result = await db.friends.delete_one({
        "$or": [
            {"user_id": user.id, "friend_id": friend_id},
            {"user_id": friend_id, "friend_id": user.id}
        ]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Amizade não encontrada")
    
    return {"success": True}

app.include_router(api_router)



logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()