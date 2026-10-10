import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext.jsx'
import './ProjectsPage.css'
import './IssuesPage.css'

function IssuesPage() {
  const { token, request } = useAuth()
  const [issues, setIssues] = useState([])
  const [projects, setProjects] = useState([])
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const [priority, setPriority] = useState('medium')
  const [loading, setLoading] = useState(Boolean(token))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [projectResult, issueResult] = await Promise.all([
        request('/api/projects'),
        request('/api/issues'),
      ])
      setProjects(projectResult.projects)
      setIssues(issueResult.issues)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [request, token])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    if (projects.length && !projectId) setProjectId(projects[0]._id)
  }, [projects, projectId])

  async function createIssue(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await request('/api/issues', {
        method: 'POST',
        body: { title, description, priority, projectId },
      })
      setIssues((current) => [result.issue, ...current])
      setTitle('')
      setDescription('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(issue, status) {
    setError('')
    try {
      const result = await request(`/api/issues/${issue._id}`, { method: 'PATCH', body: { status } })
      setIssues((current) => current.map((item) => item._id === issue._id ? result.issue : item))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function deleteIssue(issue) {
    if (!window.confirm(`Delete issue “${issue.title}”?`)) return
    setError('')
    try {
      await request(`/api/issues/${issue._id}`, { method: 'DELETE' })
      setIssues((current) => current.filter((item) => item._id !== issue._id))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const visibleIssues = issues.filter((issue) => (
    (!projectFilter || issue.project?._id === projectFilter || issue.project === projectFilter)
    && (statusFilter === 'all' || issue.status === statusFilter)
  ))

  if (!token) return <section className="projects-page"><h1>Issues</h1><p role="status">Sign in to manage issues.</p></section>

  return (
    <section className="projects-page issues-page">
      <header className="projects-heading"><div><p className="eyebrow">WORKSPACE</p><h1>Issue Tracker</h1><p>Track work and status across your projects.</p></div></header>
      <form className="project-form" onSubmit={createIssue}>
        <h2>Create an issue</h2>
        <label>Issue title<input required minLength="2" maxLength="160" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Description<textarea maxLength="5000" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label>Project<select required value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="" disabled>Select a project</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
        </select></label>
        <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <div className="project-form-actions"><button type="submit" disabled={saving || !projectId}>{saving ? 'Saving…' : 'Create issue'}</button></div>
      </form>
      <div className="issue-filters">
        <label>Filter by project<select aria-label="Filter by project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="">All projects</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label>
        <label>Filter by status<select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="in-progress">In progress</option><option value="closed">Closed</option></select></label>
      </div>
      {error && <p className="project-error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading issues…</p> : <div className="project-list">
        {visibleIssues.length === 0 ? <p>No issues match this filter.</p> : visibleIssues.map((issue) => (
          <article className="project-card" key={issue._id}>
            <div><div className="project-card-title"><h2>{issue.title}</h2><span className="project-status">{issue.priority}</span></div><p>{issue.description || 'No description provided.'}</p><small>{issue.project?.name || projects.find((item) => item._id === issue.project)?.name || 'Project'} · {issue.status}</small></div>
            <div className="project-card-actions"><label className="issue-status-control">Status<select aria-label={`Status for ${issue.title}`} value={issue.status} onChange={(event) => changeStatus(issue, event.target.value)}><option value="open">Open</option><option value="in-progress">In progress</option><option value="closed">Closed</option></select></label><button type="button" className="secondary-button" onClick={() => deleteIssue(issue)}>Delete</button></div>
          </article>
        ))}
      </div>}
    </section>
  )
}

export default IssuesPage
