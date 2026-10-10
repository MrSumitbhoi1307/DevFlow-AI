// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App.jsx'

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const developer = {
  id: 'profile-dev',
  name: 'Profile Developer',
  email: 'profile-developer@example.test',
  role: 'developer',
  status: 'active',
  createdAt: '2021-04-12T00:00:00.000Z',
}

function setupFetch({ passwordResponse, updatedUser } = {}) {
  sessionStorage.setItem('devflow.token', 'profile-token')
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const path = new URL(url).pathname
    const method = options.method || 'GET'
    if (path === '/api/auth/me' && method === 'GET') {
      return jsonResponse({ success: true, user: developer })
    }
    if (path === '/api/auth/me' && method === 'PATCH') {
      return jsonResponse({ success: true, user: updatedUser || { ...developer, name: 'Updated Developer' } })
    }
    if (path === '/api/dashboard/summary') {
      return jsonResponse({ success: true, summary: { totalProjects: 0, openIssues: 0 } })
    }
    if (path === '/api/auth/change-password' && method === 'POST') {
      return passwordResponse || jsonResponse({ success: true, message: 'Password changed successfully' })
    }
    throw new Error(`Unexpected request: ${method} ${path}`)
  }))
}

function openProfile() {
  return within(screen.getByRole('navigation', { name: 'Main navigation' }))
    .getByRole('link', { name: 'Profile' })
}

describe('Profile page', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('renders the signed-in user profile data', async () => {
    setupFetch()
    render(<App />)
    await screen.findByText(developer.name)
    fireEvent.click(openProfile())

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: developer.name })).toBeTruthy()
    expect(screen.getByText(developer.email)).toBeTruthy()
    expect(screen.getByText('Developer', { selector: '.profile-role-badge' })).toBeTruthy()
    expect(screen.getByText('Member since April 2021')).toBeTruthy()
    expect(screen.getByLabelText('Name')).toHaveValue(developer.name)
  })

  it('saves a name and immediately updates the profile and app shell', async () => {
    setupFetch()
    render(<App />)
    await screen.findByText(developer.name)
    fireEvent.click(openProfile())
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated Developer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('heading', { name: 'Updated Developer' })).toBeTruthy()
    expect(screen.getByText('Updated Developer', { selector: '.workspace-user-text strong' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Profile name updated.')
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/auth/me',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer profile-token' }),
        body: JSON.stringify({ name: 'Updated Developer' }),
      }),
    ))
  })

  it('shows the server error for a wrong current password', async () => {
    setupFetch({
      passwordResponse: jsonResponse({ success: false, error: 'Current password is incorrect' }, 400),
    })
    render(<App />)
    await screen.findByText(developer.name)
    fireEvent.click(openProfile())
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'WrongPassword123' } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPassword456' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPassword456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect')
  })

  it('blocks mismatched password confirmation before sending a request', async () => {
    setupFetch()
    render(<App />)
    await screen.findByText(developer.name)
    fireEvent.click(openProfile())
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'CurrentPassword123' } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPassword456' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'AnotherPassword789' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('New password and confirmation do not match.')
    expect(fetch.mock.calls.some(([url]) => new URL(url).pathname === '/api/auth/change-password')).toBe(false)
  })

  it('navigates to the page from the Profile sidebar link', async () => {
    setupFetch()
    render(<App />)
    await screen.findByText(developer.name)
    fireEvent.click(openProfile())

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeTruthy()
    expect(window.location.hash).toBe('#profile')
    expect(openProfile()).toHaveAttribute('aria-current', 'page')
  })
})
