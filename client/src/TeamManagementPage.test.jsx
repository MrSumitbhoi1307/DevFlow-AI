// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import TeamManagementPage from './TeamManagementPage.jsx'

const { auth } = vi.hoisted(() => ({ auth: { request: vi.fn() } }))

vi.mock('./auth/AuthContext.jsx', () => ({ useAuth: () => auth }))

afterEach(() => {
  cleanup()
  auth.request.mockReset()
})

describe('Team Management page', () => {
  it('renders member roles and project and issue counts', async () => {
    auth.request.mockResolvedValue({ members: [{
      _id: 'dev-1', name: 'Team Developer', email: 'dev@example.test', role: 'developer',
      projectsOwnedCount: 2, issuesReportedCount: 5,
    }] })

    render(<TeamManagementPage />)

    expect(await screen.findByText('Team Developer')).toBeTruthy()
    expect(screen.getByText('Developer')).toBeTruthy()
    expect(screen.getByText('dev@example.test')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
    expect(auth.request).toHaveBeenCalledWith('/api/team')
  })

  it('does not render email when the Developer response omits it', async () => {
    auth.request.mockResolvedValue({ members: [{
      _id: 'dev-2', name: 'Private Developer', role: 'developer',
      projectsOwnedCount: 0, issuesReportedCount: 0,
    }] })

    render(<TeamManagementPage />)

    expect(await screen.findByText('Private Developer')).toBeTruthy()
    expect(screen.queryByText(/@/)).toBeNull()
  })

  it('shows a server error', async () => {
    auth.request.mockRejectedValue(new Error('Team service unavailable'))

    render(<TeamManagementPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Team service unavailable')
  })
})
