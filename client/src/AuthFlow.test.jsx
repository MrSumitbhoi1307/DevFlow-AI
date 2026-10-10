// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App.jsx'

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

const developer = { id: 'dev-1', name: 'Dev User', email: 'dev@example.com', role: 'developer', status: 'active' }
const admin = { id: 'admin-1', name: 'Admin User', email: 'admin@example.com', role: 'admin', status: 'active' }

describe('client authentication', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('logs in with the backend fields and stores the token for this browser session', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, token: 'login-token', user: developer }))
      .mockResolvedValueOnce(jsonResponse({ success: true, user: developer }))

    render(<App />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: developer.email } })
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'Password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByText(developer.name)).toBeTruthy()
    expect(sessionStorage.getItem('devflow.token')).toBe('login-token')
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:5000/api/auth/login')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ email: developer.email, password: 'Password123' })
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/dashboard/summary',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer login-token' }) }),
    ))
  })

  it('registers with name, email and password and does not send a role', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, token: 'register-token', user: developer }, 201))
      .mockResolvedValueOnce(jsonResponse({ success: true, user: developer }))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: developer.name } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: developer.email } })
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'Password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText(developer.name)).toBeTruthy()
    expect(sessionStorage.getItem('devflow.token')).toBe('register-token')
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:5000/api/auth/register')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ name: developer.name, email: developer.email, password: 'Password123' })
  })

  it('loads the current Admin role and logs out cleanly', async () => {
    sessionStorage.setItem('devflow.token', 'admin-token')
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, user: admin }))

    render(<App />)

    expect(await screen.findByText(admin.name)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Team Management' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))

    expect(sessionStorage.getItem('devflow.token')).toBeNull()
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy()
  })

  it('hides Admin navigation and tools from a Developer', async () => {
    sessionStorage.setItem('devflow.token', 'developer-token')
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, user: developer }))

    render(<App />)

    expect(await screen.findByText(developer.name)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Team Management' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Admin Users' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Audit Logs' })).toBeNull()
    expect(screen.queryByText('Manage developer and admin permissions.')).toBeNull()
  })

  it('lets a Developer open Team Management without exposing emails', async () => {
    sessionStorage.setItem('devflow.token', 'developer-token')
    fetch.mockImplementation(async (url) => {
      const path = new URL(url).pathname
      if (path === '/api/auth/me') return jsonResponse({ success: true, user: developer })
      if (path === '/api/dashboard/summary') {
        return jsonResponse({ success: true, summary: { totalProjects: 1, openIssues: 2 } })
      }
      if (path === '/api/team') {
        return jsonResponse({ success: true, members: [{
          _id: 'dev-2', name: 'Private Developer', role: 'developer',
          projectsOwnedCount: 1, issuesReportedCount: 2,
        }] })
      }
      throw new Error(`Unexpected request: ${path}`)
    })

    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'Team Management' }))

    expect(await screen.findByText('Private Developer')).toBeTruthy()
    expect(screen.queryByText(/@/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Team Management' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Admin Users' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Audit Logs' })).toBeNull()
  })

  it('clears an expired session and returns to the Login form after a 401', async () => {
    sessionStorage.setItem('devflow.token', 'expired-token')
    fetch.mockResolvedValueOnce(jsonResponse({ success: false, error: 'Authentication required' }, 401))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy()
    expect(sessionStorage.getItem('devflow.token')).toBeNull()
    expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/auth/me', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer expired-token' }),
    }))
  })
})
