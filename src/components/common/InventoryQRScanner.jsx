import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

// สแกน QR ของ item ในคลัง — QR format: {"type":"inventory_item","id","code","name"}
export default function InventoryQRScanner({ onResult, onClose }) {
  const instanceRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let scanner
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      scanner = new Html5QrcodeScanner(
        'wo-qr-reader',
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        false
      )
      instanceRef.current = scanner
      scanner.render(
        (decodedText) => {
          try {
            const data = JSON.parse(decodedText)
            if (data.type === 'inventory_item' && (data.id || data.code)) {
              onResult(data)
            } else {
              setError('QR นี้ไม่ใช่รายการในคลัง')
            }
          } catch {
            onResult({ code: decodedText })  // เผื่อ QR เป็น code เปล่า ๆ
          }
        },
        () => {}
      )
    }).catch(() => setError('ไม่สามารถโหลดตัวสแกน QR'))

    return () => { instanceRef.current?.clear().catch(() => {}) }
  }, [])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">สแกน QR รายการคลัง</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div id="wo-qr-reader" className="w-full rounded-xl overflow-hidden" />
        {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}
        <p className="mt-3 text-xs text-gray-400 text-center">หันกล้องไปที่ QR บนอุปกรณ์</p>
      </div>
    </div>
  )
}
