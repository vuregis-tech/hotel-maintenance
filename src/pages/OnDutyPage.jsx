import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, parseISO } from 'date-fns'
import { th as thLocale, enUS } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, X, Plus, Edit2, Clock, Trash2, Check, CalendarPlus, Users } from 'lucide-react'
import toast from 'react-hot-toast'

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#F97316', '#EC4899',
]

function colorBg(hex) {
  return { backgroundColor: hex + '22', borderColor: hex, color: hex }
}

// ── TechCheckBox ──────────────────────────────────────
function TechCheckBox({ technicians, excludeIds = [], selected, setSelected, conflicts = {} }) {
  const available = technicians.filter(t => !excludeIds.includes(t.id))
  const toggle = id => {
    const sid = String(id)
    setSelected(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid])
  }
  if (available.length === 0)
    return <p className="text-sm text-gray-400 py-2 text-center">ช่างทุกคน assign ในวันนี้แล้ว</p>
  return (
    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden max-h-52 overflow-y-auto">
      {available.map(tech => {
        const checked = selected.includes(String(tech.id))
        const conflictShifts = conflicts[tech.id] ? [...conflicts[tech.id]] : []
        return (
          <label key={tech.id}
            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}>
            <input type="checkbox" checked={checked} onChange={() => toggle(tech.id)}
              className="w-4 h-4 text-blue-600 rounded flex-shrink-0" />
            <span className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">{tech.full_name}</span>
            {conflictShifts.length > 0 ? (
              <span className="text-xs text-amber-600 flex-shrink-0"
                title={`มี Shift อื่น: ${conflictShifts.join(', ')}`}>
                ⚠️ {conflictShifts[0]}{conflictShifts.length > 1 ? ` +${conflictShifts.length - 1}` : ''}
              </span>
            ) : (
              tech.department && <span className="text-xs text-gray-400 flex-shrink-0">{tech.department}</span>
            )}
          </label>
        )
      })}
    </div>
  )
}

