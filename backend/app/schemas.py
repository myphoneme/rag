from __future__ import annotations

from pydantic import BaseModel, Field


class DocumentSummary(BaseModel):
    id: str
    name: str
    extension: str
    size_bytes: int
    chunk_count: int
    uploaded_at: str


class UploadResponse(BaseModel):
    documents: list[DocumentSummary]
    message: str


class SourceItem(BaseModel):
    document_id: str
    document_name: str
    snippet: str
    page: int | None = None
    sheet: str | None = None
    row_range: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceItem]


class HealthResponse(BaseModel):
    status: str
    indexed_documents: int
    chat_model: str
    embedding_model: str
