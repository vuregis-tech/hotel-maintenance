import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { api, schedToISO } from '../lib/api'
import toast from 'react-hot-toast'
import { X, Users, MapPin, Wrench, FileText, Camera, Image as ImageIcon } from 'lucide-react'

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
  const { lang, t } = useLang()
  const navigate = useNavigate()

  const [areas, setAreas] = useState([])
  const [issueTypes, setIssueTypes] = useState([])
  const [form, setForm] = useState({
    main_area_id: '',
    sub_area_id: '',
    other_location: '',
    guest_inhouse: false,
    priority: 'normal',
    issue_type_id: '',
    other_issue: '',
    description: '',
    sched_date: '',
    sched_hour: '08',
    sched_minute: '00',
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

  function handleSchedDateChange(dateVal) {
    const now = new Date()
    const isToday = dateVal === localDateStr(now)
    const { hour, minute } = isToday
      ? snapToFuture(now, form.sched_hour, form.sched_minute)
      : { hour: form.sched_hour, minute: form.sched_minute }
    setForm(f => ({ ...f, sched_date: dateVal, sched_hour: hour, sched_minute: minute }))
  }

  function handleSchedHourChange(hourVal) {
    const now = new Date()
    const isToday = form.sched_date === localDateStr(now)
    const { hour, minute } = isToday
      ? snapToFuture(now, hourVal, form.sched_minute)
      : { hour: hourVal, minute: form.sched_minute }
    setForm(f => ({ ...f, sched_hour: hour, sched_minute: minute }))
  }

  function handleMainAreaChange(val) {
    setForm(f => ({ ...f, main_area_id: val, sub_area_id: '', other_location: '' }))
  }

  function handleImageAdd(e) {
    const files = Array.from(e.target.files)
    e.target.value = ''
    const newImages = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setImages(prev => [...prev, ...newImages])
  }

  function removeImage(idx) {
    setImages(prev => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.description.trim()) return toast.error(t('request.validationDesc'))
    if (!isOtherArea && !form.main_area_id) return toast.error(t('request.validationArea'))

    setSubmitting(true)
    try {
      const payload = {
        main_area_id: isOtherArea ? null : (form.main_area_id ? Number(form.main_area_id) : null),
        sub_area_id: form.sub_area_id ? Number(form.sub_area_id) : null,
        other_location: isOtherArea ? form.other_location : null,
        guest_inhouse: form.guest_inhouse,
        is_urgent: form.priority !== 'normal',
        priority: form.priority,
        scheduled_at: schedToISO(form.sched_date, form.sched_hour, form.sched_minute),
        issue_type_id: form.issue_type_id && form.issue_type_id !== 'other' ? Number(form.issue_type_id) : null,
        other_issue: form.issue_type_id === 'other' ? form.other_issue : null,
        description: form.description,
      }
      const job = await api.createJob(payload)
      const uploadResults = await Promise.allSettled(images.map(img => api.uploadImage(job.id, img.file)))
      const failed = uploadResults.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        const reason = failed[0].reason?.message || 'ไม่ทราบสาเหตุ'
        toast.error(`อัปโหลดรูปล้มเหลว: ${reason}`, { duration: 6000 })
      }
      toast.success(t('request.submitSuccess'))
      navigate(`/requests/${job.id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const priorityOptions = [
    { value: 'normal', label: t('priority.normal'), color: 'border-gray-300 text-gray-700', active: 'border-blue-500 bg-blue-50 text-blue-700' },
    { value: 'urgent', label: `${t('priority.urgent')} 🔴`, color: 'border-orange-300 text-orange-600', active: 'border-orange-500 bg-orange-50 text-orange-700' },
    { value: 'very_urgent', label: `${t('priority.very_urgent')} 🚨`, color: 'border-red-300 text-red-600', active: 'border-red-600 bg-red-50 text-red-700' },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{t('request.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('request.pageSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Reporter Info */}
        <Section icon={Users} title={t('request.reporterSection')}>
          <div className="grid grid-cols-3 gap-3">
            {[
              [t('request.nameLabel'), user?.full_name],
              [t('request.positionLabel'), user?.position],
              [t('request.departmentLabel'), user?.department],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{val}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Location */}
        <Section icon={MapPin} title={t('request.locationSection')}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('request.mainArea')} *</label>
              <select value={form.main_area_id} onChange={e => handleMainAreaChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{t('request.mainAreaPlaceholder')}</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                <option value="other">{t('request.otherAreaOption')}</option>
              </select>
            </div>

            {!isOtherArea && form.main_area_id && subAreas.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('request.subAreaLabel')}</label>
                <select value={form.sub_area_id} onChange={e => set('sub_area_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{t('request.subAreaPlaceholder')}</option>
                  {subAreas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {isOtherArea && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('request.specifyLocation')} *</label>
                <input type="text" value={form.other_location} onChange={e => set('other_location', e.target.value)}
                  placeholder={t('request.specifyLocationPlaceholder')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}

            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.guest_inhouse} onChange={e => set('guest_inhouse', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-sm text-gray-700">{t('request.guestInhouse')}</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('request.priorityLevel')}</label>
              <div className="grid grid-cols-3 gap-2">
                {priorityOptions.map(opt => (
                  <label key={opt.value} className={`flex items-center justify-center gap-1.5 border-2 rounded-lg px-3 py-2 cursor-pointer text-sm font-medium transition-colors ${form.priority === opt.value ? opt.active : opt.color}`}>
                    <input type="radio" name="priority" value={opt.value} checked={form.priority === opt.value} onChange={() => set('priority', opt.value)} className="hidden" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Issue */}
        <Section icon={Wrench} title={t('request.issueSection')}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('request.issueTypeLabel')}</label>
              <select value={form.issue_type_id} onChange={e => set('issue_type_id', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{t('request.issueTypePlaceholder')}</option>
                {issueTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                <option value="other">{t('request.otherAreaOption')}</option>
              </select>
            </div>

            {form.issue_type_id === 'other' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('request.specifyIssue')}</label>
                <input type="text" value={form.other_issue} onChange={e => set('other_issue', e.target.value)}
                  placeholder={t('request.specifyIssuePlaceholder')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('request.descriptionLabel')} *</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={4} placeholder={t('request.descriptionPlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('request.scheduleLabel')}</label>
              <div className="flex gap-2">
                <input type="date" value={form.sched_date} min={localDateStr(new Date())}
                  onChange={e => handleSchedDateChange(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={form.sched_hour} onChange={e => handleSchedHourChange(e.target.value)}
                  disabled={!form.sched_date}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40">
                  {SCHED_HOURS.map(h => <option key={h} value={h}>{h}{t('request.timeUnit')}</option>)}
                </select>
                <select value={form.sched_minute} onChange={e => set('sched_minute', e.target.value)}
                  disabled={!form.sched_date}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40">
                  {SCHED_MINUTES.map(m => <option key={m} value={m}>{m}{t('request.timeUnit')}</option>)}
                </select>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('request.scheduleHint')}</p>
            </div>
          </div>
        </Section>

        {/* Photos */}
        <Section icon={FileText} title={t('request.photoSection')}>
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

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-blue-300 rounded-xl py-4 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <Camera className="w-6 h-6 text-blue-500" />
                <span className="text-sm font-medium text-blue-600">{t('request.takePhoto')}</span>
                <span className="text-xs text-gray-400">{t('request.openCamera')}</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageAdd} />
              </label>

              <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-300 rounded-xl py-4 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
                <ImageIcon className="w-6 h-6 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">{t('request.selectPhotoLabel')}</span>
                <span className="text-xs text-gray-400">{t('request.fromGallery')}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageAdd} />
              </label>
            </div>

            {images.length > 0 && (
              <p className="text-xs text-gray-400 text-center">
                {images.length} {lang === 'th' ? 'รูป · กดรูปเพื่อลบ' : 'photo(s) · tap to remove'}
              </p>
            )}
          </div>
        </Section>

        <div className="flex gap-3 pb-4">
          <button type="button" onClick={() => navigate(-1)}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={submitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            {submitting ? t('common.saving') : t('request.confirmSubmit')}
          </button>
        </div>
      </form>
    </div>
  )
}
