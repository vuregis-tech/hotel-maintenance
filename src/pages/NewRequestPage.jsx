import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { api, schedToISO, isVideoUrl } from '../lib/api'
import toast from 'react-hot-toast'
import { X, Users, MapPin, Wrench, FileText, Camera, Image as ImageIcon, Video } from 'lucide-react'

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

function CameraRecorder({ onSave, onClose }) {
  const [phase, setPhase] = useState('init') // init | live | recording | preview | error
  const [errorMsg, setErrorMsg] = useState('')
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const mimeTypeRef = useRef('video/webm')
  const chunksRef = useRef([])
  const previewUrlRef = useRef(null)
  const liveRef = useRef(null)
  const previewRef = useRef(null)

  useEffect(() => {
    let alive = true
    async function init() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (alive) { setErrorMsg('เบราว์เซอร์ไม่รองรับการบันทึกจากกล้อง'); setPhase('error') }
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true })
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        setPhase('live')
      } catch (e) {
        if (!alive) return
        const msg = e.name === 'NotAllowedError' ? 'ไม่ได้รับอนุญาตให้เข้าถึงกล้อง' : 'ไม่สามารถเข้าถึงกล้องได้'
        setErrorMsg(msg); setPhase('error')
      }
    }
    init()
    return () => {
      alive = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null }
    }
  }, [])

  useEffect(() => {
    if (phase === 'live' && liveRef.current && streamRef.current) {
      liveRef.current.srcObject = streamRef.current
    }
  }, [phase])

  function startRecord() {
    const stream = streamRef.current
    if (!stream) return
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      .find(t => { try { return MediaRecorder.isTypeSupported(t) } catch { return false } }) || ''
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
    mimeTypeRef.current = recorder.mimeType || mimeType || 'video/webm'
    chunksRef.current = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
      previewUrlRef.current = URL.createObjectURL(blob)
      if (previewRef.current) previewRef.current.src = previewUrlRef.current
      setPhase('preview')
    }
    recorder.start(100)
    recorderRef.current = recorder
    setPhase('recording')
  }

  function stopRecord() {
    recorderRef.current?.stop()
    recorderRef.current = null
  }

  function retry() {
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null }
    chunksRef.current = []
    setPhase('live')
  }

  function save() {
    if (!previewUrlRef.current || chunksRef.current.length === 0) return
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
    const ext = mimeTypeRef.current.includes('mp4') ? '.mp4' : '.webm'
    const file = new File([blob], `video-${Date.now()}${ext}`, { type: blob.type })
    const url = previewUrlRef.current
    previewUrlRef.current = null // ownership transferred to parent
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    onSave(file, url)
  }

  function close() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white font-medium text-sm">บันทึกวีดิโอ</span>
        <button onClick={close} className="text-white/60 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative bg-black overflow-hidden">
        {(phase === 'init' || phase === 'error') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {phase === 'init' && <p className="text-white/50 text-sm">กำลังเปิดกล้อง...</p>}
            {phase === 'error' && <p className="text-red-400 text-sm">{errorMsg}</p>}
          </div>
        )}
        <video ref={liveRef} autoPlay playsInline muted
          className={`absolute inset-0 w-full h-full object-cover ${phase === 'preview' || phase === 'init' || phase === 'error' ? 'invisible' : ''}`} />
        <video ref={previewRef} controls playsInline
          className={`absolute inset-0 w-full h-full object-contain bg-black ${phase !== 'preview' ? 'hidden' : ''}`} />
        {phase === 'recording' && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-medium">กำลังบันทึก...</span>
          </div>
        )}
      </div>

      <div className="p-6 shrink-0">
        {phase === 'live' && (
          <div className="flex justify-center">
            <button onClick={startRecord}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-colors">
              <div className="w-5 h-5 rounded-full bg-white" />
            </button>
          </div>
        )}
        {phase === 'recording' && (
          <div className="flex justify-center">
            <button onClick={stopRecord}
              className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 border-2 border-white flex items-center justify-center shadow-lg transition-colors">
              <div className="w-6 h-6 rounded-sm bg-red-500" />
            </button>
          </div>
        )}
        {phase === 'preview' && (
          <div className="flex gap-3">
            <button onClick={retry}
              className="flex-1 border border-white/30 text-white py-3 rounded-xl text-sm hover:bg-white/10 transition-colors">
              ลองใหม่
            </button>
            <button onClick={save}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl text-sm font-medium transition-colors">
              ใช้วีดิโอนี้
            </button>
          </div>
        )}
        {phase === 'error' && (
          <button onClick={close}
            className="w-full border border-white/30 text-white py-3 rounded-xl text-sm hover:bg-white/10">
            ปิด
          </button>
        )}
      </div>
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
  const [media, setMedia] = useState([]) // [{file, preview, isVideo}]
  const [showRecorder, setShowRecorder] = useState(false)
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

  function handleMediaAdd(e) {
    const files = Array.from(e.target.files)
    e.target.value = ''
    const toAdd = []
    for (const f of files) {
      const isVideo = f.type.startsWith('video/') || isVideoUrl(f.name)
      if (isVideo && f.size > 100 * 1024 * 1024) {
        toast.error(`วีดิโอ "${f.name}" ใหญ่เกินไป (สูงสุด 100MB)`)
        continue
      }
      toAdd.push({ file: f, preview: URL.createObjectURL(f), isVideo })
    }
    setMedia(prev => [...prev, ...toAdd])
  }

  function handleRecordedVideo(file, url) {
    setShowRecorder(false)
    setMedia(prev => [...prev, { file, preview: url, isVideo: true }])
  }

  function removeMedia(idx) {
    setMedia(prev => {
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
      const uploadResults = await Promise.allSettled(
        media.map(item => item.isVideo ? api.uploadVideo(job.id, item.file) : api.uploadImage(job.id, item.file))
      )
      const failed = uploadResults.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        const reason = failed[0].reason?.message || 'ไม่ทราบสาเหตุ'
        toast.error(`อัปโหลดไฟล์ล้มเหลว: ${reason}`, { duration: 6000 })
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

        {/* Photos & Videos */}
        <Section icon={FileText} title={lang === 'th' ? 'รูปภาพ / วีดิโอ' : 'Photos & Videos'}>
          <div className="space-y-3">
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((item, idx) => (
                  <div key={idx} className="relative aspect-square">
                    {item.isVideo ? (
                      <video src={item.preview} className="w-full h-full object-cover rounded-lg" muted playsInline />
                    ) : (
                      <img src={item.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                    )}
                    {item.isVideo && (
                      <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-white text-[10px] font-medium flex items-center gap-0.5">
                        <Video className="w-2.5 h-2.5" /> VDO
                      </div>
                    )}
                    <button type="button" onClick={() => removeMedia(idx)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-blue-300 rounded-xl py-3 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <Camera className="w-5 h-5 text-blue-500" />
                <span className="text-xs font-medium text-blue-600 text-center">{t('request.takePhoto')}</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleMediaAdd} />
              </label>

              <button type="button" onClick={() => setShowRecorder(true)}
                className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-red-300 rounded-xl py-3 cursor-pointer hover:border-red-500 hover:bg-red-50 transition-colors">
                <Video className="w-5 h-5 text-red-500" />
                <span className="text-xs font-medium text-red-600 text-center">{lang === 'th' ? 'บันทึกวีดิโอ' : 'Record Video'}</span>
              </button>

              <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-300 rounded-xl py-3 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
                <ImageIcon className="w-5 h-5 text-gray-400" />
                <span className="text-xs font-medium text-gray-600 text-center">{lang === 'th' ? 'เลือกรูป/วีดิโอ' : 'Select Files'}</span>
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaAdd} />
              </label>
            </div>

            {media.length > 0 && (
              <p className="text-xs text-gray-400 text-center">
                {media.length} {lang === 'th' ? 'ไฟล์ · กด ✕ เพื่อลบ' : 'file(s) · tap ✕ to remove'}
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

      {showRecorder && (
        <CameraRecorder
          onSave={handleRecordedVideo}
          onClose={() => setShowRecorder(false)}
        />
      )}
    </div>
  )
}
