import { useState } from 'react'
import { useAuth } from './auth/AuthContext.jsx'
import './AuthPage.css'

function AuthIllustration() {
  return (
    <div className="auth-art" aria-hidden="true">
      <div className="auth-art-orbit" />
      <div className="auth-art-code">
        <span className="auth-art-dot" /><span className="auth-art-dot" /><span className="auth-art-dot" />
        <div className="auth-art-code-lines"><i /><i /><i /><i /><i /><i /></div>
      </div>
      <div className="auth-art-card auth-art-card-top"><b>Project</b><span /></div>
      <div className="auth-art-card auth-art-card-bottom"><b>Code review</b><span /></div>
    </div>
  )
}

function AuthPage({ initialMode = 'login', onHome }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  function switchMode(event, nextMode) {
    event.preventDefault()
    setMode(nextMode)
    setError('')
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="DevFlow introduction">
        <button className="auth-brand" type="button" onClick={onHome} aria-label="DevFlow AI home">
          <span className="auth-brand-mark" aria-hidden="true">D</span>DevFlow <span>AI</span>
        </button>
        <div className="auth-story-copy">
          <p className="auth-story-kicker">YOUR DEVELOPER WORKSPACE</p>
          <h1>Code.<br />Collaborate.<br /><span>Build.</span></h1>
          <p>Bring your projects, issues, and team into one focused workspace.</p>
        </div>
        <AuthIllustration />
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-panel-inner">
          <button className="auth-home-link" type="button" onClick={onHome}>← Back to home</button>
          <header className="auth-heading">
            <p className="eyebrow">DEVFLOW AI WORKSPACE</p>
            <h2 id="auth-title">{isRegister ? 'Create your account' : 'Welcome back'}</h2>
            <p>{isRegister ? 'Join your DevFlow workspace.' : 'Sign in to open your development workspace.'}</p>
          </header>
          <form className="auth-form" onSubmit={submit}>
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
            <div className="auth-password-field">
              <label htmlFor="auth-password">Password</label>
              <span className="password-field">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  minLength={isRegister ? 10 : 1}
                  maxLength="128"
                  pattern={isRegister ? '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{10,128}' : undefined}
                  title={isRegister ? 'Use at least 10 characters with a lowercase letter, an uppercase letter, and a number.' : undefined}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
              {isRegister && <small className="password-help">At least 10 characters, with uppercase, lowercase, and a number.</small>}
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Login'}</button>
          </form>
          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New to DevFlow?'}{' '}
            <a href={isRegister ? '#login' : '#register'} onClick={(event) => switchMode(event, isRegister ? 'login' : 'register')}>
              {isRegister ? 'Login' : 'Register'}
            </a>
          </p>
        </div>
      </section>
    </main>
  )
}

export default AuthPage
