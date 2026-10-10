// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ApiTesterPage from './ApiTesterPage.jsx'

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }))
vi.mock('./auth/AuthContext.jsx', () => ({ useAuth: () => ({ request: requestMock }) }))

afterEach(() => {
  cleanup()
  requestMock.mockReset()
  vi.unstubAllGlobals()
})

describe('API Tester page', () => {
  it('sends a request and renders response data as plain text', async () => {
    requestMock.mockResolvedValueOnce({ savedRequests: [] })
      .mockResolvedValueOnce({
        status: 201,
        statusText: 'Created',
        durationMs: 35,
        headers: { 'content-type': 'text/html' },
        body: '<script>window.stolen = true</script>',
        truncated: false,
      })

    render(<ApiTesterPage />)
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://api.example.test/items' } })
    fireEvent.change(screen.getByLabelText('Headers (JSON object)'), { target: { value: '{"Accept":"text/html"}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('201 Created')).toBeTruthy()
    const responseText = screen.getByText('<script>window.stolen = true</script>')
    expect(responseText.tagName).toBe('PRE')
    expect(responseText.querySelector('script')).toBeNull()
    expect(requestMock).toHaveBeenCalledWith('/api/api-tester/send', expect.objectContaining({
      method: 'POST',
      body: { method: 'GET', url: 'https://api.example.test/items', headers: { Accept: 'text/html' }, body: '' },
    }))
  })

  it('shows a blocked URL error returned by the server', async () => {
    requestMock.mockResolvedValueOnce({ savedRequests: [] })
      .mockRejectedValueOnce(new Error('Requests to local or non-public network addresses are not allowed'))

    render(<ApiTesterPage />)
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'http://127.0.0.1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Requests to local or non-public network addresses are not allowed')
  })

  it('saves and deletes a request using the authenticated API helper', async () => {
    const savedRequest = {
      _id: 'saved-1',
      name: 'Health check',
      method: 'GET',
      url: 'https://api.example.test/health',
      headers: {},
      body: '',
    }
    requestMock.mockResolvedValueOnce({ savedRequests: [] })
      .mockResolvedValueOnce({ savedRequest })
      .mockResolvedValueOnce({ success: true, savedRequestId: savedRequest._id })
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<ApiTesterPage />)
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: savedRequest.url } })
    fireEvent.change(screen.getByLabelText('Saved request name'), { target: { value: savedRequest.name } })
    fireEvent.click(screen.getByRole('button', { name: 'Save request' }))

    expect(await screen.findByText('Health check')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(requestMock).toHaveBeenCalledWith('/api/api-tester/saved/saved-1', { method: 'DELETE' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.queryByText('Health check')).toBeNull()
  })
})
