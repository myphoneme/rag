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
  updatePassword,
  updateProfile,
  updateUser,
} from "./api";
import { RiDeleteBin3Fill } from "react-icons/ri";
import { MdModeEdit } from "react-icons/md";

const ACCEPTED_TYPES = ".pdf,.docx,.txt,.md,.csv,.xlsx";
const inputStyle = {
  width: "100%",
  padding: "12px",
  marginTop: "6px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--bg-main)",
  color: "var(--text-main)",
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
  const [role, setRole] = useState("");
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

      localStorage.setItem("userEmail", res.email);
      localStorage.setItem("userRole", res.role);
      localStorage.setItem("userName", res.name);

      setRole(res.role);
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
  const activeNavigation = navigationItems.find(
  (item) => item.id === activeView
);
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
const [showEditModal, setShowEditModal] = useState(false);

const [editUser, setEditUser] = useState({
  name: "",
  email: "",
  password: "",
  role: "user"
});
const [profileData, setProfileData] = useState({
  name: localStorage.getItem("userName") || "",
  newPassword: "",
  confirmPassword: ""
});
useEffect(() => {
  const savedEmail = localStorage.getItem("userEmail");
  const savedRole = localStorage.getItem("userRole");

  if (savedEmail && savedRole) {
    setIsAuthenticated(true);
    setRole(savedRole);
  }
}, []);
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

  const email = localStorage.getItem("userEmail");
const username = email?.split("@")[0];

const userName = localStorage.getItem("userName") || "";
const initials = userName
  .split(" ")
  .map(word => word[0])
  .join("")
  .toUpperCase()
  .slice(0, 2);
  
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
  
    
  </div>

  <button
  type="submit"
  className="btn-primary"
  style={{
    width: "180px",
    padding: "0.9rem",
    borderRadius: "0.75rem",
    background: "#5D5FEF",
    color: "white",
    fontWeight: "700",
    border: "none",
    cursor: "pointer",
    display: "block",
    margin: "0 auto"
  }}
>
  Login
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
    bottom: '50px',
    left: '0',
    width: '200px',
    background: '#0F172A',
    border: '1px solid #1F2937',
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
    overflow: 'hidden',
    zIndex: 100
  }}>

    {/* USER INFO */}
    <div style={{
      padding: '12px',
      borderBottom: '1px solid #1F2937'
    }}>
      <p style={{ color: '#fff', fontSize: '13px', margin: 0 }}>
        {email}
      </p>
      <p style={{ color: '#9CA3AF', fontSize: '11px', margin: 0 }}>
        {role}
      </p>
    </div>

    {/* PROFILE */}
    <button
      onClick={() => {
        setActiveView("profile");
        setShowMenu(false);
      }}
      style={{
        width: '100%',
        padding: '10px',
        background: 'transparent',
        border: 'none',
        color: '#E5E7EB',
        textAlign: 'left',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => e.target.style.background = '#1F2937'}
      onMouseLeave={(e) => e.target.style.background = 'transparent'}
    >
      👤 Profile Settings
    </button>

    {/* LOGOUT */}
    <button
      onClick={() => {
  localStorage.removeItem("userEmail");
localStorage.removeItem("userRole");

setIsAuthenticated(false);
setRole("");

showNotification("Logged out successfully 👋", "success");
}}
      style={{
        width: '100%',
        padding: '10px',
        background: 'transparent',
        border: 'none',
        color: '#EF4444',
        textAlign: 'left',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => e.target.style.background = 'rgba(239,68,68,0.1)'}
      onMouseLeave={(e) => e.target.style.background = 'transparent'}
    >
      🚪 Logout
    </button>

  </div>
)}
</div>
                <div style={{ overflow: 'hidden' }}>
                  <p
  style={{
    fontSize: "0.85rem",
    fontWeight: "700",
    color: "var(--text-main)",
    margin: 0
  }}
