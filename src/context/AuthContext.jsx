import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext({})

const DEFAULT_PERMISSIONS = {
  admin:      ['view_dashboard','create_request','view_all_requests','assign_work','accept_work','inspect_job','cancel_job','reopen_job','view_reports','manage_on_duty','manage_settings'],
  supervisor: ['view_dashboard','create_request','view_all_requests','assign_work','accept_work','inspect_job','cancel_job','reopen_job','view_reports','manage_on_duty'],
  technician: ['view_dashboard','create_request','view_all_requests','accept_work','inspect_job','view_reports','manage_on_duty'],
  staff:      ['view_dashboard','create_request'],
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS)
  const activeUserRef = useRef(null)

  function loadPermissions() {
    const userId = activeUserRef.current
    return api.getPermissions()
      .then(data => {
        // Discard if user changed (signed out) while the request was in-flight
        if (activeUserRef.current === userId) setPermissions(data)
      })
      .catch(() => {})
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.me()
        .then(u => {
          activeUserRef.current = u.id
          setUser(u)
          setMustChangePassword(u.must_change_password || false)
          loadPermissions()
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
    activeUserRef.current = data.user.id
    setUser(data.user)
    setMustChangePassword(data.must_change_password || false)
    loadPermissions()
    return data
  }

  function signOut() {
    activeUserRef.current = null
    localStorage.removeItem('token')
    setUser(null)
    setMustChangePassword(false)
    setPermissions(DEFAULT_PERMISSIONS)
  }

  function clearMustChangePassword() {
    setMustChangePassword(false)
    setUser(prev => prev ? { ...prev, must_change_password: false } : prev)
  }

  const hasPermission = useCallback((feature) => {
    if (!user) return false
    if (user.role === 'admin') return true
    return permissions[user.role]?.includes(feature) ?? false
  }, [user, permissions])

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, mustChangePassword, clearMustChangePassword, permissions, hasPermission, reloadPermissions: loadPermissions }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
