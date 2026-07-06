import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { api, activeWorkOrder } from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'
import JobDrawer from '../components/common/JobDrawer'
import { ClipboardList, Clock, CheckCircle, AlertTriangle, Plus, ChevronDown, ChevronRight, Wrench, DoorClosed, X, Zap, CheckSquare, Timer, ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { th as thLocale, enUS } from 'date-fns/locale'

function jobHasActiveOoo(j) {
  const today = new Date().toISOString().split('T')[0]
  return j.work_orders?.some(w =>
    w.ooo_room &&
    ['assigned', 'in_progress', 'external'].includes(w.status) &&
    (!w.ooo_end_date || w.ooo_end_date >= today)
  )
}

const FILTER_MATCH = {
  pending:        j => j.status === 'pending',
  inProgress:     j => ['assigned', 'in_progress'].includes(j.status),
  inspection:     j => j.status === 'pending_inspection',
  veryUrgent:     j => j.priority === 'very_urgent' && !['completed','cancelled'].includes(j.status),
  urgent:         j => j.is_urgent && j.priority !== 'very_urgent' && !['completed','cancelled'].includes(j.status),
  external:       j => j.status === 'external_tech',
  ooo:            jobHasActiveOoo,
  completedToday: j => true,
}

function StatCard({ label, value, icon: Icon, color, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left rounded-xl border p-5 transition-all ${
        active ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${active ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${active ? 'bg-blue-100 text-blue-600' : color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </button>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { lang, t } = useLang()
  const [jobs, setJobs] = useState([])
  const [completedToday, setCompletedToday] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null)
  const [slaSettings, setSlaSettings] = useState({})
  const [dashPage, setDashPage] = useState(1)
  const [now, setNow] = useState(Date.now())
  const dateLocale = lang === 'th' ? thLocale : enUS

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  function elapsedMins(createdAt) {
    return Math.floor((now - new Date(createdAt).getTime()) / 60000)
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
    if (activeWorkOrder(job)?.accepted_at) return 0
    const over = elapsedMins(job.created_at) - threshold
    return over > 0 ? over : 0
  }

  // Department filter
  const [departments, setDepartments] = useState([])
  const [deptFilter, setDeptFilter] = useState(new Set())
  const [deptOpen, setDeptOpen] = useState(false)
  const deptRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    api.getDepartments().then(d => { if (!cancelled) setDepartments(d) }).catch(() => {})
    api.getSLASettings().then(d => { if (!cancelled) setSlaSettings(d) }).catch(() => {})
    function refresh() {
      api.getJobs({ limit: 1000 }).then(d => { if (!cancelled) setJobs(d) }).finally(() => { if (!cancelled) setLoading(false) })
      api.getCompletedToday().then(d => { if (!cancelled) setCompletedToday(d) }).catch(() => { if (!cancelled) setCompletedToday([]) })
    }
    refresh()
    const id = setInterval(() => { if (!cancelled && document.visibilityState === 'visible') refresh() }, 30000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  useEffect(() => {
    function handler(e) {
      if (deptRef.current && !deptRef.current.contains(e.target)) setDeptOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggleDept(name) {
    setDeptFilter(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Merge active API depts + soft-deleted dept names still present in job data
  const deptOptions = (() => {
    const apiNames = departments.map(d => d.name)
    const apiSet = new Set(apiNames)
    const extra = [...new Set(jobs.map(j => j.reporter?.department).filter(Boolean))].filter(n => !apiSet.has(n))
    return [...apiNames, ...extra]
  })()

  // Apply dept filter — jobs with no reporter dept always shown
  const matchDept = j => deptFilter.size === 0 || !j.reporter?.department || deptFilter.has(j.reporter.department)
  const filteredJobs = jobs.filter(matchDept)
  const filteredToday = completedToday.filter(matchDept)

  const counts = {
    pending:        filteredJobs.filter(FILTER_MATCH.pending).length,
    inProgress:     filteredJobs.filter(FILTER_MATCH.inProgress).length,
    inspection:     filteredJobs.filter(FILTER_MATCH.inspection).length,
    veryUrgent:     filteredJobs.filter(FILTER_MATCH.veryUrgent).length,
    urgent:         filteredJobs.filter(FILTER_MATCH.urgent).length,
    external:       filteredJobs.filter(FILTER_MATCH.external).length,
    ooo:            filteredJobs.filter(jobHasActiveOoo).length,
    completedToday: filteredToday.length,
  }

  const filterLabelKey = {
    pending: 'dashboard.stats.pending', inProgress: 'dashboard.stats.inProgress',
    inspection: 'dashboard.stats.inspection', veryUrgent: 'dashboard.stats.veryUrgent',
    urgent: 'dashboard.stats.urgent', external: 'dashboard.stats.external',
    ooo: 'dashboard.stats.ooo', completedToday: 'dashboard.stats.completedToday',
  }

  const DASH_PAGE_SIZE = 20
  const activeFilteredJobs = activeFilter === 'completedToday'
    ? filteredToday
    : activeFilter
      ? filteredJobs.filter(FILTER_MATCH[activeFilter])
      : null

  const displayedJobs = activeFilteredJobs
    ? activeFilteredJobs.slice((dashPage - 1) * DASH_PAGE_SIZE, dashPage * DASH_PAGE_SIZE)
    : filteredJobs.slice(0, 8)

  const dashTotalPages = activeFilteredJobs
    ? Math.max(1, Math.ceil(activeFilteredJobs.length / DASH_PAGE_SIZE))
    : 1

  function toggleFilter(key) {
    setDashPage(1)
    setActiveFilter(prev => prev === key ? null : key)
  }

  const cards = [
    { key: 'pending',        labelKey: 'dashboard.stats.pending',        value: counts.pending,        icon: ClipboardList, color: 'bg-yellow-50 text-yellow-600' },
    { key: 'inProgress',     labelKey: 'dashboard.stats.inProgress',     value: counts.inProgress,     icon: Clock,         color: 'bg-blue-50 text-blue-600' },
    { key: 'inspection',     labelKey: 'dashboard.stats.inspection',     value: counts.inspection,     icon: CheckCircle,   color: 'bg-orange-50 text-orange-600' },
    { key: 'completedToday', labelKey: 'dashboard.stats.completedToday', value: counts.completedToday, icon: CheckSquare,   color: 'bg-green-50 text-green-600' },
    { key: 'veryUrgent',     labelKey: 'dashboard.stats.veryUrgent',     value: counts.veryUrgent,     icon: Zap,           color: 'bg-red-100 text-red-700' },
    { key: 'urgent',         labelKey: 'dashboard.stats.urgent',         value: counts.urgent,         icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
    { key: 'external',       labelKey: 'dashboard.stats.external',       value: counts.external,       icon: Wrench,        color: 'bg-purple-50 text-purple-600' },
    { key: 'ooo',            labelKey: 'dashboard.stats.ooo',            value: counts.ooo,            icon: DoorClosed,    color: 'bg-gray-100 text-gray-600' },
  ]

  const deptLabel = deptFilter.size === 0
    ? t('request.allDepts')
    : `${t('request.filterDept')} (${deptFilter.size})`

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('dashboard.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('dashboard.greeting')}, {user?.full_name}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Department filter */}
            <div ref={deptRef} className="relative">
              <button
                onClick={() => setDeptOpen(v => !v)}
                className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm focus:outline-none whitespace-nowrap ${
                  deptFilter.size > 0
                    ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-300 text-gray-700 bg-white'
                }`}>
                {deptLabel}
                <ChevronDown className={`w-4 h-4 transition-transform ${deptOpen ? 'rotate-180' : ''}`} />
              </button>
              {deptOpen && (
                <div className="absolute z-20 top-full mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px] max-h-64 overflow-y-auto">
                  <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                    <input type="checkbox" className="w-4 h-4 rounded accent-blue-600"
                      checked={deptFilter.size === 0}
                      onChange={() => setDeptFilter(new Set())} />
                    <span className="font-medium">{t('common.all')}</span>
                  </label>
                  {deptOptions.length > 0 && <div className="border-t border-gray-100 my-1" />}
                  {deptOptions.map(name => (
                    <label key={name} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                      <input type="checkbox" className="w-4 h-4 rounded accent-blue-600"
                        checked={deptFilter.has(name)}
                        onChange={() => toggleDept(name)} />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Link to="/new-request"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
              {t('dashboard.addRequest')}
            </Link>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(c => (
            <StatCard key={c.key} label={t(c.labelKey)} value={c.value} icon={c.icon}
              color={c.color} active={activeFilter === c.key} onClick={() => toggleFilter(c.key)} />
          ))}
        </div>

        {/* Job List */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">
                {activeFilter ? t(filterLabelKey[activeFilter]) : t('dashboard.recentJobs')}
              </h2>
              {activeFilter && (
                <button onClick={() => setActiveFilter(null)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full transition-colors">
                  <X className="w-3 h-3" /> {t('dashboard.clearFilter')}
                </button>
              )}
            </div>
            {!activeFilter && (
              <Link to="/requests" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                {t('dashboard.viewAll')} <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
          ) : displayedJobs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {activeFilter ? `${t('dashboard.noJobsInFilter')} "${t(filterLabelKey[activeFilter])}"` : t('dashboard.noJobs')}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {displayedJobs.map(job => {
                const overdue = urgentSlaOverdue(job)
                const awo = activeWorkOrder(job)
                return (
                <button key={job.id} onClick={() => setSelectedJobId(job.id)}
                  className="w-full flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-400">{job.request_number}</span>
                      {job.priority === 'very_urgent' && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-600 text-white rounded font-bold">🚨 {t('priority.very_urgent')}</span>
                      )}
                      {job.priority === 'urgent' && job.priority !== 'very_urgent' && (
                        <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">🔴 {t('priority.urgent')}</span>
                      )}
                      {jobHasActiveOoo(job) && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded font-medium flex items-center gap-0.5">
                          <DoorClosed className="w-3 h-3" /> OOO
                        </span>
                      )}
                      {overdue > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-600 text-white rounded font-bold flex items-center gap-0.5">
                          <Timer className="w-3 h-3" /> {t('request.slaOverdue')} {fmtElapsed(overdue)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{job.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {job.main_area?.name}{job.sub_area ? ` › ${job.sub_area.name}` : ''}{job.other_location ? ` (${job.other_location})` : ''}
                      {' · '}{job.reporter?.full_name}{job.reporter?.department ? ` (${job.reporter.department})` : ''}
                      {awo?.technician && (
                        <>
                          {' · '}{t('request.techTag')}: {awo.technician.full_name}
                          {awo.accepted_at && (
                            <span className="text-gray-400 ml-1">
                              ({t('request.techAccepted')} {format(new Date(awo.accepted_at), 'd MMM HH:mm', { locale: dateLocale })})
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <StatusBadge status={job.status} />
                    <p className="text-xs text-gray-400 mt-1">
                      {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy', { locale: dateLocale }) : ''}
                    </p>
                  </div>
                </button>
              )})}
            </div>
          )}

          {/* Pagination — shown only when a filter is active and results span multiple pages */}
          {activeFilter && dashTotalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              <span>{activeFilteredJobs?.length} {t('request.itemsCount')}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setDashPage(p => Math.max(1, p - 1))} disabled={dashPage === 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2">{dashPage} / {dashTotalPages}</span>
                <button onClick={() => setDashPage(p => Math.min(dashTotalPages, p + 1))} disabled={dashPage === dashTotalPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedJobId && (
        <JobDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)}
          onUpdate={() => {
            api.getJobs({ limit: 1000 }).then(setJobs).catch(() => {})
            api.getCompletedToday().then(setCompletedToday).catch(() => {})
          }} />
      )}
    </>
  )
}
