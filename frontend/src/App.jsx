import { useEffect, useMemo, useRef, useState } from "react";
import {
  createUser,
  deleteUser,
  deleteDocument,
  fetchDocuments,
  fetchHealth,
  sendMessage,
  uploadDocuments,
  loginUser,
  getUsers,
} from "./api";

const ACCEPTED_TYPES = ".pdf,.docx,.txt,.md,.csv,.xlsx";
const inputStyle = {
  width: "100%",
  padding: "12px",
  marginTop: "6px",
  borderRadius: "10px",
  border: "1px solid #2A2F3A",
  background: "#0B0F19",
  color: "#E5E7EB",
  fontSize: "14px",
  outline: "none"
};

const labelStyle = {
  fontSize: "12px",
  color: "#9CA3AF",
  fontWeight: "500"
};

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(localStorage.getItem("userRole"));
const isAdmin = role === "admin";

  // --- HE ITHE ADD KARA (Juna loginData ani handleLogin replace kara) ---
  const [loginData, setLoginData] = useState({ 
  email: "", 
  password: ""
});
  const [authError, setAuthError] = useState("");

  const handleLogin = async (e) => {
  e.preventDefault();
  setAuthError(""); 
  try {
    const res = await loginUser(loginData.email, loginData.password);

    if (res.status === "success") {
      setIsAuthenticated(true);

      // ✅ ADD THIS LINE
      localStorage.setItem("userEmail", res.email);
      if (res.status === "success") {
  setIsAuthenticated(true);

  localStorage.setItem("userEmail", res.email);
  localStorage.setItem("userRole", res.role);

  setRole(res.role);   // 🔥 THIS LINE FIXES YOUR PROBLEM
}   // 🔥 IMPORTANT
    }
  } catch (err) {
    setAuthError(err.message);
  }
};

  const [documents, setDocuments] = useState([]);
  const [health, setHealth] = useState(null);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [question, setQuestion] = useState("");
  const [search, setSearch] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
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
  const [showMenu, setShowMenu] = useState(false);
const [showProfile, setShowProfile] = useState(false);
const [newUser, setNewUser] = useState({
  email: "",
  password: ""
});
const [showInviteModal, setShowInviteModal] = useState(false);

const [inviteData, setInviteData] = useState({
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "user"
});

const [users, setUsers] = useState([]);
const [profileData, setProfileData] = useState({
  newPassword: "",
  confirmPassword: ""
});

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
  useEffect(() => {
  async function loadUsers() {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  }

  if (isAdmin) loadUsers();
}, [isAdmin]);

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
  const email = localStorage.getItem("userEmail");
  const initials = "AS";
  
