import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export default function CameraRecorder({ onSave, onClose, zIndex = 'z-50' }) {
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
    previewUrlRef.current = null
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
    <div className={`fixed inset-0 bg-black ${zIndex} flex flex-col`}>
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
