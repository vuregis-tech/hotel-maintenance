import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday } from 'date-fns'
import { th as thLocale, enUS } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import toast from 'react-hot-toast'

// ── TechCheckBox — อยู่นอก component หลักเพื่อป้องกัน React remount ──────
function TechCheckBox({ technicians, alreadyOnDuty, selectedTechs, setSelectedTechs, t }) {
  const available = technicians.filter(t => !alreadyOnDuty.includes(t.id))
  const toggle = (id) => {
    const sid = String(id)
    setSelectedTechs(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid])
  }
  if (available.length === 0) {
    return <p className="text-sm text-gray-400 py-2">{t('onDuty.allOnDuty')}</p>
  }
  return (
    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden max-h-60 overflow-y-auto">
      {available.map(tech => {
        const checked = selectedTechs.includes(String(tech.id))
        return (
          <label key={tech.id}
            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${checked ? 'bg-blue-50' : ''}`}>
            <input type="checkbox" checked={checked} onChange={() => toggle(tech.id)}
              className="w-4 h-4 text-blue-600 rounded flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-900">{tech.full_name}</span>
              <span className="text-xs text-gray-500 ml-1.5">({tech.department})</span>
            </div>
          </label>
        )
      })}
    </div>
  )
}

export default function OnDutyPage() {
  const { user } = useAuth()
  const { lang, t } = useLang()
  const dateLocale = lang === 'th' ? thLocale : enUS
  const isSuperAdmin = ['admin', 'supervisor'].includes(user?.role)

  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedTechs, setSelectedTechs] = useState([])
  const [saving, setSaving] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  useEffect(() => {
    api.getOnDutyMonth(year, month).then(setSchedules)
  }, [year, month])

  useEffect(() => {
    if (isSuperAdmin) api.getTechnicians().then(setTechnicians)
  }, [isSuperAdmin])

  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
  const firstDayOffset = (getDay(days[0]) + 6) % 7

  function getDaySchedules(day) {
    const dateStr = format(day, 'yyyy-MM-dd')
    return schedules.filter(s => s.duty_date === dateStr)
  }

  function openAdd(day) {
    if (!isSuperAdmin) return
    setSelectedDay(day)
    setSelectedTechs([])
    setShowAddModal(true)
  }

  async function handleAdd() {
    if (selectedTechs.length === 0) return toast.error(t('workOrder.selectTech'))
    setSaving(true)
    try {
      const dateStr = format(selectedDay, 'yyyy-MM-dd')
      const results = await Promise.all(
        selectedTechs.map(techId =>
          api.setOnDuty({ technician_id: Number(techId), duty_date: dateStr })
            .catch(err => ({ _error: err.message }))
        )
      )
      const successes = results.filter(r => !r._error)
      const errors = results.filter(r => r._error)

      if (successes.length > 0) setSchedules(s => [...s, ...successes])
      if (errors.length > 0) toast.error(`${t('onDuty.addError')} ${errors.length} ${t('onDuty.addErrorSuffix')}`)
      if (successes.length > 0) toast.success(`${t('onDuty.addSuccess')} ${successes.length} ${t('onDuty.addSuccessSuffix')}`)
      setShowAddModal(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id) {
    try {
      await api.removeOnDuty(id)
      setSchedules(s => s.filter(x => x.id !== id))
      toast.success(t('onDuty.removeSuccess'))
    } catch (err) { toast.error(err.message) }
  }

  const DAY_LABELS = lang === 'th'
    ? ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const alreadyOnDutyIds = selectedDay
    ? getDaySchedules(selectedDay).map(s => s.technician?.id).filter(Boolean)
    : []

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('onDuty.title')}</h1>

      {/* Month Nav */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-gray-900">
            {format(currentDate, 'MMMM yyyy', { locale: dateLocale })}
          </h2>
          <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array(firstDayOffset).fill(null).map((_, i) => <div key={`e${i}`} />)}
          {days.map(day => {
            const daySchedules = getDaySchedules(day)
            const today = isToday(day)
            return (
              <div key={day.toISOString()}
                onClick={() => openAdd(day)}
                className={`min-h-[70px] rounded-lg p-1 border transition-colors ${
                  today ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-300'
                } ${isSuperAdmin ? 'cursor-pointer' : 'cursor-default'}`}>
                <p className={`text-xs font-medium mb-1 ${today ? 'text-blue-600' : 'text-gray-600'}`}>
                  {format(day, 'd')}
                </p>
                <div className="space-y-0.5">
                  {daySchedules.map(s => (
                    <div key={s.id} className="flex items-center gap-1 bg-green-100 rounded px-1 py-0.5 group">
                      <span className="text-xs text-green-800 truncate flex-1 leading-tight">
                        {s.technician?.full_name?.split(' ')[0]}
                      </span>
                      {isSuperAdmin && (
                        <button onClick={e => { e.stopPropagation(); handleRemove(s.id) }}
                          className="text-green-400 hover:text-red-500 opacity-0 group-hover:opacity-100 flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {isSuperAdmin && daySchedules.length === 0 && (
                    <div className="text-xs text-gray-300 text-center py-1">{t('onDuty.addMore')}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
          <span>{t('onDuty.legend.onDuty')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-400" />
          <span>{t('onDuty.legend.today')}</span>
        </div>
      </div>

      {/* Today's on-duty list */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">{t('onDuty.todayDuty')}</h3>
        {getDaySchedules(new Date()).length === 0 ? (
          <p className="text-sm text-gray-400">{t('onDuty.noDutyToday')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {getDaySchedules(new Date()).map(s => (
              <div key={s.id} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-800">{s.technician?.full_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && selectedDay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-0.5">{t('onDuty.addDuty')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {format(selectedDay, 'EEEE d MMMM yyyy', { locale: dateLocale })}
            </p>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">{t('onDuty.selectTech')}</label>
                {selectedTechs.length > 0 && (
                  <span className="text-xs text-blue-600 font-medium">
                    {t('onDuty.selectedCount')} {selectedTechs.length} {t('onDuty.people')}
                  </span>
                )}
              </div>
              <TechCheckBox
                technicians={technicians}
                alreadyOnDuty={alreadyOnDutyIds}
                selectedTechs={selectedTechs}
                setSelectedTechs={setSelectedTechs}
                t={t}
              />
              {alreadyOnDutyIds.length > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">{t('onDuty.alreadyOnDuty')}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">
                {t('common.cancel')}
              </button>
              <button onClick={handleAdd} disabled={saving || selectedTechs.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {saving ? t('common.saving') : `${t('common.save')}${selectedTechs.length > 0 ? ` (${selectedTechs.length} ${t('onDuty.people')})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
