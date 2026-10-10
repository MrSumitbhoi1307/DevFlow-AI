import { useState } from 'react'
import { useAuth } from './auth/AuthContext.jsx'
import './AuthPage.css'

function AuthPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isRegister = mode === 'register'

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (isRegister) await register({ name, email, password })
      else await login({ email, password })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setError('')
  }

  return (
    <main className="main-content auth-content">
      <header className="topbar">
        <div>
          <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <p>{isRegister ? 'Join your DevFlow workspace.' : 'Sign in to open your development workspace.'}</p>
        </div>
      </header>
      <section className="welcome-card auth-welcome">
        <p>DEVFLOW AI WORKSPACE</p>
        <h2>{isRegister ? 'Build better software together.' : 'Your projects are ready when you are.'}</h2>
        <form className="project-form auth-form" onSubmit={submit}>
          {isRegister && (
            <label>
              Name
              <input autoComplete="name" minLength="2" maxLength="100" required value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          <label>
            Email
            <input type="email" autoComplete="email" maxLength="254" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? 10 : 1}
              maxLength="128"
              pattern={isRegister ? '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{10,128}' : undefined}
              title={isRegister ? 'Use at least 10 characters with a lowercase letter, an uppercase letter, and a number.' : undefined}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {isRegister && <small>At least 10 characters, with uppercase, lowercase, and a number.</small>}
          </label>
          {error && <p className="project-error" role="alert">{error}</p>}
          <div className="project-form-actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Please wait...' : isRegister ? 'Create account' : 'Login'}</button>
          </div>
        </form>
        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'New to DevFlow?'}{' '}
          <button className="auth-link" type="button" onClick={() => switchMode(isRegister ? 'login' : 'register')}>
            {isRegister ? 'Login' : 'Register'}
          </button>
        </p>
      </section>
    </main>
  )
}

export default AuthPage
