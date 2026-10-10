import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)
const TOKEN_KEY = 'devflow.token'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

async function sendRequest(path, { authToken, method = 'GET', body, onUnauthorized } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response || typeof response.json !== 'function') {
    throw new Error('The server did not return a valid response')
  }
  const payload = await response.json().catch(() => ({}))
  if (response.status === 401) onUnauthorized?.()
  if (!response.ok) throw new Error(payload.error || 'The request could not be completed')
  return payload
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(sessionStorage.getItem(TOKEN_KEY)))

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    setLoading(false)
  }, [])

  const request = useCallback((path, options = {}) => sendRequest(path, {
    ...options,
    authToken: options.authToken === undefined ? token : options.authToken,
    onUnauthorized: logout,
  }), [logout, token])

  const acceptCredentials = useCallback((payload) => {
    sessionStorage.setItem(TOKEN_KEY, payload.token)
    setToken(payload.token)
    setUser(payload.user)
    setLoading(false)
    return payload.user
  }, [])

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser)
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const payload = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      authToken: null,
    })
    return acceptCredentials(payload)
  }, [acceptCredentials, request])

  const register = useCallback(async ({ name, email, password }) => {
    const payload = await request('/api/auth/register', {
      method: 'POST',
      body: { name, email, password },
      authToken: null,
    })
    return acceptCredentials(payload)
  }, [acceptCredentials, request])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let current = true
    setLoading(true)
    request('/api/auth/me')
      .then((payload) => {
        if (current) setUser(payload.user)
      })
      .catch(() => {
        if (current) setUser(null)
      })
      .finally(() => {
        if (current) setLoading(false)
      })

    return () => {
      current = false
    }
  }, [request, token])

  const value = useMemo(() => ({ user, token, loading, login, register, logout, request, updateUser }), [
    user, token, loading, login, register, logout, request, updateUser,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used within an AuthProvider')
  return auth
}
