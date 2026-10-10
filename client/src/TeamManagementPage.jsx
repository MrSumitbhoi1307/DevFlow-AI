import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext.jsx'
import './AdminUsersPage.css'

function countFrom(member, keys) {
  const key = keys.find((candidate) => member[candidate] !== undefined)
  return key ? member[key] : 0
}

function TeamManagementPage() {
  const { request } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadMembers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await request('/api/team')
      setMembers(result.members || result.team || result.users || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  return (
    <section className="admin-users-page" aria-labelledby="team-management-title">
      <header className="admin-users-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1 id="team-management-title">Team Management</h1>
          <p>View active workspace members and their contributions.</p>
        </div>
        <button type="button" className="admin-users-refresh" onClick={loadMembers} disabled={loading}>Refresh</button>
      </header>

      {error && <p className="project-error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading team…</p> : members.length === 0 ? <p>No active team members found.</p> : (
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Projects owned</th><th>Issues reported</th></tr></thead>
            <tbody>
              {members.map((member) => (
                <tr key={member._id || member.id}>
                  <td>{member.name}</td>
                  <td>{member.email || ''}</td>
                  <td>{member.role === 'admin' ? 'Admin' : 'Developer'}</td>
                  <td>{countFrom(member, ['projectsOwned', 'projectsOwnedCount', 'projectCount', 'projectsCount'])}</td>
                  <td>{countFrom(member, ['issuesReported', 'issuesReportedCount', 'issueCount', 'issuesCount'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default TeamManagementPage
