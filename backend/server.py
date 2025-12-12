from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import bcrypt
import jwt
import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "djrehab_music")
SECRET_KEY = os.getenv("JWT_SECRET")

# Initialize SECRET_KEY with a secure default if not provided
if not SECRET_KEY:
    SECRET_KEY = "temporary-secret-key-for-deployment"
    print("WARNING: JWT_SECRET not set, using temporary default. Set JWT_SECRET environment variable for production.")

try:
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]
    # Test connection
    client.admin.command('ping')
    MONGODB_AVAILABLE = True
    print(f"MongoDB connected successfully to database: {DB_NAME}")
except Exception as e:
    print(f"MongoDB connection failed: {e}")
    print("App will run in limited mode without database functionality")
    MONGODB_AVAILABLE = False
    db = None

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

# Models
class AdminLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Folder(BaseModel):
    name: str
    cover_image: Optional[str] = None

class Track(BaseModel):
    title: str
    artist: str
    cdn_url: str
    duration: int
    folder_id: str
    cover_art: Optional[str] = None

class FolderReorder(BaseModel):
    folder_ids: List[str]

class TrackReorder(BaseModel):
    track_ids: List[str]

# Auth helpers
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_admin(token: str = Depends(lambda: None)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

# Startup - Create default admin if not exists (only if MongoDB is available)
@app.on_event("startup")
async def startup_event():
    if not MONGODB_AVAILABLE:
        print("Skipping admin initialization - MongoDB not available")
        return
    
    try:
        admin = await db.admins.find_one({"username": "djrehab2006"})
        if not admin:
            hashed = bcrypt.hashpw("Helena@1810".encode('utf-8'), bcrypt.gensalt())
            await db.admins.insert_one({
                "username": "djrehab2006",
                "password_hash": hashed.decode('utf-8'),
                "created_at": datetime.utcnow()
            })
            print("Default admin created: username=djrehab2006, password=Helena@1810")
    except Exception as e:
        print(f"Failed to initialize admin user: {e}")
        print("App will continue without admin functionality")

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "mongodb_available": MONGODB_AVAILABLE,
        "database": DB_NAME if MONGODB_AVAILABLE else "not connected"
    }

# Auth Endpoints
@app.post("/api/auth/login", response_model=Token)
async def login(admin_login: AdminLogin):
    if not MONGODB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    admin = await db.admins.find_one({"username": admin_login.username})
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(admin_login.password.encode('utf-8'), admin["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": admin_login.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/verify")
async def verify_token(username: str = Depends(get_current_admin)):
    return {"username": username}

# Folder Endpoints
@app.get("/api/folders")
async def get_folders():
    if not MONGODB_AVAILABLE:
        return []
    folders = await db.folders.find().sort("position", 1).to_list(length=None)
    return [serialize_doc(f) for f in folders]

@app.post("/api/folders")
async def create_folder(folder: Folder, admin: str = Depends(get_current_admin)):
    if not MONGODB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    count = await db.folders.count_documents({})
    folder_dict = folder.dict()
    folder_dict["position"] = count
    folder_dict["created_at"] = datetime.utcnow()
    result = await db.folders.insert_one(folder_dict)
    new_folder = await db.folders.find_one({"_id": result.inserted_id})
    return serialize_doc(new_folder)

@app.put("/api/folders/{folder_id}")
async def update_folder(folder_id: str, folder: Folder, admin: str = Depends(get_current_admin)):
    if not MONGODB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    from bson import ObjectId
    await db.folders.update_one({"_id": ObjectId(folder_id)}, {"$set": folder.dict()})
    updated = await db.folders.find_one({"_id": ObjectId(folder_id)})
    return serialize_doc(updated)

@app.delete("/api/folders/{folder_id}")
async def delete_folder(folder_id: str, admin: str = Depends(get_current_admin)):
    if not MONGODB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    from bson import ObjectId
    await db.tracks.delete_many({"folder_id": folder_id})
    await db.folders.delete_one({"_id": ObjectId(folder_id)})
    return {"message": "Folder deleted"}

@app.put("/api/folders/reorder")
async def reorder_folders(reorder: FolderReorder, admin: str = Depends(get_current_admin)):
    if not MONGODB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    from bson import ObjectId
    for idx, folder_id in enumerate(reorder.folder_ids):
        await db.folders.update_one({"_id": ObjectId(folder_id)}, {"$set": {"position": idx}})
    return {"message": "Folders reordered"}

# Track Endpoints
@app.get("/api/tracks")
async def get_tracks(folder_id: Optional[str] = None):
    if not MONGODB_AVAILABLE:
        return []
    query = {"folder_id": folder_id} if folder_id else {}
    tracks = await db.tracks.find(query).sort("position", 1).to_list(length=None)
    return [serialize_doc(t) for t in tracks]

@app.post("/api/tracks")
async def create_track(track: Track, admin: str = Depends(get_current_admin)):
    if not MONGODB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    count = await db.tracks.count_documents({"folder_id": track.folder_id})
    track_dict = track.dict()
    track_dict["position"] = count
    track_dict["created_at"] = datetime.utcnow()
    result = await db.tracks.insert_one(track_dict)
    new_track = await db.tracks.find_one({"_id": result.inserted_id})
    return serialize_doc(new_track)

@app.put("/api/tracks/reorder")
async def reorder_tracks(reorder: TrackReorder, admin: str = Depends(get_current_admin)):
    if not MONGODB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    from bson import ObjectId
    for idx, track_id in enumerate(reorder.track_ids):
        await db.tracks.update_one({"_id": ObjectId(track_id)}, {"$set": {"position": idx}})
    return {"message": "Tracks reordered"}

@app.put("/api/tracks/{track_id}")
async def update_track(track_id: str, track: Track, admin: str = Depends(get_current_admin)):
    if not MONGODB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    from bson import ObjectId
    await db.tracks.update_one({"_id": ObjectId(track_id)}, {"$set": track.dict()})
    updated = await db.tracks.find_one({"_id": ObjectId(track_id)})
    return serialize_doc(updated)

@app.delete("/api/tracks/{track_id}")
async def delete_track(track_id: str, admin: str = Depends(get_current_admin)):
    if not MONGODB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    from bson import ObjectId
    await db.tracks.delete_one({"_id": ObjectId(track_id)})
    return {"message": "Track deleted"}
