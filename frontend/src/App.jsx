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
    "Welcome to Phoneme. I'm your AI workspace assistant. Upload your documents to the library, and I'll help you extract insights, summarize content, or answer specific questions based on your data.",
  sources: [],
};

const navigationItems = [
  {
    id: "upload",
    label: "Library",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
    ),
  },
  {
    id: "chat",
    label: "Assistant",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    ),
  },
];

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const fileInputRef = useRef(null);
  const chatViewportRef = useRef(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const [healthData, documentData] = await Promise.all([
          fetchHealth(),
          fetchDocuments(),
        ]);
        if (!cancelled) {
          setHealth(healthData);
          setDocuments(documentData);
        }
      } catch (err) {
        if (!cancelled) setError("System synchronization failed. Retrying...");
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (chatViewportRef.current) {
      chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
    }
  }, [messages, isSending, activeView]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredDocuments = useMemo(() => {
    if (!normalizedSearch) return documents;
    return documents.filter((doc) =>
      doc.name.toLowerCase().includes(normalizedSearch) || doc.extension.toLowerCase().includes(normalizedSearch)
    );
  }, [documents, normalizedSearch]);

  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDocuments.slice(start, start + itemsPerPage);
  }, [filteredDocuments, currentPage]);

  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);

  const filteredMessages = useMemo(() => {
    if (!normalizedSearch) return messages;
    return messages.filter((msg) => msg.content.toLowerCase().includes(normalizedSearch));
  }, [messages, normalizedSearch]);

  async function handleUpload(event) {
    event.preventDefault();
    if (!selectedFiles.length) return;
    setError("");
    setIsUploading(true);
    const count = selectedFiles.length;
    try {
      await uploadDocuments(selectedFiles);
      const [h, d] = await Promise.all([fetchHealth(), fetchDocuments()]);
      setHealth(h);
      setDocuments(d);
      setSelectedFiles([]);
      setIsModalOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotification({ message: `${count} document(s) successfully indexed.`, type: 'success' });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteDocument(id);
      const d = await fetchDocuments();
      setDocuments(d);
      showNotification("Document removed from library.");
    } catch (err) {
      setError("Deletion failed.");
    }
  }

  async function handleAsk(event) {
    event.preventDefault();
    const message = question.trim();
    if (!message || isSending) return;

    setError("");
    setIsSending(true);
    setQuestion("");
    setActiveView("chat");

    const userMsg = { id: `u-${Date.now()}`, role: "user", content: message };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await sendMessage(message);
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: response.answer,
        sources: response.sources,
      }]);
    } catch (err) {
      setError("AI service unavailable.");
    } finally {
      setIsSending(false);
    }
  }

  const activeNavigation = navigationItems.find(n => n.id === activeView);
  const initials = "AS";

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className="sidebar-shell">
        <div className="sidebar-brand">
          <img src="/logopng.png" alt="Phoneme" className="brand-logo" />
        </div>

        <p className="sidebar-caption">Workspace</p>
        <nav className="sidebar-nav">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeView === item.id ? "active" : ""}`}
              onClick={() => setActiveView(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 0.5rem' }}>
            <div className="avatar avatar-user" style={{ borderRadius: '12px' }}>{initials}</div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '700', whiteSpace: 'nowrap' }}>Arjun Singh</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--p-500)', fontWeight: '600' }}>Admin Account</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="content-shell">
        <header className="content-header">
          <div className="header-copy">
            <p className="section-label">Workspace</p>
            <h2>{activeNavigation?.label}</h2>
          </div>

          <div className="header-tools">
            <div className="search-field">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search resources..."
              />
            </div>

            <button className="btn-primary" onClick={() => { setError(""); setIsModalOpen(true); }} style={{ padding: '0.625rem 1.25rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add Document
            </button>

            <button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
              {theme === "dark" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="18.36" x2="5.64" y2="16.92"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
          </div>
        </header>

        <main className="content-main">
          {notification && (
            <div className={`notification notification-${notification.type} animate-up`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {notification.message}
            </div>
          )}
          {error && (
            <div style={{ background: 'var(--error)', color: 'white', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: '600', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {activeView === "upload" ? (
            <div className="animate-up" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              <div className="metrics-row">
                <div className="metric-card">
                  <label>Total Documents</label>
                  <span>{health?.indexed_documents ?? 0}</span>
                </div>
                <div className="metric-card">
                  <label>Knowledge Size</label>
                  <span>{formatFileSize(documents.reduce((s, d) => s + d.size_bytes, 0))}</span>
                </div>
                <div className="metric-card">
                  <label>AI Engine</label>
                  <span style={{ fontSize: '1.1rem' }}>GPT-4o Pro</span>
                </div>
                <div className="metric-card">
                  <label>System Health</label>
                  <span style={{ fontSize: '1.1rem', color: 'var(--accent)' }}>Operational</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="library-header-row">
                  <div className="card-title-group">
                    <p className="section-label">Library Inventory</p>
                    <h3>Manage Indexed Knowledge</h3>
                  </div>
                </div>
                
                {filteredDocuments.length > 0 ? (
                  <>
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Document Name</th>
                            <th>Type</th>
                            <th>Size</th>
                            <th>Knowledge Chunks</th>
                            <th>Indexed Date</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedDocuments.map((doc) => (
                            <tr key={doc.id}>
                              <td>
                                <div className="file-name-cell">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  {doc.name}
                                </div>
                              </td>
                              <td><span className="type-badge">{doc.extension.replace('.', '')}</span></td>
                              <td>{formatFileSize(doc.size_bytes)}</td>
                              <td><span style={{ fontWeight: 700 }}>{doc.chunk_count}</span></td>
                              <td>{formatDate(doc.uploaded_at)}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button className="btn-ghost" onClick={() => handleDelete(doc.id)}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="pagination-footer">
                        <p className="pagination-info">
                          Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredDocuments.length)}</strong> of <strong>{filteredDocuments.length}</strong> resources
                        </p>
                        <div className="pagination-actions">
                          <button 
                            className="btn-pagination" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                            Previous
                          </button>
                          
                          <div className="pagination-pages">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                              <button
                                key={page}
                                className={`btn-page ${currentPage === page ? 'active' : ''}`}
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </button>
                            ))}
                          </div>

                          <button 
                            className="btn-pagination" 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          >
                            Next
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="card" style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Your knowledge base is currently empty.</p>
                    <button className="btn-primary" onClick={() => { setError(""); setIsModalOpen(true); }} style={{ margin: '1.5rem auto 0' }}>Upload First Document</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="chat-container animate-up">
              <div ref={chatViewportRef} className="chat-messages">
                {filteredMessages.map((msg) => (
                  <div key={msg.id} className={`msg-wrapper ${msg.role}`}>
                    <div className={`avatar avatar-${msg.role === 'assistant' ? 'ai' : 'user'}`}>
                      {msg.role === 'assistant' ? 'AI' : initials}
                    </div>
                    <div className="msg-content">
                      <p className="msg-meta">{msg.role === 'assistant' ? 'Phoneme Assistant' : 'Arjun Singh'}</p>
                      <div className={`msg-bubble ${msg.role}`}>
                        {msg.content}
                        {msg.sources?.length > 0 && (
                          <div className="sources-list">
                            {msg.sources.map((src, i) => (
                              <div key={i} className="source-item">
                                <strong>{src.document_name}</strong>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>"{src.snippet.substring(0, 120)}..."</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="msg-wrapper assistant">
                    <div className="avatar avatar-ai">AI</div>
                    <div className="msg-content">
                      <p className="msg-meta">Phoneme Assistant</p>
                      <div className="msg-bubble assistant" style={{ display: 'flex', gap: '6px' }}>
                        <div className="dot" style={{ width: '6px', height: '6px', background: 'var(--brand)', borderRadius: '50%', animation: 'pulse 1.2s infinite' }} />
                        <div className="dot" style={{ width: '6px', height: '6px', background: 'var(--brand)', borderRadius: '50%', animation: 'pulse 1.2s infinite 0.2s' }} />
                        <div className="dot" style={{ width: '6px', height: '6px', background: 'var(--brand)', borderRadius: '50%', animation: 'pulse 1.2s infinite 0.4s' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="composer-area">
                <form className="composer-box" onSubmit={handleAsk}>
                  <textarea
                    placeholder="Type your question here... (Shift + Enter for new line)"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAsk(e);
                      }
                    }}
                  />
                  <button type="submit" className="btn-primary" disabled={isSending}>
                    {isSending ? "Processing..." : "Ask AI"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="card-title-group">
                <p className="section-label">Ingestion</p>
                <h3 style={{ fontSize: '1.25rem' }}>Upload Documents</h3>
              </div>
              <button className="btn-ghost" onClick={() => setIsModalOpen(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {error && (
                <div style={{ background: 'var(--error)', color: 'white', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: '600', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}
              <form onSubmit={handleUpload}>
                <label className="dropzone">
                  <div className="dropzone-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} style={{ display: 'none' }} />
                  <span className="dropzone-title">Click to upload or drag resources</span>
                  <span className="dropzone-copy">PDF, DOCX, TXT, MD, CSV, XLSX</span>
                </label>

                {selectedFiles.length > 0 && (
                  <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {selectedFiles.map((file, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                          <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{file.name}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatFileSize(file.size)}</span>
                        </div>
                      ))}
                    </div>
                    <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', justifyContent: 'center', width: '100%' }} disabled={isUploading}>
                      {isUploading ? "Syncing Knowledge..." : "Confirm & Ingest"}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 10px; }
      `}</style>
    </div>
  );
}
