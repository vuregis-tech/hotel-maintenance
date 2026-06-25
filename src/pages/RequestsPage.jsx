import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import StatusBadge from '../components/common/StatusBadge'
import { format } from 'date-fns'
import { th as thLocale, enUS } from 'date-fns/locale'
import { Search, DoorClosed } from 'lucide-react'

export default function RequestsPage() {
  const { user } = useAuth()
  const { lang, t } = useLang()
  const dateLocale = lang === 'th' ? thLocale : enUS

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

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
    setLoading(true)
    api.getJobs({ status: filterStatus || undefined })
      .then(setJobs)
      .finally(() => setLoading(false))
  }, [filterStatus])

  const filtered = jobs.filter(j =>
    !search || j.description.toLowerCase().includes(search.toLowerCase()) ||
    j.request_number.toLowerCase().includes(search.toLowerCase()) ||
    j.reporter?.full_name?.toLowerCase().includes(search.toLowerCase())
  )

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
          filtered.map(job => (
            <Link key={job.id} to={`/requests/${job.id}`}
              className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors block">
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
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{job.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                  <span>
                    {job.main_area?.name || t('common.other')}{job.sub_area ? ` › ${job.sub_area.name}` : ''}{job.other_location ? ` (${job.other_location})` : ''}
                  </span>
                  <span>·</span>
                  <span>{job.reporter?.full_name} ({job.reporter?.department})</span>
                  {job.work_orders?.[0]?.technician && (
                    <><span>·</span><span>{t('request.techTag')}: {job.work_orders[0].technician.full_name}</span></>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 text-right text-xs text-gray-400">
                {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy HH:mm', { locale: dateLocale }) : ''}
              </div>
            </Link>
          ))
        )}
      </div>

      <p className="text-xs text-gray-400 text-right">{filtered.length} {t('request.itemsCount')}</p>
    </div>
  )
}
