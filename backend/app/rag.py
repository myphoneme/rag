from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from langchain_chroma import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .config import Settings
from .loaders import load_documents, sanitize_filename


class RagService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._embeddings: GoogleGenerativeAIEmbeddings | None = None
        self._llm: ChatGoogleGenerativeAI | None = None
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        self._vectorstore: Chroma | None = None

    def health(self) -> dict[str, Any]:
        return {
            "status": "ok",
            "indexed_documents": len(self.list_documents()),
            "chat_model": self.settings.chat_model,
            "embedding_model": self.settings.embedding_model,
        }

    def list_documents(self) -> list[dict[str, Any]]:
        manifest = self._load_manifest()
        return [self._public_document(entry) for entry in manifest["documents"]]

    def upload_files(self, uploads: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not uploads:
            raise ValueError("Select at least one file to upload.")

        saved_entries: list[dict[str, Any]] = []
        manifest = self._load_manifest()

        for upload in uploads:
            original_name = upload["filename"]
            content = upload["content"]

            if not content:
                raise ValueError(f"'{original_name}' is empty.")

            existing = next(
                (item for item in manifest["documents"] if item["name"] == original_name),
                None,
            )
            if existing:
                self.delete_document(existing["id"])
                manifest = self._load_manifest()

            document_id = uuid4().hex
            suffix = Path(original_name).suffix.lower()
            stored_name = f"{document_id}-{sanitize_filename(original_name)}"
            file_path = self.settings.upload_dir / stored_name
            file_path.write_bytes(content)

            raw_documents = load_documents(file_path)
            if not raw_documents:
                file_path.unlink(missing_ok=True)
                raise ValueError(f"No readable text found in '{original_name}'.")

            uploaded_at = datetime.now(UTC).isoformat()
            for document in raw_documents:
                document.metadata.update(
                    {
                        "document_id": document_id,
                        "document_name": original_name,
                        "extension": suffix,
                        "uploaded_at": uploaded_at,
                    }
                )

            chunks = self._splitter.split_documents(raw_documents)
            if not chunks:
                file_path.unlink(missing_ok=True)
                raise ValueError(f"Unable to chunk '{original_name}'.")

            chunk_ids = [f"{document_id}:{index}" for index in range(len(chunks))]
            self._get_vectorstore().add_documents(chunks, ids=chunk_ids)

            entry = {
                "id": document_id,
                "name": original_name,
                "extension": suffix,
                "size_bytes": len(content),
                "chunk_count": len(chunks),
                "uploaded_at": uploaded_at,
                "stored_name": stored_name,
                "chunk_ids": chunk_ids,
            }
            manifest["documents"].append(entry)
            saved_entries.append(self._public_document(entry))

        self._write_manifest(manifest)
        return saved_entries

    def delete_document(self, document_id: str) -> None:
        manifest = self._load_manifest()
        documents = manifest["documents"]
        target = next((item for item in documents if item["id"] == document_id), None)
        if not target:
            raise ValueError("Document not found.")

        chunk_ids = target.get("chunk_ids", [])
        if chunk_ids:
            self._get_vectorstore().delete(ids=chunk_ids)

        file_path = self.settings.upload_dir / target.get("stored_name", "")
        if file_path.exists():
            file_path.unlink()

        manifest["documents"] = [item for item in documents if item["id"] != document_id]
        self._write_manifest(manifest)

    def ask(self, message: str) -> dict[str, Any]:
        query = message.strip()
        if not query:
            raise ValueError("Message cannot be empty.")

        if not self.list_documents():
            return {
                "answer": "Upload at least one document before starting the chat.",
                "sources": [],
            }

        docs = self._get_vectorstore().similarity_search(query, k=self.settings.top_k)
        if not docs:
            return {"answer": "I couldn't find relevant context in the indexed files.", "sources": []}

        context_parts = []
        for index, document in enumerate(docs, start=1):
            source_name = document.metadata.get("document_name", "Unknown")
            page = document.metadata.get("page")
            sheet = document.metadata.get("sheet")
            locator = []
            if page:
                locator.append(f"page {page}")
            if sheet:
                locator.append(f"sheet {sheet}")
            locator_text = f" ({', '.join(locator)})" if locator else ""
            context_parts.append(
                f"[Source {index}: {source_name}{locator_text}]\n{document.page_content}"
            )

        prompt = (
            "You are a grounded document assistant.\n"
            "Answer only from the provided context.\n"
            "If the answer is not supported by the context, say you don't know.\n"
            "Keep answers concise, but include useful specifics when available.\n\n"
            f"Question:\n{query}\n\n"
            f"Context:\n{'\n\n'.join(context_parts)}"
        )

        response = self._get_llm().invoke(prompt)
        return {
            "answer": getattr(response, "content", str(response)).strip(),
            "sources": self._build_sources(docs),
        }

    def _get_embeddings(self) -> GoogleGenerativeAIEmbeddings:
        self._ensure_api_key()
        if self._embeddings is None:
            self._embeddings = GoogleGenerativeAIEmbeddings(
                model=self.settings.embedding_model,
                api_key=self.settings.google_api_key,
            )
        return self._embeddings

    def _get_llm(self) -> ChatGoogleGenerativeAI:
        self._ensure_api_key()
        if self._llm is None:
            self._llm = ChatGoogleGenerativeAI(
                model=self.settings.chat_model,
                temperature=0.2,
                api_key=self.settings.google_api_key,
            )
        return self._llm

    def _get_vectorstore(self) -> Chroma:
        if self._vectorstore is None:
            try:
                self._vectorstore = Chroma(
                    collection_name=self.settings.collection_name,
                    persist_directory=str(self.settings.chroma_dir),
                    embedding_function=self._get_embeddings(),
                )
            except Exception as exc:
                raise RuntimeError(
                    f"Unable to open the Chroma database at '{self.settings.chroma_dir}'."
                ) from exc
        return self._vectorstore

    def _build_sources(self, docs: list[Any]) -> list[dict[str, Any]]:
        seen: set[tuple[Any, ...]] = set()
        sources: list[dict[str, Any]] = []

        for document in docs:
            metadata = document.metadata
            key = (
                metadata.get("document_id"),
                metadata.get("page"),
                metadata.get("sheet"),
                metadata.get("row_range"),
            )
            if key in seen:
                continue
            seen.add(key)
            sources.append(
                {
                    "document_id": metadata.get("document_id", ""),
                    "document_name": metadata.get("document_name", "Unknown"),
                    "snippet": document.page_content[:220].strip(),
                    "page": metadata.get("page"),
                    "sheet": metadata.get("sheet"),
                    "row_range": metadata.get("row_range"),
                }
            )

        return sources

    def _ensure_api_key(self) -> None:
        if not self.settings.google_api_key:
            raise RuntimeError("GOOGLE_API_KEY is not set.")

    def _load_manifest(self) -> dict[str, Any]:
        path = self.settings.manifest_path
        if not path.exists():
            return {"documents": []}
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        data.setdefault("documents", [])
        return data

    def _write_manifest(self, manifest: dict[str, Any]) -> None:
        with self.settings.manifest_path.open("w", encoding="utf-8") as handle:
            json.dump(manifest, handle, indent=2)

    def _public_document(self, entry: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": entry["id"],
            "name": entry["name"],
            "extension": entry["extension"],
            "size_bytes": entry["size_bytes"],
            "chunk_count": entry["chunk_count"],
            "uploaded_at": entry["uploaded_at"],
        }
