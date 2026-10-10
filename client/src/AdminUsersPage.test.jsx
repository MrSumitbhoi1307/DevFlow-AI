// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App.jsx'

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const admin = { id: 'admin-1', name: 'Admin User', email: 'admin@example.com', role: 'admin', status: 'active' }
const developer = { id: 'dev-1', name: 'Dev User', email: 'dev@example.com', role: 'developer', status: 'active' }
const listedDeveloper = { _id: 'dev-1', name: developer.name, email: developer.email, role: 'developer', status: 'active' }

function mockAdminRequests({ user = admin, users = [listedDeveloper], actionResponse } = {}) {
  fetch.mockImplementation(async (url, options = {}) => {
    if (url.endsWith('/api/auth/me')) return jsonResponse({ success: true, user })
    if (url.endsWith('/api/dashboard/summary')) return jsonResponse({ success: true, summary: { totalProjects: 0, openIssues: 0, teamMembers: 1 } })
    if (url.endsWith('/api/admin/users') && (!options.method || options.method === 'GET')) return jsonResponse({ success: true, users })
    if (url.includes('/api/admin/users/') && actionResponse) return actionResponse
    return jsonResponse({ success: false, error: 'Unexpected request' }, 404)
  })
}

describe('Admin Users page', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows the user-management page to an Admin', async () => {
    sessionStorage.setItem('devflow.token', 'admin-token')
    mockAdminRequests()

    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'Admin Users' }))

    expect(await screen.findByRole('heading', { name: 'Admin Users' })).toBeTruthy()
    expect(await screen.findByText(developer.email)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Promote' })).toBeTruthy()
  })

  it('does not show or allow a Developer to reach the Admin Users page', async () => {
    sessionStorage.setItem('devflow.token', 'developer-token')
    mockAdminRequests({ user: developer, users: [] })

    render(<App />)
    expect(await screen.findByText(developer.name)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Admin Users' })).toBeNull()

    window.history.replaceState(null, '', '#admin-users')
    expect(screen.queryByRole('heading', { name: 'Admin Users' })).toBeNull()
    expect(screen.queryByText(developer.email)).toBeNull()
  })

  it('calls the role API when an Admin promotes a Developer', async () => {
    sessionStorage.setItem('devflow.token', 'admin-token')
    mockAdminRequests({ actionResponse: jsonResponse({ success: true, user: { ...listedDeveloper, role: 'admin' } }) })

    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'Admin Users' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Promote' }))

    await waitFor(() => {
      const roleCall = fetch.mock.calls.find(([url]) => url === 'http://localhost:5000/api/admin/users/dev-1/role')
      expect(roleCall).toBeTruthy()
      expect(roleCall[1].method).toBe('PATCH')
      expect(JSON.parse(roleCall[1].body)).toEqual({ role: 'admin' })
      expect(roleCall[1].headers.Authorization).toBe('Bearer admin-token')
    })
  })

  it('shows Admin protection errors returned by the server', async () => {
    sessionStorage.setItem('devflow.token', 'admin-token')
    mockAdminRequests({
      users: [{ ...listedDeveloper, role: 'admin' }],
      actionResponse: jsonResponse({ success: false, error: 'Cannot remove the last active Admin' }, 409),
    })
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'Admin Users' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot remove the last active Admin')
    expect(confirm).toHaveBeenCalledOnce()
  })
})
