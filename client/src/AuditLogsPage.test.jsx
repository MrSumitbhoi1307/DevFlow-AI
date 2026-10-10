// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App.jsx'

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const admin = { id: 'admin-1', name: 'Log Admin', email: 'admin@example.com', role: 'admin', status: 'active' }
const developer = { id: 'developer-1', name: 'Team Dev', email: 'dev@example.com', role: 'developer', status: 'active' }

function mockWorkspace(user, auditResponse = jsonResponse({ success: true, auditLogs: [] })) {
  fetch.mockImplementation(async (url) => {
    if (url.endsWith('/api/auth/me')) return jsonResponse({ success: true, user })
    if (url.endsWith('/api/dashboard/summary')) return jsonResponse({ success: true, summary: { totalProjects: 0, openIssues: 0, teamMembers: 1 } })
    if (url.startsWith('http://localhost:5000/api/admin/audit-logs')) return auditResponse
    return jsonResponse({ success: false, error: 'Unexpected request' }, 404)
  })
}

describe('Admin Audit Log page', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows audit entries to an Admin', async () => {
    sessionStorage.setItem('devflow.token', 'admin-token')
    mockWorkspace(admin, jsonResponse({ success: true, auditLogs: [{
      id: 'entry-1', actor: { name: 'Log Admin' }, action: 'issue.created', targetType: 'issue',
      targetId: 'issue-1', createdAt: '2026-01-01T00:00:00.000Z',
    }] }))

    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'Audit Logs' }))
    expect(await screen.findByRole('heading', { name: 'Audit Log' })).toBeTruthy()
    expect(await screen.findByText('issue.created')).toBeTruthy()
    const auditTable = screen.getByRole('table')
    expect(within(auditTable).getByText('Log Admin')).toBeTruthy()
  })

  it('hides the Audit Log page and blocks its URL state for a Developer', async () => {
    sessionStorage.setItem('devflow.token', 'developer-token')
    mockWorkspace(developer)

    render(<App />)
    expect(await screen.findByText(developer.name)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Audit Log' })).toBeNull()
    window.history.replaceState(null, '', '#audit-logs')
    expect(screen.queryByRole('heading', { name: 'Audit Log' })).toBeNull()
  })
})
