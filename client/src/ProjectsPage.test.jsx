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

const developer = { id: 'dev-1', name: 'Dev', email: 'dev@example.com', role: 'developer', status: 'active' }

function mockProjectRequests({ projects = [], createResponse } = {}) {
  fetch.mockImplementation(async (url, options = {}) => {
    if (url.endsWith('/api/auth/me')) return jsonResponse({ success: true, user: developer })
    if (url.endsWith('/api/dashboard/summary')) return jsonResponse({ success: true, summary: { totalProjects: projects.length, openIssues: 0 } })
    if (url.endsWith('/api/projects') && (!options.method || options.method === 'GET')) return jsonResponse({ success: true, projects })
    if (url.endsWith('/api/projects') && options.method === 'POST') return createResponse
    return jsonResponse({ success: false, error: 'Unexpected request' }, 404)
  })
}

describe('Projects page inside the authenticated app', () => {
  beforeEach(() => {
    sessionStorage.setItem('devflow.token', 'test-token')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads persisted projects with the shared session token', async () => {
    mockProjectRequests({ projects: [{ _id: 'p1', name: 'Existing app', description: 'Stored project', status: 'active', owner: { name: 'Dev' } }] })

    render(<App />)
    await screen.findByText('Dev')
    fireEvent.click(screen.getByRole('link', { name: 'Projects' }))

    expect(await screen.findByText('Existing app')).toBeTruthy()
    expect(screen.getByText('Stored project')).toBeTruthy()
    expect(fetch).toHaveBeenLastCalledWith('http://localhost:5000/api/projects', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }))
  })

  it('creates a project and renders the returned persisted record', async () => {
    mockProjectRequests({ createResponse: jsonResponse({
      success: true,
      project: { _id: 'p2', name: 'New project', description: 'Created from the form', status: 'active' },
    }, 201) })

    render(<App />)
    await screen.findByText('Dev')
    fireEvent.click(screen.getByRole('link', { name: 'Projects' }))
    await screen.findByText('No projects yet. Create one to get started.')
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'New project' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Created from the form' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }))

    expect(await screen.findByText('New project')).toBeTruthy()
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('http://localhost:5000/api/projects', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    })))
  })

  it('shows Login instead of Projects when no session exists', () => {
    sessionStorage.clear()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
})
