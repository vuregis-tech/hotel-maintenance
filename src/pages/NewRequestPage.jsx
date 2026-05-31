import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import toast from 'react-hot-toast'
import { Upload, X, AlertTriangle, Users, MapPin, Wrench, FileText } from 'lucide-react'

// ✅ ต้องนิยาม Section ข้างนอก component หลัก
// ถ้านิยามข้างใน → React จะสร้าง component ใหม่ทุก render → focus หาย
function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export default function NewRequestPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [areas, setAreas] = useState([])
  const [issueTypes, setIssueTypes] = useState([])
  const [form, setForm] = useState({
    main_area_id: '',
    sub_area_id: '',
    other_location: '',
    guest_inhouse: false,
    is_urgent: false,
    issue_type_id: '',
    other_issue: '',
    description: '',
  })
  const [images, setImages] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([api.getAreas(), api.getIssueTypes()]).then(([a, it]) => {
      setAreas(a)
      setIssueTypes(it)
    })
  }, [])

  const selectedMainArea = areas.find(a => a.id === Number(form.main_area_id))
  const subAreas = selectedMainArea?.sub_areas?.filter(s => s.is_active) || []
  const isOtherArea = form.main_area_id === 'other'

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleMainAreaChange(val) {
    setForm(f => ({ ...f, main_area_id: val, sub_area_id: '', other_location: '' }))
  }

  function handleImageAdd(e) {
    const files = Array.from(e.target.files)
    const newImages = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setImages(prev => [...prev, ...newImages])
    e.target.value = ''
  }

  function removeImage(idx) {
    setImages(prev => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.description.trim()) return toast.error('กรุณาระบุรายละเอียดงานซ่อม')
    if (!isOtherArea && !form.main_area_id) return toast.error('กรุณาเลือกพื้นที่')

    setSubmitting(true)
    try {
      const payload = {
        main_area_id: isOtherArea ? null : (form.main_area_id ? Number(form.main_area_id) : null),
        sub_area_id: form.sub_area_id ? Number(form.sub_area_id) : null,
        other_location: isOtherArea ? form.other_location : null,
        guest_inhouse: form.guest_inhouse,
        is_urgent: form.is_urgent,
        issue_type_id: form.issue_type_id && form.issue_type_id !== 'other' ? Number(form.issue_type_id) : null,
        other_issue: form.issue_type_id === 'other' ? form.other_issue : null,
        description: form.description,
      }
      const job = await api.createJob(payload)

      for (const img of images) {
        try { await api.uploadImage(job.id, img.file) } catch {}
      }

      toast.success('แจ้งซ่อมสำเร็จ')
      navigate(`/requests/${job.id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">แจ้งซ่อม</h1>
        <p className="text-sm text-gray-500 mt-0.5">กรอกข้อมูลการแจ้งซ่อมให้ครบถ้วน</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Reporter Info */}
        <Section icon={Users} title="ข้อมูลผู้แจ้ง">
          <div className="grid grid-cols-3 gap-3">
            {[['ชื่อ', user?.full_name], ['ตำแหน่ง', user?.position], ['แผนก', user?.department]].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{val}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Location */}
        <Section icon={MapPin} title="สถานที่">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">พื้นที่หลัก *</label>
              <select value={form.main_area_id} onChange={e => handleMainAreaChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- เลือกพื้นที่หลัก --</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                <option value="other">อื่นๆ (ระบุเอง)</option>
              </select>
            </div>

            {!isOtherArea && form.main_area_id && subAreas.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">พื้นที่ย่อย</label>
                <select value={form.sub_area_id} onChange={e => set('sub_area_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- เลือกพื้นที่ย่อย --</option>
                  {subAreas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {isOtherArea && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ระบุสถานที่ *</label>
                <input type="text" value={form.other_location} onChange={e => set('other_location', e.target.value)}
                  placeholder="ระบุสถานที่..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}

            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.guest_inhouse} onChange={e => set('guest_inhouse', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-sm text-gray-700">มีแขก In House</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_urgent} onChange={e => set('is_urgent', e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded" />
                <span className="text-sm text-red-600 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> งานด่วน
                </span>
              </label>
            </div>
          </div>
        </Section>

        {/* Issue */}
        <Section icon={Wrench} title="ประเภทงาน / รายละเอียด">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทงาน</label>
              <select value={form.issue_type_id} onChange={e => set('issue_type_id', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- เลือกประเภทงาน --</option>
                {issueTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                <option value="other">อื่นๆ (ระบุเอง)</option>
              </select>
            </div>

            {form.issue_type_id === 'other' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ระบุประเภทงาน</label>
                <input type="text" value={form.other_issue} onChange={e => set('other_issue', e.target.value)}
                  placeholder="ระบุประเภทงาน..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียดงานซ่อม *</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={4} placeholder="อธิบายรายละเอียดของปัญหาที่พบ..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
        </Section>

        {/* Photos */}
        <Section icon={FileText} title="รูปถ่าย">
          <div className="space-y-3">
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square">
                    <img src={img.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button type="button" onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">เพิ่มรูปถ่าย</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageAdd} />
            </label>
          </div>
        </Section>

        <div className="flex gap-3 pb-4">
          <button type="button" onClick={() => navigate(-1)}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            ยกเลิก
          </button>
          <button type="submit" disabled={submitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            {submitting ? 'กำลังบันทึก...' : 'ยืนยันการแจ้งซ่อม'}
          </button>
        </div>
      </form>
    </div>
  )
}
