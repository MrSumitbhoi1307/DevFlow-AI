// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ProjectsPage from './ProjectsPage.jsx'

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

import { cleanup } from '@testing-library/react'

describe('ProjectsPage', () => {
  afterEach(() => {
    cleanup()
  })
  beforeEach(() => {
    localStorage.setItem('devflow.token', 'test-token')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads persisted projects from the API', async () => {
    fetch.mockResolvedValue(jsonResponse({
      success: true,
      projects: [{ _id: 'p1', name: 'Existing app', description: 'Stored project', status: 'active', owner: { name: 'Dev' } }],
    }))

    render(<ProjectsPage />)

    expect(await screen.findByText('Existing app')).toBeTruthy()
    expect(screen.getByText('Stored project')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/projects', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }))
  })

  it('creates a project and renders the returned persisted record', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, projects: [] }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        project: { _id: 'p2', name: 'New project', description: 'Created from the form', status: 'active' },
      }, 201))

    render(<ProjectsPage />)
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

  it('shows a clear authentication message when no token exists', () => {
    localStorage.clear()
    render(<ProjectsPage />)
    expect(screen.getByRole('status').textContent).toBe('Sign in to manage projects.')
    expect(fetch).not.toHaveBeenCalled()
  })
})