return (
    <div className="app-shell" data-theme={theme}>
      {!isAuthenticated ? (
        /* --- LOGIN SCREEN (Exactly Centered) --- */
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh', 
          width: '100vw',
          background: '#000000', // Purn background black
          position: 'fixed',
          top: 0,
          left: 0
        }}>
          <div className="login-card animate-up" style={{ 
            width: '100%', 
            maxWidth: '380px', 
            padding: '2.5rem', 
            borderRadius: '1.5rem', 
            background: '#111111', // Card cha thoda dark grey/black shade
            border: '1px solid #222',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>
            {/* --- CUSTOM PHONEME LOGO --- */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ 
                fontSize: '2.5rem', 
                fontWeight: '900', 
                letterSpacing: '-1.5px', 
                margin: 0,
                color: '#FFFFFF',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textTransform: 'uppercase'
              }}>
                <img src="/logopng.png" alt="Phoneme" className="brand-logo" />
              </h1>
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#888', marginBottom: '2rem' }}>
              Workspace Login
            </h3>
            
            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
  {/* Email Input */}
  <input 
    type="email" 
    placeholder="Email Address" 
    value={loginData.email}
    onChange={(e) => setLoginData({...loginData, email: e.target.value})}
    style={{ width: '100%', padding: '0.9rem', borderRadius: '0.75rem', border: '1px solid #333', background: '#1a1a1a', color: '#fff', outline: 'none' }}
    required 
  />

  {/* Password Input */}
  <input 
    type="password" 
    placeholder="Password" 
    value={loginData.password}
    onChange={(e) => setLoginData({...loginData, password: e.target.value})}
    style={{ width: '100%', padding: '0.9rem', borderRadius: '0.75rem', border: '1px solid #333', background: '#1a1a1a', color: '#fff', outline: 'none' }}
    required 
  />

  {/* Role Dropdown */}
  <div style={{ textAlign: 'left' }}>
    <label style={{ color: '#666', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>Login As</label>
    
  </div>

  <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.9rem', borderRadius: '0.75rem', background: '#5D5FEF', color: 'white', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
    Sign In
  </button>
</form></div>
        </div>
      ) : (
        /* --- MAIN CONTENT (Dashboard) --- */
        <>
          <aside className="sidebar-shell">
            <div className="sidebar-brand" style={{ padding: '1.5rem' }}>
               <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff', margin: 0, textTransform: 'uppercase' }}>
                <img src="/logopng.png" alt="Phoneme" className="brand-logo" />

              </h2>
            </div>

            <p className="sidebar-caption" style={{ padding: '0 1.5rem', color: '#555', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Workspace</p>
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
              {isAdmin && (
  <button
    className="nav-item"
    onClick={() => setActiveView("admin")}
  >
    👨‍💼 User Management
  </button>
)}
            </nav>

            <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid #222' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
  <div 
    className="avatar"
    onClick={() => setShowMenu(!showMenu)}
    style={{ cursor: 'pointer', background: '#5D5FEF', color: '#fff', width: '35px', height: '35px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
  >
    {email?.charAt(0).toUpperCase()}
  </div>

  {showMenu && (
    <div style={{
      position: 'absolute',
      bottom: '45px',
      right: '0',
      background: '#111',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '10px'
    }}>
      <button onClick={() => {
        setActiveView("profile");
        setShowMenu(false);
      }}>
        👤 Profile
      </button>

      <button onClick={() => {
        setIsAuthenticated(false);
        localStorage.clear();
      }}>
        🚪 Logout
      </button>
    </div>
  )}
</div>
                <div style={{ overflow: 'hidden' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fff', margin: 0 }}>
  {email}
</p>
                  
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
              )}{activeView === "admin" && isAdmin ? (
  <div style={{ padding: "30px", color: "#fff" }}>
    
    {/* HEADER */}
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "20px"
    }}>
      <h2 style={{ fontSize: "22px" }}>User Management</h2>

      <button
        onClick={() => setShowInviteModal(true)}
        style={{
          background: "#5D5FEF",
          color: "#fff",
          border: "none",
          padding: "8px 15px",
          borderRadius: "6px",
          cursor: "pointer"
        }}
      >
        ➕ Invite User
      </button>
    </div>

    {/* USER TABLE */}
    <div style={{
      background: "#111",
      padding: "20px",
      borderRadius: "10px",
      border: "1px solid #222"
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
            <th style={{ padding: "10px" }}>Email</th>
            <th style={{ padding: "10px" }}>Role</th>
            <th style={{ padding: "10px" }}>Action</th>
          </tr>
        </thead>

        <tbody>
          {users.map((u) => (
            <tr key={u.email} style={{ borderBottom: "1px solid #222" }}>
              
              <td style={{ padding: "10px" }}>{u.email}</td>

              <td style={{ padding: "10px" }}>
                <span style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background:
                    u.role === "admin"
                      ? "#ef4444"
                      : u.role === "editor"
                      ? "#3b82f6"
                      : "#10b981",
                  fontSize: "12px"
                }}>
                  {u.role}
                </span>
              </td>

              <td style={{ padding: "10px" }}>
                <button
                  onClick={async () => {
                    if (window.confirm("Delete this user?")) {
                      await deleteUser(u.email);
                      setUsers(users.filter(user => user.email !== u.email));
                    }
                  }}
                  style={{
                    background: "transparent",
                    color: "#ef4444",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  ❌ Delete
                </button>
              </td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>

  </div>
) : activeView === "profile" ? (

  <div style={{ padding: "20px", color: "#fff", maxWidth: "400px" }}>
    <h2>👤 My Profile</h2>

    <p style={{ marginTop: "10px" }}>
      <b>Email:</b> {email}
    </p>

    <input
      type="password"
      placeholder="New Password"
      value={profileData.newPassword}
      onChange={(e) =>
        setProfileData({ ...profileData, newPassword: e.target.value })
      }
      style={{ marginTop: "10px", width: "100%", padding: "8px" }}
    />

    <input
      type="password"
      placeholder="Confirm Password"
      value={profileData.confirmPassword}
      onChange={(e) =>
        setProfileData({ ...profileData, confirmPassword: e.target.value })
      }
      style={{ marginTop: "10px", width: "100%", padding: "8px" }}
    />

    <button
      style={{ marginTop: "10px" }}
      onClick={() => {
        if (profileData.newPassword !== profileData.confirmPassword) {
          alert("Passwords do not match ❌");
          return;
        }

        alert("Password Updated ✅ (API connect karaycha aahe)");
      }}
    >
      🔑 Update Password
    </button>
  </div>
) : activeView === "upload" ? (

              
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="composer-area">
                    <form className="composer-box" onSubmit={handleAsk}>
                      <textarea
                        placeholder="Type your question here..."
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
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
        </>
      )}

      {/* --- MODALS --- */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem' }}>Upload Documents</h3>
              <button className="btn-ghost" onClick={() => setIsModalOpen(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpload}>
                <label className="dropzone">
                  <input ref={fileInputRef} type="file" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} style={{ display: 'none' }} />
                  <span className="dropzone-title">Click to upload or drag resources</span>
                </label>
                {selectedFiles.length > 0 && (
                  <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>
                    {isUploading ? "Syncing..." : "Confirm & Ingest"}
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
      {/* ✅👉 इथे Invite Modal add कर */}
{showInviteModal && (
  <div className="modal-overlay">
    <div style={{
      background: "#111827",
      padding: "28px",
      borderRadius: "16px",
      width: "380px",
      border: "1px solid #1F2937",
      boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
    }}>

      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ color: "#fff", margin: 0 }}>Invite User</h2>
        <p style={{ color: "#9CA3AF", fontSize: "13px" }}>
          Add a new user to your workspace
        </p>
      </div>

      {/* Name */}
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Full Name</label>
        <input
          placeholder="Enter full name"
          value={inviteData.name}
          onChange={(e) =>
            setInviteData({ ...inviteData, name: e.target.value })
          }
          style={inputStyle}
        />
      </div>

      {/* Email */}
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Email Address</label>
        <input
          placeholder="Enter email"
          value={inviteData.email}
          onChange={(e) =>
            setInviteData({ ...inviteData, email: e.target.value })
          }
          style={inputStyle}
        />
      </div>

      {/* Password */}
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>New Password</label>
        <input
          type="password"
          placeholder="Create password"
          value={inviteData.password}
          onChange={(e) =>
            setInviteData({ ...inviteData, password: e.target.value })
          }
          style={inputStyle}
        />
      </div>

      {/* Confirm Password */}
      <div style={{ marginBottom: "18px" }}>
        <label style={labelStyle}>Confirm Password</label>
        <input
          type="password"
          placeholder="Re-enter password"
          value={inviteData.confirmPassword}
          onChange={(e) =>
            setInviteData({ ...inviteData, confirmPassword: e.target.value })
          }
          style={inputStyle}
        />
      </div>

      {/* Role */}
      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>Role</label>

        <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
          <div
            onClick={() => setInviteData({ ...inviteData, role: "user" })}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "10px",
              textAlign: "center",
              cursor: "pointer",
              border: inviteData.role === "user"
                ? "2px solid #5D5FEF"
                : "1px solid #2A2F3A",
              background: inviteData.role === "user"
                ? "rgba(93,95,239,0.2)"
                : "transparent",
              color: "#fff",
              fontWeight: "600"
            }}
          >
            👤 User
          </div>

          <div
            onClick={() => setInviteData({ ...inviteData, role: "admin" })}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "10px",
              textAlign: "center",
              cursor: "pointer",
              border: inviteData.role === "admin"
                ? "2px solid #5D5FEF"
                : "1px solid #2A2F3A",
              background: inviteData.role === "admin"
                ? "rgba(93,95,239,0.2)"
                : "transparent",
              color: "#fff",
              fontWeight: "600"
            }}
          >
            👨‍💼 Admin
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={() => setShowInviteModal(false)}
          style={{
            flex: 1,
            background: "transparent",
            border: "1px solid #2A2F3A",
            color: "#9CA3AF",
            padding: "10px",
            borderRadius: "10px"
          }}
        >
          Cancel
        </button>

        <button
          onClick={async () => {
            if (
              !inviteData.name ||
              !inviteData.email ||
              !inviteData.password ||
              !inviteData.confirmPassword
            ) {
              alert("All fields required ❌");
              return;
            }

            if (inviteData.password !== inviteData.confirmPassword) {
              alert("Password mismatch ❌");
              return;
            }

            try {
              await createUser(
                inviteData.email,
                inviteData.password,
                inviteData.role,
                inviteData.name
              );

              alert("User created ✅");
              setShowInviteModal(false);

            } catch (err) {
              alert(err.message);
            }
          }}
          style={{
            flex: 1,
            background: "#5D5FEF",
            border: "none",
            color: "#fff",
            padding: "10px",
            borderRadius: "10px",
            fontWeight: "600"
          }}
        >
          Invite
        </button>
      </div>

    </div>
  </div>
)}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
        .animate-up { animation: slideUp 0.3s ease-out; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}