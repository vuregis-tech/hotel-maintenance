import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { api } from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'
import JobDrawer from '../components/common/JobDrawer'
import { ClipboardList, Clock, CheckCircle, AlertTriangle, Plus, ChevronRight, Wrench, DoorClosed, X, Zap, CheckSquare } from 'lucide-react'
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
  urgent:         j => j.is_urgent && !['completed','cancelled'].includes(j.status),
  external:       j => j.status === 'external_tech',
  ooo:            jobHasActiveOoo,
  completedToday: j => true, // handled by separate list
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
  const dateLocale = lang === 'th' ? thLocale : enUS

  useEffect(() => {
    api.getJobs({ limit: 100 }).then(setJobs).finally(() => setLoading(false))
    api.getCompletedToday().then(setCompletedToday).catch(() => setCompletedToday([]))
  }, [])

  const counts = {
    pending:        jobs.filter(FILTER_MATCH.pending).length,
    inProgress:     jobs.filter(FILTER_MATCH.inProgress).length,
    inspection:     jobs.filter(FILTER_MATCH.inspection).length,
    veryUrgent:     jobs.filter(FILTER_MATCH.veryUrgent).length,
    urgent:         jobs.filter(FILTER_MATCH.urgent).length,
    external:       jobs.filter(FILTER_MATCH.external).length,
    ooo:            jobs.filter(jobHasActiveOoo).length,
    completedToday: completedToday.length,
  }

  const filterLabelKey = {
    pending: 'dashboard.stats.pending', inProgress: 'dashboard.stats.inProgress',
    inspection: 'dashboard.stats.inspection', veryUrgent: 'dashboard.stats.veryUrgent',
    urgent: 'dashboard.stats.urgent', external: 'dashboard.stats.external',
    ooo: 'dashboard.stats.ooo', completedToday: 'dashboard.stats.completedToday',
  }

  const displayedJobs = activeFilter === 'completedToday'
    ? completedToday
    : activeFilter
      ? jobs.filter(FILTER_MATCH[activeFilter])
      : jobs.slice(0, 8)

  function toggleFilter(key) {
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

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('dashboard.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('dashboard.greeting')}, {user?.full_name}</p>
          </div>
          <Link to="/new-request"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            {t('dashboard.addRequest')}
          </Link>
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
              {displayedJobs.map(job => (
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
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{job.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {job.main_area?.name}{job.sub_area ? ` › ${job.sub_area.name}` : ''}{job.other_location ? ` (${job.other_location})` : ''}
                      {' · '}{job.reporter?.full_name}{job.reporter?.department ? ` (${job.reporter.department})` : ''}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <StatusBadge status={job.status} />
                    <p className="text-xs text-gray-400 mt-1">
                      {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy', { locale: dateLocale }) : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedJobId && (
        <JobDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)}
          onUpdate={updated => {
            setJobs(prev => prev.map(j => j.id === updated.id ? updated : j))
            setCompletedToday(prev => prev.map(j => j.id === updated.id ? updated : j))
          }} />
      )}
    </>
  )
}
