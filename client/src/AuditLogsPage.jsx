import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext.jsx'
import './AuditLogsPage.css'

function AuditLogsPage() {
  const { request } = useAuth()
  const [entries, setEntries] = useState([])
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = action ? `?action=${encodeURIComponent(action)}` : ''
      const result = await request(`/api/admin/audit-logs${query}`)
      setEntries(result.auditLogs)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [action, request])

  useEffect(() => { loadEntries() }, [loadEntries])

  return (
    <section className="audit-logs-page" aria-labelledby="audit-logs-title">
      <header className="audit-logs-heading">
        <div>
          <p className="eyebrow">SECURITY</p>
          <h1 id="audit-logs-title">Audit Log</h1>
          <p>Review recent administrative and issue activity.</p>
        </div>
        <button type="button" onClick={loadEntries} disabled={loading}>Refresh</button>
      </header>
      <label className="audit-action-filter">Filter by action
        <input value={action} maxLength="80" onChange={(event) => setAction(event.target.value)} placeholder="All actions" />
      </label>
      {error && <p className="audit-logs-error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading audit entries…</p> : entries.length === 0 ? <p>No audit entries found.</p> : (
        <div className="audit-logs-table-wrap">
          <table className="audit-logs-table">
            <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
            <tbody>{entries.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.createdAt).toLocaleString()}</td>
                <td>{entry.actor?.name || 'Unknown user'}</td>
                <td>{entry.action}</td>
                <td>{entry.targetType}: {entry.targetId}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default AuditLogsPage
