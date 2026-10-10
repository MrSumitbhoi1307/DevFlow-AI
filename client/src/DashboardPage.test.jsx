// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import App from './App.jsx'

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const admin = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'admin', status: 'active' }

describe('live dashboard metrics', () => {
  beforeEach(() => {
    sessionStorage.setItem('devflow.token', 'dashboard-token')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads real project, issue, and admin team metrics', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse({ success: true, user: admin })
      if (url.endsWith('/api/dashboard/summary')) return jsonResponse({ success: true, summary: { totalProjects: 3, openIssues: 7, teamMembers: 10 } })
      return jsonResponse({ success: false, error: 'Not found' }, 404)
    })

    render(<App />)
    expect(await screen.findByText('3')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('10')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/dashboard/summary', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer dashboard-token' }),
    }))
  })

  it('shows a dashboard loading state and the server error', async () => {
    let resolveSummary
    fetch.mockImplementation((url) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve(jsonResponse({ success: true, user: admin }))
      return new Promise((resolve) => { resolveSummary = resolve })
    })

    render(<App />)
    expect(await screen.findByText('Loading workspace metrics…')).toHaveTextContent('Loading workspace metrics')
    resolveSummary(jsonResponse({ success: false, error: 'Metrics unavailable' }, 503))
    expect(await screen.findByRole('alert')).toHaveTextContent('Metrics unavailable')
  })

  it('shows a useful error when the summary request returns no response', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse({ success: true, user: admin })
      return undefined
    })

    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The server did not return a valid response')
    expect(screen.queryByText('0')).toBeNull()
  })
})
