import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Hotel, Eye, EyeOff, Wrench } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { user, signIn, loading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await signIn(username, password)
      toast.success('เข้าสู่ระบบสำเร็จ')
    } catch (err) {
      toast.error(err.message || 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ระบบแจ้งซ่อมโรงแรม</h1>
          <p className="text-gray-500 mt-1">Hotel Maintenance System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">เข้าสู่ระบบ</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อผู้ใช้</label>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
              {submitting ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />กำลังเข้าสู่ระบบ...</>
              ) : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-6 text-sm text-gray-400">
          <Hotel className="w-4 h-4" />
          <span>Hotel Maintenance System v2.0</span>
        </div>
      </div>
    </div>
  )
}
