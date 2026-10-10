import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext.jsx'
import './AdminUsersPage.css'

function AdminUsersPage() {
  const { request, user, logout } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await request('/api/admin/users')
      setUsers(result.users)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function performAction(target, action, method, body) {
    setError('')
    setBusyId(target._id)
    try {
      const result = await request(`/api/admin/users/${target._id}${action}`, { method, body })
      if (method === 'DELETE') {
        setUsers((current) => current.filter((candidate) => candidate._id !== target._id))
        if (target._id === user.id) logout()
      } else {
        setUsers((current) => current.map((candidate) => candidate._id === target._id ? result.user : candidate))
        if (target._id === user.id && (result.user.role !== 'admin' || result.user.status !== 'active')) logout()
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  function removeUser(target) {
    if (window.confirm(`Remove ${target.name} (${target.email})? This cannot be undone.`)) {
      performAction(target, '', 'DELETE')
    }
  }

  return (
    <section className="admin-users-page" aria-labelledby="admin-users-title">
      <header className="admin-users-heading">
        <div>
          <p className="eyebrow">ACCESS CONTROL</p>
          <h1 id="admin-users-title">Admin Users</h1>
          <p>Manage workspace roles and account access.</p>
        </div>
        <button type="button" className="admin-users-refresh" onClick={loadUsers} disabled={loading}>Refresh</button>
      </header>

      {error && <p className="project-error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading users…</p> : users.length === 0 ? <p>No users found.</p> : (
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((target) => (
                <tr key={target._id}>
                  <td>{target.name}</td>
                  <td>{target.email}</td>
                  <td>{target.role === 'admin' ? 'Admin' : 'Developer'}</td>
                  <td>{target.status === 'active' ? 'Active' : 'Inactive'}</td>
                  <td>
                    <div className="admin-users-actions">
                      <button type="button" disabled={busyId === target._id} onClick={() => performAction(target, '/role', 'PATCH', { role: target.role === 'admin' ? 'developer' : 'admin' })}>
                        {target.role === 'admin' ? 'Demote' : 'Promote'}
                      </button>
                      <button type="button" disabled={busyId === target._id} onClick={() => performAction(target, '/status', 'PATCH', { status: target.status === 'active' ? 'inactive' : 'active' })}>
                        {target.status === 'active' ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button type="button" className="admin-users-remove" disabled={busyId === target._id} onClick={() => removeUser(target)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default AdminUsersPage
