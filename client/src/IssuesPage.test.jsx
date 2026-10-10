// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App.jsx'

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const developer = { id: 'dev-1', name: 'Dev', email: 'dev@example.com', role: 'developer', status: 'active' }
const project = { _id: 'project-1', name: 'Workspace project', description: '', status: 'active' }
const existingIssue = { _id: 'issue-1', title: 'Fix login', description: 'Handle errors', status: 'open', priority: 'high', project: { _id: project._id, name: project.name } }

function setupFetch({ issues = [], issueRequest } = {}) {
  fetch.mockImplementation(async (url, options = {}) => {
    if (url.endsWith('/api/auth/me')) return jsonResponse({ success: true, user: developer })
    if (url.endsWith('/api/projects')) return jsonResponse({ success: true, projects: [project] })
    if (url.endsWith('/api/issues') && (!options.method || options.method === 'GET')) return jsonResponse({ success: true, issues })
    if (url.endsWith('/api/issues') && options.method === 'POST') return issueRequest?.(options) || jsonResponse({ success: true, issue: { ...existingIssue, _id: 'created-issue', title: 'New issue' } }, 201)
    if (url.endsWith('/api/issues/issue-1') && options.method === 'PATCH') return issueRequest?.(options) || jsonResponse({ success: true, issue: { ...existingIssue, status: JSON.parse(options.body).status } })
    return jsonResponse({ success: false, error: 'Unexpected request' }, 500)
  })
}

describe('Issues page in the authenticated workspace', () => {
  beforeEach(() => {
    sessionStorage.setItem('devflow.token', 'test-token')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('creates an issue linked to the selected project', async () => {
    setupFetch()
    render(<App />)
    await screen.findByText('Dev')
    fireEvent.click(screen.getByRole('link', { name: 'Issues' }))
    fireEvent.change(await screen.findByLabelText('Issue title'), { target: { value: 'New issue' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Created from UI' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create issue' }))

    expect(await screen.findByText('New issue')).toBeTruthy()
    await waitFor(() => {
      const call = fetch.mock.calls.find(([url, options]) => url.endsWith('/api/issues') && options?.method === 'POST')
      expect(call).toBeTruthy()
      expect(JSON.parse(call[1].body)).toEqual({ title: 'New issue', description: 'Created from UI', priority: 'medium', projectId: project._id })
    })
  })

  it('changes an issue status through the API', async () => {
    setupFetch({ issues: [existingIssue] })
    render(<App />)
    await screen.findByText('Dev')
    fireEvent.click(screen.getByRole('link', { name: 'Issues' }))
    const status = await screen.findByLabelText('Status for Fix login')
    fireEvent.change(status, { target: { value: 'in-progress' } })

    expect(await screen.findByText(/in-progress/)).toBeTruthy()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/issues/issue-1', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ status: 'in-progress' }),
    })))
  })

  it('shows server errors to the user', async () => {
    setupFetch({ issueRequest: () => jsonResponse({ success: false, error: 'Project is no longer available' }, 404) })
    render(<App />)
    await screen.findByText('Dev')
    fireEvent.click(screen.getByRole('link', { name: 'Issues' }))
    fireEvent.change(await screen.findByLabelText('Issue title'), { target: { value: 'New issue' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create issue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Project is no longer available')
  })
})