>
  {localStorage.getItem("userName")}
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
  <div style={{ padding: "30px", color: "var(--text-main)" }}>
    
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
        ➕ Add User
      </button>
    </div>

    {/* USER TABLE */}
    <div style={{
  background: "var(--bg-card)",
  padding: "20px",
  borderRadius: "10px",
  border: "1px solid var(--border)"
}}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
    <th style={{ padding: "10px", width: "60px" }}>#</th>
    <th style={{ padding: "10px" }}>Name / Email ID</th>
    <th style={{ padding: "10px" }}>Role</th>
    <th style={{ padding: "10px" }}>Actions</th>
  </tr>
</thead>
<tbody>
  {users.map((u, index) => (
    <tr key={u.email} style={{ borderBottom: "1px solid var(--border)" }}>

      {/* Serial Number */}
      <td style={{ padding: "10px", fontWeight: "600" }}>
        {index + 1}
      </td>

      {/* Name + Email */}
      <td style={{ padding: "10px" }}>
        <div style={{
          fontWeight: "700",
          fontSize: "15px",
          color: "var(--text-main)"
        }}>
          {u.name}
        </div>

        <div style={{
          fontSize: "13px",
          color: "#9CA3AF",
          marginTop: "4px"
        }}>
          {u.email}
        </div>
      </td>

      {/* Role */}
      <td style={{ padding: "10px" }}>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: "6px",
            background: u.role === "admin" ? "#ef4444" : "#10b981",
            color: "#fff",
            fontSize: "12px"
          }}
        >
          {u.role}
        </span>
      </td>

      {/* Actions */}
      <td style={{ padding: "10px" }}>
        <button
          onClick={() => {
            setEditUser({
              name: u.name,
              email: u.email,
              password: "",
              role: u.role
            });
            setShowEditModal(true);
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "#3B82F6",
            fontSize: "18px",
            marginRight: "10px",
            cursor: "pointer"
          }}
        >
          <MdModeEdit />
        </button>

        <button
          onClick={async () => {
            await deleteUser(u.email);
            const data = await getUsers();
            setUsers(data);
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "#EF4444",
            fontSize: "18px",
            cursor: "pointer"
          }}
        >
          <RiDeleteBin3Fill />
        </button>
      </td>

    </tr>
  ))}
