import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useLang } from '../context/LangContext'
import StatusBadge from '../components/common/StatusBadge'
import JobDrawer from '../components/common/JobDrawer'
import { format } from 'date-fns'
import { th as thLocale, enUS } from 'date-fns/locale'
import { ChevronDown, ChevronRight, User, MapPin, BarChart2, Wrench, Trophy, DoorClosed, Package, Download, History } from 'lucide-react'
import * as XLSX from 'xlsx'

function getDefaultDates() {
  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) }
}

// ── Shared date filter bar ────────────────────────────
function DateFilter({ dateFrom, dateTo, onFromChange, onToChange, onSearch, onClear, children }) {
  const { t } = useLang()
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('reports.dateFrom')}</label>
          <input type="date" value={dateFrom} onChange={e => onFromChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('reports.dateTo')}</label>
          <input type="date" value={dateTo} onChange={e => onToChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        {children}
        <button onClick={onSearch}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          {t('reports.search')}
        </button>
        <button onClick={onClear}
          className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          {t('reports.clear')}
        </button>
      </div>
    </div>
  )
}

// ── Tab 1: Summary ────────────────────────────────────
function SummaryTab() {
  const { lang, t } = useLang()
  const dateLocale = lang === 'th' ? thLocale : enUS
  const defaults = getDefaultDates()
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)
  const [summary, setSummary] = useState(null)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [departments, setDepartments] = useState([])
  const [deptFilter, setDeptFilter] = useState('')

  const SUMMARY_FILTERS = {
    all:                { label: t('reports.stats.all'),              match: () => true },
    pending:            { label: t('reports.stats.pending'),          match: j => j.status === 'pending' },
    assigned:           { label: t('reports.stats.assigned'),         match: j => j.status === 'assigned' },
    in_progress:        { label: t('reports.stats.inProgress'),       match: j => j.status === 'in_progress' },
    pending_inspection: { label: t('reports.stats.pendingInspection'),match: j => j.status === 'pending_inspection' },
    completed:          { label: t('reports.stats.completed'),        match: j => j.status === 'completed' },
    reopened:           { label: t('reports.stats.reopened'),         match: j => j.status === 'reopened' },
    urgent:             { label: t('reports.stats.urgent'),           match: j => j.is_urgent },
    external_tech:      { label: t('reports.stats.externalTech'),     match: j => j.status === 'external_tech' },
    ooo:                { label: t('reports.stats.ooo'),              match: j => {
      const today = new Date().toISOString().split('T')[0]
      return j.work_orders?.some(w =>
        w.ooo_room &&
        ['assigned', 'in_progress', 'external'].includes(w.status) &&
        (!w.ooo_end_date || w.ooo_end_date >= today)
      )
    }},
  }

  useEffect(() => {
    loadData()
    api.getDepartments().then(setDepartments).catch(() => {})
  }, [])

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
    setDateFrom(d.from); setDateTo(d.to); setActiveFilter('all'); setDeptFilter('')
  }

  const deptOptions = (() => {
    const apiNames = departments.map(d => d.name)
    const apiSet = new Set(apiNames)
    const extra = [...new Set(list.map(j => j.reporter?.department).filter(Boolean))].filter(n => !apiSet.has(n))
    return [...apiNames, ...extra]
  })()

  const statCards = summary ? [
    { key: 'all',                label: t('reports.stats.all'),               value: summary.total,               color: 'bg-gray-100 text-gray-700',    activeColor: 'ring-gray-400' },
    { key: 'pending',            label: t('reports.stats.pending'),           value: summary.pending,             color: 'bg-yellow-100 text-yellow-700', activeColor: 'ring-yellow-400' },
    { key: 'assigned',           label: t('reports.stats.assigned'),          value: summary.assigned,            color: 'bg-blue-100 text-blue-700',    activeColor: 'ring-blue-400' },
    { key: 'in_progress',        label: t('reports.stats.inProgress'),        value: summary.in_progress,         color: 'bg-indigo-100 text-indigo-700',activeColor: 'ring-indigo-400' },
    { key: 'pending_inspection', label: t('reports.stats.pendingInspection'), value: summary.pending_inspection,  color: 'bg-orange-100 text-orange-700',activeColor: 'ring-orange-400' },
    { key: 'completed',          label: t('reports.stats.completed'),         value: summary.completed,           color: 'bg-green-100 text-green-700',  activeColor: 'ring-green-400' },
    { key: 'reopened',           label: t('reports.stats.reopened'),          value: summary.reopened,            color: 'bg-red-100 text-red-700',      activeColor: 'ring-red-400' },
    { key: 'urgent',             label: t('reports.stats.urgent'),            value: summary.urgent_count,        color: 'bg-rose-100 text-rose-700',    activeColor: 'ring-rose-400' },
    { key: 'external_tech',      label: t('reports.stats.externalTech'),      value: summary.external_tech,       color: 'bg-purple-100 text-purple-700',activeColor: 'ring-purple-400' },
    { key: 'ooo',                label: t('reports.stats.ooo'),               value: summary.ooo_count,           color: 'bg-gray-100 text-gray-700',    activeColor: 'ring-gray-400' },
  ] : []

  const filteredList = list.filter(j => {
    const matchDept = !deptFilter || !j.reporter?.department || j.reporter.department === deptFilter
    return matchDept && (SUMMARY_FILTERS[activeFilter]?.match ?? (() => true))(j)
  })

  const colHeaders = [
    t('reports.col.no'), t('reports.col.reportedAt'), t('reports.col.area'),
    t('reports.col.reporter'), t('reports.col.issueType'), t('reports.col.status'), t('reports.col.urgent'),
  ]

  return (
    <>
      <div className="space-y-4">
        <DateFilter dateFrom={dateFrom} dateTo={dateTo}
          onFromChange={setDateFrom} onToChange={setDateTo}
          onSearch={loadData} onClear={clear}>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('request.filterDept')}</label>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">{t('common.all')}</option>
              {deptOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </DateFilter>

        {summary && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {statCards.map(c => (
                <button key={c.key} onClick={() => setActiveFilter(c.key)}
                  className={`rounded-xl p-4 text-left transition-all ${c.color} ${
                    activeFilter === c.key ? `ring-2 ${c.activeColor} shadow-md scale-[1.02]` : 'opacity-80 hover:opacity-100 hover:shadow-sm'
                  }`}>
                  <p className="text-xs font-medium opacity-75">{c.label}</p>
                  <p className="text-3xl font-bold mt-1">{c.value}</p>
                  {activeFilter === c.key && (
                    <p className="text-xs mt-1 font-medium opacity-60">{t('reports.showing')}</p>
                  )}
                </button>
              ))}
            </div>

            {summary.avg_completion_hours != null && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">{t('reports.avgRepairTime')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary.avg_completion_hours} {t('reports.hours')}</p>
              </div>
            )}
          </>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">
              {SUMMARY_FILTERS[activeFilter]?.label || t('reports.stats.all')}
            </h2>
            <span className="text-sm text-gray-400">({filteredList.length} {t('reports.items')})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {colHeaders.map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('common.loading')}</td></tr>
                ) : filteredList.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('reports.noFound')}</td></tr>
                ) : filteredList.map(job => (
                  <tr key={job.id} className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => setSelectedJobId(job.id)}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{job.request_number}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy HH:mm', { locale: dateLocale }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {job.main_area?.name || t('common.other')}{job.sub_area ? ` › ${job.sub_area.name}` : ''}{job.other_location ? ` (${job.other_location})` : ''}
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

      {selectedJobId && (
        <JobDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}
    </>
  )
}

