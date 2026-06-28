import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, imgUrl, schedToISO } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import StatusBadge from './StatusBadge'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { th as thLocale, enUS } from 'date-fns/locale'
import {
  X, Wrench, CheckCircle, XCircle, Plus, Trash2, Package,
  History, UserPlus, RefreshCw, ExternalLink, Undo2, ImageOff, ArrowUpRight, Edit2
} from 'lucide-react'

function TechCheckList({ technicians, onDutyTechs, selectedTech, setSelectedTech, selectedTechs, setSelectedTechs, multi = false, excludeId = null }) {
  const { t } = useLang()
  const list = technicians.filter(tech => tech.id !== excludeId)
  const onDutyList = list.filter(tech => onDutyTechs.includes(tech.id))
  const offDutyList = list.filter(tech => !onDutyTechs.includes(tech.id))
  const isChecked = (tech) => multi
    ? selectedTechs.includes(String(tech.id))
    : selectedTech === String(tech.id)
  const toggle = (tech) => {
    if (multi) {
      const id = String(tech.id)
      setSelectedTechs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    } else {
      setSelectedTech(prev => prev === String(tech.id) ? '' : String(tech.id))
    }
  }
  const renderTech = (tech) => (
    <label key={tech.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${isChecked(tech) ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'}`}>
      <input type="checkbox" checked={isChecked(tech)} onChange={() => toggle(tech)}
        className="w-4 h-4 text-blue-600 rounded" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900">{tech.full_name}</span>
        <span className="text-xs text-gray-500 ml-1">({tech.department})</span>
      </div>
      {onDutyTechs.includes(tech.id) && (
        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full whitespace-nowrap">🟢 On Duty</span>
      )}
    </label>
  )
  return (
    <div className="mb-3 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
      {onDutyList.length > 0 && (
        <>
          <div className="px-3 py-1.5 bg-green-50 text-xs font-semibold text-green-700">{t('workOrder.onDutySection')}</div>
          <div className="max-h-40 overflow-y-auto">{onDutyList.map(renderTech)}</div>
        </>
      )}
      {offDutyList.length > 0 && (
        <>
          <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500">{t('workOrder.allTechsSection')}</div>
          <div className="max-h-40 overflow-y-auto">{offDutyList.map(renderTech)}</div>
        </>
      )}
      {list.length === 0 && (
        <div className="px-3 py-4 text-center text-sm text-gray-400">{t('common.loading')}</div>
      )}
    </div>
  )
}

function SafeImage({ src, className }) {
  const [broken, setBroken] = useState(false)
  if (broken) return (
    <div className={`${className} flex items-center justify-center bg-gray-100`}>
      <ImageOff className="w-5 h-5 text-gray-300" />
    </div>
  )
  return <img src={src} alt="" className={className} onError={() => setBroken(true)} />
}

function InfoRow({ label, value, pre }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex gap-3">
      <span className="text-sm text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className={`text-sm text-gray-900 font-medium ${pre ? 'whitespace-pre-line' : ''}`}>{value}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function InnerModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 text-base">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function MaterialsTable({ materials, onChange }) {
  const { t } = useLang()
  const addRow = () => onChange([...materials, { name: '', qty: 1, unit: t('workOrder.defaultUnit'), unit_cost: 0 }])
  const removeRow = (i) => onChange(materials.filter((_, idx) => idx !== i))
  const updateRow = (i, field, val) => {
    const updated = [...materials]
    updated[i] = { ...updated[i], [field]: val }
    onChange(updated)
  }

  return (
    <div className="border-2 border-orange-200 rounded-xl overflow-hidden bg-orange-50">
      <div className="flex items-center justify-between px-3 py-2.5 bg-orange-100 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-orange-600" />
          <label className="text-sm font-semibold text-orange-800">{t('workOrder.materials')}</label>
          {materials.length > 0 && (
            <span className="text-xs bg-orange-500 text-white rounded-full px-2 py-0.5 font-medium">{materials.length}</span>
          )}
        </div>
        <button type="button" onClick={addRow}
          className="flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" /> {t('workOrder.addMaterial')}
        </button>
      </div>
      {materials.length === 0 ? (
        <div className="px-3 py-3 text-xs text-orange-400 text-center">{t('workOrder.noMaterials')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-orange-50 border-b border-orange-200">
              <tr>
                <th className="text-left px-3 py-2 text-orange-700 font-medium">{t('workOrder.materialName')}</th>
                <th className="text-right px-3 py-2 text-orange-700 font-medium w-16">{t('workOrder.qty')}</th>
                <th className="text-left px-3 py-2 text-orange-700 font-medium w-16">{t('workOrder.unit')}</th>
                <th className="text-right px-3 py-2 text-orange-700 font-medium w-20">{t('workOrder.unitCost')}</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-100">
              {materials.map((m, i) => (
                <tr key={i} className="bg-white hover:bg-orange-50 transition-colors">
                  <td className="px-3 py-2">
                    <input value={m.name} onChange={e => updateRow(i, 'name', e.target.value)}
                      placeholder={t('workOrder.materialName')}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-orange-400 bg-white" />
                  </td>
                  <td className="px-2 py-2 w-16">
                    <input type="number" min="0" step="0.1" value={m.qty}
                      onChange={e => updateRow(i, 'qty', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-orange-400 bg-white" />
                  </td>
                  <td className="px-2 py-2 w-16">
                    <input value={m.unit} onChange={e => updateRow(i, 'unit', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-orange-400 bg-white" />
                  </td>
                  <td className="px-2 py-2 w-20">
                    <input type="number" min="0" step="0.01" value={m.unit_cost ?? 0}
                      onChange={e => updateRow(i, 'unit_cost', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-orange-400 bg-white" />
                  </td>
                  <td className="px-2 py-2 w-8">
                    <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const SCHED_MINUTES = ['00', '15', '30', '45']
const SCHED_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function snapToFuture(now, hour, minute) {
  const cH = now.getHours()
  const cM = now.getMinutes()
  const nextMins = SCHED_MINUTES.filter(m => parseInt(m) > cM)
  const h = parseInt(hour, 10)
  const isPast = h < cH || (h === cH && !nextMins.includes(minute))
  if (!isPast) return { hour, minute }
  if (nextMins.length > 0) return { hour: String(cH).padStart(2, '0'), minute: nextMins[0] }
  return { hour: String(Math.min(cH + 1, 23)).padStart(2, '0'), minute: '00' }
}

export default function JobDrawer({ jobId, onClose, onUpdate }) {
  const { user } = useAuth()
  const { lang, t } = useLang()
  const dateLocale = lang === 'th' ? thLocale : enUS
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [technicians, setTechnicians] = useState([])
  const [onDutyTechs, setOnDutyTechs] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [issueTypes, setIssueTypes] = useState([])

  const [modal, setModal] = useState(null)
  const [selectedTech, setSelectedTech] = useState('')
  const [selectedTechs, setSelectedTechs] = useState([])
  const [acting, setActing] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [completeForm, setCompleteForm] = useState({
    repair_details: '', materials: [], ooo_room: false,
    ooo_start_date: '', ooo_end_date: '', ooo_notified_user_id: '',
    is_external: false, external_note: '', is_complete: false
  })
  const [inspectForm, setInspectForm] = useState({ result: 'pass', notes: '' })
  const [editForm, setEditForm] = useState({
    description: '', issue_type_id: '', priority: 'normal',
    sched_date: '', sched_hour: '08', sched_minute: '00',
    guest_inhouse: false
  })
  const [locationHistory, setLocationHistory] = useState([])
  const [histLoading, setHistLoading] = useState(false)

  useEffect(() => {
    if (!jobId) return
    setLoading(true); setJob(null)
    api.getJob(jobId).then(setJob).finally(() => setLoading(false))
  }, [jobId])

  useEffect(() => {
    if (['assign', 'reassign', 'coassign', 'recall', 'transfer'].includes(modal) && technicians.length === 0) {
      api.getTechnicians().then(setTechnicians).catch(() => {})
      api.getOnDutyToday()
        .then(duty => setOnDutyTechs(Array.isArray(duty) ? duty.map(d => d.technician?.id).filter(Boolean) : []))
        .catch(() => setOnDutyTechs([]))
    }
    if (modal === 'complete') {
      setCompleteForm({
        repair_details: '', materials: [], ooo_room: false,
        ooo_start_date: '', ooo_end_date: '', ooo_notified_user_id: '',
        is_external: false, external_note: '', is_complete: false
      })
      if (allUsers.length === 0) api.getOOONotifyUsers().then(setAllUsers).catch(() => setAllUsers([]))
    }
    if (modal === 'edit' && issueTypes.length === 0) {
      api.getIssueTypes().then(setIssueTypes)
    }
  }, [modal])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !modal) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, modal])

  async function handleAssign(type) {
    if (!selectedTech) return toast.error(t('workOrder.selectTech'))
    setActing(true)
    try {
      let updated
      if (type === 'reassign') updated = await api.reassignJob(job.id, Number(selectedTech))
      else updated = await api.coAssignJob(job.id, Number(selectedTech))
      setJob(updated); setModal(null); setSelectedTech('')
      toast.success(type === 'reassign' ? t('workOrder.toast.reassignSuccess') : t('workOrder.toast.coAssignSuccess'))
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleAssignMulti() {
    if (selectedTechs.length === 0) return toast.error(t('workOrder.selectTech'))
    setActing(true)
    try {
      let updated = await api.assignJob(job.id, Number(selectedTechs[0]))
      for (let i = 1; i < selectedTechs.length; i++) {
        updated = await api.coAssignJob(job.id, Number(selectedTechs[i]))
      }
      setJob(updated); setModal(null); setSelectedTechs([])
      toast.success(`${t('workOrder.toast.assignSuccess')}${selectedTechs.length > 1 ? ` (${selectedTechs.length})` : ''}`)
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleCoAssignMulti() {
    if (selectedTechs.length === 0) return toast.error(t('workOrder.selectTech'))
    setActing(true)
    try {
      let updated = job
      for (const techId of selectedTechs) {
        updated = await api.coAssignJob(job.id, Number(techId))
      }
      setJob(updated); setModal(null); setSelectedTechs([])
      toast.success(`${t('workOrder.toast.coAssignSuccess')} (${selectedTechs.length})`)
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleAccept() {
    setActing(true)
    try {
      const updated = await api.acceptJob(job.id)
      setJob(updated); setModal(null)
      toast.success(t('workOrder.toast.acceptSuccess'))
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleComplete() {
    if (!completeForm.repair_details.trim()) return toast.error(t('workOrder.toast.repairDetailsRequired'))
    if (completeForm.ooo_room) {
      const today = new Date().toISOString().split('T')[0]
      if (completeForm.ooo_start_date && completeForm.ooo_start_date < today)
        return toast.error(t('workOrder.toast.oooDatePast'))
      if (completeForm.ooo_end_date && completeForm.ooo_start_date && completeForm.ooo_end_date < completeForm.ooo_start_date)
        return toast.error(t('workOrder.toast.oooDateOrder'))
    }
    setActing(true)
    try {
      const updated = await api.completeJob(job.id, {
        repair_details: completeForm.repair_details,
        materials: completeForm.materials.filter(m => m.name),
        ooo_room: completeForm.ooo_room,
        ooo_start_date: completeForm.ooo_room && completeForm.ooo_start_date ? completeForm.ooo_start_date : null,
        ooo_end_date: completeForm.ooo_room && completeForm.ooo_end_date ? completeForm.ooo_end_date : null,
        ooo_notified_user_id: completeForm.ooo_notified_user_id ? Number(completeForm.ooo_notified_user_id) : null,
        is_external: completeForm.is_external,
        external_note: completeForm.is_external ? completeForm.external_note : null,
        is_complete: completeForm.is_complete,
      })
      setJob(updated); setModal(null)
      if (!completeForm.is_complete) toast.success(t('workOrder.toast.savedProgress'))
      else if (completeForm.is_external) toast.success(t('workOrder.toast.externalLogged'))
      else toast.success(t('workOrder.toast.repairLogged'))
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleEdit() {
    setActing(true)
    try {
      const payload = {}
      if (editForm.description) payload.description = editForm.description
      if (editForm.issue_type_id) payload.issue_type_id = editForm.issue_type_id !== 'other' ? Number(editForm.issue_type_id) : null
      if (editForm.priority) payload.priority = editForm.priority
      payload.scheduled_at = schedToISO(editForm.sched_date, editForm.sched_hour, editForm.sched_minute)
      payload.guest_inhouse = editForm.guest_inhouse
      const updated = await api.editJob(job.id, payload)
      setJob(updated); setModal(null)
      toast.success(t('workOrder.toast.editSuccess'))
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  function handleSchedDateChange(dateVal) {
    const now = new Date()
    const isToday = dateVal === localDateStr(now)
    const { hour, minute } = isToday
      ? snapToFuture(now, editForm.sched_hour, editForm.sched_minute)
      : { hour: editForm.sched_hour, minute: editForm.sched_minute }
    setEditForm(f => ({ ...f, sched_date: dateVal, sched_hour: hour, sched_minute: minute }))
  }

  function handleSchedHourChange(hourVal) {
    const now = new Date()
    const isToday = editForm.sched_date === localDateStr(now)
    const { hour, minute } = isToday
      ? snapToFuture(now, hourVal, editForm.sched_minute)
      : { hour: hourVal, minute: editForm.sched_minute }
    setEditForm(f => ({ ...f, sched_hour: hour, sched_minute: minute }))
  }

  async function handleInspect() {
    if (inspectForm.result === 'fail' && !inspectForm.notes.trim())
      return toast.error(t('workOrder.toast.inspectNoteRequired'))
    setActing(true)
    try {
      const updated = await api.inspectJob(job.id, inspectForm)
      setJob(updated); setModal(null)
      toast.success(inspectForm.result === 'pass' ? t('workOrder.toast.inspectPassSuccess') : t('workOrder.toast.inspectFailSuccess'))
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleRemoveCo(coId) {
    try {
      const updated = await api.removeCoAssign(job.id, coId)
      setJob(updated); toast.success(t('workOrder.toast.removeCoSuccess'))
    } catch (err) { toast.error(err.message) }
  }

  async function handleRecall(newTechId = null) {
    setActing(true)
    try {
      const updated = await api.recallJob(job.id, newTechId ? Number(newTechId) : null)
      setJob(updated); setModal(null); setSelectedTech('')
      toast.success(newTechId ? t('workOrder.toast.recallReassignSuccess') : t('workOrder.toast.recallSuccess'))
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleCancel() {
    if (!confirm(t('workOrder.cancelConfirm'))) return
    try {
      const u = await api.cancelJob(job.id); setJob(u)
      toast.success(t('workOrder.toast.cancelSuccess'))
    } catch (err) { toast.error(err.message) }
  }

  async function handleReject(reason) {
    if (!reason.trim()) return toast.error(t('workOrder.toast.reasonRequired'))
    setActing(true)
    try {
      const updated = await api.rejectJob(job.id, reason)
      setJob(updated); setModal(null)
      toast.success(t('workOrder.toast.rejectSuccess'))
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleTransfer(techId, note) {
    if (!techId) return toast.error(t('workOrder.selectTech'))
    setActing(true)
    try {
      const updated = await api.transferJob(job.id, Number(techId), note)
      setJob(updated); setModal(null); setSelectedTech('')
      toast.success(t('workOrder.toast.transferSuccess'))
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleSelfAssign() {
    setActing(true)
    try {
      const updated = await api.selfAssignJob(job.id)
      setJob(updated); toast.success(t('workOrder.toast.selfAssignSuccess'))
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function loadHistory() {
    if (!job) return
    setHistLoading(true)
    try {
      const h = await api.getLocationHistory({
        main_area_id: job.main_area?.id || '',
        sub_area_id: job.sub_area?.id || '',
        other_location: job.other_location || '',
        months: 6,
      })
      setLocationHistory(h)
    } finally { setHistLoading(false) }
  }

  const wo = job?.work_orders?.find(w => ['assigned','in_progress','completed','external'].includes(w.status)) || job?.work_orders?.[0]
  const latestInspection = job?.inspections?.slice(-1)[0]

  const isSuperAdmin = ['admin','supervisor'].includes(user?.role)
  const isMyWO = wo?.technician?.id === user?.id
  const isSameDept = user?.department && job?.reporter?.department === user?.department

  const canAssign   = job && isSuperAdmin && ['pending','reopened','external_tech'].includes(job.status)
  const canAccept   = job && isMyWO && job.status === 'assigned'
  const canComplete = job && (isMyWO || isSuperAdmin) && ['assigned','in_progress'].includes(job.status)
  const canRecall   = job && isSuperAdmin && ['assigned','in_progress'].includes(job.status)
  const canCoAssign = job && isSuperAdmin && ['assigned','in_progress'].includes(job.status)
  const canInspect  = job && job.status === 'pending_inspection' && (isSuperAdmin || isSameDept || user?.role !== 'staff')
  const canCancel   = job && job.status === 'pending' && (user?.role === 'admin' || job.reporter?.id === user?.id)
  const canReject   = job && isMyWO && job.status === 'assigned'
  const canTransfer = job && (isMyWO || isSuperAdmin) && ['assigned','in_progress'].includes(job.status)
  const canSelfAssign = job && user?.role === 'technician' && job.status === 'pending'
  const canEdit = job && (
    (job.status === 'pending') ||
    (job.status === 'assigned' && !wo?.accepted_at)
  ) && (
    user?.department === job.reporter?.department ||
    ['admin','supervisor'].includes(user?.role)
  )

  let parsedMaterials = []
  if (wo?.materials_used) { try { parsedMaterials = JSON.parse(wo.materials_used) } catch {} }

  const techListProps = { technicians, onDutyTechs, selectedTech, setSelectedTech, selectedTechs, setSelectedTechs }
  const matHeaders = [t('workOrder.materialName'), t('workOrder.qty'), t('workOrder.unit'), t('workOrder.unitCost')]

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={() => { if (!modal) onClose() }} />

      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-gray-50 z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          {loading ? (
            <span className="text-gray-400 text-sm">{t('common.loading')}</span>
          ) : job ? (
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-bold text-gray-900 text-base">{job.request_number}</span>
              {job.priority === 'very_urgent' && (
                <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded-full font-semibold">{t('workOrder.veryUrgentTag')}</span>
              )}
              {job.priority === 'urgent' && (
                <span className="text-xs px-2 py-0.5 bg-orange-400 text-white rounded-full font-semibold">{t('workOrder.urgentTag')}</span>
              )}
              {(!job.priority || job.priority === 'normal') && job.is_urgent && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">{t('workOrder.urgentTag')}</span>
              )}
              {job.guest_inhouse && (
                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">{t('workOrder.guestInHouseTag')}</span>
              )}
              <StatusBadge status={job.status} />
            </div>
          ) : <span />}

          <div className="flex items-center gap-2 flex-shrink-0">
            {job && (
              <Link to={`/requests/${job.id}`}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-lg px-2.5 py-1.5 transition-colors">
                <ArrowUpRight className="w-3.5 h-3.5" /> {t('common.viewFull')}
              </Link>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">{t('common.loading')}</div>
          ) : !job ? (
            <div className="py-16 text-center text-gray-400 text-sm">{t('workOrder.notFound')}</div>
          ) : (
            <>
              {/* Action Buttons */}
              {(canAssign || canAccept || canComplete || canRecall || canCoAssign ||
                canInspect || canCancel || canReject || canTransfer || canSelfAssign || canEdit) && (
                <div className="flex flex-wrap gap-2">
                  {canAssign && (
                    <button onClick={() => { setSelectedTechs([]); setModal('assign') }}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium">
                      <Wrench className="w-4 h-4" /> {t('workOrder.assign')}
                    </button>
                  )}
                  {canRecall && (
                    <button onClick={() => { setSelectedTech(''); setModal('recall') }}
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-medium">
                      <Undo2 className="w-4 h-4" /> {t('workOrder.recall')}
                    </button>
                  )}
                  {canCoAssign && (
                    <button onClick={() => { setSelectedTechs([]); setModal('coassign') }}
                      className="flex items-center gap-1.5 border border-indigo-300 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg text-sm font-medium">
                      <UserPlus className="w-4 h-4" /> {t('workOrder.coAssign')}
                    </button>
                  )}
                  {canAccept && (
                    <button onClick={() => setModal('accept')}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium">
                      <CheckCircle className="w-4 h-4" /> {t('workOrder.accept')}
                    </button>
                  )}
                  {canComplete && (
                    <button onClick={() => setModal('complete')}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium">
                      <CheckCircle className="w-4 h-4" /> {t('workOrder.complete')}
                    </button>
                  )}
                  {canInspect && (
                    <button onClick={() => setModal('inspect')}
                      className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-medium">
                      <CheckCircle className="w-4 h-4" /> {t('workOrder.inspect')}
                    </button>
                  )}
                  {canSelfAssign && (
                    <button onClick={handleSelfAssign} disabled={acting}
                      className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium">
                      <CheckCircle className="w-4 h-4" /> {t('workOrder.selfAccept')}
                    </button>
                  )}
                  {canReject && (
                    <button onClick={() => { setRejectReason(''); setModal('reject') }}
                      className="flex items-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium">
                      <XCircle className="w-4 h-4" /> {t('workOrder.reject')}
                    </button>
                  )}
                  {canTransfer && (
                    <button onClick={() => { setSelectedTech(''); setTransferNote(''); setModal('transfer') }}
                      className="flex items-center gap-1.5 border border-indigo-300 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg text-sm font-medium">
                      <RefreshCw className="w-4 h-4" /> {t('workOrder.transfer')}
                    </button>
                  )}
                  {canCancel && (
                    <button onClick={handleCancel}
                      className="flex items-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium">
                      <XCircle className="w-4 h-4" /> {t('common.cancel')}
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => {
                      setEditForm({
                        description: job.description || '',
                        issue_type_id: job.issue_type?.id ? String(job.issue_type.id) : '',
                        priority: job.priority || 'normal',
                        sched_date: job.scheduled_at ? (() => { const d = new Date(job.scheduled_at); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })() : '',
                        sched_hour: job.scheduled_at ? String(new Date(job.scheduled_at).getHours()).padStart(2, '0') : '08',
                        sched_minute: job.scheduled_at ? String(new Date(job.scheduled_at).getMinutes()).padStart(2, '0') : '00',
                        guest_inhouse: job.guest_inhouse || false,
                      })
                      setModal('edit')
                    }}
                      className="flex items-center gap-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium">
                      <Edit2 className="w-4 h-4" /> {t('common.edit')}
                    </button>
                  )}
                  <button onClick={() => { setModal('history'); loadHistory() }}
                    className="flex items-center gap-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium">
                    <History className="w-4 h-4" /> {t('workOrder.locationHistory')}
                  </button>
                </div>
              )}

              {/* Request Info */}
              <Section title={t('workOrder.infoSection')}>
                <div className="space-y-2.5">
                  <InfoRow label={t('workOrder.reporterLabel')} value={`${job.reporter?.full_name}${job.reporter?.department ? ` (${job.reporter.department})` : ''}`} />
                  <InfoRow label={t('workOrder.reportedAt')} value={job.reported_at ? format(new Date(job.reported_at), t('common.datetimeFormat'), { locale: dateLocale }) : ''} />
                  <InfoRow label={t('workOrder.areaLabel')} value={
                    job.main_area ? `${job.main_area.name}${job.sub_area ? ` › ${job.sub_area.name}` : ''}` : job.other_location || '-'
                  } />
                  <InfoRow label={t('workOrder.issueLabel')} value={job.issue_type?.name || job.other_issue} />
                  <InfoRow label={t('workOrder.descriptionLabel')} value={job.description} pre />
                  <InfoRow label={t('workOrder.scheduledLabel')} value={job.scheduled_at ? format(new Date(job.scheduled_at), 'd MMMM yyyy HH:mm', { locale: dateLocale }) : null} />
                  {job.last_edited_by && (
                    <InfoRow label={t('workOrder.lastEditedLabel')} value={`${t('common.by')} ${job.last_edited_by.full_name}${job.last_edited_at ? ' · ' + format(new Date(job.last_edited_at), 'd MMM yy HH:mm', { locale: dateLocale }) : ''}`} />
                  )}
                </div>
                {job.images?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-2">{t('workOrder.photosLabel')}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {job.images.map(img => (
                        <a key={img.id} href={imgUrl(img.filename)} target="_blank" rel="noopener noreferrer"
                          className="block rounded-lg overflow-hidden">
                          <SafeImage src={imgUrl(img.filename)}
                            className="w-full aspect-square object-cover hover:opacity-90 rounded-lg" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              {/* Work Order */}
              {wo && (
                <Section title={t('workOrder.repairSection')}>
                  <div className="space-y-2.5">
                    <InfoRow label={t('workOrder.assignedTechLabel')} value={`${wo.technician?.full_name} (${wo.technician?.position})`} />
                    {wo.co_assignments?.length > 0 && (
                      <div className="flex gap-3">
                        <span className="text-sm text-gray-500 w-28 flex-shrink-0">{t('workOrder.coTechLabel')}</span>
                        <div className="space-y-1">
                          {wo.co_assignments.map(c => (
                            <div key={c.id} className="flex items-center gap-2">
                              <span className="text-sm text-gray-900 font-medium">{c.technician?.full_name}</span>
                              {isSuperAdmin && (
                                <button onClick={() => handleRemoveCo(c.id)} className="text-gray-300 hover:text-red-500">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <InfoRow label={t('workOrder.assignedByLabel')} value={wo.assigned_by?.full_name} />
                    <InfoRow label={t('workOrder.acceptedAtLabel')} value={wo.accepted_at ? format(new Date(wo.accepted_at), 'd MMM yyyy HH:mm', { locale: dateLocale }) : t('workOrder.notAccepted')} />
                    {wo.is_external && (
                      <div className="flex gap-2 items-start p-3 bg-purple-50 rounded-lg">
                        <ExternalLink className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-purple-700">{t('workOrder.externalJobLabel')}</p>
                          {wo.external_note && <p className="text-xs text-purple-600 mt-0.5">{wo.external_note}</p>}
                        </div>
                      </div>
                    )}
                    {wo.repair_logs && wo.repair_logs.length > 0 ? (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">{t('workOrder.repairLogs')}</p>
                        <div className="space-y-2">
                          {wo.repair_logs.map((log, idx) => (
                            <div key={log.id} className={`rounded-lg p-3 text-sm border-l-4 ${log.is_complete ? 'bg-green-50 border-green-400' : 'bg-blue-50 border-blue-400'}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-gray-600">{t('workOrder.repairLog')}{idx + 1} · {log.created_by?.full_name}</span>
                                <div className="flex items-center gap-1.5">
                                  {log.is_complete
                                    ? <span className="text-xs text-green-600 font-medium">✓ {t('workOrder.doneReady').split(' — ')[0]}</span>
                                    : <span className="text-xs text-blue-600 font-medium">⏳ {t('workOrder.inProgressSave').split(' — ')[0]}</span>
                                  }
                                  <span className="text-xs text-gray-400">{format(new Date(log.created_at), 'd MMM HH:mm', { locale: dateLocale })}</span>
                                </div>
                              </div>
                              <p className="text-gray-700 whitespace-pre-wrap">{log.repair_details}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : wo.repair_details ? (
                      <InfoRow label={t('workOrder.repairDetails')} value={wo.repair_details} pre />
                    ) : null}
                    {parsedMaterials.length > 0 && (
                      <div className="flex gap-3">
                        <span className="text-sm text-gray-500 w-28 flex-shrink-0">{t('workOrder.materialsLabel')}</span>
                        <div className="flex-1 overflow-x-auto">
                          <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                            <thead className="bg-gray-50">
                              <tr>
                                {matHeaders.map(h => (
                                  <th key={h} className="text-left px-2 py-1.5 text-gray-500 font-medium">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {parsedMaterials.map((m, i) => (
                                <tr key={i}>
                                  <td className="px-2 py-1.5">{m.name}</td>
                                  <td className="px-2 py-1.5 text-right font-medium">{m.qty}</td>
                                  <td className="px-2 py-1.5">{m.unit}</td>
                                  <td className="px-2 py-1.5 text-right">{m.unit_cost ?? 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {wo.ooo_room && !wo.ooo_start_date && <InfoRow label={t('workOrder.oooRoomLabel')} value={`${wo.ooo_days || '-'} ${t('common.day')}`} />}
                    {wo.ooo_start_date && <InfoRow label={t('workOrder.oooRoomLabel')} value={`${format(parseISO(wo.ooo_start_date), 'd MMM yy', { locale: dateLocale })} ${t('common.to')} ${wo.ooo_end_date ? format(parseISO(wo.ooo_end_date), 'd MMM yy', { locale: dateLocale }) : '?'}`} />}
                    {wo.ooo_notified_user && <InfoRow label={t('workOrder.oooNotifiedLabel')} value={wo.ooo_notified_user.full_name} />}
                    {wo.completed_at && <InfoRow label={t('workOrder.completedAt')} value={format(new Date(wo.completed_at), 'd MMM yyyy HH:mm', { locale: dateLocale })} />}
                  </div>
                </Section>
              )}

              {/* Inspection */}
              {latestInspection && (
                <Section title={t('workOrder.inspectSection')}>
                  <div className="space-y-2.5">
                    <InfoRow label={t('workOrder.inspectedBy')} value={latestInspection.inspector?.full_name} />
                    <div className="flex gap-3">
                      <span className="text-sm text-gray-500 w-28 flex-shrink-0">{t('workOrder.inspectResult')}</span>
                      <span className={`text-sm font-semibold ${latestInspection.result === 'pass' ? 'text-green-600' : 'text-red-600'}`}>
                        {latestInspection.result === 'pass' ? t('workOrder.passResult') : t('workOrder.failResult')}
                      </span>
                    </div>
                    {latestInspection.notes && <InfoRow label={t('workOrder.notesLabel')} value={latestInspection.notes} pre />}
                    <InfoRow label={t('workOrder.inspectedAt')} value={format(new Date(latestInspection.created_at), 'd MMM yyyy HH:mm', { locale: dateLocale })} />
                  </div>
                </Section>
              )}

              {/* History */}
              {job.history?.length > 0 && (
                <Section title={t('workOrder.historySection')}>
                  <div className="space-y-3">
                    {[...job.history].reverse().map(h => (
                      <div key={h.id} className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusBadge status={h.new_status} />
                            <span className="text-gray-500 text-xs">{h.changed_by?.full_name}</span>
                            <span className="text-gray-400 text-xs">{format(new Date(h.timestamp), 'd MMM yy HH:mm', { locale: dateLocale })}</span>
                          </div>
                          {h.note && <p className="text-gray-600 text-xs mt-0.5">{h.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Inner Modals ── */}

      {modal === 'assign' && (
        <InnerModal title={t('workOrder.assignModal')} onClose={() => setModal(null)}>
          {selectedTechs.length > 0 && (
            <p className="text-xs text-blue-600 font-medium mb-2">
              {t('workOrder.selectedCount')} {selectedTechs.length} {t('workOrder.selectedCountSuffix')}
              {selectedTechs.length > 1 && ` ${t('workOrder.firstIsPrimary')}`}
            </p>
          )}
          <TechCheckList {...techListProps} multi={true} />
          <div className="flex gap-2">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
            <button onClick={handleAssignMulti} disabled={acting || selectedTechs.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? t('common.saving') : `${t('workOrder.assign')}${selectedTechs.length > 0 ? ` (${selectedTechs.length})` : ''}`}
            </button>
          </div>
        </InnerModal>
      )}

      {modal === 'accept' && (
        <InnerModal title={t('workOrder.acceptModal')} onClose={() => setModal(null)}>
          <p className="text-sm text-gray-600 mb-4">{t('workOrder.acceptConfirm')}</p>
          <div className="flex gap-2">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
            <button onClick={handleAccept} disabled={acting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? t('common.saving') : t('common.confirm')}
            </button>
          </div>
        </InnerModal>
      )}

      {modal === 'coassign' && (
        <InnerModal title={t('workOrder.coAssignModal')} onClose={() => setModal(null)}>
          {selectedTechs.length > 0 && (
            <p className="text-xs text-indigo-600 font-medium mb-2">{t('workOrder.selectedCount')} {selectedTechs.length} {t('workOrder.selectedCountSuffix')}</p>
          )}
          <TechCheckList {...techListProps} multi={true} excludeId={wo?.technician?.id} />
          <div className="flex gap-2">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
            <button onClick={handleCoAssignMulti} disabled={acting || selectedTechs.length === 0}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? t('common.saving') : `${t('workOrder.coAssign')}${selectedTechs.length > 0 ? ` (${selectedTechs.length})` : ''}`}
            </button>
          </div>
        </InnerModal>
      )}

      {modal === 'complete' && (
        <InnerModal title={t('workOrder.complete')} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t('workOrder.repairDescLabel')} *</label>
              <textarea value={completeForm.repair_details}
                onChange={e => setCompleteForm(f => ({ ...f, repair_details: e.target.value }))}
                rows={3} placeholder={t('workOrder.repairDetailsPlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <MaterialsTable materials={completeForm.materials} onChange={m => setCompleteForm(f => ({ ...f, materials: m }))} />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={completeForm.ooo_room}
                onChange={e => setCompleteForm(f => ({ ...f, ooo_room: e.target.checked }))}
                className="w-4 h-4 text-red-600 rounded" />
              <span className="text-sm text-gray-700">{t('workOrder.oooRoom')}</span>
            </label>
            {completeForm.ooo_room && (
              <div className="space-y-2 pl-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('workOrder.oooStart')}</label>
                    <input type="date" value={completeForm.ooo_start_date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setCompleteForm(f => ({ ...f, ooo_start_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('workOrder.oooEnd')}</label>
                    <input type="date" value={completeForm.ooo_end_date}
                      min={completeForm.ooo_start_date || new Date().toISOString().split('T')[0]}
                      onChange={e => setCompleteForm(f => ({ ...f, ooo_end_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{t('workOrder.oooApprover')}</label>
                  <select value={completeForm.ooo_notified_user_id}
                    onChange={e => setCompleteForm(f => ({ ...f, ooo_notified_user_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">{t('workOrder.oooApproverPlaceholder')}</option>
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.department})</option>
                    ))}
                  </select>
                  {allUsers.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">{t('workOrder.notifyApprover')}</p>
                  )}
                </div>
              </div>
            )}
            <div className="border border-purple-200 rounded-lg p-3 bg-purple-50 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={completeForm.is_external}
                  onChange={e => setCompleteForm(f => ({ ...f, is_external: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 rounded" />
                <span className="text-sm font-medium text-purple-700 flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" /> {t('workOrder.externalTech')}
                </span>
              </label>
              {completeForm.is_external && (
                <textarea value={completeForm.external_note}
                  onChange={e => setCompleteForm(f => ({ ...f, external_note: e.target.value }))}
                  rows={2} placeholder={t('workOrder.externalNote')}
                  className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none bg-white" />
              )}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('workOrder.jobStatus')}</span>
              </div>
              <div className="divide-y divide-gray-100">
                <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${completeForm.is_complete ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                  <input type="radio" name="drawer_job_complete_status" checked={completeForm.is_complete}
                    onChange={() => setCompleteForm(f => ({ ...f, is_complete: true }))}
                    className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-700">{t('workOrder.doneReady')}</p>
                    <p className="text-xs text-gray-400">{t('workOrder.doneReadyDesc')}</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${!completeForm.is_complete ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <input type="radio" name="drawer_job_complete_status" checked={!completeForm.is_complete}
                    onChange={() => setCompleteForm(f => ({ ...f, is_complete: false }))}
                    className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-700">{t('workOrder.inProgressSave')}</p>
                    <p className="text-xs text-gray-400">{t('workOrder.inProgressSaveDesc')}</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
            <button onClick={handleComplete} disabled={acting}
              className={`flex-1 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium ${
                !completeForm.is_complete ? 'bg-blue-600 hover:bg-blue-700'
                : completeForm.is_external ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-green-600 hover:bg-green-700'
              }`}>
              {acting ? t('common.saving')
                : !completeForm.is_complete ? t('workOrder.saveProgress')
                : completeForm.is_external ? t('workOrder.sendExternal')
                : t('workOrder.submitInspect')}
            </button>
          </div>
        </InnerModal>
      )}

      {modal === 'inspect' && (
        <InnerModal title={t('workOrder.inspectModal')} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="flex gap-3">
              {[['pass', t('workOrder.inspectPass'), 'bg-green-600'], ['fail', t('workOrder.inspectFail'), 'bg-red-600']].map(([val, label, bg]) => (
                <button key={val} type="button"
                  onClick={() => setInspectForm(f => ({ ...f, result: val }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${inspectForm.result === val ? `${bg} text-white` : 'border border-gray-300 text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {inspectForm.result === 'fail' ? t('workOrder.inspectFailNote') : t('workOrder.inspectPassNote')}
              </label>
              <textarea value={inspectForm.notes}
                onChange={e => setInspectForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder={inspectForm.result === 'fail' ? t('workOrder.inspectFailDesc') : t('workOrder.inspectNoteDesc')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {inspectForm.result === 'fail' && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{t('workOrder.inspectWarnMsg')}</p>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
            <button onClick={handleInspect} disabled={acting}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? t('common.saving') : t('common.confirm')}
            </button>
          </div>
        </InnerModal>
      )}

      {modal === 'recall' && (
        <InnerModal title={t('workOrder.recallModal')} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {wo?.technician && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Undo2 className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">{t('workOrder.recallFrom')} <strong>{wo.technician.full_name}</strong></p>
                  <p className="text-xs text-amber-600 mt-0.5">{t('workOrder.recallNote')}</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">{t('workOrder.afterRecall')}</label>
              {[
                ['', t('workOrder.recallToPending'), t('workOrder.recallToPendingDesc')],
                ['reassign_mode', t('workOrder.recallReassign'), t('workOrder.recallReassignDesc')]
              ].map(([val, label, desc]) => (
                <label key={val} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="recall_mode_drawer" value={val}
                    checked={selectedTech === val}
                    onChange={() => {
                      setSelectedTech(val)
                      if (val === 'reassign_mode') api.getTechnicians().then(setTechnicians)
                    }}
                    className="text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
            {selectedTech === 'reassign_mode' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{t('workOrder.selectNewTech')}</label>
                <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {(() => {
                    const filtered = technicians.filter(tech => tech.id !== wo?.technician?.id)
                    const onD = filtered.filter(tech => onDutyTechs.includes(tech.id))
                    const offD = filtered.filter(tech => !onDutyTechs.includes(tech.id))
                    return (
                      <>
                        {onD.length > 0 && (
                          <>
                            <div className="px-3 py-1.5 bg-green-50 text-xs font-semibold text-green-700 sticky top-0">{t('workOrder.onDutySection')}</div>
                            {onD.map(tech => (
                              <label key={tech.id} className="flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50">
                                <input type="radio" name="recall_new_tech_drawer" value={tech.id} className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-900">{tech.full_name}</span>
                                <span className="text-xs text-gray-500">({tech.department})</span>
                                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full ml-auto">🟢 On Duty</span>
                              </label>
                            ))}
                          </>
                        )}
                        {offD.length > 0 && (
                          <>
                            {onD.length > 0 && <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 sticky top-0">{t('workOrder.allTechsSection')}</div>}
                            {offD.map(tech => (
                              <label key={tech.id} className="flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50">
                                <input type="radio" name="recall_new_tech_drawer" value={tech.id} className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-900">{tech.full_name}</span>
                                <span className="text-xs text-gray-500">({tech.department})</span>
                              </label>
                            ))}
                          </>
                        )}
                        {filtered.length === 0 && <div className="px-3 py-4 text-center text-sm text-gray-400">{t('common.loading')}</div>}
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setModal(null); setSelectedTech('') }}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
            <button onClick={() => {
              if (selectedTech === 'reassign_mode') {
                const sel = document.querySelector('input[name="recall_new_tech_drawer"]:checked')
                if (!sel?.value) return toast.error(t('workOrder.selectTech'))
                handleRecall(sel.value)
              } else {
                handleRecall(null)
              }
            }} disabled={acting}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? t('common.saving') : t('workOrder.confirmRecall')}
            </button>
          </div>
        </InnerModal>
      )}

      {modal === 'reject' && (
        <InnerModal title={t('workOrder.rejectModal')} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{t('workOrder.rejectDesc')}</p>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t('workOrder.rejectReasonLabel')}</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={3} placeholder={t('workOrder.rejectReasonPlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
            <button onClick={() => handleReject(rejectReason)} disabled={acting}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? t('common.saving') : t('workOrder.confirmReject')}
            </button>
          </div>
        </InnerModal>
      )}

      {modal === 'transfer' && (
        <InnerModal title={t('workOrder.transferModal')} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{t('workOrder.transferDesc')}</p>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t('workOrder.transferTechLabel')}</label>
              {(() => {
                const filtered = technicians.filter(tech => tech.id !== wo?.technician?.id)
                const onDutyFiltered = filtered.filter(tech => onDutyTechs.includes(tech.id))
                const offDutyFiltered = filtered.filter(tech => !onDutyTechs.includes(tech.id))
                return (
                  <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {onDutyFiltered.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-green-50 text-xs font-semibold text-green-700 sticky top-0">{t('workOrder.onDutySection')}</div>
                        {onDutyFiltered.map(tech => (
                          <label key={tech.id} className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 ${selectedTech === String(tech.id) ? 'bg-blue-50' : ''}`}>
                            <input type="checkbox" checked={selectedTech === String(tech.id)}
                              onChange={() => setSelectedTech(selectedTech === String(tech.id) ? '' : String(tech.id))}
                              className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm font-medium text-gray-900">{tech.full_name}</span>
                            <span className="text-xs text-gray-500">({tech.department})</span>
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full ml-auto">🟢 On Duty</span>
                          </label>
                        ))}
                      </>
                    )}
                    {offDutyFiltered.map(tech => (
                      <label key={tech.id} className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 ${selectedTech === String(tech.id) ? 'bg-blue-50' : ''}`}>
                        <input type="checkbox" checked={selectedTech === String(tech.id)}
                          onChange={() => setSelectedTech(selectedTech === String(tech.id) ? '' : String(tech.id))}
                          className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm font-medium text-gray-900">{tech.full_name}</span>
                        <span className="text-xs text-gray-500">({tech.department})</span>
                      </label>
                    ))}
                    {filtered.length === 0 && <div className="px-3 py-4 text-center text-sm text-gray-400">{t('common.loading')}</div>}
                  </div>
                )
              })()}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t('workOrder.transferNote')}</label>
              <textarea value={transferNote} onChange={e => setTransferNote(e.target.value)}
                rows={2} placeholder={t('workOrder.transferNotePlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
            <button onClick={() => handleTransfer(selectedTech, transferNote)} disabled={acting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? t('workOrder.transferring') : t('workOrder.confirmTransfer')}
            </button>
          </div>
        </InnerModal>
      )}

      {modal === 'edit' && (
        <InnerModal title={t('workOrder.editModal')} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t('workOrder.issueLabel')}</label>
              <select value={editForm.issue_type_id} onChange={e => setEditForm(f => ({ ...f, issue_type_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{t('workOrder.issueTypePlaceholder')}</option>
                {issueTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">{t('workOrder.priorityLevel')}</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'normal', label: t('priority.normal') },
                  { value: 'urgent', label: `${t('priority.urgent')} 🔴` },
                  { value: 'very_urgent', label: `${t('priority.very_urgent')} 🚨` },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setEditForm(f => ({ ...f, priority: opt.value }))}
                    className={`py-2 rounded-lg text-sm font-medium border-2 transition-colors ${editForm.priority === opt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t('workOrder.repairDescLabel')}</label>
              <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                rows={3} placeholder={t('workOrder.repairDescPlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t('workOrder.scheduleLabel')}</label>
              <div className="flex gap-2">
                <input type="date" value={editForm.sched_date} min={localDateStr(new Date())}
                  onChange={e => handleSchedDateChange(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={editForm.sched_hour} onChange={e => handleSchedHourChange(e.target.value)}
                  disabled={!editForm.sched_date}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none disabled:opacity-40">
                  {SCHED_HOURS.map(h => <option key={h} value={h}>{h}{t('request.timeUnit')}</option>)}
                </select>
                <select value={editForm.sched_minute}
                  onChange={e => setEditForm(f => ({ ...f, sched_minute: e.target.value }))}
                  disabled={!editForm.sched_date}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none disabled:opacity-40">
                  {SCHED_MINUTES.map(m => <option key={m} value={m}>{m}{t('request.timeUnit')}</option>)}
                </select>
              </div>
              {editForm.sched_date && (
                <button type="button" onClick={() => setEditForm(f => ({ ...f, sched_date: '' }))}
                  className="mt-1 text-xs text-gray-400 hover:text-red-500">{t('workOrder.clearTime')}</button>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.guest_inhouse}
                onChange={e => setEditForm(f => ({ ...f, guest_inhouse: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-700">{t('workOrder.guestInhouse')}</span>
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
            <button onClick={handleEdit} disabled={acting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? t('common.saving') : t('workOrder.saveEdit')}
            </button>
          </div>
        </InnerModal>
      )}

      {modal === 'history' && (
        <InnerModal title={t('workOrder.locationHistoryModal')} onClose={() => setModal(null)}>
          <p className="text-xs text-gray-500 mb-3">
            {job?.main_area?.name}{job?.sub_area ? ` › ${job.sub_area.name}` : ''}{job?.other_location || ''}
          </p>
          {histLoading ? (
            <div className="text-center text-gray-400 py-4 text-sm">{t('common.loading')}</div>
          ) : locationHistory.length === 0 ? (
            <div className="text-center text-gray-400 py-4 text-sm">{t('workOrder.noRepairHistory')}</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {locationHistory.map((h, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-400">{h.request_number}</span>
                    <StatusBadge status={h.status} />
                  </div>
                  <p className="text-sm font-medium text-gray-800">{h.issue}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{h.description}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-gray-400">{t('common.tech')}: {h.technician}</span>
                    <span className="text-xs text-gray-400">
                      {h.reported_at ? format(new Date(h.reported_at), 'd MMM yy', { locale: dateLocale }) : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setModal(null)}
            className="w-full mt-4 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">
            {t('common.close')}
          </button>
        </InnerModal>
      )}
    </>
  )
}
