from __future__ import annotations

from functools import lru_cache

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .rag import RagService
from .schemas import ChatRequest, ChatResponse, DocumentSummary, HealthResponse, UploadResponse

settings = get_settings()
app = FastAPI(title=settings.project_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
            uploads.append(
                {
                    "filename": file.filename or "upload",
                    "content": await file.read(),
                }
            )
        documents = get_service().upload_files(uploads)
        return {"documents": documents, "message": f"Indexed {len(documents)} file(s)."}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
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
