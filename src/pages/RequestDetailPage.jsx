import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, imgUrl } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/common/StatusBadge'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  ArrowLeft, Wrench, CheckCircle, XCircle, Plus, Trash2,
  History, UserPlus, RefreshCw, ExternalLink, Undo2, ImageOff, Edit2
} from 'lucide-react'

const BASE = ''

// ── TechCheckList — อยู่นอก component หลักเพื่อป้องกัน React remount ──────
function TechCheckList({ technicians, onDutyTechs, selectedTech, setSelectedTech, selectedTechs, setSelectedTechs, multi = false, excludeId = null }) {
  const list = technicians.filter(t => t.id !== excludeId)
  const onDutyList = list.filter(t => onDutyTechs.includes(t.id))
  const offDutyList = list.filter(t => !onDutyTechs.includes(t.id))
  const isChecked = (t) => multi
    ? selectedTechs.includes(String(t.id))
    : selectedTech === String(t.id)
  const toggle = (t) => {
    if (multi) {
      const id = String(t.id)
      setSelectedTechs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    } else {
      setSelectedTech(prev => prev === String(t.id) ? '' : String(t.id))
    }
  }
  const renderTech = (t) => (
    <label key={t.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${isChecked(t) ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'}`}>
      <input type="checkbox" checked={isChecked(t)} onChange={() => toggle(t)}
        className="w-4 h-4 text-blue-600 rounded" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900">{t.full_name}</span>
        <span className="text-xs text-gray-500 ml-1">({t.department})</span>
      </div>
      {onDutyTechs.includes(t.id) && (
        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full whitespace-nowrap">🟢 On Duty</span>
      )}
    </label>
  )
  return (
    <div className="mb-3 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
      {onDutyList.length > 0 && (
        <>
          <div className="px-3 py-1.5 bg-green-50 text-xs font-semibold text-green-700">🟢 On Duty วันนี้</div>
          <div className="max-h-40 overflow-y-auto">{onDutyList.map(renderTech)}</div>
        </>
      )}
      {offDutyList.length > 0 && (
        <>
          <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500">ช่างทั้งหมด</div>
          <div className="max-h-40 overflow-y-auto">{offDutyList.map(renderTech)}</div>
        </>
      )}
      {list.length === 0 && (
        <div className="px-3 py-4 text-center text-sm text-gray-400">กำลังโหลด...</div>
      )}
    </div>
  )
}

function SafeImage({ src, className }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <ImageOff className="w-6 h-6 text-gray-300" />
      </div>
    )
  }
  return <img src={src} alt="" className={className} onError={() => setBroken(true)} />
}

function InfoRow({ label, value, pre }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex gap-3">
      <span className="text-sm text-gray-500 w-32 flex-shrink-0">{label}</span>
      <span className={`text-sm text-gray-900 font-medium ${pre ? 'whitespace-pre-line' : ''}`}>{value}</span>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-900 mb-4 text-base">{title}</h3>
        {children}
      </div>
    </div>
  )
}

