from __future__ import annotations
from fastapi import FastAPI, APIRouter, HTTPException, Cookie, Response, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path as SysPath
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import string, random
from collections import defaultdict, deque
from fastapi import Body, Query, Path as FPath
from pymongo.errors import DuplicateKeyError
# --- GOOGLE OAUTH (LOGIN DIRETO, SEM EMERGENT) ---
import secrets, jwt
from fastapi.responses import RedirectResponse
# pseudo-código python (FastAPI) – coloque num cron semanal ou no /quests/refresh
import random
from math import floor, sqrt
from datetime import date
from typing import Literal
from fastapi import Depends, Body
import time
from collections import defaultdict, deque
from bson import ObjectId
# from shop_seed import SHOP_ITEMS  # Não mais necessário - usamos make_items()
ROOT_DIR = SysPath(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
groups_col = db["groups"]
group_members_col = db["group_members"]
group_join_col = db["group_join_requests"]
sessions_col = db["study_sessions"]     # SUA coleção de sessões concluídas
presence_col = db["presence"]           # SUA coleção de presença/tempo real
users_col = db["users"]                 # SUA coleção de perfis públicos (se tiver)



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

class TimerStateIn(BaseModel):
    state: Literal["focus", "break", "paused", "idle"]
    seconds_left: Optional[int] = None

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
import secrets
from fastapi.responses import JSONResponse

CSRF_EXEMPT_PATHS = {
    # presença / grupos
    "/api/presence/leave",
    "/api/groups",
    "/api/groups/join",
    "/api/groups/leave",

    # ⬇⬇⬇ liberar as rotas do timer
    "/api/study/start",
    "/api/study/end",
    "/api/study/timer/state",
}



@app.middleware("http")
async def csrf_guard(request: Request, call_next):
    # Métodos “seguros” não validam
    if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
        return await call_next(request)

    # Isenta se vier Authorization (útil em dev cross-origin)
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return await call_next(request)

    # Isenta paths específicos
    if request.url.path in CSRF_EXEMPT_PATHS:
        return await call_next(request)

    # Verificação CSRF padrão (header vs cookie)
    header = request.headers.get("X-CSRF-Token")
    cookie = request.cookies.get("csrf_token")
    if not header or not cookie or not secrets.compare_digest(header, cookie):
        return JSONResponse({"detail": "CSRF check failed"}, status_code=403)

    return await call_next(request)



import time
from collections import defaultdict, deque

EXEMPT_RATE_PATHS = {
    "/api/auth/google/login",
    "/api/auth/google/callback",
    "/api/health",

    # ⬇⬇⬇ heartbeats não devem ser limitados
    "/api/presence/ping",
    "/api/presence/open",
    "/api/presence/leave",

    # opcional: o front pode mandar com alta frequência
    "/api/study/timer/state",
}


RATE_LIMIT_WINDOW = 60.0  # segundos
RATE_LIMIT_MAX_BY_METHOD = {
    "GET": 300,      # GETs são barulhentos (extensões, DevTools) -> bem generoso
    "POST": 120,
    "PUT": 60,
    "PATCH": 60,
    "DELETE": 60,
}

_hitq = defaultdict(deque)
# limite de tamanho do corpo (1 MB está ótimo para nosso uso)
MAX_BODY_BYTES = 1_048_576

@app.middleware("http")
async def rate_limit(request: Request, call_next):
    path = request.url.path
    if path in EXEMPT_RATE_PATHS:
        return await call_next(request)

    ip = request.client.host if request.client else "unknown"
    method = request.method.upper()
    limit = RATE_LIMIT_MAX_BY_METHOD.get(method, 120)

    now = time.time()
    key = (ip, method)  # por IP+método (não por path)
    dq = _hitq[key]

    # limpa janelas antigas
    while dq and (now - dq[0]) > RATE_LIMIT_WINDOW:
        dq.popleft()

    if len(dq) >= limit:
        return JSONResponse({"detail": "Too many requests"}, status_code=429)

    dq.append(now)
    return await call_next(request)
# === FIM RATE LIMIT ===



async def ensure_group_indexes():
    # remove o índice único errado em "id" se existir
    try:
        await groups_col.drop_index("id_1")
    except Exception:
        pass

    # códigos de convite precisam ser únicos
    await groups_col.create_index("invite_code", unique=True)

    # (group_id, user_id) único em memberships
    await group_members_col.create_index([("group_id", 1), ("user_id", 1)], unique=True)

    # busca por nome/descrição (não é único)
    try:
        await groups_col.create_index([("name", "text"), ("description", "text")])
    except Exception:
        pass


# === TIMER CONFIG ===
def timer_config_for(user) -> dict:
    # pegue de Settings do usuário se já existir
    cfg = getattr(user, "timer_cfg", None) or {}
    return {
        "focus_min": int(cfg.get("focus_min", 50)),
        "break_min": int(cfg.get("break_min", 10)),
        "long_break_min": int(cfg.get("long_break_min", 20)),
        "long_every": int(cfg.get("long_every", 4)),  # long break a cada 4 focos
    }

def _sec(mins: int) -> int:
    return int(mins) * 60

# Endpoints antigos comentados - usamos os novos endpoints em api_router
# @app.get("/api/shop/list")
# def shop_list():
#     return {"items": SHOP_ITEMS}
# 
# @app.get("/api/shop")
# def shop_root():
#     return {"items": SHOP_ITEMS}
# 
# @app.get("/api/shop/all")
# def shop_all():
#     return {"items": SHOP_ITEMS}


@app.on_event("startup")
async def _startup_indexes():
    # ... se você já tiver outro startup, apenas acrescente a chamada:
    await ensure_group_indexes()




@app.middleware("http")
async def body_size_guard(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH"):
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > MAX_BODY_BYTES:
            return JSONResponse({"detail": "Payload too large"}, status_code=413)
    return await call_next(request)
# === HEADERS DE SEGURANÇA (CSP para API) ===
@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "same-origin"
    resp.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

    # CSP: API-first (JSON). Permite connect 'self' e silencia fontes do Google quando o browser renderiza.
    resp.headers["Content-Security-Policy"] = (
        "default-src 'none'; "
        "connect-src 'self'; "
        "img-src 'self' data:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "frame-ancestors 'none'; base-uri 'none';"
    )
    return resp
# === FIM HEADERS ===



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
from datetime import datetime, timezone

def utcnow():
    return datetime.now(timezone.utc)

def issue_session(user_id: str) -> dict:
    return {
        "id": secrets.token_urlsafe(32),             # session_token
        "user_id": user_id,
        "csrf_token": secrets.token_urlsafe(32),     # amarrado à sessão
        "created_at": utcnow().isoformat(),
        "expires_at": (utcnow() + timedelta(days=SESSION_TTL_DAYS)).isoformat(),
    }

async def persist_session(sess: dict):
    await db.sessions.update_one({"id": sess["id"]}, {"$set": sess}, upsert=True)

def set_session_cookies(resp: Response, sess: dict, *, prod: bool):
    # Back-end público em HTTPS? -> prod=True
    cookie_kwargs = dict(
        httponly=True,
        secure=prod,
        samesite="None" if prod else "Lax",  # dev cross-origin usa None
        max_age=SESSION_TTL_DAYS * 24 * 3600,
        path="/",
    )
    # cookie HttpOnly com o token da sessão
    resp.set_cookie("session_token", sess["id"], **cookie_kwargs)
    # cookie NÃO-HttpOnly com o CSRF (para o front mandar no header)
    resp.set_cookie("csrf_token", sess["csrf_token"], httponly=False, secure=prod,
                    samesite=cookie_kwargs["samesite"], max_age=cookie_kwargs["max_age"], path="/")

def now_utc():
    return datetime.now(timezone.utc)

def period_bounds(period: str):
    now = now_utc()
    if period == "day":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start = datetime(1970, 1, 1, tzinfo=timezone.utc)
    return start, now

def _to_aware(dt):
    """
    Converte string ou datetime para timezone-aware (UTC).
    Aceita '...Z' e valores sem tz (assume UTC).
    """
    if dt is None:
        return None
    if isinstance(dt, str):
        s = dt.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
        except Exception:
            return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

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

def utcnow():
    return datetime.now(timezone.utc)

class TimerStateBody(BaseModel):
    state: Optional[str] = None     # "focus" | "break" | "paused" | None
    seconds_left: Optional[int] = None
    subject_id: Optional[str] = None  # se você já envia; senão, ignore

@api_router.post("/study/timer/state")
async def study_timer_state(body: TimerStateBody, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)

    patch = {
        "active_session.timer.state": body.state,
        "active_session.timer.seconds_left": body.seconds_left,
        "active_session.timer.updated_at": utcnow(),   # 👈 NOVO
    }
    # (opcional) se você também quiser atualizar a matéria aqui:
    if body.subject_id:
        patch["active_session.subject_id"] = body.subject_id

    await db.users.update_one({"id": user.id}, {"$set": patch}, upsert=True)
    return {"ok": True}

    update = {
        "active_session.timer.state": payload.state,
        "last_activity": datetime.now(timezone.utc).isoformat(),
    }

    if payload.state == "paused":
        # congela no backend
        if payload.seconds_left is not None and payload.seconds_left >= 0:
            update["active_session.timer.seconds_left"] = int(payload.seconds_left)
        update["active_session.timer.phase_until"] = None
    else:
        # focus/break: ancora com hora absoluta
        secs = max(0, int(payload.seconds_left or 0))
        update["active_session.timer.seconds_left"] = secs
        update["active_session.timer.phase_until"] = (datetime.now(timezone.utc) + timedelta(seconds=secs)).isoformat()

    await db.users.update_one({"id": user.id}, {"$set": update}, upsert=True)
    return {"ok": True}

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
    # === CSRF: cookie não-HttpOnly para o front ler e mandar no header ===
    csrf = secrets.token_urlsafe(32)
    resp.set_cookie(
    "csrf_token", csrf,
    max_age=60*60*24*30,
    httponly=False,
    secure=COOKIE_SECURE,
    samesite="none" if COOKIE_SECURE else "lax",
    path="/",
)

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

# coleções
groups_col = db["groups"]
group_members_col = db["group_members"]
users_col = db["users"]

# === PATCH: /auth/me (substituir função inteira) ===
@api_router.get("/auth/me")
async def auth_me(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "nickname": getattr(user, "nickname", None),
        "tag": getattr(user, "tag", None),
        "coins": user.coins or 0,
        "xp": user.xp or 0,
        "level": user.level or 1,
        "items_owned": user.items_owned or [],
        "equipped_items": user.equipped_items or {"seal": None, "border": None, "theme": None},
        "last_nickname_change": getattr(user, "last_nickname_change", None),
    }

# === /PATCH ===



@api_router.post("/auth/logout")
async def logout(request: Request, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.sessions.delete_one({"id": session_token})
    resp = JSONResponse({"ok": True})
    # apaga cookies
    resp.delete_cookie("session_token", path="/")
    resp.delete_cookie("csrf_token", path="/")
    return resp


# Root Route
@api_router.get("/")
async def root():
    return {"message": "CicloStudy API", "status": "ok"}

# Auth Helper
async def get_current_user(request: Request, session_token: str | None = Cookie(None)):
    """
    Aceita:
      - Cookie: session_token (JWT)
      - Header: Authorization: Bearer <jwt>  (prod)
      - Header: Authorization: Bearer <user_id>  (dev fallback)
    """
    token = session_token
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1].strip()

    if not token:
        raise HTTPException(status_code=401, detail="no-session")

    # tenta JWT primeiro
    uid = None
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        uid = data.get("sub")
    except jwt.InvalidTokenError:
        # dev fallback: se não for JWT, trate como user_id direto
        uid = token

    if not uid:
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
    cu.last_nickname_change = user.get("last_nickname_change")
    return cu


# --- [ADD] Helpers da nova fórmula de coins/XP ---
def _today_utc_date() -> date:
    return datetime.now(timezone.utc).date()

async def _get_user_settings_minutes(user_id: str) -> int:
    s = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0, "study_duration": 1})
    return int(s.get("study_duration", 50)) if s else 50

