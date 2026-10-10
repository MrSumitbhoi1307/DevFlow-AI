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
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, user: admin }))
      .mockResolvedValueOnce(jsonResponse({ success: true, users: [listedDeveloper] }))

    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'Admin Users' }))

    expect(await screen.findByRole('heading', { name: 'Admin Users' })).toBeTruthy()
    expect(await screen.findByText(developer.email)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Promote' })).toBeTruthy()
  })

  it('does not show or allow a Developer to reach the Admin Users page', async () => {
    sessionStorage.setItem('devflow.token', 'developer-token')
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, user: developer }))

    render(<App />)
    expect(await screen.findByText(developer.name)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Admin Users' })).toBeNull()

    window.history.replaceState(null, '', '#admin-users')
    expect(screen.queryByRole('heading', { name: 'Admin Users' })).toBeNull()
    expect(screen.queryByText(developer.email)).toBeNull()
  })

  it('calls the role API when an Admin promotes a Developer', async () => {
    sessionStorage.setItem('devflow.token', 'admin-token')
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, user: admin }))
      .mockResolvedValueOnce(jsonResponse({ success: true, users: [listedDeveloper] }))
      .mockResolvedValueOnce(jsonResponse({ success: true, user: { ...listedDeveloper, role: 'admin' } }))

    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'Admin Users' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Promote' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    expect(fetch.mock.calls[2][0]).toBe('http://localhost:5000/api/admin/users/dev-1/role')
    expect(fetch.mock.calls[2][1].method).toBe('PATCH')
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ role: 'admin' })
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer admin-token')
  })

  it('shows Admin protection errors returned by the server', async () => {
    sessionStorage.setItem('devflow.token', 'admin-token')
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, user: admin }))
      .mockResolvedValueOnce(jsonResponse({ success: true, users: [{ ...listedDeveloper, role: 'admin' }] }))
      .mockResolvedValueOnce(jsonResponse({ success: false, error: 'Cannot remove the last active Admin' }, 409))
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'Admin Users' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot remove the last active Admin')
    expect(confirm).toHaveBeenCalledOnce()
  })
})