// ── ShiftForm (create / edit) ──────────────────────────
function ShiftForm({ initial, onSave, onCancel, saving }) {
  const { t } = useLang()
  const [form, setForm] = useState(initial || { name: '', start_time: '08:00', end_time: '17:00', color: COLORS[0] })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isOvernight = form.end_time <= form.start_time

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('onDuty.shift.name')}</label>
        <input value={form.name} onChange={e => set('name', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="เช่น เช้า / บ่าย / ดึก" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('onDuty.shift.startTime')}</label>
          <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('onDuty.shift.endTime')}</label>
          <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      {isOvernight && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          🌙 {t('onDuty.shift.overnight')} ({form.start_time} → +1 วัน {form.end_time})
        </p>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">{t('onDuty.shift.color')}</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => set('color', c)}
              style={{ backgroundColor: c }}
              className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`} />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">
          ยกเลิก
        </button>
        <button onClick={() => onSave(form)} disabled={saving || !form.name.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
          {saving ? 'กำลังบันทึก…' : t('common.save')}
        </button>
      </div>
    </div>
  )
}

// ── Shifts Tab ────────────────────────────────────────
function ShiftsTab({ shifts, onRefresh, isSuperAdmin }) {
  const { t } = useLang()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [todayAssignments, setTodayAssignments] = useState([])

  useEffect(() => {
    const now = new Date()
    const todayStr = format(now, 'yyyy-MM-dd')
    api.getShiftAssignments(now.getFullYear(), now.getMonth() + 1)
      .then(all => setTodayAssignments(all.filter(a => a.assignment_date === todayStr)))
      .catch(() => {})
  }, [])

  async function handleSave(form) {
    setSaving(true)
    try {
      if (editingId) {
        await api.updateShift(editingId, form)
      } else {
        await api.createShift(form)
      }
      toast.success(t('onDuty.shift.saveSuccess'))
      setShowForm(false); setEditingId(null)
      onRefresh()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm(t('onDuty.shift.deleteConfirm'))) return
    try {
      await api.deleteShift(id)
      toast.success(t('onDuty.shift.deleteSuccess'))
      onRefresh()
    } catch (err) { toast.error(err.message) }
  }

  const editingShift = editingId ? shifts.find(s => s.id === editingId) : null

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <div className="flex justify-end">
          <button onClick={() => { setShowForm(true); setEditingId(null) }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />
            {t('onDuty.shift.addShift')}
          </button>
        </div>
      )}

      {showForm && !editingId && (
        <div className="bg-white border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('onDuty.shift.addShift')}</h3>
          <ShiftForm onSave={handleSave} onCancel={() => setShowForm(false)} saving={saving} />
        </div>
      )}

      {shifts.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          {t('onDuty.shift.noShifts')}
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map(shift => {
            const isOvernight = shift.end_time <= shift.start_time
            const todayCount = todayAssignments.filter(a => a.shift.id === shift.id).length
            return (
              <div key={shift.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {editingId === shift.id ? (
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">แก้ไข Shift</h3>
                    <ShiftForm
                      initial={editingShift}
                      onSave={handleSave}
                      onCancel={() => setEditingId(null)}
                      saving={saving} />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: shift.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{shift.name}</span>
                        {isOvernight && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">🌙 ข้ามวัน</span>
                        )}
                        {todayCount > 0 && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" />{todayCount} คน วันนี้
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {shift.start_time} – {shift.end_time}
                        {isOvernight && ' (+1 วัน)'}
                      </p>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingId(shift.id); setShowForm(false) }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(shift.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── DayPopup — shared between admin (with remove) and viewer ─
function DayPopup({ dateStr, assignments, isSuperAdmin, onRemove, onClose, dateLocale }) {
  const grouped = (() => {
    const map = {}
    for (const a of assignments) {
      const sid = a.shift.id
      if (!map[sid]) map[sid] = { shift: a.shift, items: [] }
      map[sid].items.push(a)
    }
    return Object.values(map)
  })()

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">
            {format(parseISO(dateStr), 'EEEE d MMMM yyyy', { locale: dateLocale })}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">ไม่มี assignment วันนี้</p>
        ) : (
          <div className="space-y-2">
            {grouped.map(({ shift, items }) => (
              <div key={shift.id} className="rounded-lg p-3 border" style={colorBg(shift.color)}>
                <p className="text-xs font-semibold mb-2">{shift.name} · {shift.start_time}–{shift.end_time}</p>
                <div className="space-y-1">
                  {items.map(a => (
                    <div key={a.id} className="flex items-center justify-between">
                      <span className="text-sm bg-white/70 rounded px-2 py-0.5">{a.technician?.full_name}</span>
                      {isSuperAdmin && (
                        <button onClick={() => onRemove(a.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Schedule Tab ──────────────────────────────────────
function ScheduleTab({ shifts, technicians, isSuperAdmin }) {
  const { lang, t } = useLang()
  const dateLocale = lang === 'th' ? thLocale : enUS

  const [currentDate, setCurrentDate] = useState(new Date())
  const [assignments, setAssignments] = useState([])

  // range-select mode (admin only): first click = from, second click = to
  const [rangeMode, setRangeMode] = useState(false)
  const [rangeStart, setRangeStart] = useState(null)
  const [rangeEnd, setRangeEnd] = useState(null)
  const [hoverDay, setHoverDay] = useState(null)
  const [showAssignModal, setShowAssignModal] = useState(false)

  // assign modal form
  const [selShiftId, setSelShiftId] = useState('')
  const [selTechs, setSelTechs] = useState([])
  const [saving, setSaving] = useState(false)

  // day detail popup
  const [popupDay, setPopupDay] = useState(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const loadAssignments = useCallback(() => {
    api.getShiftAssignments(year, month)
      .then(setAssignments)
      .catch(() => {})
  }, [year, month])

  useEffect(() => { loadAssignments() }, [loadAssignments])

  function cancelRangeMode() {
    setRangeMode(false); setRangeStart(null); setRangeEnd(null); setHoverDay(null)
  }

  function isHoverInRange(dayStr) {
    if (!rangeMode || !rangeStart || rangeEnd || !hoverDay || dayStr === rangeStart) return false
    const from = rangeStart <= hoverDay ? rangeStart : hoverDay
    const to = rangeStart <= hoverDay ? hoverDay : rangeStart
    return dayStr >= from && dayStr <= to
  }

  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
  const firstDayOffset = (getDay(days[0]) + 6) % 7
  const DAY_LABELS = lang === 'th'
    ? ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  function getDayAssignments(day) {
    const dateStr = format(day, 'yyyy-MM-dd')
    return assignments.filter(a => a.assignment_date === dateStr)
  }

  function handleDayClick(day) {
    if (rangeMode) {
      if (!rangeStart) {
        setRangeStart(format(day, 'yyyy-MM-dd'))
      } else {
        const a = rangeStart
        const b = format(day, 'yyyy-MM-dd')
        const from = a <= b ? a : b
        const to = a <= b ? b : a
        setRangeStart(from); setRangeEnd(to)
        setSelShiftId(shifts[0]?.id?.toString() || '')
        setSelTechs([])
        setShowAssignModal(true)
      }
      return
    }
    // normal mode — open day popup for everyone
    setPopupDay(format(day, 'yyyy-MM-dd'))
  }

  function isInRange(day) {
    if (!rangeStart) return false
    const d = format(day, 'yyyy-MM-dd')
    if (rangeEnd) return d >= rangeStart && d <= rangeEnd
    return d === rangeStart
  }

  async function handleAssign() {
    if (!selShiftId) return toast.error(t('onDuty.schedule.selectShift'))
    if (selTechs.length === 0) return toast.error(t('onDuty.selectTech'))
    setSaving(true)
    try {
      const result = await api.bulkCreateAssignments({
        shift_id: Number(selShiftId),
        technician_ids: selTechs.map(Number),
        date_from: rangeStart,
        date_to: rangeEnd,
      })
      toast.success(`${t('onDuty.schedule.assignSuccess')} ${result.length} ${t('onDuty.schedule.assignSuccessSuffix')}`)
      setShowAssignModal(false); cancelRangeMode()
      loadAssignments()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleRemoveAssignment(id) {
    if (!confirm(t('onDuty.schedule.removeConfirm'))) return
    try {
      await api.deleteShiftAssignment(id)
      toast.success(t('onDuty.removeSuccess'))
      // reload and close popup
      setPopupDay(null)
      loadAssignments()
    } catch (err) { toast.error(err.message) }
  }

  function groupByShift(dayAssignments) {
    const map = {}
    for (const a of dayAssignments) {
      const sid = a.shift.id
      if (!map[sid]) map[sid] = { shift: a.shift, items: [] }
      map[sid].items.push(a)
    }
    return Object.values(map)
  }

  const popupAssignments = popupDay ? assignments.filter(a => a.assignment_date === popupDay) : []

  // Techs already assigned in chosen range for the selected shift (excluded from picker)
  const alreadyAssignedInRange = (() => {
    if (!rangeStart || !rangeEnd || !selShiftId) return []
    const ids = new Set()
    for (const a of assignments) {
      if (a.assignment_date >= rangeStart && a.assignment_date <= rangeEnd &&
          String(a.shift.id) === String(selShiftId)) {
        ids.add(a.technician?.id)
      }
    }
    return [...ids].filter(Boolean)
  })()

  // Techs on a DIFFERENT shift in the range — shown with ⚠️ warning
  const conflictsInRange = (() => {
    if (!rangeStart || !rangeEnd || !selShiftId) return {}
    const result = {}
    for (const a of assignments) {
      if (a.assignment_date >= rangeStart && a.assignment_date <= rangeEnd &&
          String(a.shift.id) !== String(selShiftId) && a.technician?.id) {
        if (!result[a.technician.id]) result[a.technician.id] = new Set()
        result[a.technician.id].add(a.shift.name)
      }
    }
    return result
  })()

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
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

        {/* Range mode banner */}
        {rangeMode && (
          <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-blue-700 font-medium">
              {!rangeStart ? 'กดวันเริ่มต้น' : `เริ่ม ${rangeStart} — กดวันสิ้นสุด`}
            </span>
            <button onClick={cancelRangeMode} className="text-xs text-gray-500 underline">ยกเลิก</button>
          </div>
        )}

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
            const dayAssignments = getDayAssignments(day)
            const grouped = groupByShift(dayAssignments)
            const today = isToday(day)
            const inRange = isInRange(day)
            const dateStr = format(day, 'yyyy-MM-dd')
            const isRangeStart = dateStr === rangeStart
            const inHover = isHoverInRange(dateStr)
            return (
              <div key={dateStr}
                onClick={() => handleDayClick(day)}
                onMouseEnter={() => { if (rangeMode && rangeStart && !rangeEnd) setHoverDay(dateStr) }}
                onMouseLeave={() => setHoverDay(null)}
                className={`min-h-[72px] rounded-lg p-1 border transition-colors cursor-pointer
                  ${today && !inRange ? 'border-blue-400 bg-blue-50' : ''}
                  ${inRange ? 'border-blue-400 bg-blue-50' : ''}
                  ${isRangeStart ? 'ring-2 ring-blue-500' : ''}
                  ${inHover ? 'border-blue-300 bg-blue-50/50' : ''}
                  ${!today && !inRange && !inHover ? 'border-gray-100 hover:border-gray-300 hover:bg-gray-50' : ''}
                `}>
                <p className={`text-xs font-medium mb-0.5 ${today || inRange ? 'text-blue-600' : 'text-gray-600'}`}>
                  {format(day, 'd')}
                </p>
                <div className="space-y-0.5">
                  {grouped.map(({ shift, items }) => (
                    <div key={shift.id}
                      title={`${shift.name} (${shift.start_time}–${shift.end_time})${shift.end_time <= shift.start_time ? ' 🌙' : ''}\n${items.map(a => a.technician?.full_name).join(', ')}`}
                      style={{ backgroundColor: shift.color + '22', borderColor: shift.color }}
                      className="rounded px-1 py-0.5 border text-[10px] leading-tight">
                      <span style={{ color: shift.color }} className="font-semibold block truncate">
                        {shift.end_time <= shift.start_time ? '🌙 ' : ''}{shift.name}
                      </span>
                      <span className="text-gray-600 truncate block">
                        {items.map(a => a.technician?.full_name?.split(' ')[0]).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Assign button (admin only, shown when not in range mode) */}
        {isSuperAdmin && !rangeMode && (
          <div className="mt-3 flex justify-end">
            <button onClick={() => { setRangeMode(true); setRangeStart(null); setRangeEnd(null) }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
              <CalendarPlus className="w-4 h-4" />
              {t('onDuty.schedule.assign')}
            </button>
          </div>
        )}
      </div>

      {/* Shift legend */}
      {shifts.length > 0 && (
        <div className="flex flex-wrap gap-3 px-1">
          {shifts.map(s => (
            <div key={s.id} className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
              <span>{s.name} ({s.start_time}–{s.end_time})</span>
            </div>
          ))}
        </div>
      )}

      {/* Today active shifts */}
      <TodayShiftPanel assignments={assignments} shifts={shifts} />

      {/* Day detail popup */}
      {popupDay && (
        <DayPopup
          dateStr={popupDay}
          assignments={popupAssignments}
          isSuperAdmin={isSuperAdmin}
          onRemove={handleRemoveAssignment}
          onClose={() => setPopupDay(null)}
          dateLocale={dateLocale} />
      )}

      {/* Assign range modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900">{t('onDuty.schedule.assign')}</h3>
              <button onClick={() => { setShowAssignModal(false); cancelRangeMode() }}
                className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {rangeStart === rangeEnd ? rangeStart : `${rangeStart} → ${rangeEnd}`}
            </p>

            {/* Shift selector */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('onDuty.schedule.selectShift')}</label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {shifts.map(s => (
                  <label key={s.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors
                      ${String(selShiftId) === String(s.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="shift" value={s.id}
                      checked={String(selShiftId) === String(s.id)}
                      onChange={() => { setSelShiftId(String(s.id)); setSelTechs([]) }}
                      className="sr-only" />
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{s.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{s.start_time}–{s.end_time}</span>
                    </div>
                    {String(selShiftId) === String(s.id) && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                  </label>
                ))}
              </div>
            </div>

            {/* Tech selector */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-600">{t('onDuty.schedule.selectTechs')}</label>
                {selTechs.length > 0 && (
                  <span className="text-xs text-blue-600 font-medium">เลือก {selTechs.length} คน</span>
                )}
              </div>
              <TechCheckBox
                technicians={technicians}
                excludeIds={alreadyAssignedInRange}
                selected={selTechs}
                setSelected={setSelTechs}
                conflicts={conflictsInRange} />
              {alreadyAssignedInRange.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">{t('onDuty.schedule.alreadyAssigned')}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setShowAssignModal(false); cancelRangeMode() }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">
                {t('common.cancel')}
              </button>
              <button onClick={handleAssign}
                disabled={saving || !selShiftId || selTechs.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {saving ? 'กำลังบันทึก…' : `Assign${selTechs.length > 0 ? ` (${selTechs.length})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Today's active shifts panel ───────────────────────
function TodayShiftPanel({ assignments, shifts }) {
  const { t } = useLang()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const todayStr = format(now, 'yyyy-MM-dd')
  const yesterdayStr = format(new Date(now - 86400000), 'yyyy-MM-dd')
  const nowTime = format(now, 'HH:mm')

  const active = assignments.filter(a => {
    const shift = shifts.find(s => s.id === a.shift.id) || a.shift
    const overnight = shift.end_time <= shift.start_time
    if (overnight) {
      if (a.assignment_date === yesterdayStr && nowTime < shift.end_time) return true
      if (a.assignment_date === todayStr && nowTime >= shift.start_time) return true
      return false
    }
    return a.assignment_date === todayStr && nowTime >= shift.start_time && nowTime < shift.end_time
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{t('onDuty.todayDuty')}</h3>
        <span className="text-xs text-gray-400">ณ {format(now, 'HH:mm')} น.</span>
      </div>
      {active.length === 0 ? (
        <p className="text-sm text-gray-400">{t('onDuty.noDutyToday')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {active.map(a => (
            <div key={a.id} className="flex items-center gap-2 rounded-full px-3 py-1.5 border text-sm"
              style={colorBg(a.shift.color)}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.shift.color }} />
              <span className="font-medium" style={{ color: a.shift.color }}>{a.shift.name}</span>
              <span className="text-gray-700">{a.technician?.full_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────
export default function OnDutyPage() {
  const { user, hasPermission } = useAuth()
  const { t } = useLang()
  // Can manage shifts if permission is granted AND role is admin/supervisor (not technician)
  const isSuperAdmin = hasPermission('manage_on_duty') && ['admin', 'supervisor'].includes(user?.role)

  const [tab, setTab] = useState('schedule')
  const [shifts, setShifts] = useState([])
  const [technicians, setTechnicians] = useState([])

  const loadShifts = useCallback(() => {
    api.getShifts().then(setShifts).catch(() => {})
  }, [])

  useEffect(() => {
    loadShifts()
    if (isSuperAdmin) api.getTechnicians().then(setTechnicians).catch(() => {})
  }, [loadShifts, isSuperAdmin])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('onDuty.title')}</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'schedule', label: t('onDuty.tabs.schedule') },
          { key: 'shifts', label: t('onDuty.tabs.shifts') },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'shifts' && (
        <ShiftsTab shifts={shifts} onRefresh={loadShifts} isSuperAdmin={isSuperAdmin} />
      )}
      {tab === 'schedule' && (
        <ScheduleTab shifts={shifts} technicians={technicians} isSuperAdmin={isSuperAdmin} />
      )}
    </div>
  )
}