async def _update_and_get_streak(user_id: str, studied_minutes_today: int) -> int:
    """
    Incrementa streak se estudou >=25 min no dia.
    Salva/usa: users.last_streak_date (YYYY-MM-DD), users.streak_days (int).
    """
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "last_streak_date": 1, "streak_days": 1})
    today = _today_utc_date()
    last = None
    if u and u.get("last_streak_date"):
        try:
            last = datetime.fromisoformat(u["last_streak_date"]).date()
        except Exception:
            try:
                last = date.fromisoformat(u["last_streak_date"])
            except Exception:
                last = None

    streak = int(u.get("streak_days", 0) if u else 0)

    if studied_minutes_today >= 25:
        if not last:
            streak = 1
        else:
            delta = (today - last).days
            if delta == 0:
                pass
            elif delta == 1:
                streak += 1
            else:
                streak = 1
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"last_streak_date": today.isoformat(), "streak_days": streak}},
            upsert=True
        )
    return streak

def _fatigue_multiplier(minutes: int) -> float:
    if minutes <= 50:  return 1.00
    if minutes <= 100: return 0.90
    if minutes <= 180: return 0.80
    return 0.70

def _completion_multiplier(duration: int, block_minutes: int, skipped: bool) -> float:
    if skipped:
        return 1.00
    return 1.20 if duration >= block_minutes else 1.00

def _streak_multiplier(streak_days: int) -> float:
    # 3% por dia até 7 dias (máx +21%)
    return 1.0 + min(max(streak_days, 0), 7) * 0.03

def _week_bounds_utc(now: datetime) -> tuple[datetime, datetime]:
    start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=7)
    return start, end

async def _week_minutes_accumulated(user_id: str) -> int:
    now = datetime.now(timezone.utc)
    week_start, week_end = _week_bounds_utc(now)
    sessions = await db.study_sessions.find(
        {"user_id": user_id, "completed": True},
        {"_id": 0, "start_time": 1, "duration": 1}
    ).to_list(10000)
    total = 0
    for s in sessions:
        try:
            st = datetime.fromisoformat(s["start_time"])
            if week_start <= st < week_end:
                total += int(s.get("duration", 0))
        except Exception:
            pass
    return total

def _softcap_multiplier(week_minutes_before: int) -> float:
    # a partir de 900 min/semana, coins pela metade
    return 0.5 if week_minutes_before >= 900 else 1.0

def _coins_raw(duration: int) -> float:
    # base: 1 coin a cada 5 min
    return duration / 5.0

def _session_xp_raw(duration: int, block_minutes: int) -> float:
    # sublinear + bônus por blocos completos
    blocks = duration // block_minutes if block_minutes > 0 else 0
    return 8.0 * (duration ** 0.9) + 12.0 * blocks

