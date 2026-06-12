import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'
import JobDrawer from '../components/common/JobDrawer'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { ChevronDown, ChevronRight, User, MapPin, BarChart2, Wrench, Trophy } from 'lucide-react'

// filter key → match function (ทำงานกับ list item จาก API)
const SUMMARY_FILTERS = {
  all:                { label: 'ทั้งหมด',          match: () => true },
  pending:            { label: 'รอรับงาน',         match: j => j.status === 'pending' },
  assigned:           { label: 'จ่ายงานแล้ว',      match: j => j.status === 'assigned' },
  in_progress:        { label: 'กำลังดำเนินการ',   match: j => j.status === 'in_progress' },
  pending_inspection: { label: 'รอตรวจ',           match: j => j.status === 'pending_inspection' },
  completed:          { label: 'เสร็จสิ้น',         match: j => j.status === 'completed' },
  reopened:           { label: 'ส่งซ่อมใหม่',      match: j => j.status === 'reopened' },
  urgent:             { label: 'งานด่วน',           match: j => j.is_urgent },
}

function getDefaultDates() {
  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) }
}

// ── Shared date filter bar ────────────────────────────
function DateFilter({ dateFrom, dateTo, onFromChange, onToChange, onSearch, onClear, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">จากวันที่</label>
          <input type="date" value={dateFrom} onChange={e => onFromChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ถึงวันที่</label>
          <input type="date" value={dateTo} onChange={e => onToChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        {children}
        <button onClick={onSearch}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          ค้นหา
        </button>
        <button onClick={onClear}
          className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          ล้าง
        </button>
      </div>
    </div>
  )
}

// ── Tab 1: Summary ────────────────────────────────────
function SummaryTab() {
  const defaults = getDefaultDates()
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)
  const [summary, setSummary] = useState(null)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedJobId, setSelectedJobId] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    try {
      const [s, l] = await Promise.all([api.getReportSummary(params), api.getReportList(params)])
      setSummary(s); setList(l)
    } finally { setLoading(false) }
  }

  function clear() {
    const d = getDefaultDates()
    setDateFrom(d.from); setDateTo(d.to); setActiveFilter('all')
  }

  const statCards = summary ? [
    { key: 'all',                label: 'ทั้งหมด',        value: summary.total,                color: 'bg-gray-100 text-gray-700',    activeColor: 'ring-gray-400' },
    { key: 'pending',            label: 'รอรับงาน',       value: summary.pending,               color: 'bg-yellow-100 text-yellow-700', activeColor: 'ring-yellow-400' },
    { key: 'assigned',           label: 'จ่ายงานแล้ว',    value: summary.assigned,              color: 'bg-blue-100 text-blue-700',    activeColor: 'ring-blue-400' },
    { key: 'in_progress',        label: 'กำลังดำเนินการ', value: summary.in_progress,           color: 'bg-indigo-100 text-indigo-700',activeColor: 'ring-indigo-400' },
    { key: 'pending_inspection', label: 'รอตรวจ',         value: summary.pending_inspection,    color: 'bg-orange-100 text-orange-700',activeColor: 'ring-orange-400' },
    { key: 'completed',          label: 'เสร็จสิ้น',      value: summary.completed,             color: 'bg-green-100 text-green-700',  activeColor: 'ring-green-400' },
    { key: 'reopened',           label: 'ส่งซ่อมใหม่',   value: summary.reopened,              color: 'bg-red-100 text-red-700',      activeColor: 'ring-red-400' },
    { key: 'urgent',             label: 'งานด่วน',        value: summary.urgent_count,          color: 'bg-rose-100 text-rose-700',    activeColor: 'ring-rose-400' },
  ] : []

  // กรองรายการตาม activeFilter (client-side)
  const filteredList = list.filter(SUMMARY_FILTERS[activeFilter]?.match ?? (() => true))

  return (
    <>
      <div className="space-y-4">
        <DateFilter dateFrom={dateFrom} dateTo={dateTo}
          onFromChange={setDateFrom} onToChange={setDateTo}
          onSearch={loadData} onClear={clear} />

        {summary && (
          <>
            {/* Stat Cards — กดเพื่อ filter */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {statCards.map(c => (
                <button
                  key={c.key}
                  onClick={() => setActiveFilter(c.key)}
                  className={`rounded-xl p-4 text-left transition-all ${c.color} ${
                    activeFilter === c.key
                      ? `ring-2 ${c.activeColor} shadow-md scale-[1.02]`
                      : 'opacity-80 hover:opacity-100 hover:shadow-sm'
                  }`}
                >
                  <p className="text-xs font-medium opacity-75">{c.label}</p>
                  <p className="text-3xl font-bold mt-1">{c.value}</p>
                  {activeFilter === c.key && (
                    <p className="text-xs mt-1 font-medium opacity-60">▼ กำลังแสดง</p>
                  )}
                </button>
              ))}
            </div>

            {summary.avg_completion_hours != null && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">เวลาเฉลี่ยในการซ่อม (แจ้ง → ซ่อมเสร็จ)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary.avg_completion_hours} ชั่วโมง</p>
              </div>
            )}
          </>
        )}

        {/* Job List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">
              {SUMMARY_FILTERS[activeFilter]?.label || 'ทั้งหมด'}
            </h2>
            <span className="text-sm text-gray-400">({filteredList.length} รายการ)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['เลขที่','วันที่แจ้ง','พื้นที่','ผู้แจ้ง','ประเภทงาน','สถานะ','ด่วน'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">กำลังโหลด...</td></tr>
                ) : filteredList.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">ไม่พบข้อมูล</td></tr>
                ) : filteredList.map(job => (
                  <tr key={job.id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedJobId(job.id)}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{job.request_number}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy HH:mm', { locale: th }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {job.main_area?.name || 'อื่นๆ'}{job.sub_area ? ` › ${job.sub_area.name}` : ''}{job.other_location ? ` (${job.other_location})` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs">{job.reporter?.full_name}<br/><span className="text-gray-400">{job.reporter?.department}</span></td>
                    <td className="px-4 py-3 text-xs">{job.issue_type?.name || job.other_issue || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-3 text-center text-sm">{job.is_urgent ? <span className="text-red-500 font-bold">!</span> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Job Detail Drawer */}
      {selectedJobId && (
        <JobDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}
    </>
  )
}

