import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'
import {
  Wrench, LayoutDashboard, PlusCircle, ClipboardList,
  BarChart2, Settings, LogOut, Menu, X, ChevronDown, Bell, CalendarCheck, KeyRound
} from 'lucide-react'

function NavItem({ to, icon: Icon, label, onClick }) {
  if (onClick) {
    return (
      <button onClick={onClick}
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 w-full text-left transition-colors text-sm font-medium">
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span>{label}</span>
      </button>
    )
  }
  return (
    <NavLink to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium ${isActive
          ? 'bg-blue-50 text-blue-700 font-semibold'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

export default function Layout({ children }) {
  const { user, signOut, mustChangePassword, clearMustChangePassword } = useAuth()
  const { t } = useLang()
  const [logoUrl, setLogoUrl] = useState(null)

  useEffect(() => {
    api.getLogo().then(d => setLogoUrl(d.url)).catch(() => {})
    const handler = (e) => setLogoUrl(e.detail.url)
    window.addEventListener('logo-updated', handler)
    return () => window.removeEventListener('logo-updated', handler)
  }, [])
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)

  function handleSignOut() {
    signOut()
    navigate('/login')
  }

  async function handleChangePw(isForced = false) {
    if (!pwForm.old_password || !pwForm.new_password) return toast.error(t('common.required'))
    if (pwForm.new_password.length < 8) return toast.error(t('auth.passwordTooShort'))
    if (pwForm.new_password !== pwForm.confirm) return toast.error(t('auth.passwordMismatch'))
    setPwSaving(true)
    try {
      await api.changePassword({ old_password: pwForm.old_password, new_password: pwForm.new_password })
      toast.success(t('auth.passwordChanged'))
      setPwForm({ old_password: '', new_password: '', confirm: '' })
      if (isForced) {
        clearMustChangePassword()
      } else {
        setShowChangePw(false)
      }
    } catch (err) { toast.error(err.message) }
    finally { setPwSaving(false) }
  }

  const navItems = [
    { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', roles: ['admin', 'supervisor', 'technician', 'staff'] },
    { to: '/new-request', icon: PlusCircle, labelKey: 'nav.newRequest', roles: ['admin', 'supervisor', 'technician', 'staff'] },
    { to: '/requests', icon: ClipboardList, labelKey: 'nav.requests', roles: ['admin', 'supervisor', 'technician', 'staff'] },
    { to: '/onduty', icon: CalendarCheck, labelKey: 'nav.onDuty', roles: ['admin', 'supervisor', 'technician'] },
    { to: '/reports', icon: BarChart2, labelKey: 'nav.reports', roles: ['admin', 'supervisor'] },
    { to: '/admin', icon: Settings, labelKey: 'nav.admin', roles: ['admin'] },
  ].filter(item => item.roles.includes(user?.role))

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      {logoUrl && (
        <div className="flex justify-center items-center px-4 pt-4 pb-3 border-b border-gray-100">
          <img src={logoUrl} alt="logo" className="h-[100px] w-auto object-contain" />
        </div>
      )}
      {/* System name */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm leading-tight">Work Order</p>
          <p className="text-xs text-gray-400">{t('auth.systemName')}</p>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{user?.position}{user?.department ? ` · ${user.department}` : ''}</p>
            </div>
            <button onClick={() => setShowChangePw(true)}
              title={t('auth.changePassword')}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded flex-shrink-0 transition-colors">
              <KeyRound className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
            user?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
            user?.role === 'supervisor' ? 'bg-orange-100 text-orange-700' :
            user?.role === 'technician' ? 'bg-green-100 text-green-700' :
            'bg-blue-100 text-blue-700'
          }`}>{t(`role.${user?.role}`)}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => <NavItem key={item.to} {...item} label={t(item.labelKey)} />)}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-4 border-t border-gray-100">
        <NavItem icon={LogOut} label={t('nav.signOut')} onClick={handleSignOut} />
      </div>
    </div>
  )

  const pwFields = [
    { key: 'old_password', label: t('auth.oldPassword') },
    { key: 'new_password', label: t('auth.newPassword') },
    { key: 'confirm',      label: t('auth.confirmPassword') },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl z-50">
            <div className="absolute top-4 right-4">
              <button onClick={() => setSidebarOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-gray-500 hover:text-gray-700">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">{t('auth.systemName')}</span>
          </div>
          {logoUrl && (
            <img src={logoUrl} alt="logo" className="ml-auto h-[50px] w-auto object-contain" />
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Force Change Password Modal — blocks all access until done */}
      {mustChangePassword && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <KeyRound className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">{t('auth.mustChangeTitle')}</h3>
                <p className="text-xs text-gray-500">{user?.full_name}</p>
              </div>
            </div>
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4 border border-amber-200">
              {t('auth.mustChangeNotice')}
            </p>
            <div className="space-y-3">
              {pwFields.map(({ key, label }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>
                  <input type="password" value={pwForm[key]}
                    onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleChangePw(true)}
                    autoComplete="off"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">{t('auth.passwordHint')}</p>
            <button onClick={() => handleChangePw(true)} disabled={pwSaving}
              className="w-full mt-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              {pwSaving ? t('common.saving') : t('auth.setNewPassword')}
            </button>
            <button onClick={handleSignOut}
              className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 py-1">
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      )}

      {/* Change Password Modal (voluntary) */}
      {showChangePw && !mustChangePassword && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-4">{t('auth.changePassword')}</h3>
            <div className="space-y-3">
              {pwFields.map(({ key, label }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>
                  <input type="password" value={pwForm[key]}
                    onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleChangePw(false)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">{t('auth.passwordHint')}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowChangePw(false); setPwForm({ old_password: '', new_password: '', confirm: '' }) }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">
                {t('common.cancel')}
              </button>
              <button onClick={() => handleChangePw(false)} disabled={pwSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {pwSaving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