def _apply_mults(value: float, *mults: float) -> int:
    v = float(value)
    for m in mults:
        v *= float(m)
    return max(0, int(v // 1))

def _xp_curve_per_level(level: int) -> int:
    base_xp = 100
    return int(base_xp * (1.25 ** (level - 1)) + 0.999)


def current_user_id(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth.split(" ", 1)[1].strip()
    # como várias rotas de ranking/grupos usam esse helper, aceite cookie também:
    try:
        tok = request.cookies.get("session_token")
        data = jwt.decode(tok, JWT_SECRET, algorithms=["HS256"])
        return data.get("sub")
    except Exception:
        pass
    raise HTTPException(status_code=401, detail="unauthorized")


def period_bounds(period: str):
    now = datetime.now(timezone.utc)
    if period == "day":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start = datetime(1970, 1, 1, tzinfo=timezone.utc)
    return start, now

# --- [FIM HELPERS NOVA FÓRMULA] ---
# === [ADD] Calendar/Event Models ===
class EventChecklistItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    done: bool = False

class CalendarEventCreate(BaseModel):
    title: str
    start: datetime  # ISO
    end: datetime    # ISO
    subject_id: Optional[str] = None
    checklist: List[EventChecklistItem] = Field(default_factory=list)


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=40)
    description: Optional[str] = ""
    visibility: Literal["public","private","hidden"] = "public"
    emoji: Optional[str] = None
    color: Optional[str] = None  # ex.: "#2dd4bf"

class GroupOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    visibility: str
    emoji: str | None = None
    color: str | None = None
    owner_id: str
    invite_code: str
    created_at: datetime

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[Literal["public","private","hidden"]] = None
    emoji: Optional[str] = None
    color: Optional[str] = None

class InviteJoin(BaseModel):
    invite_code: str

class MemberRoleChange(BaseModel):
    user_id: str
    role: Literal["admin","mod","member"]

class GroupLeave(BaseModel):
    group_id: str


class GroupJoin(BaseModel):
    invite_code: str

class GroupLeave(BaseModel):
    group_id: str



class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    subject_id: Optional[str] = None
    completed: Optional[bool] = None

class CalendarEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    start: datetime
    end: datetime
    subject_id: Optional[str] = None
    completed: bool = False
    checklist: List[EventChecklistItem] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
# === [ADD] Calendar Helpers (overlaps, minutes, autocompletion) ===

def _expand_tolerance(start: datetime, end: datetime, tolerance_minutes: int = 60) -> tuple[datetime, datetime]:
    return (start - timedelta(minutes=tolerance_minutes), end + timedelta(minutes=tolerance_minutes))

def _overlap_minutes(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> int:
    s = max(a_start, b_start)
    e = min(a_end, b_end)
    if e <= s:
        return 0
    return int((e - s).total_seconds() // 60)

async def ensure_member(group_id: str, uid: str):
    m = await group_members_col.find_one({"group_id": group_id, "user_id": uid})
    if not m:
        raise HTTPException(403, "not a member")
    return m

async def ensure_admin(group_id: str, uid: str):
    m = await ensure_member(group_id, uid)
    if m["role"] not in ("admin",):
        raise HTTPException(403, "admin only")
    return m


async def _subject_week_minutes(user_id: str, subject_id: str, until: Optional[datetime] = None) -> int:
    """Minutos estudados da matéria nesta semana (segunda 00:00) até 'until' (ou agora)."""
    now = until or datetime.now(timezone.utc)
    week_start, week_end = _week_bounds_utc(now)
    # limita janela até 'until'
    hi = min(week_end, now)
    sessions = await db.study_sessions.find(
        {"user_id": user_id, "completed": True, "subject_id": subject_id},
        {"_id": 0, "start_time": 1, "duration": 1}
    ).to_list(10000)
    total = 0
    for s in sessions:
        try:
            st = datetime.fromisoformat(s["start_time"])
            dur = int(s.get("duration", 0))
            # sessão considerada no intervalo [week_start, hi)
            endt = st + timedelta(minutes=dur)
            total += _overlap_minutes(week_start, hi, st, endt)
        except Exception:
            pass
    return total

async def _effective_minutes_in_window(user_id: str, window_start: datetime, window_end: datetime, subject_id: Optional[str]) -> int:
    """
    Soma dos minutos 'efetivos' na janela. Pausas contam: ajusta estudo com fator (study+break)/study.
    Se subject_id for None, considera todas as matérias; caso contrário, só a matéria vinculada.
    """
    # fator de pausa
    cfg = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    study_len = int(cfg.get("study_duration", 50)) if cfg else 50
    break_len = int(cfg.get("break_duration", 10)) if cfg else 10
    factor = (study_len + break_len) / max(1, study_len)

    q = {"user_id": user_id, "completed": True}
    if subject_id:
        q["subject_id"] = subject_id

    sessions = await db.study_sessions.find(q, {"_id": 0, "start_time": 1, "duration": 1}).to_list(10000)
    total = 0
    for s in sessions:
        try:
            st = datetime.fromisoformat(s["start_time"])
            dur = int(s.get("duration", 0))
            endt = st + timedelta(minutes=dur)
            ov = _overlap_minutes(window_start, window_end, st, endt)
            total += ov
        except Exception:
            pass
    return int(total * factor)

async def _try_autocomplete_events(user_id: str, subject_id: Optional[str], session_start: datetime, session_end: datetime):
    """
    Verifica eventos do usuário que se sobrepõem à janela [session_start-1h, session_end+1h]
    e marca como concluído se atender:
      Regra 1: minutos_efetivos >= 75% da duração do evento; OU
      Regra 2: (se tem subject_id) a meta semanal daquela matéria foi alcançada dentro da janela ±1h.
    """
    # janela “grande” para filtrar eventos candidatos
    ws, we = _expand_tolerance(session_start, session_end, 60)

    # pega eventos que tocam essa janela
    candidates = await db.calendar_events.find(
        {
            "user_id": user_id,
            "$or": [
                {"start": {"$lte": we.isoformat()}, "end": {"$gte": ws.isoformat()}},
                {"start": {"$gte": ws.isoformat(), "$lte": we.isoformat()}},
            ],
        },
        {"_id": 0}
    ).to_list(1000)

    for ev in candidates:
        if ev.get("completed"):
            continue

        ev_start = datetime.fromisoformat(ev["start"])
        ev_end   = datetime.fromisoformat(ev["end"])
        # janela de tolerância do próprio evento
        ev_ws, ev_we = _expand_tolerance(ev_start, ev_end, 60)

        # minutos efetivos na janela (respeita subject_id se houver)
        eff = await _effective_minutes_in_window(user_id, ev_ws, ev_we, ev.get("subject_id"))
        ev_duration = max(0, int((ev_end - ev_start).total_seconds() // 60))

        rule1_ok = (eff >= int(0.75 * ev_duration))

        rule2_ok = False
        if ev.get("subject_id"):
            # minutos semanais ANTES e DEPOIS, recortando por 'limites' da janela do evento
            before = await _subject_week_minutes(user_id, ev["subject_id"], until=ev_ws)
            after  = await _subject_week_minutes(user_id, ev["subject_id"], until=ev_we)

            subj = await db.subjects.find_one({"id": ev["subject_id"], "user_id": user_id}, {"_id": 0, "time_goal": 1})
            goal = int(subj.get("time_goal", 0)) if subj else 0
            # atingiu a meta dentro da janela (antes < goal <= depois)
            rule2_ok = (goal > 0 and before < goal <= after)

        if rule1_ok or rule2_ok:
            await db.calendar_events.update_one({"id": ev["id"], "user_id": user_id}, {"$set": {"completed": True}})


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
# --- Presença ---------------------------------------------------------------
# Estrutura exemplo guardada por usuário:
# presence_store[user_id] = {
#   "status": "online"|"away"|"offline",
#   "last_ping": datetime,          # qualquer heartbeat
#   "last_interaction": datetime,   # quando interaction=True
#   "timer_state": "idle|focus|break|paused",
#   "seconds_left": int|None,
# }

from typing import Optional
from fastapi import Request, Cookie  # já deve existir
# ...



# coloque perto das outras constantes de presença
AWAY_AFTER_SECS = 1800      # 30 min sem interação => Ausente
OFFLINE_AFTER_SECS = 120    # 2 min sem ping => Offline (aba sumiu)

def _presence_from_fields(u: dict) -> str:
    """
    Regras:
    - OFFLINE se não recebe heartbeat (last_activity) há >2 min OU tabs_open <= 0
    - Senão, AWAY se não há interação (last_interaction) há >30 min
    - Senão, ONLINE
    """
    tabs = int(u.get("tabs_open") or 0)

    # heartbeats (ping) e interações convertidos pra UTC-aware
    last_activity     = _to_aware(u.get("last_activity"))
    last_interaction  = _to_aware(u.get("last_interaction"))

    # sem abas OU sem heartbeat recente => OFFLINE
    if tabs <= 0:
        return "offline"
    if last_activity:
        idle_hb = (utcnow() - last_activity).total_seconds()
        if idle_hb > OFFLINE_AFTER_SECS:
            return "offline"
    else:
        # se não temos last_activity, joga offline por segurança
        return "offline"

    # com heartbeat ok: decide entre ONLINE/AWAY pela interação
    if last_interaction:
        idle_int = (utcnow() - last_interaction).total_seconds()
        if idle_int > AWAY_AFTER_SECS:
            return "away"
    return "online"


class PingBody(BaseModel):
    interaction: Optional[bool] = False

@api_router.post("/presence/open")
async def presence_open(request: Request, session_token: Optional[str] = Cookie(None)):
    me = await get_current_user(request, session_token)
    doc = await db.users.find_one({"id": me.id}, {"_id": 0}) or {"id": me.id}
    tabs = max(0, int(doc.get("tabs_open") or 0)) + 1
    now = utcnow()
    updates = {"tabs_open": tabs, "last_activity": now, "last_interaction": now}
    await db.users.update_one({"id": me.id}, {"$set": updates}, upsert=True)
    merged = {**doc, **updates}
    return {"ok": True, "status": _presence_from_fields(merged), "tabs_open": tabs}

@api_router.get("/groups/{group_id}/presence", tags=["groups"])
async def groups_presence(group_id: str, request: Request):
    # pega IDs dos membros
    uids = [m["user_id"] async for m in group_members_col.find({"group_id": group_id}, {"user_id":1, "_id":0})]
    if not uids: return []
    cur = presence_col.find({"user_id": {"$in": uids}})
    out = []
    async for p in cur:
        out.append({
            "id": p["user_id"],
            "name": p.get("name",""),
            "nickname": p.get("nickname",""),
            "tag": p.get("tag",""),
            "status": p.get("status","offline"),          # online | away | offline
            "show_timer": p.get("show_timer", False),
            "timer_state": p.get("timer_state", None),    # focus | paused | break
            "studying": p.get("studying"),
            "seconds_left": p.get("seconds_left"),
        })
    return out

def blocks_pipeline(match_extra):
    return [
        {"$match": {"completed": True, **match_extra}},
        {"$project": {"user_id":1, "minutes": {"$ifNull":["$minutes",50]}}},
        {"$group": {"_id":"$user_id", "minutes": {"$sum":"$minutes"}}},
        {"$project": {"_id":0, "user_id":"$_id", "minutes":1, "blocks":{"$floor":{"$divide":["$minutes",50]}}}},
        {"$match": {"blocks": {"$gt": 0}}},
        {"$sort": {"blocks": -1, "minutes": -1}},
        {"$limit": 100}
    ]

@api_router.get("/rankings/global", tags=["rankings"])
async def rk_global(period: str = "week"):
    start, end = period_bounds(period)
    cur = sessions_col.aggregate(blocks_pipeline({"started_at":{"$gte": start, "$lte": end}}))
    out = []
    async for r in cur:
        u = await users_col.find_one({"id": r["user_id"]}, {"name":1,"nickname":1,"tag":1})
        handle = f'{u["nickname"]}#{u["tag"]}' if u and u.get("nickname") and u.get("tag") else ""
        out.append({"id": r["user_id"], "handle": handle, "name": (u or {}).get("name",""),
                    "blocks": int(r["blocks"]), "minutes": int(r["minutes"])})
    return out

@api_router.get("/rankings/friends", tags=["rankings"])
async def rk_friends(period: str = "week", request: Request = None):
    uid = current_user_id(request)
    start, end = period_bounds(period)
    friends_col = db["friendships"]
    friends = set()
    async for fr in friends_col.find({"$or":[{"a": uid},{"b": uid}], "status":"accepted"}):
        other = fr["b"] if fr["a"] == uid else fr["a"]
        friends.add(other)
    if not friends: return []
    cur = sessions_col.aggregate(blocks_pipeline({"started_at":{"$gte": start, "$lte": end},
                                                  "user_id": {"$in": list(friends)}}))
    out = []
    async for r in cur:
        u = await users_col.find_one({"id": r["user_id"]}, {"name":1,"nickname":1,"tag":1})
        handle = f'{u["nickname"]}#{u["tag"]}' if u and u.get("nickname") and u.get("tag") else ""
        out.append({"id": r["user_id"], "handle": handle, "name": (u or {}).get("name",""),
                    "blocks": int(r["blocks"]), "minutes": int(r["minutes"])})
    return out

@api_router.get("/rankings/groups", tags=["rankings"])
async def rk_groups(period: str = "week"):
    start, end = period_bounds(period)
    tmp = [r async for r in sessions_col.aggregate(blocks_pipeline({"started_at":{"$gte": start, "$lte": end}}))]
    if not tmp: return []
    agg = {}
    for r in tmp:
        async for gm in group_members_col.find({"user_id": r["user_id"]}, {"group_id":1, "_id":0}):
            gid = gm["group_id"]
            g = await groups_col.find_one({"_id": ObjectId(gid)}, {"name":1})
            if not g: continue
            key = gid
            if key not in agg: agg[key] = {"group_id": gid, "group_name": g["name"], "minutes":0, "blocks":0}
            agg[key]["minutes"] += r["minutes"]; agg[key]["blocks"] += r["blocks"]
    ranked = sorted(agg.values(), key=lambda x: (-x["blocks"], -x["minutes"]))[:100]
    return ranked

@api_router.get("/rankings/groups/{group_id}", tags=["rankings"])
async def rk_inside_group(group_id: str, period: str = "week"):
    start, end = period_bounds(period)
    uids = [m["user_id"] async for m in group_members_col.find({"group_id": group_id}, {"user_id":1,"_id":0})]
    if not uids: return []
    cur = sessions_col.aggregate(blocks_pipeline({"started_at":{"$gte": start, "$lte": end}, "user_id":{"$in": uids}}))
    out = []
    async for r in cur:
        u = await users_col.find_one({"id": r["user_id"]}, {"name":1,"nickname":1,"tag":1})
        handle = f'{u["nickname"]}#{u["tag"]}' if u and u.get("nickname") and u.get("tag") else ""
        out.append({"id": r["user_id"], "handle": handle, "name": (u or {}).get("name",""),
                    "blocks": int(r["blocks"]), "minutes": int(r["minutes"])})
    return out


@api_router.get("/rankings/global", tags=["rankings"])
async def ranking_global(period: str = "week"):
    start, end = period_bounds(period)
    pipeline = blocks_pipeline({"started_at": {"$gte": start, "$lte": end}})
    cur = sessions_col.aggregate(pipeline)
    out = []
    async for r in cur:
        out.append({
            "id": r["user_id"],
            "handle": "",   # backend pode preencher se você tiver a tabela de users
            "name": "",
            "blocks": int(r["blocks"]),
            "minutes": int(r["minutes"]),
        })
    return out

@api_router.get("/rankings/friends", tags=["rankings"])
async def ranking_friends(period: str = "week", request: Request = None):
    uid = current_user_id(request)
    start, end = period_bounds(period)
    # colete seus amigos (recíprocos) – ajuste pro seu schema:
    friends_col = db["friendships"]
    friends = set()
    async for fr in friends_col.find({"$or":[{"a": uid},{"b": uid}], "status":"accepted"}):
        other = fr["b"] if fr["a"] == uid else fr["a"]
        friends.add(other)
    if not friends:
        return []

    pipeline = blocks_pipeline({"started_at": {"$gte": start, "$lte": end}, "user_id": {"$in": list(friends)}})
    cur = sessions_col.aggregate(pipeline)
    out = []
    async for r in cur:
        out.append({
            "id": r["user_id"],
            "handle": "",
            "name": "",
            "blocks": int(r["blocks"]),
            "minutes": int(r["minutes"]),
        })
    return out

@api_router.get("/rankings/groups", tags=["rankings"])
async def ranking_groups(period: str = "week"):
    start, end = period_bounds(period)

    # minutos por user no período
    pipeline = blocks_pipeline({"started_at": {"$gte": start, "$lte": end}})
    tmp = []
    async for r in sessions_col.aggregate(pipeline):
        tmp.append(r)  # r: {user_id, minutes, blocks}

    if not tmp:
        return []

    # mapeia user -> grupos
    res = []
    for r in tmp:
        cursor = group_members_col.find({"user_id": r["user_id"]}, {"group_id":1, "_id":0})
        async for gm in cursor:
            g = await groups_col.find_one({"_id": ObjectId(gm["group_id"])}, {"name":1})
            if not g: continue
            res.append({"group_id": gm["group_id"], "group_name": g["name"], "minutes": r["minutes"], "blocks": r["blocks"]})

    # agrega por grupo
    agg = {}
    for row in res:
        k = row["group_id"]
        agg.setdefault(k, {"group_id": k, "group_name": row["group_name"], "minutes":0, "blocks":0})
        agg[k]["minutes"] += row["minutes"]
        agg[k]["blocks"] += row["blocks"]

    ranked = sorted(agg.values(), key=lambda x: (-x["blocks"], -x["minutes"]))[:100]
    return ranked

@api_router.get("/rankings/groups/{group_id}", tags=["rankings"])
async def ranking_inside_group(group_id: str, period: str = "week"):
    start, end = period_bounds(period)
    # membros
    uids = [m["user_id"] async for m in group_members_col.find({"group_id": group_id}, {"user_id":1, "_id":0})]
    if not uids:
        return []
    pipeline = blocks_pipeline({"started_at":{"$gte":start,"$lte":end}, "user_id":{"$in":uids}})
    out = []
    async for r in sessions_col.aggregate(pipeline):
        out.append({
            "id": r["user_id"], "blocks": int(r["blocks"]), "minutes": int(r["minutes"])
        })
    return out



def _now_utc():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc)

def _new_invite():
    import secrets
    return secrets.token_urlsafe(6).replace("_","").replace("-","").lower()

@api_router.post("/groups", tags=["groups"], status_code=201, response_model=GroupOut)
async def groups_create(payload: GroupCreate, request: Request):
    uid = current_user_id(request)

    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome obrigatório")

    created_at = _now_utc()
    base_doc = {
        "name": name,
        "description": (payload.description or "").strip(),
        "visibility": payload.visibility,
        "emoji": payload.emoji,
        "color": payload.color,
        "owner_id": uid,
        "created_at": created_at,
    }

    invite = _new_invite()
    for _ in range(4):  # tenta alguns convites caso colida
        try:
            doc = {**base_doc, "invite_code": invite}
            ins = await groups_col.insert_one(doc)
            gid = str(ins.inserted_id)

            # materializa campo 'id' (não-único) para facilitar no frontend
            try:
                await groups_col.update_one({"_id": ins.inserted_id}, {"$set": {"id": gid}})
            except Exception as e:
                print("[groups_create][warn] set id failed:", repr(e))  # não derruba

            # membership do criador (idempotente)
            try:
                await group_members_col.update_one(
                    {"group_id": gid, "user_id": uid},
                    {"$setOnInsert": {"role": "admin", "joined_at": created_at}},
                    upsert=True
                )
            except Exception as e:
                print("[groups_create][warn] membership upsert failed:", repr(e))  # não derruba

            # ✅ retorna sucesso mesmo se os “try” acima avisarem
            return GroupOut(
                id=gid,
                name=doc["name"],
                description=doc.get("description") or None,
                visibility=doc["visibility"],
                emoji=doc.get("emoji"),
                color=doc.get("color"),
                owner_id=doc["owner_id"],
                invite_code=doc["invite_code"],
                created_at=created_at,
            )
        except DuplicateKeyError as e:
            # convites únicos podem colidir — tenta outro
            if "invite_code" in str(e):
                invite = _new_invite()
                continue
            # outra duplicata qualquer
            raise HTTPException(status_code=409, detail="Registro duplicado")
        except Exception as e:
            print("[groups_create][error] insert failed:", repr(e))
            # se chegou aqui sem inserir, é erro real
            raise HTTPException(status_code=500, detail="Falha ao criar grupo")

    raise HTTPException(status_code=500, detail="Não foi possível gerar convite único")

@api_router.get("/groups/mine", tags=["groups"])
async def my_groups(request: Request):
    uid = current_user_id(request)

    pipeline = [
        {"$match": {"user_id": uid}},
        # group_members guarda group_id como STRING; converte pra ObjectId p/ dar match no _id do groups
        {"$addFields": {"group_oid": {"$toObjectId": "$group_id"}}},
        {"$lookup": {
            "from": "groups",
            "localField": "group_oid",
            "foreignField": "_id",
            "as": "g"
        }},
        {"$unwind": "$g"},
        {"$project": {
            "_id": 0,
            "id": "$group_id",          # devolve string mesmo
            "role": 1,
            "name": "$g.name",
            "description": {"$ifNull": ["$g.description", ""]},
            "visibility": {"$ifNull": ["$g.visibility", "public"]},
            "emoji": "$g.emoji",
            "color": "$g.color",
            "invite_code": "$g.invite_code",
        }}
    ]

    docs = []
    async for d in group_members_col.aggregate(pipeline):
        docs.append(d)
    return docs


@api_router.get("/groups/search", tags=["groups"])
async def groups_search(q: str = ""):
    filt = {"visibility":"public"}
    if q:
        filt["name"] = {"$regex": q, "$options": "i"}
    cur = groups_col.find(filt).limit(20)
    out = []
    async for g in cur:
        out.append({"id": str(g["_id"]), "name": g["name"], "description": g.get("description",""),
                    "emoji": g.get("emoji"), "color": g.get("color")})
    return out

@api_router.get("/groups/{group_id}", tags=["groups"])
async def groups_info(group_id: str, request: Request):
    g = await groups_col.find_one({"id": group_id})
    if not g:
        try:
            g = await groups_col.find_one({"_id": ObjectId(group_id)})
            if g:
                # materializa 'id' para padronizar
                await groups_col.update_one({"_id": g["_id"]}, {"$set": {"id": str(g["_id"])}})
                g["id"] = str(g["_id"])
        except Exception:
            g = None
    if not g:
        raise HTTPException(404, "Grupo não encontrado")

    # conta membros
    count = await group_members_col.count_documents({"group_id": g.get("id", str(g["_id"]))})
    return {
        "id": g.get("id", str(g["_id"])),
        "name": g["name"],
        "description": g.get("description",""),
        "visibility": g.get("visibility","public"),
        "emoji": g.get("emoji"),
        "color": g.get("color"),
        "owner_id": g.get("owner_id"),
        "invite_code": g.get("invite_code"),
        "created_at": g.get("created_at"),
        "member_count": count,
    }


@api_router.post("/groups/join", tags=["groups"])
async def groups_join(payload: InviteJoin, request: Request):
    uid = current_user_id(request)
    g = await groups_col.find_one({"invite_code": payload.invite_code})
    if not g:
        raise HTTPException(404, "Convite inválido")
    gid = str(g["_id"])
    if (await group_members_col.find_one({"group_id": gid, "user_id": uid})):
        return {"ok": True, "group_id": gid}  # já é membro
    # se privado: cria pedido de entrada
    if g.get("visibility") == "private":
        await group_join_col.update_one(
            {"group_id": gid, "user_id": uid},
            {"$set": {"status":"pending","created_at": now_utc()}},
            upsert=True
        )
        return {"ok": True, "pending": True}
    await group_members_col.insert_one({"group_id": gid, "user_id": uid, "role":"member","joined_at": now_utc()})
    return {"ok": True, "group_id": gid}

@api_router.post("/groups/leave", tags=["groups"])
async def groups_leave(payload: GroupLeave, request: Request):
    uid = current_user_id(request)
    await group_members_col.delete_one({"group_id": payload.group_id, "user_id": uid})
    return {"ok": True}

@api_router.patch("/groups/{group_id}", tags=["groups"])
async def groups_update(group_id: str, payload: GroupUpdate, request: Request):
    uid = current_user_id(request)
    await ensure_admin(group_id, uid)
    upd = {k:v for k,v in payload.dict(exclude_unset=True).items()}
    if not upd: return {"ok": True}
    await groups_col.update_one({"_id": ObjectId(group_id)}, {"$set": upd})
    return {"ok": True}

@api_router.post("/groups/{group_id}/invite/regenerate", tags=["groups"])
async def groups_invite_regen(group_id: str, request: Request):
    uid = current_user_id(request)
    await ensure_admin(group_id, uid)
    code = secrets.token_urlsafe(6).replace("_","").lower()
    await groups_col.update_one({"_id": ObjectId(group_id)}, {"$set": {"invite_code": code}})
    return {"invite_code": code}

# pedidos de entrada (para grupos privados)
@api_router.get("/groups/{group_id}/join-requests", tags=["groups"])
async def groups_join_requests(group_id: str, request: Request):
    uid = current_user_id(request)
    await ensure_admin(group_id, uid)
    out = []
    async for r in group_join_col.find({"group_id": group_id, "status":"pending"}):
        out.append({"user_id": r["user_id"], "created_at": r["created_at"]})
    return out

@api_router.post("/groups/{group_id}/join-requests/accept", tags=["groups"])
async def groups_join_accept(group_id: str, user_id: str = Body(...), request: Request = None):
    uid = current_user_id(request)
    await ensure_admin(group_id, uid)
    await group_join_col.update_one({"group_id": group_id, "user_id": user_id}, {"$set":{"status":"accepted"}})
    if not (await group_members_col.find_one({"group_id": group_id, "user_id": user_id})):
        await group_members_col.insert_one({"group_id": group_id, "user_id": user_id, "role":"member", "joined_at": now_utc()})
    return {"ok": True}

@api_router.post("/groups/{group_id}/join-requests/reject", tags=["groups"])
async def groups_join_reject(group_id: str, user_id: str = Body(...), request: Request = None):
    uid = current_user_id(request)
    await ensure_admin(group_id, uid)
    await group_join_col.update_one({"group_id": group_id, "user_id": user_id}, {"$set":{"status":"rejected"}})
    return {"ok": True}

# gerir membros
@api_router.post("/groups/{group_id}/members/role", tags=["groups"])
async def groups_member_role(group_id: str, payload: MemberRoleChange, request: Request):
    uid = current_user_id(request)
    await ensure_admin(group_id, uid)
    await group_members_col.update_one({"group_id": group_id, "user_id": payload.user_id}, {"$set":{"role": payload.role}})
    return {"ok": True}

@api_router.post("/groups/{group_id}/members/kick", tags=["groups"])
async def groups_member_kick(group_id: str, user_id: str = Body(...), request: Request = None):
    uid = current_user_id(request)
    await ensure_admin(group_id, uid)
    await group_members_col.delete_one({"group_id": group_id, "user_id": user_id})
    return {"ok": True}




@api_router.post("/presence/ping")
async def presence_ping(body: PingBody, request: Request, session_token: Optional[str] = Cookie(None)):
    me = await get_current_user(request, session_token)
    doc = await db.users.find_one({"id": me.id}, {"_id": 0}) or {"id": me.id}
    now = utcnow()
    updates = {"last_activity": now}
    if body.interaction:
        updates["last_interaction"] = now
    await db.users.update_one({"id": me.id}, {"$set": updates}, upsert=True)
    merged = {**doc, **updates}
    return {"ok": True, "status": _presence_from_fields(merged), "tabs_open": int(merged.get("tabs_open") or 0)}




# ===== NOVO ENDPOINT MAIS ROBUSTO =====
# ===== NOVO ENDPOINT MAIS ROBUSTO =====
@api_router.get("/friends/list")
async def friends_list(request: Request, session_token: Optional[str] = Cookie(None)):
    me = await get_current_user(request, session_token)

    # 1) Lê os vínculos já existentes
    links = await db.friends.find(
        {"$or": [{"user_id": me.id}, {"friend_id": me.id}]},
        {"_id": 0}
    ).to_list(1000)

    # 2) MIGRAÇÃO: se não houver nada em friends, reconstrói a partir de friend_requests aceitos
    if not links:
        accepted = await db.friend_requests.find(
            {"$or": [{"from_id": me.id}, {"to_id": me.id}], "status": "accepted"},
            {"_id": 0, "from_id": 1, "to_id": 1}
        ).to_list(1000)

        if accepted:
            now_iso = datetime.now(timezone.utc).isoformat()
            pairs = []
            for fr in accepted:
                pairs.append({"user_id": fr["from_id"], "friend_id": fr["to_id"]})
                pairs.append({"user_id": fr["to_id"], "friend_id": fr["from_id"]})
            for p in pairs:
                await db.friends.update_one(
                    p,
                    {"$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now_iso}},
                    upsert=True,
                )
            links = await db.friends.find(
                {"$or": [{"user_id": me.id}, {"friend_id": me.id}]},
                {"_id": 0}
            ).to_list(1000)

    if not links:
        return []

    # 3) Descobre os IDs dos amigos
    friend_ids = []
    for l in links:
        u, v = l.get("user_id"), l.get("friend_id")
        if u == me.id and v:
            friend_ids.append(v)
        elif v == me.id and u:
            friend_ids.append(u)
    if not friend_ids:
        return []

    # 4) Carrega dados dos amigos
    friends = await db.users.find(
        {"id": {"$in": friend_ids}},
        {
            "_id": 0, "id": 1, "name": 1, "nickname": 1, "tag": 1,
            "tabs_open": 1, "last_activity": 1, "last_interaction": 1,
            "active_session": 1
        }
    ).to_list(1000)

    # 5) Mapa id->nome de matéria
    subj_ids = []
    for f in friends:
        sid = (f.get("active_session") or {}).get("subject_id")
        if sid:
            subj_ids.append(sid)
    subj_map = {}
    if subj_ids:
        subs = await db.subjects.find({"id": {"$in": subj_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
        subj_map = {s["id"]: s["name"] for s in subs}

    # 6) Monta resposta (com regra do timer “fresco”)
    out = []
    for f in friends:
        status = _presence_from_fields(f)
        active = f.get("active_session") or {}
        timer  = active.get("timer") or {}

        timer_state  = None
        seconds_left = None
        studying     = None
        show_timer   = False

        if status != "offline":
            state = (timer.get("state") or "").lower()
            updated_at = _to_aware(timer.get("updated_at"))
            FRESH_SECS = 120
            fresh = bool(updated_at and (utcnow() - updated_at).total_seconds() <= FRESH_SECS)

            if state in ("focus", "break"):
                sl = _sec_left_from_timer(timer) or 0
                if sl > 0:
                    seconds_left = sl
                    timer_state  = state
                    show_timer   = True
                    if state == "focus":
                        sid = active.get("subject_id")
                        if sid:
                            studying = subj_map.get(sid)
            elif state == "paused" and fresh:
                seconds_left = _sec_left_from_timer(timer)
                timer_state  = "paused"
                show_timer   = True
                sid = active.get("subject_id")
                if sid:
                    studying = subj_map.get(sid)

        out.append({
            "id": f["id"],
            "nickname": f.get("nickname"),
            "tag": f.get("tag"),
            "name": f.get("name"),
            "status": status,
            "studying": studying,
            "timer_state": timer_state,
            "seconds_left": seconds_left,
            "show_timer": show_timer,
        })

    return out
# ===== FIM DO NOVO ENDPOINT =====








@api_router.post("/presence/leave")
async def presence_leave(request: Request, session_token: Optional[str] = Cookie(None)):
    me = await get_current_user(request, session_token)
    doc = await db.users.find_one({"id": me.id}, {"_id": 0}) or {"id": me.id}
    tabs = max(0, int(doc.get("tabs_open") or 0) - 1)
    updates = {"tabs_open": tabs, "last_activity": utcnow()}
    await db.users.update_one({"id": me.id}, {"$set": updates}, upsert=True)
    merged = {**doc, **updates}
    return {"ok": True, "status": _presence_from_fields(merged), "tabs_open": tabs}


# Endpoint que seus amigos consomem (mantém status conforme regra acima)

   

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
    if session_dict.get("end_time"):
        session_dict["end_time"] = session_dict["end_time"].isoformat()

    await db.study_sessions.insert_one(session_dict)

    # status online + snapshot do que está estudando (ESTE BLOCO TEM QUE FICAR DENTRO DA FUNÇÃO!)
    block_minutes = await _get_user_settings_minutes(user.id)
    est_end = datetime.now(timezone.utc) + timedelta(minutes=block_minutes)

    await db.users.update_one(
    {"id": user.id},
    {"$set": {
        "online_status": "online",
        "active_session": {
            "session_id": session.id,
            "subject_id": input.subject_id,
            "start_time": session_dict["start_time"],
            "estimated_end": est_end.isoformat(),
            "timer": {
                "state": "focus",
                "phase_until": est_end.isoformat(),
                "seconds_left": int(block_minutes * 60),
            }
        }
    }},
    upsert=True
)


    return session



@api_router.post("/study/end")
async def end_study_session(input: StudySessionEnd, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)

    # Busca a sessão
    session = await db.study_sessions.find_one({"id": input.session_id, "user_id": user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # --- NOVA FÓRMULA DE RECOMPENSAS ---
    duration = max(0, int(input.duration))
    block_minutes = await _get_user_settings_minutes(user.id)

    week_before   = await _week_minutes_accumulated(user.id)
    fatigue_mult  = _fatigue_multiplier(duration)
    completion_mult = _completion_multiplier(duration, block_minutes, input.skipped)
    streak_days   = await _update_and_get_streak(user.id, duration if not input.skipped else 0)
    streak_mult   = _streak_multiplier(streak_days)
    softcap_mult  = _softcap_multiplier(week_before)

    coins_base = _coins_raw(duration)
    xp_base    = _session_xp_raw(duration, block_minutes)

    coins = _apply_mults(coins_base, completion_mult, fatigue_mult, streak_mult, softcap_mult)
    xp    = _apply_mults(xp_base,    completion_mult, fatigue_mult, streak_mult)

    # Atualiza sessão
    await db.study_sessions.update_one(
        {"id": input.session_id},
        {"$set": {
            "end_time": datetime.now(timezone.utc).isoformat(),
            "duration": duration,
            "completed": not input.skipped,
            "skipped": input.skipped,
            "coins_earned": int(coins),
            "xp_earned": int(xp)
        }}
    )

    # limpar estado de sessão ativa do usuário (ATENÇÃO À INDENTAÇÃO)
    await db.users.update_one(
        {"id": user.id},
        {"$unset": {"active_session": ""}}
    )
    # --- FIM NOVA FÓRMULA ---

    # Auto-completar eventos de agenda (±1h)
    subject_id = session.get("subject_id")
    try:
        st_iso = session.get("start_time")
        st = datetime.fromisoformat(st_iso) if st_iso else datetime.now(timezone.utc) - timedelta(minutes=duration)
        en = st + timedelta(minutes=duration)
        await _try_autocomplete_events(user.id, subject_id, st, en)
    except Exception as _e:
        logger.warning(f"calendar autocompletion warn: {_e}")

    # Atualiza a matéria
    if subject_id:
        await db.subjects.update_one(
            {"id": subject_id, "user_id": user.id},
            {
                "$inc": {
                    "time_spent": (duration if not input.skipped else 0),
                    "sessions_count": (0 if input.skipped else 1),
                },
                "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}
            },
            upsert=True
        )

    # Atualiza usuário (coins/xp/level)
    if coins or xp:
        udoc = await db.users.find_one({"id": user.id}, {"_id": 0}) or {"id": user.id, "coins": 0, "xp": 0, "level": 1}
        new_xp   = int(udoc.get("xp", 0)) + int(xp)
        new_lvl  = int(udoc.get("level", 1))
        need_xp  = _xp_curve_per_level(new_lvl)
        while new_xp >= need_xp:
            new_xp -= need_xp
            new_lvl += 1
            need_xp  = _xp_curve_per_level(new_lvl)

        await db.users.update_one(
            {"id": user.id},
            {
                "$inc": {"coins": int(coins)},
                "$set": {"xp": int(new_xp), "level": int(new_lvl)}
            },
            upsert=True
        )

    # Atualiza quests semanais
    try:
        await update_weekly_quests_after_study(
            user_id=user.id,
            subject_id=subject_id,
            duration=duration,
            completed=not input.skipped
        )
    except Exception as e:
        logger.warning(f"update_weekly_quests_after_study warning: {e}")

    # Resposta (GARANTA que este return esteja INDENTADO dentro da função)
    return {
        "ok": True,
        "session_id": input.session_id,
        "coins_earned": int(coins),
        "xp_earned": int(xp),
        "skipped": bool(input.skipped),
    }






# --- SHOP: precificação proporcional a 5000h -------------------------------
def _price_curve(index: int, total: int, base: float, total5000: int = 60000, gamma: float = 0.65) -> int:
    if total <= 1: t = 0.0
    else: t = index / (total - 1)
    return max(1, int(round(total5000 * base * ((1.0 + t) ** gamma))))

RARITY_BASE = {
    "common":   0.0006,   # ~36 coins itens iniciais (com N>1 escala)
    "epic":     0.0030,   # ~180
    "rare":     0.0100,   # ~600
    "legendary":0.0400,   # ~2400
}

def _seal_effects_by_rarity(rarity: str, icon: str):
    # ícone ignorado na render (será a "foto" do nick), mantido p/ fallback
    if rarity == "common":
        return {"avatar_style":{"mode":"handle_hash","glow":"soft"}}
    if rarity == "epic":
        return {"avatar_style":{"mode":"handle_hash","glow":"strong","pulse":True,"aura":"subtle"}}
    if rarity == "rare":
        return {"avatar_style":{"mode":"handle_hash","glow":"neon","particles":"sparks","orbit":"slow"}}
    # legendary
    return {"avatar_style":{"mode":"handle_hash","glow":"neon","particles":"stardust","orbit":"fast","trail":"stardust","auto_theme_sync":True}}

def _border_effects_by_rarity(rarity: str, style: str, thickness: int):
    if rarity == "common":
        return {"style": style, "thickness": thickness, "glow": True}
    if rarity == "epic":
        return {"style": style, "thickness": thickness+1, "glow": True, "hover_reactive": True}
    if rarity == "rare":
        return {"style": style, "thickness": thickness+1, "animated": "pulse", "accent_color_sync": True}
    return {"style": style, "thickness": thickness+2, "animated": "rainbow", "corner_fx": "sparkle"}

def _theme_effects_by_rarity(rarity: str, palette: list[str]):
    if rarity == "common":
        return {"palette": palette, "bg": "subtle", "contrast": "normal"}
    if rarity == "epic":
        return {"palette": palette, "bg": "subtle-animated", "contrast": "accent-shift"}
    if rarity == "rare":
        return {"palette": palette, "bg": "parallax", "transition": "page"}
    return {"palette": palette, "bg": "cycle-reactive", "celebrate_milestones": True}

# --- CATÁLOGO: Selos COMUNS (individuais) -----------------------------------
COMMON_SEAL_PRICE = [50, 58, 67, 77, 88, 101, 116, 133, 153, 176]
COMMON_SEAL_TINT  = ["amber","yellow","lime","green","teal","cyan","blue","indigo","violet","fuchsia"]

def seed_common_seals():
    """
    10 selos comuns – bonitos, únicos e sutis.
    """
    data = [
        # name, price, palette, grad, pattern, angle, opts
        ("Selo 1",   50,  ["#8B5CF6","#0EA5E9"], "linear", "hatch",   135, {"bevel": True}),
        ("Selo 2",   58,  ["#EAB308","#7C3AED"], "radial", "grain",     0, {"shimmer": True}),
        ("Selo 3",   67,  ["#22C55E","#0EA5E9"], "linear", "stripes",  25, {}),
        ("Selo 4",   77,  ["#10B981","#1D4ED8"], "conic",  "bevel",   200, {"bevel": True}),
        ("Selo 5",   88,  ["#06B6D4","#0EA5E9"], "radial", "ring",      0, {}),
        ("Selo 6",  101,  ["#14B8A6","#2563EB"], "linear", "grain",   160, {}),
        ("Selo 7",  116,  ["#60A5FA","#22D3EE"], "linear", "hatch",    45, {"shimmer": True}),
        ("Selo 8",  133,  ["#6366F1","#10B981"], "conic",  "stripes", 280, {"bevel": True}),
        ("Selo 9",  153,  ["#A78BFA","#06B6D4"], "radial", "bevel",     0, {}),
        ("Selo 10", 176,  ["#F59E0B","#0EA5E9"], "linear", "ring",    120, {}),
    ]

    out = []
    for i, (name, price, pal, grad, pattern, angle, opts) in enumerate(data, start=1):
        out.append({
            "id": f"seal_common_{i:02d}",
            "item_type": "seal",
            "name": name,
            "price": int(price),
            "rarity": "common",
            "level_required": 1,
            "tags": ["selo","avatar","comum"],
            "categories": ["common"],
            "description": "Selo Comum — visual único, bonito e sutil (sem efeitos chamativos).",
            "effects": {
                "avatar_style": {
                    "mode": "handle_hash",
                    "glow": "soft",
                    "palette": pal,      # <- cores do gradiente
                    "grad": grad,        # linear | radial | conic
                    "pattern": pattern,  # hatch | grain | stripes | ring | bevel
                    "angle": angle,
                    "shimmer": bool(opts.get("shimmer")),
                    "bevel": bool(opts.get("bevel")),
                    "hueShift": 36
                }
            },
            "perks": {}
        })
    return out

# ---------------------------------------------------------------------------


# server.py  (substitua o bloco da loja ou o arquivo inteiro se preferir)
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import math


# ---- ajuste isso se já existir no seu projeto ----
# db: espere um motor (Mongo) com collections shop_items e users. Se não existir,
# a app roda com cache em memória só para testes.
class _MemoryDB:
    def __init__(self):
        self.shop_items: List[Dict[str, Any]] = []
        self.users: Dict[str, Dict[str, Any]] = {}

    async def shop_delete_all(self):
        self.shop_items.clear()

    async def shop_insert_many(self, items):
        self.shop_items.extend(items)

    async def shop_find_all(self):
        return list(self.shop_items)

    async def user_set_equipped(self, user_id: str, item: Dict[str, Any]):
        u = self.users.setdefault(user_id, {"id": user_id, "equipped_items": {}})
        u["equipped_items"][item["item_type"]] = item
        return u

try:
    db  # noqa
except NameError:
    db = _MemoryDB()  # fallback se não tiver injetado no projeto


# ------------------------- CURVA DE PREÇO -------------------------
TOTAL_5000H_COINS = 60000  # 5000h * 12 coins/h
RAR_DIST = {"common": 12, "epic": 9, "rare": 6, "legendary": 3}  # 30 por tipo
BASE = {
    "common": 0.0006,     # ~36 coins no item inicial
    "epic": 0.0030,       # ~180
    "rare": 0.0100,       # ~600
    "legendary": 0.0400,  # ~2400
}
GAMMA = 0.65

def price_curve(i: int, n: int, rarity: str) -> int:
    t = 0.0 if n <= 1 else i / (n - 1)
    base = BASE.get(rarity, 0.001)
    return max(1, int(round(TOTAL_5000H_COINS * base * ((1.0 + t) ** GAMMA))))


# ------------------------- EFEITOS VISUAIS -------------------------
PALETTES = [
    ["#0ea5e9","#111827"],["#a78bfa","#0f172a"],["#10b981","#0b1020"],
    ["#f472b6","#0f172a"],["#f59e0b","#111827"],["#22d3ee","#0b1020"],
    ["#60a5fa","#0b1020"],["#06b6d4","#0b1020"],["#14b8a6","#111827"],
]

ICONS = ["star","bolt","diamond","heart","target","triangle","leaf","clover","dot","flame"]
STATIC_COLORS = ["#8B5CF6","#EAB308","#22C55E","#1D4ED8","#06B6D4","#2563EB",
                 "#22D3EE","#10B981","#A78BFA","#F59E0B","##f472b6","#60a5fa"]

def seal_effects(rarity: str, i: int) -> Dict[str, Any]:
    """efeitos por raridade para SELOS - AVATARES PERSONALIZADOS INCRÍVEIS"""
    # Padrões únicos para cada selo criar avatares diferentes
    patterns = ["geometric", "organic", "crystalline", "nebula", "fractal", "waves", "hexagon", "spiral", "mandala", "constellation"]
    
    base = {
        "mode": "handle_hash",  # Gera avatar único baseado no hash do nickname
        "angle": (i * 27) % 360,
        "icon": ICONS[i % len(ICONS)],
        "static_color": STATIC_COLORS[i % len(STATIC_COLORS)],
        "pattern": patterns[i % len(patterns)],
        "pattern_intensity": 0.3,
    }
    
    if rarity == "common":
        # Comum: Avatar básico com padrão sutil e brilho leve
        base.update({
            "glow": "soft",
            "pattern_intensity": 0.2,
            "border_style": "simple",
            "animation_speed": "none"
        })
    elif rarity == "rare":
        # Raro: + Órbita lenta + Partículas "sparks" + Brilho neon
        base.update({
            "glow": "neon",
            "particles": "sparks",
            "orbit": "slow",
            "pattern_intensity": 0.4,
            "border_style": "animated",
            "animation_speed": "slow",
            "shadow_layers": 2
        })
    elif rarity == "epic":
        # Especial: + Aura + Pulse + Trail + Partículas "stardust" mais densas
        base.update({
            "glow": "intense",
            "pulse": True,
            "aura": "radiant",
            "particles": "stardust",
            "orbit": "medium",
            "trail": "flowing",
            "pattern_intensity": 0.6,
            "border_style": "double",
            "animation_speed": "medium",
            "shadow_layers": 3,
            "inner_glow": True
        })
    else:  # legendary
        # Lendário: TUDO + Pattern de anéis + Múltiplas camadas + Auto-sync com tema
        base.update({
            "glow": "ethereal",
            "pulse": True,
            "aura": "cosmic",
            "particles": "galaxy",
            "orbit": "fast",
            "trail": "comet",
            "pattern_intensity": 0.8,
            "pattern_overlay": "rings",
            "border_style": "prismatic",
            "animation_speed": "fast",
            "shadow_layers": 5,
            "inner_glow": True,
            "auto_theme_sync": True,
            "holographic": True,
            "shimmer": True
        })
    
    return {"avatar_style": base}

def border_effects(rarity: str, i: int) -> Dict[str, Any]:
    """efeitos por raridade para BORDAS - PROGRESSÃO VISUAL IMPRESSIONANTE"""
    styles = ["soft", "rounded", "cut", "double", "neon", "glass", "crystalline", "plasma", "aurora", "quantum"]
    
    base = {
        "style": styles[i % len(styles)],
        "thickness": 2,
        "glow": True,
        "glow_intensity": 0.3
    }
    
    if rarity == "common":
        # Comum: Borda simples com brilho sutil
        base.update({
            "thickness": 2,
            "glow_intensity": 0.2,
            "animation": "none",
            "layers": 1
        })
    elif rarity == "rare":
        # Raro: Borda que brilha BASTANTE e se MOVE + animação "rainbow" rotativa
        base.update({
            "thickness": 2,
            "glow_intensity": 0.6,
            "animated": "rainbow",
            "accent_color_sync": True,
            "animation_speed": "slow",
            "layers": 2,
            "blur_amount": 2
        })
    elif rarity == "epic":
        # Especial: + Espessura maior + Interatividade (hover) + Pulse + Glow mais intenso
        base.update({
            "thickness": 3,
            "glow_intensity": 0.8,
            "animated": "pulse-rainbow",
            "hover_reactive": True,
            "hover_scale": 1.05,
            "accent_color_sync": True,
            "animation_speed": "medium",
            "layers": 3,
            "blur_amount": 3,
            "inner_border": True,
            "particle_trail": "subtle"
        })
    else:  # legendary
        # Lendário: TUDO + Múltiplas camadas + Efeitos de partículas + Cantos com sparkles
        base.update({
            "thickness": 4,
            "glow_intensity": 1.0,
            "animated": "prismatic",
            "hover_reactive": True,
            "hover_scale": 1.08,
            "hover_rotate": True,
            "accent_color_sync": True,
            "animation_speed": "fast",
            "layers": 5,
            "blur_amount": 4,
            "inner_border": True,
            "outer_border": True,
            "particle_trail": "intense",
            "corner_fx": "sparkle",
            "edge_shimmer": True,
            "gradient_shift": True,
            "holographic": True
        })
    
    return base

def theme_effects(rarity: str, i: int) -> Dict[str, Any]:
    """efeitos por raridade para TEMAS - EXPERIÊNCIA IMERSIVA INCRÍVEL"""
    pal = PALETTES[i % len(PALETTES)]
    
    base = {
        "palette": pal,
        "transition_speed": "normal"
    }
    
    if rarity == "common":
        # Comum: Paleta básica com fundo sutil
        base.update({
            "bg": "solid",
            "transition_speed": "normal",
            "ambient_effects": False
        })
    elif rarity == "rare":
        # Raro: + Background animado com gradiente + Efeitos ambientes sutis
        base.update({
            "bg": "gradient-animated",
            "transition_speed": "smooth",
            "ambient_effects": True,
            "ambient_intensity": 0.3,
            "color_shift": "subtle",
            "breathing_effect": True
        })
    elif rarity == "epic":
        # Especial: + Background REATIVO ao ciclo (muda durante focus/break) + Parallax + Transições
        base.update({
            "bg": "cycle-reactive",
            "transition_speed": "smooth",
            "transition_type": "page",
            "ambient_effects": True,
            "ambient_intensity": 0.6,
            "color_shift": "medium",
            "breathing_effect": True,
            "parallax_layers": 2,
            "focus_mode_enhancement": True,
            "break_mode_relaxation": True,
            "particle_background": "floating",
            "gradient_animation": "wave"
        })
    else:  # legendary
        # Lendário: TUDO + Parallax avançado + Celebrações automáticas + Efeitos cósmicos
        base.update({
            "bg": "cosmic-parallax",
            "transition_speed": "fluid",
            "transition_type": "morphing",
            "ambient_effects": True,
            "ambient_intensity": 1.0,
            "color_shift": "dynamic",
            "breathing_effect": True,
            "parallax_layers": 4,
            "focus_mode_enhancement": True,
            "break_mode_relaxation": True,
            "particle_background": "starfield",
            "gradient_animation": "aurora",
            "celebrate_milestones": True,
            "celebration_effects": "fireworks",
            "time_of_day_sync": True,
            "weather_effects": True,
            "nebula_overlay": True,
            "shimmer_accents": True,
            "holographic_ui": True
        })
    
    return base


# ------------------------- SEED (90 ITENS) -------------------------
def make_items() -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    rarities = ["common","epic","rare","legendary"]
    type_names = [("seal","Selo"), ("border","Borda"), ("theme","Tema")]

    for item_type, title in type_names:
        idx = 0
        for r in rarities:
            n = RAR_DIST[r]
            for j in range(n):
                price = price_curve(j, n, r)
                idx += 1
                if item_type == "seal":
                    effects = seal_effects(r, idx)
                    desc = {
                        "common":"Avatar personalizado baseado no seu nick#tag com padrão único e brilho sutil.",
                        "rare":"Avatar NEON com partículas cintilantes, órbita animada e brilho intenso que se move!",
                        "epic":"Avatar RADIANTE com aura brilhante, pulsação hipnótica, trilha fluindo e partículas de poeira estelar!",
                        "legendary":"Avatar CÓSMICO SUPREMO com galáxia de partículas, aura etérea, trilha de cometa, anéis prismáticos e sincronização automática com seu tema! ✨🌌",
                    }[r]
                elif item_type == "border":
                    effects = border_effects(r, idx)
                    desc = {
                        "common":"Borda elegante com brilho suave.",
                        "rare":"Borda ANIMADA arco-íris que BRILHA e SE MOVE constantemente, sincronizada com as cores do tema!",
                        "epic":"Borda INTERATIVA que reage ao hover, com 3 camadas, pulsação rainbow e trilha de partículas sutis!",
                        "legendary":"Borda PRISMÁTICA HOLOGRÁFICA com 5 camadas, efeitos de canto cintilantes, partículas intensas, shimmer nas bordas e gradientes que mudam dinamicamente! 🌈✨",
                    }[r]
                else:
                    effects = theme_effects(r, idx)
                    desc = {
                        "common":"Paleta de cores personalizada com fundo sólido.",
                        "rare":"Tema com gradiente ANIMADO, efeitos ambientes e respiração suave que muda de cor!",
                        "epic":"Tema REATIVO que muda durante focus/break, com parallax em 2 camadas, partículas flutuantes e animação em onda!",
                        "legendary":"Tema CÓSMICO com parallax em 4 camadas, campo de estrelas, nebulosa overlay, celebrações automáticas de milestones, sincronização com horário do dia e efeitos holográficos! 🌟🎆🌌",
                    }[r]

                items.append({
                    "id": f"{item_type}_{r}_{idx}",
                    "item_type": item_type,
                    "name": f"{title} {idx}",
                    "price": price,
                    "rarity": r,
                    "level_required": {"common":1,"epic":5,"rare":12,"legendary":20}[r],
                    "tags": [item_type],
                    "categories": [r],
                    "description": desc,
                    "effects": effects,
                    "perks": {},
                })
    return items


async def initialize_shop():
    items = make_items()
    # persistir
    try:
        await db.shop_delete_all()
        await db.shop_insert_many(items)
    except Exception:
        # fallback memória
        pass
    return items


# ------------------------- MODELOS E ROTAS -------------------------
class EquipBody(BaseModel):
    item_id: str

async def _get_items():
    try:
        items = await db.shop_find_all()
        if items:
            return items
    except Exception:
        pass
    # fallback: se não tiver DB, use seed em memória
    return make_items()

@api_router.post("/admin/seed-shop")
async def route_seed_shop():
    items = await initialize_shop()
    return {"ok": True, "count": len(items)}

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --------- gerador idêntico ao do shop_seed.js ---------
from math import pow

RARITIES = [("common", 12), ("rare", 9), ("epic", 6), ("legendary", 3)]
ICONS = ["dot","bolt","star","diamond","target","flame","leaf","heart","clover","triangle"]

def hsl_to_hex(h, s=70, l=50):
    h = (h % 360 + 360) % 360
    s /= 100; l /= 100
    c = (1 - abs(2*l - 1)) * s
    x = c * (1 - abs((h/60) % 2 - 1))
    m = l - c/2
    if   h < 60:  r,g,b = c,x,0
    elif h < 120: r,g,b = x,c,0
    elif h < 180: r,g,b = 0,c,x
    elif h < 240: r,g,b = 0,x,c
    elif h < 300: r,g,b = x,0,c
    else:         r,g,b = c,0,x
    r = round((r+m)*255); g = round((g+m)*255); b = round((b+m)*255)
    return f"#{(1<<24 | r<<16 | g<<8 | b):06x}"[1:]

def price_curve_simple(i, total):
    if total <= 1: return 50
    t = i / (total - 1)
    curved = pow(t, 2.2)
    return round(50 + 5750 * curved)

def split_bands(total):
    bands = []
    acc = 0
    for key, cnt in RARITIES:
        bands.append({"key": key, "start": acc, "end": acc + cnt - 1})
        acc += cnt
    return bands

def build_seals():
    total = 30
    bands = split_bands(total)
    out = []
    for i in range(total):
        band = next(b for b in bands if b["start"] <= i <= b["end"])
        rarity = band["key"]
        hue = (i * 13 + 210) % 360
        base = hsl_to_hex(hue, 72, 56)
        angle = (i * 17) % 360
        icon  = ICONS[i % len(ICONS)]
        avatar_style = {
            "icon": icon, "static_color": base, "angle": angle,
            "orbit": "fast" if rarity in ("epic","legendary") else "slow" if rarity=="rare" else "none",
            "particles": "stardust" if rarity in ("epic","legendary") else "sparks" if rarity=="rare" else "none",
            "trail": rarity in ("epic","legendary"),
            "pulse": rarity in ("epic","legendary"),
            "pattern": "rings" if rarity=="legendary" else "none",
        }
        out.append({
            "id": f"seal_{i+1}", "name": f"Selo {i+1}",
            "item_type": "seal", "rarity": rarity,
            "price": price_curve_simple(i, total),
            "level_required": 1 + i//3,
            "effects": {"avatar_style": avatar_style}
        })
    return out

def build_borders():
    total = 30
    bands = split_bands(total)
    out = []
    for i in range(total):
        band = next(b for b in bands if b["start"] <= i <= b["end"])
        rarity = band["key"]
        thickness = 2 if rarity in ("common","rare") else 3 if rarity=="epic" else 4
        animated = "" if rarity=="common" else "rainbow"
        out.append({
            "id": f"border_{i+1}", "name": f"Borda {i+1}",
            "item_type": "border", "rarity": rarity,
            "price": price_curve_simple(i, total),
            "level_required": 1 + i//3,
            "effects": { "thickness": thickness, "animated": animated, "accent_color_sync": rarity != "common" }
        })
    return out

def build_themes():
    total = 30
    bands = split_bands(total)
    out = []
    for i in range(total):
        band = next(b for b in bands if b["start"] <= i <= b["end"])
        rarity = band["key"]
        h = (i * 11 + 30) % 360
        accent  = hsl_to_hex(h, 80, 55)
        surface = hsl_to_hex((h + 320) % 360, 28, 13)
        out.append({
            "id": f"theme_{i+1}", "name": f"Tema {i+1}",
            "item_type": "theme", "rarity": rarity,
            "price": price_curve_simple(i, total),
            "level_required": 1 + i//3,
            "effects": {
                "palette": [accent, surface],
                "bg": "parallax" if rarity=="legendary" else "cycle-reactive" if rarity=="epic" else "solid",
                "celebrate_milestones": rarity=="legendary"
            }
        })
    return out

def get_shop_items():
    return build_seals() + build_borders() + build_themes()
# ---------------------------------------------------------

@api_router.get("/shop")
@api_router.get("/shop/all")
@api_router.get("/shop/items")
async def shop_list():
    # tenta ler do Mongo
    items = await db.shop_items.find({}, {"_id": 0}).to_list(1000)
    # se estiver vazio, faz o seed uma vez
    if not items:
        items = await initialize_shop()
    # o front espera esse formato
    return {"items": items}


@api_router.post("/shop/equip")
async def route_shop_equip(body: EquipBody, request: Request):
    # tenta achar o item
    items = await _get_items()
    item = next((x for x in items if x["id"] == body.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    # user_id simples (usa Authorization: Bearer <id> se existir)
    user_id = request.headers.get("Authorization", "").replace("Bearer ", "") or "local-user"
    try:
        u = await db.user_set_equipped(user_id, item)
        return {"ok": True, "equipped_items": u["equipped_items"]}
    except Exception:
        return {"ok": True}
    

app.include_router(api_router, prefix="/api")








# --- [ADD] Bonus por nível (idempotente por nível) ---
class LevelBonusPayload(BaseModel):
    level: int
    bonus_coins: int
@api_router.get("/calendar/month")
async def month_summary(year: int, month: int):
    # devolve [{date_iso, count, hasCompleted}]
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year+1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month+1, 1, tzinfo=timezone.utc)

    cur = db.events.find({"start": {"$gte": start}, "end": {"$lt": end}})
    agg = {}
    async for ev in cur:
        di = ev["start"].date().isoformat()
        d = agg.setdefault(di, {"date_iso": di, "count": 0, "hasCompleted": False})
        d["count"] += 1
        d["hasCompleted"] = d["hasCompleted"] or bool(ev.get("completed"))
    return list(agg.values())


class FriendRequestInput(BaseModel):
    friend_nickname: str
    friend_tag: str

@api_router.post("/friends/requests")
async def send_friend_request(payload: FriendRequestInput, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)

    # localizar destinatário
    to_user = await db.users.find_one({
        "nickname": {"$regex": f"^{payload.friend_nickname}$", "$options": "i"},
        "tag": {"$regex": f"^{payload.friend_tag}$", "$options": "i"},
    }, {"_id": 0, "id": 1})
    if not to_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if to_user["id"] == user.id:
        raise HTTPException(status_code=400, detail="Você não pode enviar solicitação para si mesmo")

    # já são amigos?
    already = await db.friends.find_one({
        "$or": [
            {"user_id": user.id, "friend_id": to_user["id"]},
            {"user_id": to_user["id"], "friend_id": user.id},
        ]
    })
    if already:
        raise HTTPException(status_code=400, detail="Vocês já são amigos")

    # existe pendente entre a dupla?
    dup = await db.friend_requests.find_one({
        "$or": [
            {"from_id": user.id, "to_id": to_user["id"], "status": "pending"},
            {"from_id": to_user["id"], "to_id": user.id, "status": "pending"},
        ]
    })
    if dup:
        raise HTTPException(status_code=400, detail="Já existe uma solicitação pendente entre vocês")

    req = FriendRequestModel(from_id=user.id, to_id=to_user["id"]).model_dump()
    req["created_at"] = req["created_at"].isoformat()
    await db.friend_requests.insert_one(req)
    return {"ok": True, "request_id": req["id"]}


@api_router.get("/friends/requests")
async def list_friend_requests(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    incoming = await db.friend_requests.find({"to_id": user.id, "status": "pending"}, {"_id": 0}).to_list(500)
    outgoing = await db.friend_requests.find({"from_id": user.id, "status": "pending"}, {"_id": 0}).to_list(500)
    return {"incoming": incoming, "outgoing": outgoing}


@api_router.post("/friends/requests/{request_id}/accept")
async def accept_friend_request(request_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)

    fr = await db.friend_requests.find_one({"id": request_id}, {"_id": 0})
    if not fr or fr.get("to_id") != user.id or fr.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    pairs = [
        {"user_id": fr["from_id"], "friend_id": fr["to_id"]},
        {"user_id": fr["to_id"], "friend_id": fr["from_id"]},
    ]
    now = datetime.now(timezone.utc).isoformat()
    for p in pairs:
        await db.friends.update_one(
            p,
            {"$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now}},
            upsert=True,
        )

    await db.friend_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "accepted", "responded_at": now}},
    )
    return {"ok": True}




@api_router.post("/friends/requests/{request_id}/reject")
async def reject_friend_request(request_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    fr = await db.friend_requests.find_one({"id": request_id}, {"_id": 0})
    if not fr or fr["to_id"] != user.id or fr["status"] != "pending":
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    await db.friend_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "responded_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}


def _sec_left_from_timer(timer: dict | None) -> int | None:
    if not timer:
        return None

    state = timer.get("state")  # "focus" | "break" | "paused"
    if state == "paused":
        return int(timer.get("seconds_left") or 0)

    end = _to_aware(timer.get("phase_until"))
    if not end:
        return int(timer.get("seconds_left") or 0)

    return max(0, int((end - utcnow()).total_seconds()))





@api_router.post("/rewards/level-bonus")
async def level_bonus(payload: LevelBonusPayload, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    lvl   = int(payload.level)
    bonus = max(0, int(payload.bonus_coins))

    # evita pagar repetido: grava levels_paid por usuário
    doc = await db.user_bonus.find_one({"user_id": user.id}, {"_id": 0})
    already = set(doc.get("levels_paid", [])) if doc else set()
    if lvl in already or bonus <= 0:
        return {"ok": True, "paid": False}

    await db.users.update_one({"id": user.id}, {"$inc": {"coins": bonus}}, upsert=True)
    already.add(lvl)
    await db.user_bonus.update_one(
        {"user_id": user.id},
        {"$set": {"levels_paid": sorted(list(already))}},
        upsert=True
    )
    return {"ok": True, "paid": True, "bonus": bonus}
# --- [FIM ADD] ---
# === [ADD] Calendar/Agenda Routes ===
@api_router.post("/calendar/event", response_model=CalendarEvent)
async def calendar_create(ev: CalendarEventCreate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)

    # valida subject se informado
    if ev.subject_id:
        owned = await db.subjects.find_one({"id": ev.subject_id, "user_id": user.id})
        if not owned:
            raise HTTPException(status_code=400, detail="subject_id inválido")

    doc = CalendarEvent(
        user_id=user.id,
        title=ev.title,
        start=ev.start,
        end=ev.end,
        subject_id=ev.subject_id,
        checklist=ev.checklist or []
    ).model_dump()
    # normaliza ISO
    doc["start"] = doc["start"].isoformat()
    doc["end"]   = doc["end"].isoformat()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.calendar_events.insert_one(doc)
    return doc

@api_router.get("/calendar/day")
async def calendar_day(date_iso: str, request: Request, session_token: Optional[str] = Cookie(None)):
    """
    Retorna eventos do dia (UTC) informado (YYYY-MM-DD).
    """
    user = await get_current_user(request, session_token)
    try:
        d = datetime.fromisoformat(date_iso).date()
    except Exception:
        raise HTTPException(status_code=400, detail="date_iso inválido (YYYY-MM-DD)")

    day_start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    day_end   = day_start + timedelta(days=1)

    items = await db.calendar_events.find(
        {
            "user_id": user.id,
            # qualquer evento que toque o dia
            "start": {"$lt": day_end.isoformat()},
            "end":   {"$gt": day_start.isoformat()}
        },
        {"_id": 0}
    ).sort("start", 1).to_list(500)
    return items

@api_router.patch("/calendar/event/{event_id}")
async def calendar_update(event_id: str, payload: CalendarEventUpdate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not upd:
        return {"success": True}

    if "subject_id" in upd and upd["subject_id"]:
        owned = await db.subjects.find_one({"id": upd["subject_id"], "user_id": user.id})
        if not owned:
            raise HTTPException(status_code=400, detail="subject_id inválido")

    # normaliza ISO se veio datetime
    if "start" in upd and isinstance(upd["start"], datetime):
        upd["start"] = upd["start"].isoformat()
    if "end" in upd and isinstance(upd["end"], datetime):
        upd["end"] = upd["end"].isoformat()

    await db.calendar_events.update_one({"id": event_id, "user_id": user.id}, {"$set": upd})
    return {"success": True}

@api_router.delete("/calendar/event/{event_id}")
async def calendar_delete(event_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    await db.calendar_events.delete_one({"id": event_id, "user_id": user.id})
    return {"success": True}

# Checklist: add item
class ChecklistAdd(BaseModel):
    text: str

@api_router.post("/calendar/event/{event_id}/checklist")
async def checklist_add(event_id: str, item: ChecklistAdd, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    it = {"id": str(uuid.uuid4()), "text": item.text, "done": False}
    await db.calendar_events.update_one({"id": event_id, "user_id": user.id}, {"$push": {"checklist": it}})
    return {"success": True, "item": it}

# Checklist: toggle done
@api_router.post("/calendar/event/{event_id}/checklist/{item_id}/toggle")
async def checklist_toggle(event_id: str, item_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    ev = await db.calendar_events.find_one({"id": event_id, "user_id": user.id}, {"_id": 0, "checklist": 1})
    if not ev:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    items = ev.get("checklist", [])
    for it in items:
        if it["id"] == item_id:
            it["done"] = not it.get("done", False)
            break
    await db.calendar_events.update_one({"id": event_id, "user_id": user.id}, {"$set": {"checklist": items}})
    return {"success": True}

# Shop Routes
@api_router.get("/shop", response_model=List[ShopItem])
async def get_shop_items():
    items = await db.shop_items.find({}, {"_id": 0}).to_list(1000)
    if not items:
        # Initialize shop with default items
        items = await initialize_shop()
    return items

# === PATCH: /shop/purchase (substituir função inteira) ===
@api_router.post("/shop/purchase")
async def purchase_item(input: PurchaseItem, request: Request, session_token: Optional[str] = Cookie(None)):
    # 1) pega usuário atual (já logado)
    user = await get_current_user(request, session_token)

    # 2) busca o item no banco
    item = await db.shop_items.find_one({"id": input.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # 3) bloqueia por nível mínimo (se houver)
    min_level = item.get("level_required", 1)
    if (user.level or 1) < min_level:
        raise HTTPException(status_code=400, detail=f"Nível insuficiente: requer nível {min_level}")

    # 4) checa coins
    price = item.get("price", 0)
    if (user.coins or 0) < price:
        raise HTTPException(status_code=400, detail="Not enough coins")

    # 5) não comprar duas vezes
    already = input.item_id in (user.items_owned or [])
    if already:
        raise HTTPException(status_code=400, detail="Item already owned")

    # 6) debita e adiciona item
    await db.users.update_one(
        {"id": user.id},
        {"$inc": {"coins": -price}, "$push": {"items_owned": input.item_id}},
    )

    return {"success": True, "spent": price, "item_id": input.item_id}
# === /PATCH ===



class EquipItem(BaseModel):
    item_id: str
    item_type: str  # seal, border, theme

class UnequipItem(BaseModel):
    item_type: str



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

class PresencePing(BaseModel):
    interaction: bool = False   # true quando houve clique/tecla/scroll recente

from typing import Optional

def _presence_from_timestamps(last_activity_iso: str | None,
                              last_interaction_iso: str | None,
                              tabs_open: int | None) -> str:
    # offline APENAS se não há abas abertas
    if not tabs_open or tabs_open <= 0:
        return "offline"

    # entre online/away decidimos por interação (30 min)
    now = datetime.now(timezone.utc)
    try:
        li = datetime.fromisoformat(last_interaction_iso) if last_interaction_iso else None
    except Exception:
        li = None

    if not li or (now - li).total_seconds() >= 1800:  # 30 min
        return "away"
    return "online"

def _rx(s: str):
    return {"$regex": s, "$options": "i"}




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




async def initialize_quests():
    quests = [
        {"id": "q1", "title": "Primeira Sessão", "description": "Complete sua primeira sessão de estudos", "xp_reward": 50, "coins_reward": 50, "quest_type": "daily", "target": 1},
        {"id": "q2", "title": "Estudioso", "description": "Estude por 60 minutos", "xp_reward": 100, "coins_reward": 100, "quest_type": "daily", "target": 60},
        {"id": "q3", "title": "Dedicação", "description": "Complete 5 sessões de estudo", "xp_reward": 200, "coins_reward": 200, "quest_type": "weekly", "target": 5},
        {"id": "q4", "title": "Mestre", "description": "Estude por 300 minutos em uma semana", "xp_reward": 500, "coins_reward": 500, "quest_type": "weekly", "target": 300},
    ]
    await db.quests.insert_many(quests)
    return quests

# --- Amigos: solicitação + presença ---
class FriendRequestModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_id: str
    to_id: str
    status: str = "pending"   # pending | accepted | rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    responded_at: Optional[datetime] = None

class ActiveSessionInfo(BaseModel):
    subject_id: str
    start_time: datetime
    estimated_end: Optional[datetime] = None  # (opcional) útil p/ mostrar contagem

# marca o último clique/tecla para "ausente"
# (você já tem last_activity; vamos acrescentar last_interaction)


# Friends Routes
class FriendRequest(BaseModel):
    friend_nickname: str
    friend_tag: str


class Group(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str
    name: str
    description: Optional[str] = None
    visibility: str = "public"           # "public" | "private"
    invite_code: str = Field(default_factory=lambda: "".join(random.choices(string.ascii_uppercase + string.digits, k=7)))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GroupMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    user_id: str
    role: str = "member"                 # "owner" | "admin" | "member"
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CreateGroupPayload(BaseModel):
    name: str
    description: Optional[str] = None
    visibility: Optional[str] = "public"

class JoinByInvitePayload(BaseModel):
    invite_code: str

class LeaveGroupPayload(BaseModel):
    group_id: str



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