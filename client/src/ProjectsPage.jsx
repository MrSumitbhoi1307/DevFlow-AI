import { useCallback, useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

async function apiRequest(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'The request could not be completed')
  return payload
}

function ProjectsPage() {
  const token = localStorage.getItem('devflow.token')
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(Boolean(token))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState(null)

  const loadProjects = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const result = await apiRequest('/api/projects', { token })
      setProjects(result.projects)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  function beginEdit(project) {
    setEditingId(project._id)
    setName(project.name)
    setDescription(project.description || '')
  }

  function resetForm() {
    setEditingId(null)
    setName('')
    setDescription('')
  }

  async function saveProject(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await apiRequest(editingId ? `/api/projects/${editingId}` : '/api/projects', {
        token,
        method: editingId ? 'PATCH' : 'POST',
        body: { name, description },
      })
      if (editingId) {
        setProjects((current) => current.map((project) => project._id === editingId ? result.project : project))
      } else {
        setProjects((current) => [result.project, ...current])
      }
      resetForm()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function archiveProject(project) {
    setError('')
    try {
      const result = await apiRequest(`/api/projects/${project._id}`, {
        token,
        method: 'PATCH',
        body: { status: 'archived' },
      })
      setProjects((current) => current.map((item) => item._id === project._id ? result.project : item))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (!token) {
    return <section className="projects-page"><h1>Projects</h1><p role="status">Sign in to manage projects.</p></section>
  }

  return (
    <section className="projects-page">
      <header className="projects-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Projects</h1>
          <p>Keep project details and status in one place.</p>
        </div>
      </header>

      <form className="project-form" onSubmit={saveProject}>
        <h2>{editingId ? 'Edit project' : 'Create a project'}</h2>
        <label>
          Project name
          <input required minLength="2" maxLength="120" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Description
          <textarea maxLength="2000" value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <div className="project-form-actions">
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create project'}</button>
          {editingId && <button type="button" className="secondary-button" onClick={resetForm}>Cancel</button>}
        </div>
      </form>

      {error && <p className="project-error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading projects…</p> : (
        <div className="project-list" aria-live="polite">
          {projects.length === 0 ? <p>No projects yet. Create one to get started.</p> : projects.map((project) => (
            <article className="project-card" key={project._id}>
              <div>
                <div className="project-card-title">
                  <h2>{project.name}</h2>
                  <span className={`project-status project-status-${project.status}`}>{project.status}</span>
                </div>
                <p>{project.description || 'No description provided.'}</p>
                <small>Owner: {project.owner?.name || 'You'}</small>
              </div>
              <div className="project-card-actions">
                <button type="button" className="secondary-button" onClick={() => beginEdit(project)}>Edit</button>
                {project.status !== 'archived' && <button type="button" className="secondary-button" onClick={() => archiveProject(project)}>Archive</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default ProjectsPage
