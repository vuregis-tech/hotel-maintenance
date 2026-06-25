import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mustChangePassword, setMustChangePassword] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.me()
        .then(u => {
          setUser(u)
          setMustChangePassword(u.must_change_password || false)
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function signIn(username, password) {
    const data = await api.login(username, password)
    localStorage.setItem('token', data.access_token)
    setUser(data.user)
    setMustChangePassword(data.must_change_password || false)
    return data
  }

  function signOut() {
    localStorage.removeItem('token')
    setUser(null)
    setMustChangePassword(false)
  }

  function clearMustChangePassword() {
    setMustChangePassword(false)
    setUser(prev => prev ? { ...prev, must_change_password: false } : prev)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, mustChangePassword, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
