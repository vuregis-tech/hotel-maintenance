import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Wrench, LayoutDashboard, PlusCircle, ClipboardList,
  BarChart2, Settings, LogOut, Menu, X, ChevronDown, Bell, CalendarCheck
} from 'lucide-react'

const ROLE_LABELS = { admin: 'ผู้ดูแลระบบ', supervisor: 'หัวหน้าช่าง', technician: 'ช่าง', staff: 'พนักงาน' }

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
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function handleSignOut() {
    signOut()
    navigate('/login')
  }

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'แดชบอร์ด', roles: ['admin', 'supervisor', 'technician', 'staff'] },
    { to: '/new-request', icon: PlusCircle, label: 'แจ้งซ่อม', roles: ['admin', 'supervisor', 'technician', 'staff'] },
    { to: '/requests', icon: ClipboardList, label: 'รายการงานซ่อม', roles: ['admin', 'supervisor', 'technician', 'staff'] },
    { to: '/onduty', icon: CalendarCheck, label: 'On Duty', roles: ['admin', 'supervisor', 'technician'] },
    { to: '/reports', icon: BarChart2, label: 'รายงาน', roles: ['admin', 'supervisor'] },
    { to: '/admin', icon: Settings, label: 'จัดการระบบ', roles: ['admin'] },
  ].filter(item => item.roles.includes(user?.role))

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm leading-tight">Hotel Maintenance</p>
          <p className="text-xs text-gray-400">ระบบแจ้งซ่อม</p>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="font-semibold text-gray-900 text-sm">{user?.full_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{user?.position} · {user?.department}</p>
          <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
            user?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
            user?.role === 'supervisor' ? 'bg-orange-100 text-orange-700' :
            user?.role === 'technician' ? 'bg-green-100 text-green-700' :
            'bg-blue-100 text-blue-700'
          }`}>{ROLE_LABELS[user?.role]}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => <NavItem key={item.to} {...item} />)}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <NavItem icon={LogOut} label="ออกจากระบบ" onClick={handleSignOut} />
      </div>
    </div>
  )

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
            <span className="font-semibold text-gray-900 text-sm">ระบบแจ้งซ่อม</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
