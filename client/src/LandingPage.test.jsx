// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App.jsx'

describe('signed-out landing and authentication entry points', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows the honest landing features and opens Register from Get Started Free', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Build Faster, Code Smarter with DevFlow AI' })).toBeTruthy()
    expect(screen.getByText(/project and issue tracking, API testing, rule-based code review, and team collaboration/)).toBeTruthy()
    expect(screen.queryByText(/AI-powered/i)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Code Review' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'API Tester' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Project Management' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Team Collaboration' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Get Started Free' }))
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeTruthy()
    expect(screen.getByLabelText('Name')).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
  })

  it('opens Login from landing navigation, toggles password visibility, and links to Register', () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Landing navigation' })).getByRole('button', { name: 'Login' }))

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy()
    const password = screen.getByLabelText('Password')
    expect(password.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(screen.getByLabelText('Password').type).toBe('text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('link', { name: 'Register' }))
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeTruthy()
    expect(screen.getByLabelText('Name')).toBeTruthy()
  })
})
