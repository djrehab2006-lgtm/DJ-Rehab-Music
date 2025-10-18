from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import bcrypt
import jwt
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
security = HTTPBearer()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client.djrehab_music

# JWT Config
SECRET_KEY = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Models
class AdminLogin(BaseModel):
    username: str
    password: str

class AdminCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class FolderCreate(BaseModel):
    name: str
    cover_image: Optional[str] = None  # base64

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    cover_image: Optional[str] = None

class TrackCreate(BaseModel):
    title: str
    artist: str
    cdn_url: str
    duration: Optional[int] = 0  # in seconds
    folder_id: Optional[str] = None
    cover_art: Optional[str] = None  # base64

class TrackUpdate(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    cdn_url: Optional[str] = None
    duration: Optional[int] = None
    folder_id: Optional[str] = None
    cover_art: Optional[str] = None

# Helper functions
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

# Startup - Create default admin if not exists
@app.on_event("startup")
async def startup_event():
    admin = await db.admins.find_one({"username": "djrehab2006"})
    if not admin:
        hashed = bcrypt.hashpw("Helena@1810".encode('utf-8'), bcrypt.gensalt())
        await db.admins.insert_one({
            "username": "djrehab2006",
            "password_hash": hashed.decode('utf-8'),
            "created_at": datetime.utcnow()
        })
        print("Default admin created: username=djrehab2006, password=Helena@1810")

# Auth Endpoints
@app.post("/api/auth/login", response_model=Token)
async def login(admin_login: AdminLogin):
    admin = await db.admins.find_one({"username": admin_login.username})
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(admin_login.password.encode('utf-8'), admin["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token({"sub": admin_login.username})
    return {"access_token": access_token}

@app.get("/api/auth/verify")
async def verify(payload: dict = Depends(verify_token)):
    return {"username": payload.get("sub"), "valid": True}

# Folder Endpoints
@app.get("/api/folders")
async def get_folders(payload: dict = Depends(verify_token)):
    folders = await db.folders.find().sort("created_at", -1).to_list(100)
    return [serialize_doc(f) for f in folders]

@app.post("/api/folders")
async def create_folder(folder: FolderCreate, payload: dict = Depends(verify_token)):
    folder_doc = {
        "name": folder.name,
        "cover_image": folder.cover_image,
        "created_at": datetime.utcnow()
    }
    result = await db.folders.insert_one(folder_doc)
    folder_doc["id"] = str(result.inserted_id)
    del folder_doc["_id"]
    return folder_doc

@app.put("/api/folders/{folder_id}")
async def update_folder(folder_id: str, folder: FolderUpdate, payload: dict = Depends(verify_token)):
    update_data = {k: v for k, v in folder.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.folders.update_one(
        {"_id": ObjectId(folder_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    updated_folder = await db.folders.find_one({"_id": ObjectId(folder_id)})
    return serialize_doc(updated_folder)

@app.delete("/api/folders/{folder_id}")
async def delete_folder(folder_id: str, payload: dict = Depends(verify_token)):
    # Also delete all tracks in this folder
    await db.tracks.delete_many({"folder_id": folder_id})
    result = await db.folders.delete_one({"_id": ObjectId(folder_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Folder not found")
    return {"message": "Folder deleted successfully"}

# Track Endpoints
@app.get("/api/tracks")
async def get_tracks(folder_id: Optional[str] = None, payload: dict = Depends(verify_token)):
    query = {}
    if folder_id:
        query["folder_id"] = folder_id
    tracks = await db.tracks.find(query).sort("created_at", -1).to_list(500)
    return [serialize_doc(t) for t in tracks]

@app.post("/api/tracks")
async def create_track(track: TrackCreate, payload: dict = Depends(verify_token)):
    track_doc = {
        "title": track.title,
        "artist": track.artist,
        "cdn_url": track.cdn_url,
        "duration": track.duration,
        "folder_id": track.folder_id,
        "cover_art": track.cover_art,
        "created_at": datetime.utcnow()
    }
    result = await db.tracks.insert_one(track_doc)
    track_doc["id"] = str(result.inserted_id)
    del track_doc["_id"]
    return track_doc

@app.put("/api/tracks/{track_id}")
async def update_track(track_id: str, track: TrackUpdate, payload: dict = Depends(verify_token)):
    update_data = {k: v for k, v in track.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.tracks.update_one(
        {"_id": ObjectId(track_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Track not found")
    
    updated_track = await db.tracks.find_one({"_id": ObjectId(track_id)})
    return serialize_doc(updated_track)

@app.delete("/api/tracks/{track_id}")
async def delete_track(track_id: str, payload: dict = Depends(verify_token)):
    result = await db.tracks.delete_one({"_id": ObjectId(track_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Track not found")
    return {"message": "Track deleted successfully"}

@app.get("/api/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)