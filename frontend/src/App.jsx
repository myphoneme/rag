import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteDocument,
  fetchDocuments,
  fetchHealth,
  sendMessage,
  uploadDocuments,
} from "./api";

const ACCEPTED_TYPES = ".pdf,.docx,.txt,.md,.csv,.xlsx";

const welcomeMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Welcome to Phoneme. Upload your files, build a searchable knowledge base, and ask grounded questions from one workspace.",
  sources: [],
};

const navigationItems = [
  {
    id: "upload",
    label: "Upload Documents",
    shortLabel: "Upload",
  },
  {
    id: "chat",
    label: "Chat Assistant",
    shortLabel: "Chat",
  },
];

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatSourceMeta(source) {
  const parts = [];
  if (source.page) parts.push(`Page ${source.page}`);
  if (source.sheet) parts.push(`Sheet ${source.sheet}`);
  if (source.row_range) parts.push(`Rows ${source.row_range}`);
  return parts.join(" - ");
}

function getProfileInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [health, setHealth] = useState(null);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [question, setQuestion] = useState("");
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState("upload");
  const [theme, setTheme] = useState("dark");
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState("Connecting to backend...");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const chatViewportRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [healthData, documentData] = await Promise.all([
          fetchHealth(),
          fetchDocuments(),
        ]);

        if (cancelled) {
          return;
        }

        setHealth(healthData);
        setDocuments(documentData);
        setStatus("Backend connected.");
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setStatus("Backend unavailable.");
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!chatViewportRef.current) {
      return;
    }
    chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
  }, [messages, isSending, activeView]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredDocuments = useMemo(() => {
    if (!normalizedSearch) {
      return documents;
    }

    return documents.filter((document) =>
      [document.name, document.extension, formatDate(document.uploaded_at)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [documents, normalizedSearch]);

  const filteredMessages = useMemo(() => {
    if (!normalizedSearch) {
      return messages;
    }

    return messages.filter((message) => {
      const sourceText = (message.sources || [])
        .map((source) =>
          [source.document_name, source.snippet, formatSourceMeta(source)].join(" "),
        )
        .join(" ");

      return [message.content, message.role, sourceText]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [messages, normalizedSearch]);

  async function refreshDocuments() {
    const [healthData, documentData] = await Promise.all([
      fetchHealth(),
      fetchDocuments(),
    ]);
    setHealth(healthData);
    setDocuments(documentData);
  }

  async function handleUpload(event) {
    event.preventDefault();
    setError("");

    if (!selectedFiles.length) {
      setError("Choose at least one file to upload.");
      return;
    }

    try {
      setIsUploading(true);
      const result = await uploadDocuments(selectedFiles);
      await refreshDocuments();
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setStatus(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(documentId) {
    setError("");
    try {
      await deleteDocument(documentId);
      await refreshDocuments();
      setStatus("Document removed.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAsk(event) {
    event.preventDefault();
    const message = question.trim();
    if (!message || isSending) {
      return;
    }

    setError("");
    setIsSending(true);
    setQuestion("");
    setActiveView("chat");

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      sources: [],
    };

    setMessages((current) => [...current, userMessage]);

    try {
      const response = await sendMessage(message);
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.answer,
        sources: response.sources,
      };
      setMessages((current) => [...current, assistantMessage]);
      setStatus("Response ready.");
    } catch (err) {
      setError(err.message);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content:
            "I couldn't complete that request. Check the backend configuration and try again.",
          sources: [],
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  const totalStorage = documents.reduce((sum, document) => sum + document.size_bytes, 0);
  const userName = "Arjun Singh";
  const activeNavigation = navigationItems.find((item) => item.id === activeView);

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className="sidebar-shell">
        <div className="sidebar-brand">
          <img src="/logopng.png" alt="Phoneme logo" className="brand-logo" />
        </div>

        <div className="sidebar-section">
          <p className="sidebar-caption">Main Menu</p>
          <nav className="sidebar-nav" aria-label="Primary">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${activeView === item.id ? "active" : ""}`}
                onClick={() => setActiveView(item.id)}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.id === "upload" ? "U" : "C"}
                </span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="content-shell">
        <header className="content-header">
          <div className="header-copy">
            <p className="section-label">Knowledge Workspace</p>
            <h2>{activeNavigation?.label}</h2>
          </div>

          <div className="header-tools">
            <label className="search-field">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10.5 4a6.5 6.5 0 1 0 4.09 11.55l4.43 4.42 1.41-1.41-4.42-4.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search documents or chat history"
              />
            </label>

            <div className="header-chip-row">
              <span className="header-chip">Docs {health?.indexed_documents ?? 0}</span>
            </div>

            <button
              type="button"
              className="theme-toggle"
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        <main className="content-main">
          {activeView === "upload" ? (
            <>
              <section className="section-frame">
                <div className="section-header">
                  <div>
                    <p className="section-label">Upload Center</p>
                    <h3>Ingest documents and monitor the indexing workspace.</h3>
                  </div>
                  <span className="section-chip">Ready</span>
                </div>

                <div className="upload-layout">
                  <div className="panel-block">
                    <div className="block-header">
                      <div>
                        <p className="block-kicker">File Intake</p>
                        <h4>Upload Documents</h4>
                      </div>
                    </div>

                    <form onSubmit={handleUpload} className="upload-form">
                      <label className="dropzone">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={ACCEPTED_TYPES}
                          multiple
                          onChange={(event) =>
                            setSelectedFiles(Array.from(event.target.files || []))
                          }
                        />
                        <span className="dropzone-title">Drop files here or browse</span>
                        <span className="dropzone-copy">
                          Supported: PDF, DOCX, TXT, Markdown, CSV, and Excel.
                        </span>
                      </label>

                      {selectedFiles.length ? (
                        <ul className="file-list">
                          {selectedFiles.map((file) => (
                            <li key={`${file.name}-${file.size}`}>
                              <div>
                                <strong>{file.name}</strong>
                                <small>{formatFileSize(file.size)}</small>
                              </div>
                              <span className="file-tag">Queued</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">No files selected yet.</p>
                      )}

                      <button
                        type="submit"
                        className="primary-button"
                        disabled={isUploading}
                      >
                        {isUploading ? "Indexing..." : "Upload and Index"}
                      </button>
                    </form>
                  </div>

                  <div className="panel-block stats-block">
                    <div className="block-header">
                      <div>
                        <p className="block-kicker">Workspace Metrics</p>
                        <h4>Operational Snapshot</h4>
                      </div>
                    </div>

                    <div className="stats-grid">
                      <div className="stat-tile">
                        <span>Indexed documents</span>
                        <strong>{health?.indexed_documents ?? 0}</strong>
                      </div>
                      <div className="stat-tile">
                        <span>Total storage</span>
                        <strong>{formatFileSize(totalStorage)}</strong>
                      </div>
                      <div className="stat-tile">
                        <span>Chat model</span>
                        <strong>{health?.chat_model ?? "Unavailable"}</strong>
                      </div>
                      <div className="stat-tile">
                        <span>Embedding</span>
                        <strong>{health?.embedding_model ?? "Unavailable"}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="section-frame">
                <div className="section-header">
                  <div>
                    <p className="section-label">Indexed Files</p>
                    <h3>Document library</h3>
                  </div>
                  <span className="section-chip">{filteredDocuments.length} shown</span>
                </div>

                {filteredDocuments.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Size</th>
                          <th>Chunks</th>
                          <th>Uploaded</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDocuments.map((document) => (
                          <tr key={document.id}>
                            <td className="cell-strong">{document.name}</td>
                            <td>{document.extension}</td>
                            <td>{formatFileSize(document.size_bytes)}</td>
                            <td>{document.chunk_count}</td>
                            <td>{formatDate(document.uploaded_at)}</td>
                            <td>
                              <button
                                type="button"
                                className="ghost-button compact"
                                onClick={() => handleDelete(document.id)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-card">
                    <strong>
                      {documents.length
                        ? "No documents match your search"
                        : "No documents indexed"}
                    </strong>
                    <p>
                      {documents.length
                        ? "Adjust the search field to view more records."
                        : "Upload your first set of files to activate the workspace."}
                    </p>
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="section-frame">
                <div className="section-header">
                  <div>
                    <p className="section-label">Chat Console</p>
                    <h3>Grounded conversation with indexed documents.</h3>
                  </div>
                  <span className="section-chip">Live</span>
                </div>

                <div className="stats-grid">
                  <div className="stat-tile">
                    <span>Visible messages</span>
                    <strong>{filteredMessages.length}</strong>
                  </div>
                  <div className="stat-tile">
                    <span>Indexed documents</span>
                    <strong>{health?.indexed_documents ?? 0}</strong>
                  </div>
                  <div className="stat-tile">
                    <span>Status</span>
                    <strong>{status}</strong>
                  </div>
                  <div className="stat-tile">
                    <span>Search mode</span>
                    <strong>{normalizedSearch ? "Filtered" : "Full history"}</strong>
                  </div>
                </div>
              </section>

              <section className="section-frame chat-frame">
                <div className="section-header">
                  <div>
                    <p className="section-label">Conversation Window</p>
                    <h3>Ask your documents</h3>
                  </div>
                </div>

                <div ref={chatViewportRef} className="chat-stream">
                  {filteredMessages.map((message) => (
                    <article key={message.id} className={`message message-${message.role}`}>
                      <div className="message-role">
                        {message.role === "assistant" ? "Phoneme AI" : "You"}
                      </div>
                      <div className="message-bubble">
                        <p>{message.content}</p>
                        {message.sources?.length ? (
                          <div className="source-grid">
                            {message.sources.map((source, index) => (
                              <div
                                key={`${message.id}-${source.document_id}-${index}`}
                                className="source-card"
                              >
                                <strong>{source.document_name}</strong>
                                <span>{source.snippet}</span>
                                {formatSourceMeta(source) ? (
                                  <small>{formatSourceMeta(source)}</small>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}

                  {!filteredMessages.length ? (
                    <div className="empty-card">
                      <strong>No chat messages match your search</strong>
                      <p>Use a broader search term or start a new question.</p>
                    </div>
                  ) : null}

                  {isSending ? (
                    <article className="message message-assistant">
                      <div className="message-role">Phoneme AI</div>
                      <div className="message-bubble typing">
                        <span />
                        <span />
                        <span />
                      </div>
                    </article>
                  ) : null}
                </div>

                <form onSubmit={handleAsk} className="composer">
                  <textarea
                    rows="3"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask a grounded question about the uploaded files..."
                  />
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isSending}
                  >
                    {isSending ? "Thinking..." : "Send"}
                  </button>
                </form>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
