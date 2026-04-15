from __future__ import annotations
from functools import lru_cache
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .database import get_db_connection

# Navin imports
from .config import get_settings
from .rag import RagService
from .schemas import ChatRequest, ChatResponse, DocumentSummary, HealthResponse, UploadResponse
from .database import init_db, verify_user, create_user, delete_user

settings = get_settings()
app = FastAPI(title=settings.project_name)

# --- MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- DATABASE STARTUP ---
@app.on_event("startup")
async def startup_event():
    init_db()  # App chalu jhale ki table banavla jail

# --- MODELS ---
class LoginRequest(BaseModel):
    email: str
    password: str
class CreateUserRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str
@app.post("/api/login")
async def login(request: LoginRequest):
    user = verify_user(request.email, request.password)

    if user:
        return {
            "status": "success",
            "email": user["email"],
            "role": user["role"]
        }

    raise HTTPException(status_code=401, detail="Invalid email or password")


@app.post("/api/admin/create-user")
async def admin_create_user(request: CreateUserRequest):
    success = create_user(
        request.name,
        request.email,
        request.password,
        request.role
    )
    if success:
        return {
            "status": "success",
            "message": "User created successfully"
        }

    raise HTTPException(status_code=400, detail="User already exists")
@app.delete("/api/admin/delete-user/{email}")

async def admin_delete_user(email: str):
    success = delete_user(email)

    if success:
        return {
            "status": "success",
            "message": "User deleted successfully"
        }

    raise HTTPException(status_code=404, detail="User not found")
from passlib.context import CryptContext
from .database import get_db_connection

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

from pydantic import BaseModel

class ChangePasswordRequest(BaseModel):
    email: str
    old_password: str
    new_password: str

@app.put("/api/change-password")
async def change_password(request: ChangePasswordRequest):
    conn = get_db_connection()

    user = conn.execute(
        "SELECT * FROM users WHERE email=?",
        (request.email,)
    ).fetchone()

    if not user or not pwd_context.verify(request.old_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Invalid old password")

    new_hashed = pwd_context.hash(request.new_password)

    conn.execute(
        "UPDATE users SET hashed_password=? WHERE email=?",
        (new_hashed, request.email)
    )

    conn.commit()
    conn.close()

    return {"message": "Password updated successfully"}
    conn = get_db_connection()

    user = conn.execute(
        "SELECT * FROM users WHERE email=?",
        (email,)
    ).fetchone()

    if not user or not pwd_context.verify(old_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Invalid old password")

    new_hashed = pwd_context.hash(new_password)

    conn.execute(
        "UPDATE users SET hashed_password=? WHERE email=?",
        (new_hashed, email)
    )

    conn.commit()
    conn.close()

    return {"message": "Password updated successfully"}
@lru_cache(maxsize=1)
def get_service() -> RagService:
    return RagService(settings)

@app.get("/api/health", response_model=HealthResponse)
def health() -> dict:
    try:
        return get_service().health()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@app.get("/api/documents", response_model=list[DocumentSummary])
def list_documents() -> list[dict]:
    try:
        return get_service().list_documents()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@app.post("/api/documents/upload", response_model=UploadResponse)
async def upload_documents(files: list[UploadFile] = File(...)) -> dict:
    try:
        uploads = []
        for file in files:
            content = await file.read()
            uploads.append({
                "filename": file.filename or "upload",
                "content": content,
            })
        documents = get_service().upload_files(uploads)
        return {"documents": documents, "message": f"Indexed {len(documents)} file(s)."}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@app.delete("/api/documents/{document_id}", status_code=204)
def delete_document(document_id: str) -> None:
    try:
        get_service().delete_document(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> dict:
    try:
        return get_service().ask(request.message)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
@app.get("/api/admin/users")
def get_users():
    conn = get_db_connection()
    users = conn.execute("SELECT email, role FROM users").fetchall()
    conn.close()

    return [dict(u) for u in users]