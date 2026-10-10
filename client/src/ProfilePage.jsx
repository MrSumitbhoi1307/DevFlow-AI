import { useState } from 'react'
import { useAuth } from './auth/AuthContext.jsx'
import './ProfilePage.css'

function initialsFor(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
}

function memberSince(createdAt) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return 'Member since unavailable'
  return `Member since ${new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)}`
}

function ProfilePage() {
  const { user, request, updateUser } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [nameError, setNameError] = useState('')
  const [nameSuccess, setNameSuccess] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)

  async function saveName(event) {
    event.preventDefault()
    setNameError('')
    setNameSuccess('')
    setSavingName(true)
    try {
      const payload = await request('/api/auth/me', {
        method: 'PATCH',
        body: { name: name.trim() },
      })
      updateUser(payload.user)
      setName(payload.user.name)
      setNameSuccess('Profile name updated.')
    } catch (error) {
      setNameError(error.message)
    } finally {
      setSavingName(false)
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setSavingPassword(true)
    try {
      await request('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Password changed successfully.')
    } catch (error) {
      setPasswordError(error.message)
    } finally {
      setSavingPassword(false)
    }
  }

  const passwordType = showPasswords ? 'text' : 'password'
  const roleLabel = user?.role === 'admin' ? 'Admin' : 'Developer'

  return (
    <main className="main-content profile-page">
      <div className="profile-page-heading">
        <div>
          <p className="profile-eyebrow">ACCOUNT</p>
          <h1>Profile</h1>
          <p className="profile-intro">Manage your account details and password.</p>
        </div>
      </div>

      <section className="profile-header-card" aria-label="Profile summary">
        <div className="profile-avatar" aria-hidden="true">{initialsFor(user?.name)}</div>
        <div className="profile-identity">
          <h2>{user?.name}</h2>
          <p>{user?.email}</p>
          <span className="profile-member-since">{memberSince(user?.createdAt)}</span>
        </div>
        <span className={`profile-role-badge${user?.role === 'admin' ? ' is-admin' : ''}`}>{roleLabel}</span>
      </section>

      <div className="profile-settings-grid">
        <section className="profile-card" aria-labelledby="edit-profile-title">
          <div className="profile-card-heading">
            <div className="profile-card-icon" aria-hidden="true">↗</div>
            <div>
              <h2 id="edit-profile-title">Edit profile</h2>
              <p>Update the name shown across your workspace.</p>
            </div>
          </div>
          <form onSubmit={saveName}>
            <label htmlFor="profile-name">Name</label>
            <input
              id="profile-name"
              name="name"
              type="text"
              autoComplete="name"
              minLength={2}
              maxLength={60}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(nameError)}
            />
            {nameError && <p className="profile-message is-error" role="alert">{nameError}</p>}
            {nameSuccess && <p className="profile-message is-success" role="status">{nameSuccess}</p>}
            <button className="profile-submit" type="submit" disabled={savingName}>
              {savingName ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>

        <section className="profile-card" aria-labelledby="change-password-title">
          <div className="profile-card-heading">
            <div className="profile-card-icon is-lock" aria-hidden="true">⌑</div>
            <div>
              <h2 id="change-password-title">Change password</h2>
              <p>Use your current password to set a new one.</p>
            </div>
          </div>
          <form onSubmit={changePassword}>
            <div className="profile-password-heading">
              <span>Password fields</span>
              <button
                className="profile-visibility-toggle"
                type="button"
                aria-pressed={showPasswords}
                aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                onClick={() => setShowPasswords((visible) => !visible)}
              >
                {showPasswords ? 'Hide' : 'Show'}
              </button>
            </div>
            <label htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              name="currentPassword"
              type={passwordType}
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              aria-invalid={Boolean(passwordError)}
            />
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              name="newPassword"
              type={passwordType}
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              aria-invalid={Boolean(passwordError)}
            />
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type={passwordType}
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={Boolean(passwordError)}
            />
            {passwordError && <p className="profile-message is-error" role="alert">{passwordError}</p>}
            {passwordSuccess && <p className="profile-message is-success" role="status">{passwordSuccess}</p>}
            <button className="profile-submit" type="submit" disabled={savingPassword}>
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}

export default ProfilePage
