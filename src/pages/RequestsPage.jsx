import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/common/StatusBadge'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Search, Filter } from 'lucide-react'

const STATUSES = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'pending', label: 'รอรับงาน' },
  { value: 'assigned', label: 'จ่ายงานแล้ว' },
  { value: 'in_progress', label: 'กำลังดำเนินการ' },
  { value: 'pending_inspection', label: 'รอตรวจ' },
  { value: 'completed', label: 'เสร็จสิ้น' },
  { value: 'reopened', label: 'ส่งซ่อมใหม่' },
  { value: 'cancelled', label: 'ยกเลิก' },
]

export default function RequestsPage() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

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
      <h1 className="text-xl font-bold text-gray-900">รายการงานซ่อม</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหา..." 
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Tab filters for mobile-friendly status filtering */}
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
          <div className="p-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">ไม่พบงานซ่อม</div>
        ) : (
          filtered.map(job => (
            <Link key={job.id} to={`/requests/${job.id}`}
              className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors block">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-mono text-gray-400">{job.request_number}</span>
                  {job.is_urgent && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">ด่วน</span>}
                  {job.guest_inhouse && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">มีแขก</span>}
                  <StatusBadge status={job.status} />
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{job.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                  <span>
                    {job.main_area?.name || 'อื่นๆ'}{job.sub_area ? ` › ${job.sub_area.name}` : ''}{job.other_location ? ` (${job.other_location})` : ''}
                  </span>
                  <span>·</span>
                  <span>{job.reporter?.full_name} ({job.reporter?.department})</span>
                  {job.work_orders?.[0]?.technician && (
                    <><span>·</span><span>ช่าง: {job.work_orders[0].technician.full_name}</span></>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 text-right text-xs text-gray-400">
                {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy HH:mm', { locale: th }) : ''}
              </div>
            </Link>
          ))
        )}
      </div>

      <p className="text-xs text-gray-400 text-right">{filtered.length} รายการ</p>
    </div>
  )
}