// ── Tab 2: Technician Report ──────────────────────────
function TechnicianTab() {
  const defaults = getDefaultDates()
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    try {
      const result = await api.getTechnicianReport(params)
      setData(result)
    } finally { setLoading(false) }
  }

  function clear() {
    const d = getDefaultDates()
    setDateFrom(d.from); setDateTo(d.to)
  }

  function toggleExpand(id) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  const STATUS_TH = {
    pending: 'รอรับงาน', assigned: 'จ่ายงานแล้ว', in_progress: 'กำลังดำเนินการ',
    pending_inspection: 'รอตรวจ', completed: 'เสร็จสิ้น', reopened: 'ส่งซ่อมใหม่', cancelled: 'ยกเลิก'
  }

  return (
    <div className="space-y-4">
      <DateFilter dateFrom={dateFrom} dateTo={dateTo}
        onFromChange={setDateFrom} onToChange={setDateTo}
        onSearch={loadData} onClear={clear} />

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">ไม่พบข้อมูลช่าง</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-600 font-medium">ช่างทั้งหมด</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{data.length} คน</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-600 font-medium">งานทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-700 mt-1">{data.reduce((s, t) => s + t.total, 0)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium">งานเสร็จทั้งหมด</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{data.reduce((s, t) => s + t.completed, 0)}</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4">
              <p className="text-xs text-yellow-600 font-medium">งานค้างอยู่</p>
              <p className="text-3xl font-bold text-yellow-700 mt-1">{data.reduce((s, t) => s + t.pending, 0)}</p>
            </div>
          </div>

          {/* Per-technician rows */}
          <div className="space-y-3">
            {data.map(tech => (
              <div key={tech.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header row */}
                <button onClick={() => toggleExpand(tech.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{tech.full_name}</p>
                    <p className="text-xs text-gray-500">{tech.position} · {tech.department}</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-gray-900">{tech.total}</p>
                      <p className="text-xs text-gray-400">รับงาน</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-green-600">{tech.completed}</p>
                      <p className="text-xs text-gray-400">เสร็จ</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-yellow-600">{tech.pending}</p>
                      <p className="text-xs text-gray-400">ค้าง</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-blue-600">{tech.avg_hours != null ? `${tech.avg_hours} ชม.` : '-'}</p>
                      <p className="text-xs text-gray-400">เฉลี่ย</p>
                    </div>
                    {expanded[tech.id] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {/* Detail rows */}
                {expanded[tech.id] && tech.jobs.length > 0 && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {['เลขที่','วันที่แจ้ง','พื้นที่','งาน','รับงานเมื่อ','เสร็จเมื่อ','สถานะ','ด่วน'].map(h => (
                            <th key={h} className="text-left px-4 py-2 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {tech.jobs.map((job, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-mono text-gray-400 whitespace-nowrap">{job.request_number}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                              {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy', { locale: th }) : '-'}
                            </td>
                            <td className="px-4 py-2 text-gray-700">{job.location || '-'}</td>
                            <td className="px-4 py-2 text-gray-700 max-w-xs truncate">{job.issue} — {job.description}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                              {job.assigned_at ? format(new Date(job.assigned_at), 'd MMM yy HH:mm', { locale: th }) : '-'}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                              {job.completed_at ? format(new Date(job.completed_at), 'd MMM yy HH:mm', { locale: th }) : '-'}
                            </td>
                            <td className="px-4 py-2"><StatusBadge status={job.status} /></td>
                            <td className="px-4 py-2 text-center">{job.is_urgent ? <span className="text-red-500 font-bold">!</span> : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {expanded[tech.id] && tech.jobs.length === 0 && (
                  <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-400">ไม่มีงานในช่วงเวลานี้</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab 3: Area Report ────────────────────────────────
function AreaTab() {
  const defaults = getDefaultDates()
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)
  const [areas, setAreas] = useState([])
  const [selectedMain, setSelectedMain] = useState('')
  const [selectedSub, setSelectedSub] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAreas().then(setAreas)
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (selectedMain) params.main_area_id = selectedMain
    if (selectedSub) params.sub_area_id = selectedSub
    if (filterStatus) params.status = filterStatus
    try {
      const result = await api.getAreaReport(params)
      setData(result)
    } finally { setLoading(false) }
  }

  function clear() {
    const d = getDefaultDates()
    setDateFrom(d.from); setDateTo(d.to)
    setSelectedMain(''); setSelectedSub(''); setFilterStatus('')
  }

  const selectedMainArea = areas.find(a => a.id === Number(selectedMain))
  const subAreas = selectedMainArea?.sub_areas?.filter(s => s.is_active) || []

  return (
    <div className="space-y-4">
      <DateFilter dateFrom={dateFrom} dateTo={dateTo}
        onFromChange={setDateFrom} onToChange={setDateTo}
        onSearch={loadData} onClear={clear}>
        <div>
          <label className="block text-xs text-gray-500 mb-1">พื้นที่หลัก</label>
          <select value={selectedMain}
            onChange={e => { setSelectedMain(e.target.value); setSelectedSub('') }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">ทั้งหมด</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {selectedMain && subAreas.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">พื้นที่ย่อย</label>
            <select value={selectedSub} onChange={e => setSelectedSub(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">ทั้งหมด</option>
              {subAreas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">สถานะ</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">ทั้งหมด</option>
            {['pending','assigned','in_progress','pending_inspection','completed','reopened','cancelled'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </DateFilter>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
      ) : !data ? null : (
        <>
          {/* Area summary table */}
          {data.summary?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-gray-900">สรุปตามพื้นที่ ({data.summary.length} พื้นที่)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['พื้นที่หลัก','พื้นที่ย่อย','ทั้งหมด','เสร็จสิ้น','ค้างอยู่','งานด่วน'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.summary.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{row.main_area}</td>
                        <td className="px-4 py-3 text-gray-600">{row.sub_area}</td>
                        <td className="px-4 py-3 font-bold text-gray-900">{row.total}</td>
                        <td className="px-4 py-3 text-green-600 font-medium">{row.completed}</td>
                        <td className="px-4 py-3 text-yellow-600 font-medium">{row.pending}</td>
                        <td className="px-4 py-3 text-center">{row.urgent > 0 ? <span className="text-red-500 font-bold">{row.urgent}</span> : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request list */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">รายการงานซ่อม ({data.requests?.length || 0} รายการ)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['เลขที่','วันที่แจ้ง','พื้นที่','ประเภทงาน','ผู้แจ้ง','ช่าง','สถานะ','ด่วน'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.requests?.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">ไม่พบข้อมูล</td></tr>
                  ) : data.requests?.map((job, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">{job.request_number}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-gray-600">
                        {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy HH:mm', { locale: th }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-medium">{job.main_area}</span>
                        {job.sub_area && job.sub_area !== '-' && <><br/><span className="text-gray-400">{job.sub_area}</span></>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{job.issue}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{job.reporter}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{job.technician}</td>
                      <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                      <td className="px-4 py-3 text-center">{job.is_urgent ? <span className="text-red-500 font-bold">!</span> : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab 4: Top Assets ─────────────────────────────────
function TopAssetsTab() {
  const defaults = getDefaultDates()
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    try { setData(await api.getTopAssets(params)) }
    finally { setLoading(false) }
  }

  function clear() { const d = getDefaultDates(); setDateFrom(d.from); setDateTo(d.to) }

  const maxTotal = data[0]?.total || 1

  return (
    <div className="space-y-4">
      <DateFilter dateFrom={dateFrom} dateTo={dateTo}
        onFromChange={setDateFrom} onToChange={setDateTo}
        onSearch={loadData} onClear={clear} />

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Top 5 อุปกรณ์/ประเภทงานที่เสียบ่อยที่สุด</h3>
        {loading ? (
          <div className="text-center text-gray-400 py-8 text-sm">กำลังโหลด...</div>
        ) : data.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">ไม่พบข้อมูล</div>
        ) : (
          <div className="space-y-4">
            {data.map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-blue-300'
                    }`}>{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.issue}</p>
                      {item.location && <p className="text-xs text-gray-400">{item.location}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900">{item.total}</span>
                    <span className="text-xs text-gray-400 ml-1">ครั้ง</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${(item.total / maxTotal) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>เสร็จแล้ว {item.completed} ครั้ง</span>
                  <span>ค้างอยู่ {item.pending} ครั้ง</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab 5: Staff KPI ──────────────────────────────────
function StaffKpiTab() {
  const defaults = getDefaultDates()
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    try { setData(await api.getStaffKpi(params)) }
    finally { setLoading(false) }
  }

  function clear() { const d = getDefaultDates(); setDateFrom(d.from); setDateTo(d.to) }

  return (
    <div className="space-y-4">
      <DateFilter dateFrom={dateFrom} dateTo={dateTo}
        onFromChange={setDateFrom} onToChange={setDateTo}
        onSearch={loadData} onClear={clear} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Staff Performance KPI</h3>
          <p className="text-xs text-gray-400 mt-0.5">เรียงตามจำนวนงานที่เสร็จ (มากสุดก่อน)</p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">ไม่พบข้อมูลช่าง</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['ชื่อช่าง','ตำแหน่ง/แผนก','รับงาน','เสร็จ','ค้าง','ช่างนอก',
                    'ถูกตีกลับ','เวลาตอบรับ (นาที)','เวลาซ่อมเฉลี่ย (ชม.)','ต้นทุนรวม (บาท)'].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map(tech => (
                  <tr key={tech.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">{tech.full_name}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{tech.position}<br/>{tech.department}</td>
                    <td className="px-3 py-3 font-bold text-gray-900">{tech.total_jobs}</td>
                    <td className="px-3 py-3 font-bold text-green-600">{tech.completed}</td>
                    <td className="px-3 py-3 text-yellow-600">{tech.pending}</td>
                    <td className="px-3 py-3 text-purple-600">{tech.external}</td>
                    <td className="px-3 py-3">
                      <span className={`font-bold ${tech.reopen_count > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {tech.reopen_count}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {tech.avg_response_minutes != null
                        ? <span className={`font-medium ${tech.avg_response_minutes > 30 ? 'text-red-500' : 'text-green-600'}`}>
                            {tech.avg_response_minutes}
                          </span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {tech.avg_repair_hours != null
                        ? <span className="font-medium text-blue-600">{tech.avg_repair_hours}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-medium">
                      {tech.total_cost > 0 ? tech.total_cost.toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab] = useState('summary')
  const tabs = [
    { key: 'summary', label: 'ภาพรวม', icon: BarChart2 },
    { key: 'technician', label: 'การทำงานช่าง', icon: User },
    { key: 'area', label: 'ประวัติตามพื้นที่', icon: MapPin },
    { key: 'top_assets', label: 'Top 5 เสียบ่อย', icon: Wrench },
    { key: 'staff_kpi', label: 'KPI ช่าง', icon: Trophy },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">รายงานการซ่อม</h1>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryTab />}
      {tab === 'technician' && <TechnicianTab />}
      {tab === 'area' && <AreaTab />}
      {tab === 'top_assets' && <TopAssetsTab />}
      {tab === 'staff_kpi' && <StaffKpiTab />}
    </div>
  )
}