// ── Materials Table ───────────────────────────────────
function MaterialsTable({ materials, onChange }) {
  function addRow() {
    onChange([...materials, { name: '', qty: 1, unit: 'ชิ้น', unit_cost: 0 }])
  }
  function removeRow(i) {
    onChange(materials.filter((_, idx) => idx !== i))
  }
  function updateRow(i, field, val) {
    const updated = [...materials]
    updated[i] = { ...updated[i], [field]: val }
    onChange(updated)
  }

  const totalCost = materials.reduce((s, m) => s + (Number(m.qty) || 0) * (Number(m.unit_cost) || 0), 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">อุปกรณ์สิ้นเปลือง</label>
        <button type="button" onClick={addRow}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
          <Plus className="w-3.5 h-3.5" /> เพิ่มรายการ
        </button>
      </div>
      {materials.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {['ชื่ออุปกรณ์','จำนวน','หน่วย','ราคา/หน่วย','รวม',''].map(h => (
                  <th key={h} className="text-left px-2 py-2 text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {materials.map((m, i) => (
                <tr key={i}>
                  <td className="px-2 py-1">
                    <input value={m.name} onChange={e => updateRow(i, 'name', e.target.value)}
                      placeholder="ชื่ออุปกรณ์" className="w-full border-0 focus:outline-none text-xs" />
                  </td>
                  <td className="px-2 py-1 w-16">
                    <input type="number" min="0" step="0.1" value={m.qty}
                      onChange={e => updateRow(i, 'qty', e.target.value)}
                      className="w-full border-0 focus:outline-none text-xs text-right" />
                  </td>
                  <td className="px-2 py-1 w-16">
                    <input value={m.unit} onChange={e => updateRow(i, 'unit', e.target.value)}
                      className="w-full border-0 focus:outline-none text-xs" />
                  </td>
                  <td className="px-2 py-1 w-20">
                    <input type="number" min="0" value={m.unit_cost}
                      onChange={e => updateRow(i, 'unit_cost', e.target.value)}
                      className="w-full border-0 focus:outline-none text-xs text-right" />
                  </td>
                  <td className="px-2 py-1 text-right font-medium text-gray-700 w-16">
                    {(Number(m.qty) * Number(m.unit_cost)).toLocaleString()}
                  </td>
                  <td className="px-2 py-1 w-8">
                    <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-gray-50 px-3 py-2 flex justify-end">
            <span className="text-sm font-semibold text-gray-900">
              รวม: {totalCost.toLocaleString()} บาท
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RequestDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)

  const [technicians, setTechnicians] = useState([])
  const [onDutyTechs, setOnDutyTechs] = useState([])
  const [allUsers, setAllUsers] = useState([])

  // Modals
  const [modal, setModal] = useState(null) // assign|accept|complete|inspect|reassign|coassign|recall|history|reject|transfer|edit

  // Assign / Reassign / CoAssign
  const [selectedTech, setSelectedTech] = useState('')   // single-select (reassign/transfer/recall)
  const [selectedTechs, setSelectedTechs] = useState([]) // multi-select (assign/coassign)
  const [acting, setActing] = useState(false)

  // Reject
  const [rejectReason, setRejectReason] = useState('')
  // Transfer
  const [transferNote, setTransferNote] = useState('')

  // Complete
  const [completeForm, setCompleteForm] = useState({
    repair_details: '', materials: [], ooo_room: false,
    ooo_start_date: '', ooo_end_date: '', ooo_notified_user_id: '',
    is_external: false, external_note: ''
  })

  // Edit
  const [editForm, setEditForm] = useState({
    description: '', issue_type_id: '', priority: 'normal',
    sched_date: '', sched_hour: '08', sched_minute: '00',
    guest_inhouse: false
  })
  const [issueTypes, setIssueTypes] = useState([])

  // Inspect
  const [inspectForm, setInspectForm] = useState({ result: 'pass', notes: '' })

  // History
  const [locationHistory, setLocationHistory] = useState([])
  const [histLoading, setHistLoading] = useState(false)

  useEffect(() => { api.getJob(id).then(setJob).finally(() => setLoading(false)) }, [id])
  useEffect(() => {
    if (['assign','reassign','coassign','recall','transfer'].includes(modal) && technicians.length === 0) {
      // โหลดช่างก่อน แล้วค่อยโหลด on-duty (แยกกันเพื่อไม่ให้ error ฝั่งใดกั้นอีกฝั่ง)
      api.getTechnicians().then(setTechnicians).catch(() => {})
      api.getOnDutyToday()
        .then(duty => setOnDutyTechs(Array.isArray(duty) ? duty.map(d => d.technician?.id).filter(Boolean) : []))
        .catch(() => setOnDutyTechs([]))
    }
    if (modal === 'complete' && allUsers.length === 0) {
      api.getUsers().then(setAllUsers)
    }
    if (modal === 'edit') {
      if (issueTypes.length === 0) api.getIssueTypes().then(setIssueTypes)
    }
  }, [modal])

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

  async function handleAssign(type) {
    if (!selectedTech) return toast.error('กรุณาเลือกช่าง')
    setActing(true)
    try {
      let updated
      if (type === 'reassign') updated = await api.reassignJob(job.id, Number(selectedTech))
      else updated = await api.coAssignJob(job.id, Number(selectedTech))
      setJob(updated); setModal(null); setSelectedTech('')
      toast.success({ reassign: 'เปลี่ยนช่างสำเร็จ', coassign: 'เพิ่มช่างร่วมสำเร็จ' }[type])
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  // multi-select assign: คนแรก = primary, ที่เหลือ = co-assign
  async function handleAssignMulti() {
    if (selectedTechs.length === 0) return toast.error('กรุณาเลือกช่างอย่างน้อย 1 คน')
    setActing(true)
    try {
      let updated = await api.assignJob(job.id, Number(selectedTechs[0]))
      for (let i = 1; i < selectedTechs.length; i++) {
        updated = await api.coAssignJob(job.id, Number(selectedTechs[i]))
      }
      setJob(updated); setModal(null); setSelectedTechs([])
      toast.success(`จ่ายงานสำเร็จ${selectedTechs.length > 1 ? ` (${selectedTechs.length} คน)` : ''}`)
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  // multi-select co-assign
  async function handleCoAssignMulti() {
    if (selectedTechs.length === 0) return toast.error('กรุณาเลือกช่างอย่างน้อย 1 คน')
    setActing(true)
    try {
      let updated = job
      for (const techId of selectedTechs) {
        updated = await api.coAssignJob(job.id, Number(techId))
      }
      setJob(updated); setModal(null); setSelectedTechs([])
      toast.success(`เพิ่มช่างร่วม ${selectedTechs.length} คนสำเร็จ`)
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleAccept() {
    setActing(true)
    try {
      const updated = await api.acceptJob(job.id)
      setJob(updated); setModal(null)
      toast.success('รับงานสำเร็จ')
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleComplete() {
    if (!completeForm.repair_details.trim()) return toast.error('กรุณาระบุรายละเอียดการซ่อม')
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
      })
      setJob(updated); setModal(null)
      toast.success(completeForm.is_external ? 'บันทึก: รอช่างภายนอก' : 'บันทึกการซ่อมสำเร็จ')
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
      // สร้าง scheduled_at จาก date + hour + minute
      payload.scheduled_at = editForm.sched_date
        ? `${editForm.sched_date}T${editForm.sched_hour}:${editForm.sched_minute}:00`
        : null
      payload.guest_inhouse = editForm.guest_inhouse
      const updated = await api.editJob(job.id, payload)
      setJob(updated); setModal(null)
      toast.success('แก้ไขข้อมูลสำเร็จ')
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleInspect() {
    if (inspectForm.result === 'fail' && !inspectForm.notes.trim())
      return toast.error('กรุณาระบุสิ่งที่ไม่เรียบร้อย')
    setActing(true)
    try {
      const updated = await api.inspectJob(job.id, inspectForm)
      setJob(updated); setModal(null)
      toast.success(inspectForm.result === 'pass' ? 'ผ่านการตรวจ ปิดงาน' : 'ส่งซ่อมใหม่แล้ว')
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleRemoveCo(coId) {
    try {
      const updated = await api.removeCoAssign(job.id, coId)
      setJob(updated); toast.success('ลบช่างร่วมแล้ว')
    } catch (err) { toast.error(err.message) }
  }

  async function handleRecall(newTechId = null) {
    setActing(true)
    try {
      const updated = await api.recallJob(job.id, newTechId ? Number(newTechId) : null)
      setJob(updated)
      setModal(null)
      setSelectedTech('')
      toast.success(newTechId ? 'ดึงงานกลับและ Re-assign แล้ว' : 'ดึงงานกลับสู่คิวรอสำเร็จ')
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleCancel() {
    if (!confirm('ยืนยันการยกเลิก?')) return
    try { const u = await api.cancelJob(job.id); setJob(u); toast.success('ยกเลิกแล้ว') }
    catch (err) { toast.error(err.message) }
  }

  async function handleReject(reason) {
    if (!reason.trim()) return toast.error('กรุณาระบุเหตุผล')
    setActing(true)
    try {
      const updated = await api.rejectJob(job.id, reason)
      setJob(updated); setModal(null)
      toast.success('ปฏิเสธงานแล้ว')
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleTransfer(techId, note) {
    if (!techId) return toast.error('กรุณาเลือกช่าง')
    setActing(true)
    try {
      const updated = await api.transferJob(job.id, Number(techId), note)
      setJob(updated); setModal(null); setSelectedTech('')
      toast.success('โอนงานสำเร็จ')
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  async function handleSelfAssign() {
    setActing(true)
    try {
      const updated = await api.selfAssignJob(job.id)
      setJob(updated); toast.success('รับงานสำเร็จ')
    } catch (err) { toast.error(err.message) }
    finally { setActing(false) }
  }

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
  if (!job) return <div className="p-8 text-center text-gray-400 text-sm">ไม่พบงาน</div>

  const wo = job.work_orders?.find(w => ['assigned','in_progress','completed','external'].includes(w.status))
           || job.work_orders?.[0]
  const latestInspection = job.inspections?.slice(-1)[0]

  // Permissions
  const isSuperAdmin = ['admin','supervisor'].includes(user?.role)
  const isMyWO = wo?.technician?.id === user?.id  // ช่างที่ถูก assign โดยตรง

  const isSameDept   = user?.department && job.reporter?.department === user?.department

  const canAssign    = isSuperAdmin && ['pending','reopened','external_tech'].includes(job.status)
  const canAccept    = isMyWO && job.status === 'assigned'
  const canComplete  = (isMyWO || isSuperAdmin) && ['assigned','in_progress'].includes(job.status)
  const canRecall    = isSuperAdmin && ['assigned','in_progress'].includes(job.status)
  const canCoAssign  = isSuperAdmin && ['assigned','in_progress'].includes(job.status)
  // staff แผนกเดียวกันตรวจและปิดงานได้
  const canInspect   = job.status === 'pending_inspection' && (isSuperAdmin || isSameDept || user?.role !== 'staff')
  const canCancel    = job.status === 'pending' && (user?.role === 'admin' || job.reporter?.id === user?.id)
  const canReject    = isMyWO && job.status === 'assigned'
  const canTransfer  = (isMyWO || isSuperAdmin) && ['assigned','in_progress'].includes(job.status)
  const canSelfAssign = user?.role === 'technician' && job.status === 'pending'
  const canEdit = (
    (job.status === 'pending') ||
    (job.status === 'assigned' && !wo?.accepted_at)
  ) && (
    user?.department === job.reporter?.department ||
    ['admin','supervisor'].includes(user?.role)
  )

  const Section = ({ title, children }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </div>
  )

  // shorthand props ส่งให้ TechCheckList
  const techListProps = { technicians, onDutyTechs, selectedTech, setSelectedTech, selectedTechs, setSelectedTechs }

  // parse materials json
  let parsedMaterials = []
  if (wo?.materials_used) {
    try { parsedMaterials = JSON.parse(wo.materials_used) } catch {}
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900">{job.request_number}</h1>
            {job.priority === 'very_urgent' && (
              <span className="text-sm px-3 py-1 bg-red-600 text-white rounded-full font-bold tracking-wide shadow-sm">
                🚨 ด่วนมาก
              </span>
            )}
            {job.priority === 'urgent' && (
              <span className="text-sm px-3 py-1 bg-orange-400 text-white rounded-full font-bold tracking-wide shadow-sm">
                🔴 ด่วน
              </span>
            )}
            {(!job.priority || job.priority === 'normal') && job.is_urgent && (
              <span className="text-sm px-3 py-1 bg-red-600 text-white rounded-full font-bold tracking-wide shadow-sm">
                🚨 ด่วน
              </span>
            )}
            {job.guest_inhouse && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">มีแขก In House</span>}
            <StatusBadge status={job.status} />
          </div>
          <p className="text-sm text-gray-600 font-medium mt-1">
            {job.reported_at ? format(new Date(job.reported_at), 'd MMMM yyyy เวลา HH:mm น.', { locale: th }) : ''}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* หัวหน้าช่าง: จ่ายงาน */}
        {canAssign && (
          <button onClick={() => { setSelectedTechs([]); setModal('assign') }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium">
            <Wrench className="w-4 h-4" /> จ่ายงาน
          </button>
        )}
        {/* หัวหน้าช่าง: ดึงงานกลับ */}
        {canRecall && (
          <button onClick={() => { setSelectedTech(''); setModal('recall') }}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-medium">
            <Undo2 className="w-4 h-4" /> ดึงงานกลับ
          </button>
        )}
        {/* หัวหน้าช่าง: เพิ่มช่างร่วม */}
        {canCoAssign && (
          <button onClick={() => { setSelectedTechs([]); setModal('coassign') }}
            className="flex items-center gap-1.5 border border-indigo-300 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg text-sm font-medium">
            <UserPlus className="w-4 h-4" /> เพิ่มช่างร่วม
          </button>
        )}
        {/* ช่างที่ได้รับ assign: รับงาน */}
        {canAccept && (
          <button onClick={() => setModal('accept')}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> รับงาน
          </button>
        )}
        {/* ช่างที่ได้รับ assign: บันทึกการซ่อม */}
        {canComplete && (
          <button onClick={() => setModal('complete')}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> บันทึกการซ่อม
          </button>
        )}
        {/* ผู้ตรวจ: ตรวจงาน */}
        {canInspect && (
          <button onClick={() => setModal('inspect')}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> ตรวจงาน
          </button>
        )}
        <button onClick={() => { setModal('history'); loadHistory() }}
          className="flex items-center gap-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium">
          <History className="w-4 h-4" /> ประวัติพื้นที่นี้
        </button>
        {canSelfAssign && (
          <button onClick={handleSelfAssign} disabled={acting}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> รับงาน (On Duty)
          </button>
        )}
        {canReject && (
          <button onClick={() => { setRejectReason(''); setModal('reject') }}
            className="flex items-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium">
            <XCircle className="w-4 h-4" /> ปฏิเสธงาน
          </button>
        )}
        {canTransfer && (
          <button onClick={() => { setSelectedTech(''); setTransferNote(''); setModal('transfer') }}
            className="flex items-center gap-1.5 border border-indigo-300 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg text-sm font-medium">
            <RefreshCw className="w-4 h-4" /> โอนงาน
          </button>
        )}
        {canCancel && (
          <button onClick={handleCancel}
            className="flex items-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium">
            <XCircle className="w-4 h-4" /> ยกเลิก
          </button>
        )}
        {canEdit && (
          <button onClick={() => {
            setEditForm({
              description: job.description || '',
              issue_type_id: job.issue_type?.id ? String(job.issue_type.id) : '',
              priority: job.priority || 'normal',
              sched_date: job.scheduled_at ? job.scheduled_at.slice(0, 10) : '',
              sched_hour: job.scheduled_at ? job.scheduled_at.slice(11, 13) : '08',
              sched_minute: job.scheduled_at ? job.scheduled_at.slice(14, 16) : '00',
              guest_inhouse: job.guest_inhouse || false,
            })
            setModal('edit')
          }}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium">
            <Edit2 className="w-4 h-4" /> แก้ไข
          </button>
        )}
      </div>

      {/* Request Info */}
      <Section title="ข้อมูลการแจ้งซ่อม">
        <div className="space-y-2.5">
          <InfoRow label="ผู้แจ้ง" value={`${job.reporter?.full_name} (${job.reporter?.position})`} />
          <InfoRow label="วันที่แจ้ง" value={job.reported_at ? format(new Date(job.reported_at), 'd MMMM yyyy เวลา HH:mm น.', { locale: th }) : ''} />
          <InfoRow label="พื้นที่" value={
            job.main_area ? `${job.main_area.name}${job.sub_area ? ` › ${job.sub_area.name}` : ''}` : job.other_location || '-'
          } />
          <InfoRow label="ประเภทงาน" value={job.issue_type?.name || job.other_issue} />
          <InfoRow label="รายละเอียด" value={job.description} pre />
          <InfoRow label="นัดซ่อม" value={job.scheduled_at ? format(new Date(job.scheduled_at), 'd MMMM yyyy HH:mm น.', { locale: th }) : null} />
          {job.last_edited_by && (
            <InfoRow label="แก้ไขล่าสุด" value={`โดย ${job.last_edited_by.full_name}${job.last_edited_at ? ' เมื่อ ' + format(new Date(job.last_edited_at), 'd MMM yy HH:mm', { locale: th }) : ''}`} />
          )}
        </div>
        {job.images?.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">รูปถ่าย</p>
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
        <Section title="ข้อมูลการซ่อม">
          <div className="space-y-2.5">
            <InfoRow label="ช่างผู้รับงาน" value={`${wo.technician?.full_name} (${wo.technician?.position})`} />
            {wo.co_assignments?.length > 0 && (
              <div className="flex gap-3">
                <span className="text-sm text-gray-500 w-32 flex-shrink-0">ช่างร่วม</span>
                <div className="space-y-1">
                  {wo.co_assignments.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="text-sm text-gray-900 font-medium">{c.technician?.full_name}</span>
                      {isSuperAdmin && (
                        <button onClick={() => handleRemoveCo(c.id)}
                          className="text-gray-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <InfoRow label="จ่ายงานโดย" value={wo.assigned_by?.full_name} />
            <InfoRow label="วันที่รับงาน" value={wo.accepted_at ? format(new Date(wo.accepted_at), 'd MMM yyyy HH:mm', { locale: th }) : 'ยังไม่รับงาน'} />
            {wo.is_external && (
              <div className="flex gap-2 items-start p-3 bg-purple-50 rounded-lg">
                <ExternalLink className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-purple-700">งานช่างภายนอก</p>
                  {wo.external_note && <p className="text-xs text-purple-600 mt-0.5">{wo.external_note}</p>}
                </div>
              </div>
            )}
            {wo.repair_details && <InfoRow label="รายละเอียดการซ่อม" value={wo.repair_details} pre />}
            {parsedMaterials.length > 0 && (
              <div className="flex gap-3">
                <span className="text-sm text-gray-500 w-32 flex-shrink-0">อุปกรณ์</span>
                <div className="flex-1">
                  <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        {['ชื่ออุปกรณ์','จำนวน','หน่วย','ราคา/หน่วย','รวม'].map(h => (
                          <th key={h} className="text-left px-2 py-1.5 text-gray-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {parsedMaterials.map((m, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5">{m.name}</td>
                          <td className="px-2 py-1.5 text-right">{m.qty}</td>
                          <td className="px-2 py-1.5">{m.unit}</td>
                          <td className="px-2 py-1.5 text-right">{Number(m.unit_cost).toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right font-medium">{(m.qty * m.unit_cost).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-2 py-1.5 font-semibold text-right text-gray-700">รวม</td>
                        <td className="px-2 py-1.5 font-bold text-gray-900 text-right">{(wo.total_cost || 0).toLocaleString()} บาท</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
            {wo.ooo_room && !wo.ooo_start_date && <InfoRow label="ปิดห้อง OOO" value={`${wo.ooo_days || '-'} วัน`} />}
            {wo.ooo_start_date && <InfoRow label="ปิดห้อง OOO" value={`${wo.ooo_start_date} ถึง ${wo.ooo_end_date || '?'}`} />}
            {wo.ooo_notified_user && <InfoRow label="แจ้ง" value={wo.ooo_notified_user.full_name} />}
            {wo.completed_at && <InfoRow label="ซ่อมเสร็จ" value={format(new Date(wo.completed_at), 'd MMM yyyy HH:mm', { locale: th })} />}
          </div>
        </Section>
      )}

      {/* Inspection */}
      {latestInspection && (
        <Section title="ผลการตรวจ">
          <div className="space-y-2.5">
            <InfoRow label="ผู้ตรวจ" value={latestInspection.inspector?.full_name} />
            <div className="flex gap-3">
              <span className="text-sm text-gray-500 w-32 flex-shrink-0">ผล</span>
              <span className={`text-sm font-semibold ${latestInspection.result === 'pass' ? 'text-green-600' : 'text-red-600'}`}>
                {latestInspection.result === 'pass' ? '✓ ผ่าน' : '✗ ไม่ผ่าน — ส่งซ่อมใหม่'}
              </span>
            </div>
            {latestInspection.notes && <InfoRow label="หมายเหตุ" value={latestInspection.notes} pre />}
            <InfoRow label="วันที่ตรวจ" value={format(new Date(latestInspection.created_at), 'd MMM yyyy HH:mm', { locale: th })} />
          </div>
        </Section>
      )}

      {/* History */}
      {job.history?.length > 0 && (
        <Section title="ประวัติสถานะ">
          <div className="space-y-3">
            {[...job.history].reverse().map(h => (
              <div key={h.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={h.new_status} />
                    <span className="text-gray-500 text-xs">{h.changed_by?.full_name}</span>
                    <span className="text-gray-400 text-xs">{format(new Date(h.timestamp), 'd MMM yy HH:mm', { locale: th })}</span>
                  </div>
                  {h.note && <p className="text-gray-600 text-xs mt-0.5">{h.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Modals ── */}

      {/* Assign — multi-select */}
      {modal === 'assign' && (
        <Modal title="จ่ายงานให้ช่าง" onClose={() => setModal(null)}>
          {selectedTechs.length > 0 && (
            <p className="text-xs text-blue-600 font-medium mb-2">
              เลือกแล้ว {selectedTechs.length} คน
              {selectedTechs.length > 1 && ' (คนแรก = ช่างหลัก, ที่เหลือ = ช่างร่วม)'}
            </p>
          )}
          <TechCheckList {...techListProps} multi={true} />
          <div className="flex gap-2">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">ยกเลิก</button>
            <button onClick={handleAssignMulti} disabled={acting || selectedTechs.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? 'กำลังบันทึก...' : `จ่ายงาน${selectedTechs.length > 0 ? ` (${selectedTechs.length} คน)` : ''}`}
            </button>
          </div>
        </Modal>
      )}

      {/* Accept */}
      {modal === 'accept' && (
        <Modal title="รับงาน" onClose={() => setModal(null)}>
          <p className="text-sm text-gray-600 mb-4">กดยืนยันเพื่อรับงานและเริ่มดำเนินการซ่อม</p>
          <div className="flex gap-2">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">ยกเลิก</button>
            <button onClick={handleAccept} disabled={acting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? 'กำลังบันทึก...' : 'ยืนยันรับงาน'}
            </button>
          </div>
        </Modal>
      )}

      {/* Reassign */}
      {modal === 'reassign' && (
        <Modal title="เปลี่ยนช่าง" onClose={() => setModal(null)}>
          <TechCheckList {...techListProps} />
          <div className="flex gap-2">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">ยกเลิก</button>
            <button onClick={() => handleAssign('reassign')} disabled={acting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? 'กำลังบันทึก...' : 'เปลี่ยนช่าง'}
            </button>
          </div>
        </Modal>
      )}

      {/* Co-assign — multi-select */}
      {modal === 'coassign' && (
        <Modal title="เพิ่มช่างร่วมปฏิบัติงาน" onClose={() => setModal(null)}>
          {selectedTechs.length > 0 && (
            <p className="text-xs text-indigo-600 font-medium mb-2">เลือกแล้ว {selectedTechs.length} คน</p>
          )}
          <TechCheckList {...techListProps} multi={true} excludeId={wo?.technician?.id} />
          <div className="flex gap-2">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">ยกเลิก</button>
            <button onClick={handleCoAssignMulti} disabled={acting || selectedTechs.length === 0}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? 'กำลังบันทึก...' : `เพิ่มช่างร่วม${selectedTechs.length > 0 ? ` (${selectedTechs.length} คน)` : ''}`}
            </button>
          </div>
        </Modal>
      )}

      {/* Complete */}
      {modal === 'complete' && (
        <Modal title="บันทึกการซ่อม" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">รายละเอียดการซ่อม *</label>
              <textarea value={completeForm.repair_details}
                onChange={e => setCompleteForm(f => ({ ...f, repair_details: e.target.value }))}
                rows={3} placeholder="อธิบายสิ่งที่ทำ..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <MaterialsTable
              materials={completeForm.materials}
              onChange={m => setCompleteForm(f => ({ ...f, materials: m }))} />

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={completeForm.ooo_room}
                onChange={e => setCompleteForm(f => ({ ...f, ooo_room: e.target.checked }))}
                className="w-4 h-4 text-red-600 rounded" />
              <span className="text-sm text-gray-700">ปิดห้อง Out of Order</span>
            </label>
            {completeForm.ooo_room && (
              <div className="space-y-2 pl-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">วันที่เริ่มปิด</label>
                    <input type="date" value={completeForm.ooo_start_date}
                      onChange={e => setCompleteForm(f => ({ ...f, ooo_start_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">วันที่เปิดคืน</label>
                    <input type="date" value={completeForm.ooo_end_date}
                      onChange={e => setCompleteForm(f => ({ ...f, ooo_end_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">แจ้ง Housemate/Front</label>
                  <select value={completeForm.ooo_notified_user_id}
                    onChange={e => setCompleteForm(f => ({ ...f, ooo_notified_user_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- เลือกผู้รับแจ้ง --</option>
                    {allUsers.filter(u => /housemate|front/i.test(u.department)).map(u => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.department})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* External tech option */}
            <div className="border border-purple-200 rounded-lg p-3 bg-purple-50 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={completeForm.is_external}
                  onChange={e => setCompleteForm(f => ({ ...f, is_external: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 rounded" />
                <span className="text-sm font-medium text-purple-700 flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" /> ต้องใช้ช่างภายนอก
                </span>
              </label>
              {completeForm.is_external && (
                <textarea value={completeForm.external_note}
                  onChange={e => setCompleteForm(f => ({ ...f, external_note: e.target.value }))}
                  rows={2} placeholder="เหตุผล / รายละเอียด..."
                  className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white" />
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">ยกเลิก</button>
            <button onClick={handleComplete} disabled={acting}
              className={`flex-1 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium ${
                completeForm.is_external ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'
              }`}>
              {acting ? 'กำลังบันทึก...' : completeForm.is_external ? 'ส่งให้หัวหน้าช่าง' : 'ยืนยัน'}
            </button>
          </div>
        </Modal>
      )}

      {/* Inspect */}
      {modal === 'inspect' && (
        <Modal title="ตรวจงาน" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="flex gap-3">
              {[['pass','เรียบร้อย','bg-green-600'],['fail','ไม่เรียบร้อย','bg-red-600']].map(([val, label, bg]) => (
                <button key={val} type="button"
                  onClick={() => setInspectForm(f => ({ ...f, result: val }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    inspectForm.result === val ? `${bg} text-white` : 'border border-gray-300 text-gray-700'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {inspectForm.result === 'fail' ? 'ระบุสิ่งที่ไม่เรียบร้อย *' : 'หมายเหตุ'}
              </label>
              <textarea value={inspectForm.notes}
                onChange={e => setInspectForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder={inspectForm.result === 'fail' ? 'ระบุรายละเอียด...' : 'หมายเหตุเพิ่มเติม...'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {inspectForm.result === 'fail' && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">
                ⚠️ ระบบจะส่งงานกลับให้ช่างคนเดิมและหัวหน้าช่างทันที
              </p>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">ยกเลิก</button>
            <button onClick={handleInspect} disabled={acting}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </button>
          </div>
        </Modal>
      )}

      {/* Recall */}
      {modal === 'recall' && (
        <Modal title="ดึงงานกลับ" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {/* แสดงช่างที่จะถูกดึงกลับ */}
            {wo?.technician && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Undo2 className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    ดึงงานกลับจาก <strong>{wo.technician.full_name}</strong>
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    งานที่อยู่ระหว่างดำเนินการจะถูกยกเลิก และต้องจ่ายงานใหม่
                  </p>
                </div>
              </div>
            )}

            {/* ตัวเลือก: Re-assign ทันที หรือ กลับ pending */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                หลังดึงกลับต้องการทำอะไร?
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="recall_action" value="pending"
                    checked={selectedTech === ''}
                    onChange={() => setSelectedTech('')}
                    className="text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">กลับไปรอจ่ายงาน (Pending)</p>
                    <p className="text-xs text-gray-500">จ่ายงานให้ช่างคนใหม่ในภายหลัง</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="recall_action" value="reassign"
                    checked={selectedTech === 'reassign_mode'}
                    onChange={() => { setSelectedTech('reassign_mode'); api.getTechnicians().then(setTechnicians) }}
                    className="text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Re-assign ให้ช่างคนใหม่ทันที</p>
                    <p className="text-xs text-gray-500">เลือกช่างคนใหม่แล้วจ่ายงานในขั้นตอนเดียว</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Tech checklist — แสดงเมื่อเลือก re-assign */}
            {selectedTech === 'reassign_mode' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">เลือกช่างคนใหม่</label>
                {(() => {
                  const onDutyList = technicians.filter(t => onDutyTechs.includes(t.id) && t.id !== wo?.technician?.id)
                  const offDutyList = technicians.filter(t => !onDutyTechs.includes(t.id) && t.id !== wo?.technician?.id)
                  return (
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                      {onDutyList.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 bg-green-50 text-xs font-semibold text-green-700 sticky top-0">🟢 On Duty วันนี้</div>
                          {onDutyList.map(t => (
                            <label key={t.id} className="flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50">
                              <input type="radio" name="recall_new_tech" value={t.id}
                                className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-medium text-gray-900">{t.full_name}</span>
                              <span className="text-xs text-gray-500">({t.department})</span>
                              <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full ml-auto">🟢 On Duty</span>
                            </label>
                          ))}
                        </>
                      )}
                      {offDutyList.length > 0 && (
                        <>
                          {onDutyList.length > 0 && <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 sticky top-0">ช่างทั้งหมด</div>}
                          {offDutyList.map(t => (
                            <label key={t.id} className="flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50">
                              <input type="radio" name="recall_new_tech" value={t.id}
                                className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-medium text-gray-900">{t.full_name}</span>
                              <span className="text-xs text-gray-500">({t.department})</span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={() => { setModal(null); setSelectedTech('') }}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">
              ยกเลิก
            </button>
            <button onClick={() => {
              if (selectedTech === 'reassign_mode') {
                const sel = document.querySelector('input[name="recall_new_tech"]:checked')
                if (!sel?.value) return toast.error('กรุณาเลือกช่างคนใหม่')
                handleRecall(sel.value)
              } else {
                handleRecall(null)
              }
            }} disabled={acting}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? 'กำลังบันทึก...' : 'ยืนยันดึงงานกลับ'}
            </button>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {modal === 'reject' && (
        <Modal title="ปฏิเสธงาน" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">ระบุเหตุผลในการปฏิเสธงานนี้ หัวหน้าช่างจะรับทราบและจัดสรรงานใหม่</p>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">เหตุผล *</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={3} placeholder="เช่น ติดภารกิจอื่น, ไม่มีความเชี่ยวชาญด้านนี้..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">ยกเลิก</button>
            <button onClick={() => handleReject(rejectReason)} disabled={acting}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? 'กำลังบันทึก...' : 'ยืนยันปฏิเสธงาน'}
            </button>
          </div>
        </Modal>
      )}

      {/* Transfer Modal */}
      {modal === 'transfer' && (
        <Modal title="โอนงานให้ช่างคนอื่น" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">เลือกช่างที่จะโอนงานให้ ช่างคนนั้นจะได้รับงานนี้ทันที</p>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">ช่างที่รับงานต่อ *</label>
              {(() => {
                const filtered = technicians.filter(t => t.id !== wo?.technician?.id)
                const onDutyFiltered = filtered.filter(t => onDutyTechs.includes(t.id))
                const offDutyFiltered = filtered.filter(t => !onDutyTechs.includes(t.id))
                return (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {onDutyFiltered.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-green-50 text-xs font-semibold text-green-700 sticky top-0">🟢 On Duty วันนี้</div>
                        {onDutyFiltered.map(t => (
                          <label key={t.id} className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 ${selectedTech === String(t.id) ? 'bg-blue-50' : ''}`}>
                            <input type="checkbox" checked={selectedTech === String(t.id)}
                              onChange={() => setSelectedTech(selectedTech === String(t.id) ? '' : String(t.id))}
                              className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm font-medium text-gray-900">{t.full_name}</span>
                            <span className="text-xs text-gray-500">({t.department})</span>
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full ml-auto">🟢 On Duty</span>
                          </label>
                        ))}
                      </>
                    )}
                    {offDutyFiltered.map(t => (
                      <label key={t.id} className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 ${selectedTech === String(t.id) ? 'bg-blue-50' : ''}`}>
                        <input type="checkbox" checked={selectedTech === String(t.id)}
                          onChange={() => setSelectedTech(selectedTech === String(t.id) ? '' : String(t.id))}
                          className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm font-medium text-gray-900">{t.full_name}</span>
                        <span className="text-xs text-gray-500">({t.department})</span>
                      </label>
                    ))}
                    {filtered.length === 0 && <div className="px-3 py-4 text-center text-sm text-gray-400">กำลังโหลด...</div>}
                  </div>
                )
              })()}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">หมายเหตุ</label>
              <textarea value={transferNote} onChange={e => setTransferNote(e.target.value)}
                rows={2} placeholder="เช่น งานค้างต่อ, ยังซ่อมไม่เสร็จเพราะ..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">ยกเลิก</button>
            <button onClick={() => handleTransfer(selectedTech, transferNote)} disabled={acting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? 'กำลังโอน...' : 'ยืนยันโอนงาน'}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {modal === 'edit' && (
        <Modal title="แก้ไขรายละเอียดงาน" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">ประเภทงาน</label>
              <select value={editForm.issue_type_id} onChange={e => setEditForm(f => ({ ...f, issue_type_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- เลือกประเภทงาน --</option>
                {issueTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">ระดับความเร่งด่วน</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'normal', label: 'ปกติ' },
                  { value: 'urgent', label: 'ด่วน 🔴' },
                  { value: 'very_urgent', label: 'ด่วนมาก 🚨' },
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">รายละเอียดงานซ่อม</label>
              <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                rows={3} placeholder="รายละเอียด..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">เวลาที่ต้องการให้ซ่อม</label>
              <div className="flex gap-2">
                <input type="date" value={editForm.sched_date}
                  onChange={e => setEditForm(f => ({ ...f, sched_date: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={editForm.sched_hour}
                  onChange={e => setEditForm(f => ({ ...f, sched_hour: e.target.value }))}
                  disabled={!editForm.sched_date}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40">
                  {Array.from({length: 24}, (_, i) => String(i).padStart(2,'0')).map(h => (
                    <option key={h} value={h}>{h} น.</option>
                  ))}
                </select>
                <select value={editForm.sched_minute}
                  onChange={e => setEditForm(f => ({ ...f, sched_minute: e.target.value }))}
                  disabled={!editForm.sched_date}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40">
                  {['00','15','30','45'].map(m => (
                    <option key={m} value={m}>{m} น.</option>
                  ))}
                </select>
              </div>
              {editForm.sched_date && (
                <button type="button" onClick={() => setEditForm(f => ({ ...f, sched_date: '' }))}
                  className="mt-1 text-xs text-gray-400 hover:text-red-500">ล้างเวลา</button>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.guest_inhouse}
                onChange={e => setEditForm(f => ({ ...f, guest_inhouse: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-700">มีแขก In House</span>
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">ยกเลิก</button>
            <button onClick={handleEdit} disabled={acting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {acting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </Modal>
      )}

      {/* Location History */}
      {modal === 'history' && (
        <Modal title={`ประวัติซ่อมพื้นที่นี้ (6 เดือนย้อนหลัง)`} onClose={() => setModal(null)}>
          <p className="text-xs text-gray-500 mb-3">
            {job.main_area?.name}{job.sub_area ? ` › ${job.sub_area.name}` : ''}{job.other_location || ''}
          </p>
          {histLoading ? (
            <div className="text-center text-gray-400 py-4 text-sm">กำลังโหลด...</div>
          ) : locationHistory.length === 0 ? (
            <div className="text-center text-gray-400 py-4 text-sm">ไม่มีประวัติการซ่อม</div>
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
                    <span className="text-xs text-gray-400">ช่าง: {h.technician}</span>
                    <span className="text-xs text-gray-400">
                      {h.reported_at ? format(new Date(h.reported_at), 'd MMM yy', { locale: th }) : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setModal(null)}
            className="w-full mt-4 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">
            ปิด
          </button>
        </Modal>
      )}
    </div>
  )
}
