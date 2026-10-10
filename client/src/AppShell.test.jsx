// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App.jsx'

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const admin = { id: 'admin-1', name: 'Admin User', email: 'admin@example.test', role: 'admin', status: 'active' }

describe('signed-in app shell', () => {
  beforeEach(() => {
    sessionStorage.setItem('devflow.token', 'shell-token')
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse({ success: true, user: admin })
      if (url.endsWith('/api/dashboard/summary')) return jsonResponse({ success: true, summary: { totalProjects: 0, openIssues: 0, teamMembers: 0 } })
      return jsonResponse({ success: false, error: 'Not found' }, 404)
    }))
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows the profile, route-aware nav and Admin group while keeping hash navigation', async () => {
    const { container } = render(<App />)
    await screen.findByText('Admin User')

    expect(container.querySelector('.workspace-avatar').textContent).toBe('AU')
    expect(screen.getByText('Admin', { selector: 'small' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Projects' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Issues' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Team' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'API Tester' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Code Review' })).toBeTruthy()
    expect(screen.getByText('ADMIN')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Admin Users' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Audit Logs' })).toBeTruthy()

    fireEvent.click(screen.getByRole('link', { name: 'Projects' }))
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page')
    expect(window.location.hash).toBe('#projects')
    expect(container.querySelector('.workspace-page-title').textContent).toBe('Projects')
  })

  it('opens the mobile nav control, closes it after navigation, and logs out from the sidebar', async () => {
    const { container } = render(<App />)
    await screen.findByText('Admin User')

    const menu = container.querySelector('.mobile-menu-toggle')
    fireEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('link', { name: 'Issues' }))
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    expect(window.location.hash).toBe('#issues')

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    await waitFor(() => expect(sessionStorage.getItem('devflow.token')).toBeNull())
    expect(await screen.findByRole('heading', { name: 'Build Faster, Code Smarter with DevFlow AI' })).toBeTruthy()
  })
})
