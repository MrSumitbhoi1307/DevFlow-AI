// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CodeReviewPage from './CodeReviewPage.jsx'

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }))
vi.mock('./auth/AuthContext.jsx', () => ({ useAuth: () => ({ request: requestMock }) }))

const historyItem = {
  _id: 'review-1',
  title: 'Prior review',
  language: 'javascript',
  summary: { findings: 1, bySeverity: { info: 0, warning: 1, error: 0 }, score: 92 },
}

const resultWithFinding = {
  reviewer: 'rule-based',
  summary: { findings: 1, bySeverity: { info: 0, warning: 0, error: 1 }, score: 80 },
  findings: [{
    rule: 'avoid-eval', severity: 'error', line: 3,
    message: 'Dynamic code evaluation is present.',
    suggestion: 'Avoid eval and new Function; use explicit, trusted control flow.',
  }],
}

describe('Code Review page', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockImplementation(async (path) => {
      if (path === '/api/code-review/history') return { reviews: [] }
      throw new Error(`Unexpected request: ${path}`)
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('runs a review and displays findings with severity, line, message, and suggestion', async () => {
    requestMock.mockImplementation(async (path) => {
      if (path === '/api/code-review/history') return { reviews: [] }
      if (path === '/api/code-review') return resultWithFinding
      throw new Error(`Unexpected request: ${path}`)
    })
    render(<CodeReviewPage />)

    expect(screen.getByText('Rule-based review (no AI model)')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Review title (optional)'), { target: { value: 'Quick check' } })
    fireEvent.change(screen.getByLabelText('Code to review'), { target: { value: 'eval(input)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run review' }))

    expect(await screen.findByText('avoid-eval')).toBeTruthy()
    expect(screen.getByText('Line 3')).toBeTruthy()
    expect(screen.getByText('Dynamic code evaluation is present.')).toBeTruthy()
    expect(screen.getByText(/Suggestion: Avoid eval/)).toBeTruthy()
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith('/api/code-review', {
      method: 'POST', body: { language: 'javascript', title: 'Quick check', code: 'eval(input)' },
    }))
  })

  it('shows a clean result when the reviewer finds no issues', async () => {
    requestMock.mockImplementation(async (path) => {
      if (path === '/api/code-review/history') return { reviews: [] }
      if (path === '/api/code-review') return {
        reviewer: 'rule-based',
        summary: { findings: 0, bySeverity: { info: 0, warning: 0, error: 0 }, score: 100 },
        findings: [],
      }
      throw new Error(`Unexpected request: ${path}`)
    })
    render(<CodeReviewPage />)
    fireEvent.change(screen.getByLabelText('Code to review'), { target: { value: 'const answer = 42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run review' }))

    expect(await screen.findByText('No findings detected')).toBeTruthy()
    expect(screen.getByText('Your code passed these rule-based checks.')).toBeTruthy()
    expect(screen.getByText('Score 100/100')).toBeTruthy()
  })

  it('displays a server error', async () => {
    requestMock.mockImplementation(async (path) => {
      if (path === '/api/code-review/history') return { reviews: [] }
      if (path === '/api/code-review') throw new Error('Review service is temporarily unavailable')
      throw new Error(`Unexpected request: ${path}`)
    })
    render(<CodeReviewPage />)
    fireEvent.change(screen.getByLabelText('Code to review'), { target: { value: 'const answer = 42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run review' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Review service is temporarily unavailable')
  })

  it('deletes a saved history item', async () => {
    requestMock.mockImplementation(async (path) => {
      if (path === '/api/code-review/history') return { reviews: [historyItem] }
      if (path === '/api/code-review/history/review-1') return { success: true }
      throw new Error(`Unexpected request: ${path}`)
    })
    render(<CodeReviewPage />)
    expect(await screen.findByText('Prior review')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Prior review' }))

    await waitFor(() => expect(requestMock).toHaveBeenCalledWith('/api/code-review/history/review-1', { method: 'DELETE' }))
    expect(screen.queryByText('Prior review')).toBeNull()
  })
})
