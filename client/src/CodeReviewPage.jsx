import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext.jsx'
import './CodeReviewPage.css'

function CodeReviewPage() {
  const { request } = useAuth()
  const [language, setLanguage] = useState('javascript')
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const response = await request('/api/code-review/history')
      setHistory(response.reviews || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoadingHistory(false)
    }
  }, [request])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  async function runReview(event) {
    event.preventDefault()
    setError('')
    setResult(null)
    setReviewing(true)
    try {
      const review = await request('/api/code-review', {
        method: 'POST',
        body: { language, ...(title.trim() ? { title: title.trim() } : {}), code },
      })
      setResult(review)
      await loadHistory()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setReviewing(false)
    }
  }

  async function deleteHistoryItem(review) {
    setError('')
    try {
      await request(`/api/code-review/history/${review._id}`, { method: 'DELETE' })
      setHistory((current) => current.filter((item) => item._id !== review._id))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <main className="code-review-page" aria-labelledby="code-review-title">
      <header className="code-review-heading">
        <div>
          <p className="eyebrow">DEVELOPER TOOLS</p>
          <h1 id="code-review-title">Code Review</h1>
          <p>Deterministic checks for common code patterns. Submitted code is analyzed but never executed.</p>
        </div>
        <span className="code-review-label">Rule-based review (no AI model)</span>
      </header>

      {error && <p className="code-review-error" role="alert">{error}</p>}

      <form className="code-review-form" onSubmit={runReview}>
        <div className="code-review-fields">
          <label>Language
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Review title (optional)
            <input maxLength="100" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
        </div>
        <label htmlFor="review-source">Code to review</label>
        <textarea
          id="review-source"
          className="code-review-source"
          rows="18"
          maxLength={50 * 1024}
          spellCheck="false"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Paste code for deterministic rule checks…"
        />
        <div className="code-review-form-footer">
          <small>Maximum 50 KB. Code is not saved in review history.</small>
          <button type="submit" disabled={reviewing}>{reviewing ? 'Reviewing…' : 'Run review'}</button>
        </div>
      </form>

      {result && (
        <section className="code-review-results" aria-labelledby="review-results-heading">
          <div className="code-review-results-heading">
            <div>
              <p className="eyebrow">REVIEW RESULTS</p>
              <h2 id="review-results-heading">{result.summary.findings === 0 ? 'No findings detected' : `${result.summary.findings} finding${result.summary.findings === 1 ? '' : 's'}`}</h2>
            </div>
            <strong className="code-review-score">Score {result.summary.score}/100</strong>
          </div>
          <div className="code-review-severity-counts" aria-label="Finding counts by severity">
            {['error', 'warning', 'info'].map((severity) => (
              <span key={severity} className={`severity-badge severity-${severity}`}>
                {severity}: {result.summary.bySeverity[severity]}
              </span>
            ))}
          </div>
          {result.findings.length === 0 ? <p>Your code passed these rule-based checks.</p> : (
            <ol className="code-review-findings">
              {result.findings.map((finding, index) => (
                <li key={`${finding.rule}-${finding.line}-${index}`}>
                  <div className="code-review-finding-title">
                    <span className={`severity-badge severity-${finding.severity}`}>{finding.severity}</span>
                    <strong>{finding.rule}</strong>
                    <span>Line {finding.line}</span>
                  </div>
                  <p>{finding.message}</p>
                  <small>Suggestion: {finding.suggestion}</small>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <section className="code-review-history" aria-labelledby="review-history-heading">
        <div className="code-review-history-heading">
          <h2 id="review-history-heading">Review history</h2>
          <button type="button" className="code-review-refresh" onClick={loadHistory} disabled={loadingHistory}>
            {loadingHistory ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {loadingHistory ? <p role="status">Loading review history…</p> : history.length === 0 ? <p>No saved reviews yet.</p> : (
          <ul>
            {history.map((review) => (
              <li key={review._id}>
                <div>
                  <strong>{review.title}</strong>
                  <small>{review.language} · {review.summary.findings} findings · score {review.summary.score}/100</small>
                </div>
                <button type="button" className="code-review-delete" onClick={() => deleteHistoryItem(review)}>
                  Delete {review.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default CodeReviewPage
