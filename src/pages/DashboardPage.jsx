import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'
import JobDrawer from '../components/common/JobDrawer'
import { ClipboardList, Clock, CheckCircle, AlertTriangle, Plus, ChevronRight, Wrench, DoorClosed } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedJobId, setSelectedJobId] = useState(null)

  useEffect(() => {
    api.getJobs({ limit: 20 }).then(setJobs).finally(() => setLoading(false))
  }, [])

  const pending = jobs.filter(j => j.status === 'pending').length
  const inProgress = jobs.filter(j => ['assigned', 'in_progress'].includes(j.status)).length
  const pendingInspection = jobs.filter(j => j.status === 'pending_inspection').length
  const urgent = jobs.filter(j => j.is_urgent && !['completed', 'cancelled'].includes(j.status)).length
  const externalTech = jobs.filter(j => j.status === 'external_tech').length
  const oooRooms = jobs.reduce((acc, j) => {
    const wo = j.work_orders?.find(w => w.ooo_room && ['assigned','in_progress','external'].includes(w.status))
    return acc + (wo ? (wo.ooo_days || 1) : 0)
  }, 0)
  const recentJobs = jobs.slice(0, 8)

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6">
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

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="รอรับงาน" value={pending} icon={ClipboardList} color="bg-yellow-50 text-yellow-600" />
          <StatCard label="กำลังดำเนินการ" value={inProgress} icon={Clock} color="bg-blue-50 text-blue-600" />
          <StatCard label="รอตรวจ" value={pendingInspection} icon={CheckCircle} color="bg-orange-50 text-orange-600" />
          <StatCard label="งานด่วน" value={urgent} icon={AlertTriangle} color="bg-red-50 text-red-600" />
          <StatCard label="รอช่างนอก" value={externalTech} icon={Wrench} color="bg-purple-50 text-purple-600" />
          <StatCard label="ห้องปิดบริการ" value={oooRooms} icon={DoorClosed} color="bg-gray-100 text-gray-600" />
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">งานซ่อมล่าสุด</h2>
            <Link to="/requests" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              ดูทั้งหมด <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
          ) : recentJobs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">ยังไม่มีงานซ่อม</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentJobs.map(job => (
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