// ── Tab 2: Technician Report ──────────────────────────
function TechnicianTab() {
  const { lang, t } = useLang()
  const dateLocale = lang === 'th' ? thLocale : enUS
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
    try { setData(await api.getTechnicianReport(params)) }
    finally { setLoading(false) }
  }

  function clear() { const d = getDefaultDates(); setDateFrom(d.from); setDateTo(d.to) }
  function toggleExpand(id) { setExpanded(e => ({ ...e, [id]: !e[id] })) }

  const detailHeaders = [
    t('reports.col.no'), t('reports.col.reportedAt'), t('reports.col.area'),
    t('reports.col.job'), t('reports.col.acceptedAt'), t('reports.col.completedAt'),
    t('reports.col.status'), t('reports.col.urgent'),
  ]

  return (
    <div className="space-y-4">
      <DateFilter dateFrom={dateFrom} dateTo={dateTo}
        onFromChange={setDateFrom} onToChange={setDateTo}
        onSearch={loadData} onClear={clear} />

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">{t('reports.noDataTech')}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-600 font-medium">{t('reports.tech.totalTechs')}</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{data.length} {t('reports.tech.unit')}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-600 font-medium">{t('reports.tech.totalJobs')}</p>
              <p className="text-3xl font-bold text-gray-700 mt-1">{data.reduce((s, t) => s + t.total, 0)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium">{t('reports.tech.completedJobs')}</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{data.reduce((s, t) => s + t.completed, 0)}</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4">
              <p className="text-xs text-yellow-600 font-medium">{t('reports.tech.pendingJobs')}</p>
              <p className="text-3xl font-bold text-yellow-700 mt-1">{data.reduce((s, t) => s + t.pending, 0)}</p>
            </div>
          </div>

          <div className="space-y-3">
            {data.map(tech => (
              <div key={tech.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                      <p className="text-xs text-gray-400">{t('reports.tech.assigned')}</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-green-600">{tech.completed}</p>
                      <p className="text-xs text-gray-400">{t('reports.tech.completed')}</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-yellow-600">{tech.pending}</p>
                      <p className="text-xs text-gray-400">{t('reports.tech.pending')}</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-blue-600">{tech.avg_hours != null ? `${tech.avg_hours} ${t('reports.hrUnit')}` : '-'}</p>
                      <p className="text-xs text-gray-400">{t('reports.tech.avg')}</p>
                    </div>
                    {expanded[tech.id] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {expanded[tech.id] && tech.jobs.length > 0 && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {detailHeaders.map(h => (
                            <th key={h} className="text-left px-4 py-2 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {tech.jobs.map((job, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-mono text-gray-400 whitespace-nowrap">{job.request_number}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                              {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy', { locale: dateLocale }) : '-'}
                            </td>
                            <td className="px-4 py-2 text-gray-700">{job.location || '-'}</td>
                            <td className="px-4 py-2 text-gray-700 max-w-xs truncate">{job.issue} — {job.description}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                              {job.assigned_at ? format(new Date(job.assigned_at), 'd MMM yy HH:mm', { locale: dateLocale }) : '-'}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                              {job.completed_at ? format(new Date(job.completed_at), 'd MMM yy HH:mm', { locale: dateLocale }) : '-'}
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
                  <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-400">{t('reports.tech.noJobsInPeriod')}</div>
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
  const { lang, t } = useLang()
  const dateLocale = lang === 'th' ? thLocale : enUS
  const defaults = getDefaultDates()
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)
  const [areas, setAreas] = useState([])
  const [selectedMain, setSelectedMain] = useState('')
  const [selectedSub, setSelectedSub] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [areaSel, setAreaSel] = useState(null)          // แถวสรุปพื้นที่ที่เลือก (drill-down)
  const [selectedJobId, setSelectedJobId] = useState(null)

  useEffect(() => { api.getAreas().then(setAreas); loadData() }, [])

  async function loadData() {
    setLoading(true)
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (selectedMain) params.main_area_id = selectedMain
    if (selectedSub) params.sub_area_id = selectedSub
    if (filterStatus) params.status = filterStatus
    setAreaSel(null)
    try { setData(await api.getAreaReport(params)) }
    finally { setLoading(false) }
  }

  function clear() {
    const d = getDefaultDates()
    setDateFrom(d.from); setDateTo(d.to)
    setSelectedMain(''); setSelectedSub(''); setFilterStatus('')
  }

  const selectedMainArea = areas.find(a => a.id === Number(selectedMain))
  const subAreas = selectedMainArea?.sub_areas?.filter(s => s.is_active) || []

  // Drill-down: กรองรายการงานตามแถวสรุปพื้นที่ที่เลือก
  const filteredRequests = (data?.requests || []).filter(job =>
    !areaSel ||
    ((job.main_area_id ?? null) === (areaSel.main_area_id ?? null) &&
     (job.sub_area_id ?? null) === (areaSel.sub_area_id ?? null) &&
     (areaSel.sub_area_id != null || job.sub_area === areaSel.sub_area))
  )

  const areaSummaryHeaders = [
    t('reports.col.mainArea'), t('reports.col.subArea'), t('reports.col.total'),
    t('reports.col.completed'), t('reports.col.pending'), t('reports.col.urgent'),
  ]
  const areaRequestHeaders = [
    t('reports.col.no'), t('reports.col.reportedAt'), t('reports.col.area'),
    t('reports.col.issueType'), t('reports.col.reporter'), t('reports.col.technician'),
    t('reports.col.status'), t('reports.col.urgent'),
  ]

  return (
    <div className="space-y-4">
      <DateFilter dateFrom={dateFrom} dateTo={dateTo}
        onFromChange={setDateFrom} onToChange={setDateTo}
        onSearch={loadData} onClear={clear}>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('reports.area.filterMainArea')}</label>
          <select value={selectedMain}
            onChange={e => { setSelectedMain(e.target.value); setSelectedSub('') }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">{t('common.all')}</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {selectedMain && subAreas.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('reports.area.filterSubArea')}</label>
            <select value={selectedSub} onChange={e => setSelectedSub(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">{t('common.all')}</option>
              {subAreas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('reports.area.filterStatus')}</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">{t('common.all')}</option>
            {['pending','assigned','in_progress','external_tech','pending_inspection','completed','reopened','cancelled'].map(s => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
        </div>
      </DateFilter>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
      ) : !data ? null : (
        <>
          {data.summary?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-gray-900">{t('reports.area.summary')} ({data.summary.length} {t('reports.area.areas')})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {areaSummaryHeaders.map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.summary.map((row, i) => {
                      const isSel = areaSel &&
                        areaSel.main_area_id === row.main_area_id &&
                        areaSel.sub_area_id === row.sub_area_id &&
                        areaSel.sub_area === row.sub_area
                      return (
                        <tr key={i}
                          onClick={() => setAreaSel(isSel ? null : {
                            main_area_id: row.main_area_id, sub_area_id: row.sub_area_id, sub_area: row.sub_area,
                          })}
                          className={`cursor-pointer transition-colors ${isSel ? 'bg-blue-50' : 'hover:bg-blue-50/50'}`}>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            <span className="flex items-center gap-1.5">
                              {isSel ? <ChevronDown className="w-3.5 h-3.5 text-blue-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                              {row.main_area}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{row.sub_area}</td>
                          <td className="px-4 py-3 font-bold text-gray-900">{row.total}</td>
                          <td className="px-4 py-3 text-green-600 font-medium">{row.completed}</td>
                          <td className="px-4 py-3 text-yellow-600 font-medium">{row.pending}</td>
                          <td className="px-4 py-3 text-center">{row.urgent > 0 ? <span className="text-red-500 font-bold">{row.urgent}</span> : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900">{t('reports.area.requests')} ({filteredRequests.length} {t('reports.items')})</h3>
              {areaSel && (
                <button onClick={() => setAreaSel(null)}
                  className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium hover:bg-blue-200">
                  {areaSel.sub_area} ✕
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {areaRequestHeaders.map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRequests.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{t('reports.noFound')}</td></tr>
                  ) : filteredRequests.map((job, i) => (
                    <tr key={i} onClick={() => job.id && setSelectedJobId(job.id)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">{job.request_number}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-gray-600">
                        {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy HH:mm', { locale: dateLocale }) : '-'}
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

      {selectedJobId && (
        <JobDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}
    </div>
  )
}

// ── Tab 4: Top Assets ─────────────────────────────────
function TopAssetsTab() {
  const { lang, t } = useLang()
  const dateLocale = lang === 'th' ? thLocale : enUS
  const defaults = getDefaultDates()
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)         // index ของรายการที่กดขยาย
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [groupBy, setGroupBy] = useState('spot')         // 'spot' = ตามจุด | 'issue' = ตามประเภทงานรวม

  useEffect(() => { loadData(groupBy) }, [groupBy])

  async function loadData(mode = groupBy) {
    setLoading(true)
    setExpanded(null)
    const params = { group_by: mode }
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
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-gray-900">{t('reports.topAssets.title')}</h3>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            <button onClick={() => setGroupBy('spot')}
              className={`px-3 py-1.5 transition-colors ${groupBy === 'spot' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {t('reports.topAssets.bySpot')}
            </button>
            <button onClick={() => setGroupBy('issue')}
              className={`px-3 py-1.5 transition-colors border-l border-gray-200 ${groupBy === 'issue' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {t('reports.topAssets.byIssue')}
            </button>
          </div>
        </div>
        {loading ? (
          <div className="text-center text-gray-400 py-8 text-sm">{t('common.loading')}</div>
        ) : data.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">{t('reports.noFound')}</div>
        ) : (
          <div className="space-y-4">
            {data.map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between cursor-pointer rounded-lg -mx-2 px-2 py-1 hover:bg-blue-50 transition-colors"
                  onClick={() => setExpanded(expanded === i ? null : i)}>
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-blue-300'
                    }`}>{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.issue}</p>
                      {groupBy === 'issue'
                        ? <p className="text-xs text-gray-400">{item.locations_count} {t('reports.topAssets.spots')}</p>
                        : item.location && <p className="text-xs text-gray-400">{item.location}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900">{item.total}</span>
                      <span className="text-xs text-gray-400 ml-1">{t('reports.topAssets.times')}</span>
                    </div>
                    {expanded === i
                      ? <ChevronDown className="w-4 h-4 text-blue-500" />
                      : <ChevronRight className="w-4 h-4 text-gray-300" />}
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${(item.total / maxTotal) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{t('reports.topAssets.completedTimes')} {item.completed} {t('reports.topAssets.times')}</span>
                  <span>{t('reports.topAssets.pendingTimes')} {item.pending} {t('reports.topAssets.times')}</span>
                </div>
                {expanded === i && item.jobs?.length > 0 && (
                  <div className="mt-2 border border-blue-100 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-blue-50 border-b border-blue-100">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap">{t('reports.col.no')}</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap">{t('reports.col.reportedAt')}</th>
                          {groupBy === 'issue' && (
                            <th className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap">{t('reports.col.area')}</th>
                          )}
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">{t('reports.col.description')}</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">{t('reports.col.status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {item.jobs.map(job => (
                          <tr key={job.id} onClick={() => setSelectedJobId(job.id)}
                            className="bg-white hover:bg-blue-50 cursor-pointer transition-colors">
                            <td className="px-3 py-2 font-mono text-gray-400 whitespace-nowrap">
                              {job.request_number}{job.is_urgent && <span className="text-red-500 font-bold ml-1">!</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                              {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy HH:mm', { locale: dateLocale }) : '-'}
                            </td>
                            {groupBy === 'issue' && (
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{job.location || '-'}</td>
                            )}
                            <td className="px-3 py-2 text-gray-700 max-w-xs truncate">{job.description}</td>
                            <td className="px-3 py-2"><StatusBadge status={job.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedJobId && (
        <JobDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}
    </div>
  )
}

// ── Tab 5: Staff KPI ──────────────────────────────────
function StaffKpiTab() {
  const { t } = useLang()
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

  const kpiHeaders = [
    t('reports.staffKpi.techName'), t('reports.staffKpi.positionDept'),
    t('reports.staffKpi.assigned'), t('reports.staffKpi.completed'),
    t('reports.staffKpi.pending'), t('reports.staffKpi.external'),
    t('reports.staffKpi.reopen'), t('reports.staffKpi.responseTime'),
    t('reports.staffKpi.repairTime'), t('reports.staffKpi.totalCost'),
  ]

  return (
    <div className="space-y-4">
      <DateFilter dateFrom={dateFrom} dateTo={dateTo}
        onFromChange={setDateFrom} onToChange={setDateTo}
        onSearch={loadData} onClear={clear} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Staff Performance KPI</h3>
          <p className="text-xs text-gray-400 mt-0.5">{t('reports.staffKpi.subtitle')}</p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('reports.noDataTech')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {kpiHeaders.map(h => (
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
                        ? <span className={`font-medium ${tech.avg_response_minutes > 30 ? 'text-red-500' : 'text-green-600'}`}>{tech.avg_response_minutes}</span>
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

// ── Tab 6: Consumables ────────────────────────────────
function ConsumablesTab() {
  const { lang, t } = useLang()
  const dateLocale = lang === 'th' ? thLocale : enUS

  function todayStr() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [areas, setAreas] = useState([])
  const [subAreaId, setSubAreaId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})

  // flatten all sub areas from all main areas
  const allSubAreas = areas.flatMap(a => (a.sub_areas || []).filter(s => s.is_active))

  useEffect(() => {
    api.getAreas().then(setAreas)
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (subAreaId) params.sub_area_id = subAreaId
    try { setData(await api.getMaterialsReport(params)) }
    finally { setLoading(false) }
  }

  function clear() {
    const td = todayStr()
    setDateFrom(td); setDateTo(td); setSubAreaId('')
  }

  function toggleExpand(key) {
    setExpanded(e => ({ ...e, [key]: !e[key] }))
  }

  function exportExcel() {
    if (!data?.items?.length) return
    const rows = []
    for (const item of data.items) {
      for (const u of item.usages) {
        rows.push({
          [t('reports.materials.materialName')]: item.name,
          [t('reports.materials.unit')]: item.unit,
          [t('reports.materials.qty')]: u.qty,
          [t('reports.materials.mainArea')]: u.main_area,
          [t('reports.materials.subArea')]: u.sub_area,
          [t('reports.materials.requestNo')]: u.request_number,
          [t('reports.materials.recordedBy')]: u.recorded_by,
          [t('reports.materials.usageDate')]: format(new Date(u.date), 'dd/MM/yyyy HH:mm', { locale: dateLocale }),
        })
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, lang === 'th' ? 'วัสดุสิ้นเปลือง' : 'Consumables')
    XLSX.writeFile(wb, `consumables_${dateFrom}_${dateTo}.xlsx`)
  }

  const items = data?.items || []

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('reports.dateFrom')}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('reports.dateTo')}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('reports.materials.filterSubArea')}</label>
            <select value={subAreaId} onChange={e => setSubAreaId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">{t('reports.materials.allSubAreas')}</option>
              {allSubAreas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button onClick={loadData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {t('reports.search')}
          </button>
          <button onClick={clear}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            {t('reports.clear')}
          </button>
          {items.length > 0 && (
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium ml-auto">
              <Download className="w-4 h-4" />
              {t('reports.materials.exportExcel')}
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {!loading && data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-blue-600 font-medium">{t('reports.materials.materials')}</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{items.length}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-600 font-medium">{t('reports.materials.entries')}</p>
            <p className="text-3xl font-bold text-gray-700 mt-1">{data.total_entries}</p>
          </div>
        </div>
      )}

      {/* Materials table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-900">{t('reports.materials.title')}</h3>
          {!loading && <span className="text-sm text-gray-400">({items.length} {t('reports.materials.materials')})</span>}
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('reports.materials.noData')}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => {
              const key = `${item.name}||${item.unit}`
              const isOpen = !!expanded[key]
              return (
                <div key={key}>
                  {/* Material row — clickable to expand */}
                  <button
                    onClick={() => toggleExpand(key)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{item.unit}</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm flex-shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{item.total_qty.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{item.unit}</p>
                      </div>
                      <span className="text-xs text-blue-500 font-medium w-16 text-right">
                        {item.usages.length} {t('reports.materials.entries')}
                      </span>
                      {isOpen
                        ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    </div>
                  </button>

                  {/* Expanded usage detail */}
                  {isOpen && (
                    <div className="bg-blue-50 border-t border-blue-100">
                      <div className="px-5 py-2 text-xs font-medium text-blue-700 bg-blue-100">
                        {t('reports.materials.usageDetail')} — {item.name}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-blue-50">
                              {[
                                t('reports.materials.usageDate'),
                                t('reports.materials.qty'),
                                t('reports.materials.mainArea'),
                                t('reports.materials.subArea'),
                                t('reports.materials.requestNo'),
                                t('reports.materials.recordedBy'),
                              ].map(h => (
                                <th key={h} className="text-left px-4 py-2 text-blue-600 font-medium whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-100">
                            {item.usages.map((u, i) => (
                              <tr key={i} className="hover:bg-white transition-colors">
                                <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                                  {format(new Date(u.date), 'd MMM yy HH:mm', { locale: dateLocale })}
                                </td>
                                <td className="px-4 py-2 font-medium text-gray-900">{u.qty.toLocaleString()} {item.unit}</td>
                                <td className="px-4 py-2 text-gray-700">{u.main_area}</td>
                                <td className="px-4 py-2 text-gray-600">{u.sub_area}</td>
                                <td className="px-4 py-2 font-mono text-gray-400 whitespace-nowrap">{u.request_number}</td>
                                <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{u.recorded_by}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab 7: Area History ───────────────────────────────
function AreaHistoryTab() {
  const { lang, t } = useLang()
  const dateLocale = lang === 'th' ? thLocale : enUS
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [areas, setAreas] = useState([])
  const [selectedMain, setSelectedMain] = useState('')
  const [selectedSub, setSelectedSub] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [issueSel, setIssueSel] = useState('')           // ประเภทงานที่กดกรอง ('' = ทั้งหมด)
  const [selectedJobId, setSelectedJobId] = useState(null)

  useEffect(() => { api.getAreas().then(setAreas) }, [])

  async function loadData() {
    if (!selectedMain) { setData(null); return }
    setLoading(true)
    setIssueSel('')
    const params = { main_area_id: selectedMain }
    if (selectedSub) params.sub_area_id = selectedSub
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    try { setData(await api.getAreaHistory(params)) }
    finally { setLoading(false) }
  }

  function clear() {
    setDateFrom(''); setDateTo('')
    setSelectedMain(''); setSelectedSub('')
    setIssueSel(''); setData(null)
  }

  const selectedMainArea = areas.find(a => a.id === Number(selectedMain))
  const subAreas = selectedMainArea?.sub_areas?.filter(s => s.is_active) || []
  const shownJobs = (data?.jobs || []).filter(j => !issueSel || j.issue === issueSel)

  return (
    <div className="space-y-4">
      <DateFilter dateFrom={dateFrom} dateTo={dateTo}
        onFromChange={setDateFrom} onToChange={setDateTo}
        onSearch={loadData} onClear={clear}>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('reports.area.filterMainArea')} *</label>
          <select value={selectedMain}
            onChange={e => {
              setSelectedMain(e.target.value); setSelectedSub('')
              if (!e.target.value) { setData(null); setIssueSel('') }
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">{t('reports.history.selectArea')}</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {selectedMain && subAreas.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('reports.area.filterSubArea')}</label>
            <select value={selectedSub} onChange={e => setSelectedSub(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">{t('common.all')}</option>
              {subAreas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </DateFilter>

      {!selectedMain && !data ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          {t('reports.history.selectAreaHint')}
        </div>
      ) : loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
      ) : !data ? null : (
        <>
          {/* สถิติแยกประเภทงาน — chips กดกรองได้ */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">{t('reports.history.byIssue')}</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setIssueSel('')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  !issueSel ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {t('common.all')} ({data.jobs.length})
              </button>
              {data.by_issue.map(b => (
                <button key={b.issue} onClick={() => setIssueSel(issueSel === b.issue ? '' : b.issue)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    issueSel === b.issue ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {b.issue} ({b.total})
                  <span className={issueSel === b.issue ? 'text-blue-200' : 'text-green-600'}> ✓{b.completed}</span>
                </button>
              ))}
            </div>
          </div>

          {/* รายการงานพร้อมรายละเอียดการซ่อม */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                {t('reports.history.title')} ({shownJobs.length} {t('reports.items')})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {[t('reports.col.no'), t('reports.col.reportedAt'), t('reports.col.issueType'),
                      t('reports.col.description'), t('reports.history.repairDetails'),
                      t('reports.col.technician'), t('reports.col.status')].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {shownJobs.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('reports.noFound')}</td></tr>
                  ) : shownJobs.map(job => (
                    <tr key={job.id} onClick={() => setSelectedJobId(job.id)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                        {job.request_number}{job.is_urgent && <span className="text-red-500 font-bold ml-1">!</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {job.reported_at ? format(new Date(job.reported_at), 'd MMM yy', { locale: dateLocale }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{job.issue}</td>
                      <td className="px-4 py-3 text-xs text-gray-700 max-w-[200px] truncate">{job.description}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[220px] truncate">{job.repair_details || '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{job.technician}</td>
                      <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedJobId && (
        <JobDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────
export default function ReportsPage() {
  const { t } = useLang()
  const [tab, setTab] = useState('summary')

  const tabs = [
    { key: 'summary', label: t('reports.tabs.summary'), icon: BarChart2 },
    { key: 'technician', label: t('reports.tabs.technician'), icon: User },
    { key: 'area', label: t('reports.tabs.area'), icon: MapPin },
    { key: 'top_assets', label: t('reports.tabs.topAssets'), icon: Wrench },
    { key: 'staff_kpi', label: t('reports.tabs.staffKpi'), icon: Trophy },
    { key: 'materials', label: t('reports.tabs.materials'), icon: Package },
    { key: 'area_history', label: t('reports.tabs.areaHistory'), icon: History },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('reports.repairReport')}</h1>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
              tab === tb.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <tb.icon className="w-4 h-4" />
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryTab />}
      {tab === 'technician' && <TechnicianTab />}
      {tab === 'area' && <AreaTab />}
      {tab === 'top_assets' && <TopAssetsTab />}
      {tab === 'staff_kpi' && <StaffKpiTab />}
      {tab === 'materials' && <ConsumablesTab />}
      {tab === 'area_history' && <AreaHistoryTab />}
    </div>
  )
}
