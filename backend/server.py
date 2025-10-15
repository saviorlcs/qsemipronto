from fastapi import FastAPI, APIRouter, HTTPException, Cookie, Response, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
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
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_type: str  # seal, border, theme
    name: str
    price: int
    rarity: str  # common, rare, epic, legendary
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

# Root Route
@api_router.get("/")
async def root():
    return {"message": "CicloStudy API", "status": "ok"}

# Auth Helper
async def get_current_user(request: Request, session_token: Optional[str] = Cookie(None)) -> User:
    # Try cookie first, then Authorization header
    token = session_token
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Handle expires_at - could be datetime object or ISO string
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    
    # Ensure timezone awareness for comparison
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update last activity
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )
    
    return User(**user)

# Auth Routes
@api_router.get("/auth/session")
async def create_session(session_id: str, response: Response):
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid session ID")
        
        data = resp.json()
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": data["email"]}, {"_id": 0})
        
        if not existing_user:
            # Create new user
            user = User(
                email=data["email"],
                name=data["name"],
                picture=data.get("picture")
            )
            user_dict = user.model_dump()
            user_dict["last_activity"] = user_dict["last_activity"].isoformat()
            user_dict["created_at"] = user_dict["created_at"].isoformat()
            await db.users.insert_one(user_dict)
            user_id = user.id
        else:
            user_id = existing_user["id"]
        
        # Create session
        session_token = data["session_token"]
        session = UserSession(
            user_id=user_id,
            session_token=session_token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        session_dict = session.model_dump()
        session_dict["expires_at"] = session_dict["expires_at"].isoformat()
        session_dict["created_at"] = session_dict["created_at"].isoformat()
        await db.user_sessions.insert_one(session_dict)
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7*24*60*60,
            path="/"
        )
        
        return {"success": True}

@api_router.get("/auth/me")
async def get_me(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"success": True}

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

@api_router.post("/study/end")
async def end_study_session(input: StudySessionEnd, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    session = await db.study_sessions.find_one({"id": input.session_id, "user_id": user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Calculate rewards (5 min = 1 coin)
    coins = input.duration // 5 if not input.skipped else 0
    xp = input.duration if not input.skipped else 0
    
    # Update session
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
    
    # Update user stats with progressive XP system (25% increase each level)
    new_xp = user.xp + xp
    new_level = user.level
    
    # Calculate XP needed for next level: base * (1.25 ^ (level - 1)), rounded up
    def calculate_xp_for_level(level):
        base_xp = 100
        multiplier = 1.25 ** (level - 1)
        return int(base_xp * multiplier + 0.999)  # Ceiling without math.ceil
    
    xp_for_next_level = calculate_xp_for_level(new_level)
    
    while new_xp >= xp_for_next_level:
        new_xp -= xp_for_next_level
        new_level += 1
        xp_for_next_level = calculate_xp_for_level(new_level)
    
    await db.users.update_one(
        {"id": user.id},
        {"$inc": {"coins": coins}, "$set": {"level": new_level, "xp": new_xp, "online_status": "away"}}
    )
    
    # Update subject total time
    await db.subjects.update_one(
        {"id": session["subject_id"]},
        {"$inc": {"total_time_studied": input.duration}}
    )
    
    return {"success": True, "coins_earned": coins, "xp_earned": xp, "new_level": new_level}

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
    
    if user.coins < item["price"]:
        raise HTTPException(status_code=400, detail="Not enough coins")
    
    if input.item_id in user.items_owned:
        raise HTTPException(status_code=400, detail="Item already owned")
    
    await db.users.update_one(
        {"id": user.id},
        {"$inc": {"coins": -item["price"]}, "$push": {"items_owned": input.item_id}}
    )
    
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
    
    return {
        "total_time": total_time,
        "week_time": week_time,
        "cycle_progress": cycle_progress,
        "subjects": subject_stats,
        "level": user.level,
        "xp": user.xp,
        "coins": user.coins
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
@api_router.get("/quests")
async def get_quests(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    # Get all quests
    quests = await db.quests.find({}, {"_id": 0}).to_list(100)
    if not quests:
        quests = await initialize_quests()
    
    # Get user progress
    user_quests = await db.user_quests.find({"user_id": user.id}, {"_id": 0}).to_list(100)
    user_quests_map = {uq["quest_id"]: uq for uq in user_quests}
    
    result = []
    for quest in quests:
        uq = user_quests_map.get(quest["id"])
        result.append({
            **quest,
            "progress": uq["progress"] if uq else 0,
            "completed": uq["completed"] if uq else False
        })
    
    return result

async def initialize_shop():
    items = []
    # Seals - Progressive prices
    for i in range(30):
        rarity = "legendary" if i >= 27 else "epic" if i >= 20 else "rare" if i >= 10 else "common"
        # Progressive pricing: starts at 50, increases by 15% each item
        base_price = 50
        price = int(base_price * (1.15 ** i) + 0.999)
        items.append({
            "id": f"seal_{i}",
            "item_type": "seal",
            "name": f"Selo {i+1}",
            "price": price,
            "rarity": rarity
        })
    # Borders - Progressive prices
    for i in range(30):
        rarity = "legendary" if i >= 27 else "epic" if i >= 20 else "rare" if i >= 10 else "common"
        base_price = 60
        price = int(base_price * (1.15 ** i) + 0.999)
        items.append({
            "id": f"border_{i}",
            "item_type": "border",
            "name": f"Borda {i+1}",
            "price": price,
            "rarity": rarity
        })
    # Themes - Progressive prices
    for i in range(30):
        rarity = "legendary" if i >= 27 else "epic" if i >= 20 else "rare" if i >= 10 else "common"
        base_price = 100
        price = int(base_price * (1.15 ** i) + 0.999)
        items.append({
            "id": f"theme_{i}",
            "item_type": "theme",
            "name": f"Tema {i+1}",
            "price": price,
            "rarity": rarity
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()