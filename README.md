# RAG Studio

FastAPI backend and React frontend for a Gemini-powered RAG workflow with multi-file uploads and a grounded chat UI.

## Supported files

- `.pdf`
- `.docx`
- `.txt`
- `.md`
- `.csv`
- `.xlsx`

## Backend setup

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `GOOGLE_API_KEY` in your environment or `.env` loader of choice.

Run the API:

```powershell
uvicorn backend.app.main:app --reload
```

The API will start at `http://127.0.0.1:8000`.

## Frontend setup

```powershell
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://127.0.0.1:8000` by default. Override it with `VITE_API_BASE_URL` if needed.

For local development, Vite also proxies `/api` requests to `http://127.0.0.1:8000`.

## Available API routes

- `GET /api/health`
- `GET /api/documents`
- `POST /api/documents/upload`
- `DELETE /api/documents/{document_id}`
- `POST /api/chat`
