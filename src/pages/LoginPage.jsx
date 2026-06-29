import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { Hotel, Eye, EyeOff, Wrench } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { user, signIn, loading } = useAuth()
  const { lang, t } = useLang()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [errorField, setErrorField] = useState('')

  if (!loading && user) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setErrorField('')
    setSubmitting(true)
    try {
      await signIn(username, password)
      toast.success('เข้าสู่ระบบสำเร็จ')
    } catch (err) {
      const msg = err.message || 'เข้าสู่ระบบไม่สำเร็จ'
      setError(msg)
      // ระบุว่า field ไหนผิด
      if (msg.includes('ชื่อผู้ใช้') || msg.includes('ไม่พบ')) setErrorField('username')
      else if (msg.includes('รหัสผ่าน')) setErrorField('password')
      else if (msg.includes('ถูกระงับ')) setErrorField('username')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = (field) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
      errorField === field
        ? 'border-red-400 focus:ring-red-400 bg-red-50'
        : 'border-gray-300 focus:ring-blue-500'
    }`

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      <div className="bg-amber-400 text-amber-900 text-center text-xs font-bold py-1 tracking-widest shrink-0">
        ⚠ User Testing Version ⚠
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('login.welcome')}</h1>
          <p className="text-gray-500 mt-1">Work Order System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800">{t('login.submit')}</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <span className="text-red-500 text-base mt-0.5">⚠️</span>
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.username')}</label>
              <input type="text" required value={username}
                onChange={e => { setUsername(e.target.value); setError(''); setErrorField('') }}
                placeholder={t('auth.usernamePlaceholder')}
                className={inputClass('username')} autoComplete="username" autoCapitalize="none" />
              {errorField === 'username' && (
                <p className="text-xs text-red-500 mt-1">{lang === 'th' ? 'กรุณาตรวจสอบชื่อผู้ใช้อีกครั้ง' : 'Please check your username'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} required value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); setErrorField('') }}
                  placeholder="••••••••"
                  className={`${inputClass('password')} pr-10`} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errorField === 'password' && (
                <p className="text-xs text-red-500 mt-1">{lang === 'th' ? 'กรุณาตรวจสอบรหัสผ่านอีกครั้ง' : 'Please check your password'}</p>
              )}
            </div>

            <button type="submit" disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
              {submitting ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('login.submitting')}</>
              ) : t('login.submit')}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-6 text-sm text-gray-400">
          <Hotel className="w-4 h-4" />
          <span>Work Order System v2.0</span>
        </div>
      </div>
      </div>
    </div>
  )
}
