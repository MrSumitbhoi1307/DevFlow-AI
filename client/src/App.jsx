import { useState } from 'react'
import './App.css'
import AuthPage from './AuthPage.jsx'
import LandingPage from './LandingPage.jsx'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import ProjectsPage from './ProjectsPage.jsx'
import './ProjectsPage.css'
import AdminUsersPage from './AdminUsersPage.jsx'
import IssuesPage from './IssuesPage.jsx'
import DashboardPage from './DashboardPage.jsx'
import AuditLogsPage from './AuditLogsPage.jsx'
import TeamManagementPage from './TeamManagementPage.jsx'
import ApiTesterPage from './ApiTesterPage.jsx'
import CodeReviewPage from './CodeReviewPage.jsx'

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  issues: 'Issues',
  team: 'Team',
  api: 'API Tester',
  review: 'Code Review',
  'admin-users': 'Admin Users',
  'audit-logs': 'Audit Logs',
}

function NavIcon({ name }) {
  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
    projects: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" /><path d="M3 10h18" /></>,
    issues: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    team: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-1.2A4.8 4.8 0 0 1 8.3 13h1.4a4.8 4.8 0 0 1 4.8 4.8V19z" /><path d="M16 5.4a3 3 0 0 1 0 5.8M17 13a4.8 4.8 0 0 1 3.5 4.6V19" /></>,
    api: <><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" /></>,
    review: <><path d="m12 3 2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>,
    admin: <><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    audit: <><path d="M5 4h14v17H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24">{icons[name]}</svg>
}

function initialsFor(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
}

function Workspace() {
  const { user, loading, logout } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [authMode, setAuthMode] = useState(null)

  function navigate(event, page) {
    event.preventDefault()
    setActivePage(page)
    setMenuOpen(false)
    window.history.replaceState(null, '', `#${page}`)
  }

  function handleLogout() {
    setAuthMode(null)
    logout()
  }

  if (loading) return <main className="app-status"><p role="status">Checking your session…</p></main>

  if (!user) {
    return authMode
      ? <AuthPage initialMode={authMode} onHome={() => setAuthMode(null)} />
      : <LandingPage onLogin={() => setAuthMode('login')} onRegister={() => setAuthMode('register')} />
  }

  const isAdmin = user.role === 'admin'
  const sidebarClass = `workspace-shell${menuOpen ? ' menu-open' : ''}`

  return (
    <div className={sidebarClass}>
      {menuOpen && <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside id="workspace-sidebar" className="workspace-sidebar" aria-label="Workspace sidebar">
        <a className="workspace-brand" href="#dashboard" onClick={(event) => navigate(event, 'dashboard')}>
          <span className="brand-mark"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 17 12 4l7 13h-5l-2-4-2 4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg></span>
          <span>DevFlow <span className="brand-ai">AI</span></span>
        </a>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <a href="#dashboard" aria-current={activePage === 'dashboard' ? 'page' : undefined} onClick={(event) => navigate(event, 'dashboard')}><NavIcon name="dashboard" />Dashboard</a>
          <a href="#projects" aria-current={activePage === 'projects' ? 'page' : undefined} onClick={(event) => navigate(event, 'projects')}><NavIcon name="projects" />Projects</a>
          <a href="#issues" aria-current={activePage === 'issues' ? 'page' : undefined} onClick={(event) => navigate(event, 'issues')}><NavIcon name="issues" />Issues</a>
          <a href="#team" aria-current={activePage === 'team' ? 'page' : undefined} onClick={(event) => navigate(event, 'team')}><NavIcon name="team" />Team</a>
          <a href="#api" aria-current={activePage === 'api' ? 'page' : undefined} onClick={(event) => navigate(event, 'api')}><NavIcon name="api" />API Tester</a>
          <a href="#review" aria-current={activePage === 'review' ? 'page' : undefined} onClick={(event) => navigate(event, 'review')}><NavIcon name="review" />Code Review</a>
          {isAdmin && <>
            <p className="sidebar-group-label">ADMIN</p>
            <a href="#admin-users" aria-current={activePage === 'admin-users' ? 'page' : undefined} onClick={(event) => navigate(event, 'admin-users')}><NavIcon name="admin" />Admin Users</a>
            <a href="#audit-logs" aria-current={activePage === 'audit-logs' ? 'page' : undefined} onClick={(event) => navigate(event, 'audit-logs')}><NavIcon name="audit" />Audit Logs</a>
          </>}
        </nav>

        <div className="sidebar-bottom">
          <button type="button" className="sidebar-logout" onClick={handleLogout}><NavIcon name="logout" />Logout</button>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="workspace-sidebar" onClick={() => setMenuOpen((open) => !open)}>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="workspace-page-title">{PAGE_TITLES[activePage] || 'Dashboard'}</span>
          <div className="workspace-user">
            <span className="workspace-avatar" aria-hidden="true">{initialsFor(user.name)}</span>
            <span className="workspace-user-text"><strong>{user.name}</strong><small>{isAdmin ? 'Admin' : 'Developer'}</small></span>
          </div>
        </header>
        <div className="workspace-content">
          {activePage === 'api' ? <ApiTesterPage />
            : activePage === 'review' ? <CodeReviewPage />
              : activePage === 'projects' ? <ProjectsPage />
                : activePage === 'issues' ? <IssuesPage />
                  : activePage === 'team' ? <TeamManagementPage />
                    : activePage === 'admin-users' && isAdmin ? <AdminUsersPage />
                      : activePage === 'audit-logs' && isAdmin ? <AuditLogsPage />
                        : <DashboardPage />}
        </div>
      </div>
    </div>
  )
}

function App() {
  return <AuthProvider><Workspace /></AuthProvider>
}

export default App
