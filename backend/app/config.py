from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

@dataclass(frozen=True)
class Settings:
    project_name: str
    google_api_key: str
    chat_model: str
    embedding_model: str
    chunk_size: int
    chunk_overlap: int
    top_k: int
    collection_name: str
    allowed_origins: tuple[str, ...]
    root_dir: Path
    storage_dir: Path
    upload_dir: Path
    chroma_dir: Path
    manifest_path: Path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    backend_dir = Path(__file__).resolve().parents[1]
    root_dir = backend_dir.parent
    load_dotenv(backend_dir / ".env")
    load_dotenv(root_dir / ".env")
    storage_dir = root_dir / "storage"
    upload_dir = storage_dir / "uploads"
    chroma_dir = root_dir / "db"
    manifest_path = storage_dir / "manifest.json"

    storage_dir.mkdir(parents=True, exist_ok=True)
    upload_dir.mkdir(parents=True, exist_ok=True)
    chroma_dir.mkdir(parents=True, exist_ok=True)

    allowed_origins = tuple(
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    )

    return Settings(
        project_name=os.getenv("PROJECT_NAME", "RAG Studio"),
        google_api_key=os.getenv("GOOGLE_API_KEY", ""),
        chat_model=os.getenv("CHAT_MODEL", "gemini-2.5-flash"),
        embedding_model=os.getenv("EMBEDDING_MODEL", "gemini-embedding-001"),
        chunk_size=int(os.getenv("CHUNK_SIZE", "900")),
        chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "150")),
        top_k=int(os.getenv("TOP_K", "4")),
        collection_name=os.getenv("CHROMA_COLLECTION", "rag-documents"),
        allowed_origins=allowed_origins,
        root_dir=root_dir,
        storage_dir=storage_dir,
        upload_dir=upload_dir,
        chroma_dir=chroma_dir,
        manifest_path=manifest_path,
    )