</tbody>
      </table>
    </div>

  </div>
) : activeView === "profile" ? (

<div style={{
  maxWidth: "420px",
  margin: "40px auto",
  background: "var(--bg-card)",
  padding: "25px",
  borderRadius: "16px",
  border: "1px solid var(--border)"
}}>

  <h2 style={{ color: "var(--text-main)", marginBottom: "20px" }}>👤 Profile Settings</h2>
  {/* NAME */}
<div style={{ marginBottom: "15px" }}>
  <label style={labelStyle}>Full Name</label>
  <input
    value={profileData.name}
    onChange={(e) =>
      setProfileData({ ...profileData, name: e.target.value })
    }
    style={inputStyle}
  />
</div>

  {/* EMAIL */}
  <div style={{ marginBottom: "15px" }}>
    <label style={labelStyle}>Email</label>
    <input value={email} disabled style={inputStyle} />
  </div>

  {/* NEW PASSWORD */}
  <div style={{ marginBottom: "15px" }}>
    <label style={labelStyle}>New Password</label>
    <input
      type="password"
      value={profileData.newPassword}
      onChange={(e) =>
        setProfileData({ ...profileData, newPassword: e.target.value })
      }
      style={inputStyle}
    />
  </div>

  {/* CONFIRM PASSWORD */}
  <div style={{ marginBottom: "20px" }}>
    <label style={labelStyle}>Confirm Password</label>
    <input
      type="password"
      value={profileData.confirmPassword}
      onChange={(e) =>
        setProfileData({ ...profileData, confirmPassword: e.target.value })
      }
      style={inputStyle}
    />
  </div>

  <button
  onClick={async () => {
    try {
      // 👉 name update
      await updateProfile(email, profileData.name);

      // 👉 password update (optional)
      if (profileData.newPassword) {
        if (profileData.newPassword !== profileData.confirmPassword) {
          alert("Passwords do not match ❌");
          return;
        }

        await updatePassword(email, profileData.newPassword);
      }

      localStorage.setItem("userName", profileData.name);

      showNotification("Profile updated successfully ✅", "success");

      setProfileData({
        name: profileData.name,
        newPassword: "",
        confirmPassword: ""
      });

    } catch (err) {
      alert(err.message);
    }
  }}
  style={{
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    background: "#5D5FEF",
    color: "#fff",
    border: "none"
  }}
>
  💾 Save Changes
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
                                <th style={{ textAlign: 'right' }}>Actions</th>
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
                          <p className="msg-meta">
  {msg.role === 'assistant' ? 'Phoneme Assistant' : username}
</p>
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
      background: "var(--bg-card)",
      padding: "28px",
      borderRadius: "16px",
      width: "380px",
      border: "1px solid var(--border)",
      boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
    }}>

      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ color: "var(--text-main)", margin: 0 }}>Create User</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
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
              color: inviteData.role === "user"
  ? "#5D5FEF"
  : "var(--text-main)",
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
              background: inviteData.role === "user"
  ? "rgba(93,95,239,0.15)"
  : "var(--bg-main)",
              color: inviteData.role === "admin"
  ? "#5D5FEF"
  : "var(--text-main)",
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
              showNotification("All fields are required ❌", "error");
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
              const updatedUsers = await getUsers();
setUsers(updatedUsers);

              showNotification("User created successfully ✅", "success");
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
          Add user
        </button>
      </div>

    </div>
  </div>
)}
{showEditModal && (
  <div className="modal-overlay">
    <div style={{
      background: "var(--bg-card)",
      padding: "28px",
      borderRadius: "16px",
      width: "380px",
      border: "1px solid var(--border)",
      boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
    }}>

      <h2 style={{ color: "var(--text-main)", marginBottom: "10px" }}>
        Update User
      </h2>

      {/* NAME */}
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Full Name</label>
        <input
          value={editUser.name}
          onChange={(e) =>
            setEditUser({ ...editUser, name: e.target.value })
          }
          style={inputStyle}
        />
      </div>

      {/* EMAIL */}
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Email</label>
        <input value={editUser.email} disabled style={inputStyle} />
      </div>

      {/* PASSWORD */}
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>New Password</label>
        <input
          type="password"
          placeholder="Leave blank to keep same password"
          value={editUser.password}
          onChange={(e) =>
            setEditUser({ ...editUser, password: e.target.value })
          }
          style={inputStyle}
        />
      </div>

      {/* ROLE */}
      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>Role</label>

        <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
          <div
            onClick={() => setEditUser({ ...editUser, role: "user" })}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "10px",
              textAlign: "center",
              cursor: "pointer",
              border: editUser.role === "user"
                ? "2px solid #5D5FEF"
                : "1px solid #2A2F3A",
            }}
          >
            👤 User
          </div>

          <div
            onClick={() => setEditUser({ ...editUser, role: "admin" })}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "10px",
              textAlign: "center",
              cursor: "pointer",
              border: editUser.role === "admin"
                ? "2px solid #5D5FEF"
                : "1px solid #2A2F3A",
            }}
          >
            👨‍💼 Admin
          </div>
        </div>
      </div>

      {/* BUTTONS */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={() => setShowEditModal(false)}
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
            try {
              await updateUser(editUser);

              // 🔥 refresh after update
              const updatedUsers = await getUsers();
              setUsers(updatedUsers);

              showNotification("User updated successfully ", "success");
              setShowEditModal(false);

            } catch (err) {
              showNotification("Update failed ❌", "error");
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
          Save Changes
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