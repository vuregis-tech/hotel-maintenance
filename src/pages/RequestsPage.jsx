import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, activeWorkOrder } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import StatusBadge from '../components/common/StatusBadge'
import { format } from 'date-fns'
import { th as thLocale, enUS } from 'date-fns/locale'
import { ChevronDown, ChevronLeft, ChevronRight, DoorClosed, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 50

export default function RequestsPage() {
  const { user } = useAuth()
  const { lang, t } = useLang()
  const dateLocale = lang === 'th' ? thLocale : enUS

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [slaSettings, setSlaSettings] = useState({})
  const [page, setPage] = useState(1)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  // Department filter
  const [departments, setDepartments] = useState([])
  const [deptFilter, setDeptFilter] = useState(new Set()) // empty = all
  const [deptOpen, setDeptOpen] = useState(false)
  const deptRef = useRef(null)

  const STATUSES = [
    { value: '', label: t('common.all') },
    { value: 'pending', label: t('status.pending') },
    { value: 'assigned', label: t('status.assigned') },
    { value: 'in_progress', label: t('status.in_progress') },
    { value: 'pending_inspection', label: t('status.pending_inspection') },
    { value: 'completed', label: t('status.completed') },
    { value: 'reopened', label: t('status.reopened') },
    { value: 'cancelled', label: t('status.cancelled') },
  ]

  useEffect(() => {
    api.getSLASettings().then(setSlaSettings).catch(() => {})
    api.getDepartments().then(setDepartments).catch(() => toast.error('โหลดรายชื่อแผนกไม่สำเร็จ'))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPage(1)
    api.getJobs({ status: filterStatus || undefined, limit: 1000 })
      .then(data => { if (!cancelled) setJobs(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filterStatus])

  // Reset page when search changes
  useEffect(() => { setPage(1) }, [search])

  // Close dept dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (deptRef.current && !deptRef.current.contains(e.target)) setDeptOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggleDept(name) {
    setPage(1)
    setDeptFilter(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function clearDeptFilter() {
    setPage(1)
    setDeptFilter(new Set())
  }

  function elapsedMins(createdAt) {
    return Math.floor((now - new Date(createdAt).getTime()) / 60000)
  }
  const SLA_OPEN = ['pending', 'assigned', 'in_progress', 'reopened', 'external_tech']
  function slaColor(job) {
    if (!SLA_OPEN.includes(job.status)) return ''
    const priority = job.priority || 'normal'
    const threshold = slaSettings[priority]
    if (!threshold) return ''
    const elapsed = elapsedMins(job.created_at)
    if (elapsed >= threshold) return 'bg-red-50 border-l-4 border-red-400'
    if (elapsed >= threshold * 0.8) return 'bg-orange-50 border-l-4 border-orange-400'
    return ''
  }
  function fmtElapsed(mins) {
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }
  function urgentSlaOverdue(job) {
    if (job.priority !== 'urgent' && job.priority !== 'very_urgent') return 0
    const threshold = slaSettings[job.priority]
    if (!threshold) return 0
    if (['completed', 'cancelled'].includes(job.status)) return 0
    // Only count accepted_at on the active (non-rejected/transferred) work order
    if (activeWorkOrder(job)?.accepted_at) return 0
    const over = elapsedMins(job.created_at) - threshold
    return over > 0 ? over : 0
  }

  // Merge active departments from API + any extra dept names from loaded jobs (covers soft-deleted depts)
  const deptOptions = (() => {
    const apiNames = departments.map(d => d.name)
    const apiSet = new Set(apiNames)
    const extra = [...new Set(jobs.map(j => j.reporter?.department).filter(Boolean))]
      .filter(n => !apiSet.has(n))
    return [...apiNames, ...extra]
  })()

  const filtered = jobs.filter(j => {
    const lowerSearch = search.toLowerCase()
    const matchSearch = !search ||
      j.description?.toLowerCase().includes(lowerSearch) ||
      j.request_number?.toLowerCase().includes(lowerSearch) ||
      j.reporter?.full_name?.toLowerCase().includes(lowerSearch)
    // Jobs with no reporter department always shown (cannot be categorised)
    const matchDept = deptFilter.size === 0 || !j.reporter?.department || deptFilter.has(j.reporter.department)
    return matchSearch && matchDept
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const showFrom = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const showTo = Math.min(safePage * PAGE_SIZE, filtered.length)

  const deptLabel = deptFilter.size === 0
    ? t('request.allDepts')
    : `${t('request.filterDept')} (${deptFilter.size})`

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('request.listTitle')}</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('request.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Department checkbox dropdown */}
        <div ref={deptRef} className="relative">
          <button
            onClick={() => setDeptOpen(v => !v)}
            className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap ${
              deptFilter.size > 0
                ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-300 text-gray-700'
            }`}>
            {deptLabel}
            <ChevronDown className={`w-4 h-4 transition-transform ${deptOpen ? 'rotate-180' : ''}`} />
          </button>
          {deptOpen && (
            <div className="absolute z-20 top-full mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px] max-h-64 overflow-y-auto">
              <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-blue-600"
                  checked={deptFilter.size === 0}
                  onChange={clearDeptFilter}
                />
                <span className="font-medium">{t('common.all')}</span>
              </label>
              {deptOptions.length > 0 && <div className="border-t border-gray-100 my-1" />}
              {deptOptions.map(name => (
                <label key={name} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-blue-600"
                    checked={deptFilter.has(name)}
                    onChange={() => toggleDept(name)}
                  />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Tab filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUSES.slice(0, 6).map(s => (
          <button key={s.value} onClick={() => setFilterStatus(s.value)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              filterStatus === s.value
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('request.noJobs')}</div>
        ) : (
          paginated.map(job => {
            const overdue = urgentSlaOverdue(job)
            const awo = activeWorkOrder(job)
            return (
            <Link key={job.id} to={`/requests/${job.id}`}
              className={`flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors block ${slaColor(job)}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-mono text-gray-400">{job.request_number}</span>
                  {job.is_urgent && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">{t('request.urgentTag')}</span>}
                  {job.guest_inhouse && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{t('request.guestTag')}</span>}
                  {job.work_orders?.some(w => w.ooo_room && !['cancelled','rejected','transferred'].includes(w.status)) && (
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded font-medium flex items-center gap-0.5">
                      <DoorClosed className="w-3 h-3" /> OOO
                    </span>
                  )}
                  <StatusBadge status={job.status} />
                  {overdue > 0 && (
                    <span className="text-xs px-1.5 py-0.5 bg-red-600 text-white rounded font-bold">
                      ⚠ {t('request.slaOverdue')} {fmtElapsed(overdue)}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{job.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                  <span>
                    {job.main_area?.name || t('common.other')}{job.sub_area ? ` › ${job.sub_area.name}` : ''}{job.other_location ? ` (${job.other_location})` : ''}
                  </span>
                  <span>·</span>
                  <span>{job.reporter?.full_name}{job.reporter?.department ? ` (${job.reporter.department})` : ''}</span>
                  {awo?.technician && (
                    <>
                      <span>·</span>
                      <span>
                        {t('request.techTag')}: {awo.technician.full_name}
                        {awo.accepted_at && (
                          <span className="text-gray-400 ml-1">
                            ({t('request.techAccepted')} {format(new Date(awo.accepted_at), 'd MMM HH:mm', { locale: dateLocale })})
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 text-right text-xs text-gray-400">
                <div>{job.reported_at ? format(new Date(job.reported_at), 'd MMM yy HH:mm', { locale: dateLocale }) : ''}</div>
                {SLA_OPEN.includes(job.status) && (
                  <div className={`mt-0.5 font-medium ${slaSettings[job.priority || 'normal'] && elapsedMins(job.created_at) >= slaSettings[job.priority || 'normal'] ? 'text-red-600' : 'text-gray-400'}`}>
                    ⏱ {fmtElapsed(elapsedMins(job.created_at))}
                  </div>
                )}
              </div>
            </Link>
          )})
        )}
      </div>

      {/* Pagination + count */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {filtered.length === 0 ? '0' : `${showFrom}–${showTo}`} / {filtered.length} {t('request.itemsCount')}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              .map((p, idx) =>
                p === '…' ? (
                  <span key={`ellipsis-${idx}`} className="px-1">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[28px] h-7 rounded text-xs font-medium ${
                      p === safePage
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}>
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
