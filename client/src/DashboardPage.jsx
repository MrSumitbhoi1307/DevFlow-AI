import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext.jsx'

function DashboardPage() {
  const { request, user, logout } = useAuth()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await request('/api/dashboard/summary')
      setSummary(result.summary)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => { loadSummary() }, [loadSummary])

  return (
    <main className="main-content">
      <header className="topbar">
        <div><h1>Developer Dashboard</h1><p>Welcome to your development workspace.</p></div>
        <button type="button" onClick={logout}>Logout</button>
      </header>
      {error && <p role="alert">{error} <button type="button" onClick={loadSummary}>Retry</button></p>}
      {loading ? <p role="status">Loading workspace metrics…</p> : !error && summary && (
        <section className="stats" aria-label="Workspace metrics">
          <article className="stat-card"><p>Total Projects</p><h2>{summary.totalProjects}</h2></article>
          <article className="stat-card"><p>Open Issues</p><h2>{summary.openIssues}</h2></article>
          {user.role === 'admin' && <article className="stat-card"><p>Team Members</p><h2>{summary.teamMembers}</h2></article>}
        </section>
      )}
      <section className="welcome-card">
        <p>YOUR WORKSPACE</p>
        <h2>Build better software with DevFlow AI.</h2>
        <p>Track issues and projects from one workspace.</p>
      </section>
      <section className="tools-grid">
        <article className="tool-card"><h3>Issue Tracker</h3><p>Create and manage bugs, tasks and priorities.</p></article>
        <article className="tool-card"><h3>API Tester</h3><p>Send requests and inspect HTTP responses.</p></article>
        <article className="tool-card"><h3>AI Code Review</h3><p>Planned feature.</p></article>
        {user.role === 'admin' && <article className="tool-card"><h3>Team Management</h3><p>Planned feature.</p></article>}
      </section>
    </main>
  )
}

export default DashboardPage
