import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext.jsx'
import './ApiTesterPage.css'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function ApiTesterPage() {
  const { request } = useAuth()
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('')
  const [headersText, setHeadersText] = useState('{}')
  const [body, setBody] = useState('')
  const [saveName, setSaveName] = useState('')
  const [savedRequests, setSavedRequests] = useState([])
  const [response, setResponse] = useState(null)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadSavedRequests = useCallback(async () => {
    setLoadingSaved(true)
    try {
      const result = await request('/api/api-tester/saved')
      setSavedRequests(result.savedRequests || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoadingSaved(false)
    }
  }, [request])

  useEffect(() => {
    loadSavedRequests()
  }, [loadSavedRequests])

  function parseHeaders() {
    let parsed
    try {
      parsed = JSON.parse(headersText)
    } catch {
      throw new Error('Headers must be valid JSON')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Headers must be a JSON object')
    }
    return parsed
  }

  async function sendRequest(event) {
    event.preventDefault()
    setError('')
    setResponse(null)
    setSending(true)
    try {
      const result = await request('/api/api-tester/send', {
        method: 'POST',
        body: { method, url, headers: parseHeaders(), body },
      })
      setResponse(result)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  async function saveRequest() {
    setError('')
    setSaving(true)
    try {
      const result = await request('/api/api-tester/saved', {
        method: 'POST',
        body: { name: saveName, method, url, headers: parseHeaders(), body },
      })
      setSavedRequests((current) => [result.savedRequest, ...current])
      setSaveName('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  function loadRequest(saved) {
    setMethod(saved.method)
    setUrl(saved.url)
    setHeadersText(JSON.stringify(saved.headers || {}, null, 2))
    setBody(saved.body || '')
    setResponse(null)
    setError('')
  }

  async function deleteRequest(saved) {
    if (!window.confirm(`Delete saved request “${saved.name}”?`)) return
    setError('')
    try {
      await request(`/api/api-tester/saved/${saved._id}`, { method: 'DELETE' })
      setSavedRequests((current) => current.filter((item) => item._id !== saved._id))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <section className="api-tester-page" aria-labelledby="api-tester-title">
      <header className="api-tester-heading">
        <div>
          <p className="eyebrow">DEVELOPER TOOLS</p>
          <h1 id="api-tester-title">API Tester</h1>
          <p>Send a request and inspect its response. Local and private network destinations are blocked.</p>
        </div>
      </header>

      {error && <p className="api-tester-error" role="alert">{error}</p>}

      <form className="api-tester-form" onSubmit={sendRequest}>
        <div className="api-tester-request-line">
          <label>Method
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              {METHODS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="api-tester-url">URL
            <input type="url" required maxLength="2048" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://api.example.com/health" />
          </label>
          <button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send'}</button>
        </div>

        <label>Headers (JSON object)
          <textarea className="api-tester-code-input" rows="5" value={headersText} onChange={(event) => setHeadersText(event.target.value)} spellCheck="false" />
        </label>
        <label>Request body
          <textarea className="api-tester-code-input" rows="7" maxLength="102400" value={body} onChange={(event) => setBody(event.target.value)} spellCheck="false" />
        </label>

        <div className="api-tester-save-line">
          <label>Saved request name
            <input value={saveName} maxLength="100" onChange={(event) => setSaveName(event.target.value)} placeholder="e.g. Health check" />
          </label>
          <button type="button" className="api-tester-secondary" disabled={saving || !saveName.trim() || !url} onClick={saveRequest}>
            {saving ? 'Saving…' : 'Save request'}
          </button>
        </div>
      </form>

      {response && (
        <section className="api-tester-response" aria-label="API response">
          <div className="api-tester-response-heading">
            <h2>Response</h2>
            <span className={response.status >= 200 && response.status < 400 ? 'response-success' : 'response-failure'}>
              {response.status} {response.statusText}
            </span>
            <small>{response.durationMs} ms{response.truncated ? ' · Body truncated at 1 MB' : ''}</small>
          </div>
          <h3>Headers</h3>
          <pre>{JSON.stringify(response.headers || {}, null, 2)}</pre>
          <h3>Body</h3>
          <pre className="api-tester-response-body">{response.body}</pre>
        </section>
      )}

      <section className="api-tester-saved" aria-labelledby="saved-requests-title">
        <h2 id="saved-requests-title">Saved requests</h2>
        {loadingSaved ? <p role="status">Loading saved requests…</p> : savedRequests.length === 0 ? <p>No saved requests yet.</p> : (
          <ul>
            {savedRequests.map((saved) => (
              <li key={saved._id}>
                <div><strong>{saved.name}</strong><small>{saved.method} · {saved.url}</small></div>
                <div className="api-tester-saved-actions">
                  <button type="button" className="api-tester-secondary" onClick={() => loadRequest(saved)}>Load</button>
                  <button type="button" className="api-tester-delete" onClick={() => deleteRequest(saved)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

export default ApiTesterPage
