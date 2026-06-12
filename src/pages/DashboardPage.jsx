import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'
import JobDrawer from '../components/common/JobDrawer'
import { ClipboardList, Clock, CheckCircle, AlertTriangle, Plus, ChevronRight, Wrench, DoorClosed, X } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

// filter key → label และ predicate
const FILTERS = {
  pending:     { label: 'รอรับงาน',         match: j => j.status === 'pending' },
  inProgress:  { label: 'กำลังดำเนินการ',   match: j => ['assigned', 'in_progress'].includes(j.status) },
  inspection:  { label: 'รอตรวจ',           match: j => j.status === 'pending_inspection' },
  urgent:      { label: 'งานด่วน',          match: j => j.is_urgent && !['completed', 'cancelled'].includes(j.status) },
  external:    { label: 'รอช่างนอก',        match: j => j.status === 'external_tech' },
  ooo:         { label: 'ห้องปิดบริการ',    match: j => j.work_orders?.some(w => w.ooo_room && ['assigned','in_progress','external'].includes(w.status)) },
}

function StatCard({ label, value, icon: Icon, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-5 transition-all ${
        active
          ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
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
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null) // key of FILTERS or null

  useEffect(() => {
    api.getJobs({ limit: 100 }).then(setJobs).finally(() => setLoading(false))
  }, [])

  // นับจำนวนแต่ละประเภท
  const counts = {
    pending:    jobs.filter(FILTERS.pending.match).length,
    inProgress: jobs.filter(FILTERS.inProgress.match).length,
    inspection: jobs.filter(FILTERS.inspection.match).length,
    urgent:     jobs.filter(FILTERS.urgent.match).length,
    external:   jobs.filter(FILTERS.external.match).length,
    ooo:        jobs.reduce((acc, j) => {
      const wo = j.work_orders?.find(w => w.ooo_room && ['assigned','in_progress','external'].includes(w.status))
      return acc + (wo ? (wo.ooo_days || 1) : 0)
    }, 0),
  }

  // รายการที่แสดง — ถ้ามี filter ใช้ filter, ถ้าไม่มีแสดง 8 รายการล่าสุด
  const displayedJobs = activeFilter
    ? jobs.filter(FILTERS[activeFilter].match)
    : jobs.slice(0, 8)

  function toggleFilter(key) {
    setActiveFilter(prev => prev === key ? null : key)
  }

  const cards = [
    { key: 'pending',    label: 'รอรับงาน',       value: counts.pending,    icon: ClipboardList, color: 'bg-yellow-50 text-yellow-600' },
    { key: 'inProgress', label: 'กำลังดำเนินการ', value: counts.inProgress, icon: Clock,          color: 'bg-blue-50 text-blue-600' },
    { key: 'inspection', label: 'รอตรวจ',         value: counts.inspection, icon: CheckCircle,   color: 'bg-orange-50 text-orange-600' },
    { key: 'urgent',     label: 'งานด่วน',        value: counts.urgent,     icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
    { key: 'external',   label: 'รอช่างนอก',      value: counts.external,   icon: Wrench,        color: 'bg-purple-50 text-purple-600' },
    { key: 'ooo',        label: 'ห้องปิดบริการ',  value: counts.ooo,        icon: DoorClosed,    color: 'bg-gray-100 text-gray-600' },
  ]

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">แดชบอร์ด</h1>
            <p className="text-sm text-gray-500 mt-0.5">สวัสดี, {user?.full_name}</p>
          </div>
          <Link to="/new-request"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            แจ้งซ่อม
          </Link>
        </div>

        {/* Stat Cards — กดเพื่อ filter */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => (
            <StatCard
              key={c.key}
              label={c.label}
              value={c.value}
              icon={c.icon}
              color={c.color}
              active={activeFilter === c.key}
              onClick={() => toggleFilter(c.key)}
            />
          ))}
        </div>

        {/* Job List */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">
                {activeFilter ? FILTERS[activeFilter].label : 'งานซ่อมล่าสุด'}
              </h2>
              {activeFilter && (
                <button
                  onClick={() => setActiveFilter(null)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full transition-colors">
                  <X className="w-3 h-3" /> ล้างตัวกรอง
                </button>
              )}
            </div>
            {!activeFilter && (
              <Link to="/requests" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                ดูทั้งหมด <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
          ) : displayedJobs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {activeFilter ? `ไม่มีงานในหมวด "${FILTERS[activeFilter].label}"` : 'ยังไม่มีงานซ่อม'}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {displayedJobs.map(job => (
                <button key={job.id} onClick={() => setSelectedJobId(job.id)}
                  className="w-full flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-400">{job.request_number}</span>
                      {job.is_urgent && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">ด่วน</span>
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
                      {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy', { locale: th }) : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Job Detail Drawer */}
      {selectedJobId && (
        <JobDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}
    </>
  )
}
