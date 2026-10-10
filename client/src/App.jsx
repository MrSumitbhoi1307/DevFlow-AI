import { useState } from 'react'
import './App.css'
import AuthPage from './AuthPage.jsx'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import ProjectsPage from './ProjectsPage.jsx'
import './ProjectsPage.css'
import AdminUsersPage from './AdminUsersPage.jsx'
import IssuesPage from './IssuesPage.jsx'
import DashboardPage from './DashboardPage.jsx'
import AuditLogsPage from './AuditLogsPage.jsx'
import TeamManagementPage from './TeamManagementPage.jsx'

function Workspace() {
  const { user, loading } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')

  function navigate(event, page) {
    event.preventDefault()
    setActivePage(page)
    window.history.replaceState(null, '', `#${page}`)
  }

  if (loading) {
    return (
      <div className="app">
        <aside className="sidebar">
          <h2>DevFlow <span>AI</span></h2>
          <p>DEVELOPER WORKSPACE</p>
        </aside>
        <main className="main-content"><p role="status">Checking your session...</p></main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app">
        <aside className="sidebar">
          <h2>DevFlow <span>AI</span></h2>
          <p>DEVELOPER WORKSPACE</p>
        </aside>
        <AuthPage />
      </div>
    )
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>DevFlow <span>AI</span></h2>
        <p>DEVELOPER WORKSPACE</p>

        <nav>
          <a href="#dashboard" onClick={(event) => navigate(event, 'dashboard')}>Dashboard</a>
          <a href="#projects" onClick={(event) => navigate(event, 'projects')}>Projects</a>
          <a href="#issues" onClick={(event) => navigate(event, 'issues')}>Issues</a>
          <a href="#api">API Tester</a>
          <a href="#review">AI Code Review</a>
          <a href="#team" onClick={(event) => navigate(event, 'team')}>Team Management</a>
          {user.role === 'admin' && <a href="#admin-users" onClick={(event) => navigate(event, 'admin-users')}>Admin Users</a>}
          {user.role === 'admin' && <a href="#audit-logs" onClick={(event) => navigate(event, 'audit-logs')}>Audit Logs</a>}
        </nav>

        <div className="user-info">
          <strong>{user.name}</strong>
          <small>{user.role === 'admin' ? 'Administrator' : 'Developer'}</small>
        </div>
      </aside>

      {activePage === 'projects' ? <ProjectsPage />
        : activePage === 'issues' ? <IssuesPage />
          : activePage === 'team' ? <TeamManagementPage />
            : activePage === 'admin-users' && user.role === 'admin' ? <AdminUsersPage />
              : activePage === 'audit-logs' && user.role === 'admin' ? <AuditLogsPage />
                : <DashboardPage />}
    </div>
  )
}

function App() {
  return <AuthProvider><Workspace /></AuthProvider>
}

export default App
