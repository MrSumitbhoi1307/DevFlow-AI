
import './App.css'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import AuthPage from './AuthPage.jsx'

function Workspace() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return <main className="main-content"><p role="status">Checking your session...</p></main>
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
          <a href="#dashboard">Dashboard</a>
          <a href="#projects">Projects</a>
          <a href="#issues">Issues</a>
          <a href="#api">API Tester</a>
          <a href="#review">AI Code Review</a>
          {user.role === 'admin' && <a href="#team">Team Management</a>}
        </nav>

        <div className="user-info">
          <strong>{user.name}</strong>
          <small>{user.role === 'admin' ? 'Administrator' : 'Developer'}</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>Developer Dashboard</h1>
            <p>Welcome to your development workspace.</p>
          </div>
          <button type="button" onClick={logout}>Logout</button>
        </header>

        <section className="stats">
          <article className="stat-card">
            <p>Total Projects</p>
            <h2>0</h2>
          </article>
          <article className="stat-card">
            <p>Open Issues</p>
            <h2>0</h2>
          </article>
          <article className="stat-card">
            <p>API Tests</p>
            <h2>0</h2>
          </article>
          <article className="stat-card">
            <p>Team Members</p>
            <h2>0</h2>
          </article>
        </section>

        <section className="welcome-card">
          <p>YOUR WORKSPACE</p>
          <h2>Build better software with DevFlow AI.</h2>
          <p>
            Track bugs, test APIs, review code and collaborate with your
            development team from one workspace.
          </p>
          <button onClick={() => alert('Issue tracker will be added next.')}>
            Explore Workspace
          </button>
        </section>

        <section className="tools-grid">
          <article className="tool-card">
            <h3>Issue Tracker</h3>
            <p>Create and manage bugs, tasks and priorities.</p>
          </article>
          <article className="tool-card">
            <h3>API Tester</h3>
            <p>Organize API requests and inspect responses.</p>
          </article>
          <article className="tool-card">
            <h3>AI Code Review</h3>
            <p>Review code and identify possible improvements.</p>
          </article>
          {user.role === 'admin' && (
            <article className="tool-card">
              <h3>Team Management</h3>
              <p>Manage developer and admin permissions.</p>
            </article>
          )}
        </section>
      </main>
    </div>
  )
}

function App() {
  return <AuthProvider><Workspace /></AuthProvider>
}

export default App
