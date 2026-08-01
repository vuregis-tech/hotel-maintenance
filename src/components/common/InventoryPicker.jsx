import { useEffect, useState, useCallback } from 'react'
import { X, Search, QrCode, Package, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { inventory } from '../../lib/inventory'
import { useLang } from '../../context/LangContext'
import InventoryQRScanner from './InventoryQRScanner'

// Modal เลือก item จากคลัง (แผนกช่าง) → คืน object item ให้ MaterialsTable
export default function InventoryPicker({ onSelect, onClose }) {
  const { t, lang } = useLang()
  const [query, setQuery] = useState('')
  const [deptAll, setDeptAll] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async (q) => {
    setLoading(true); setErr('')
    try {
      const data = await inventory.searchItems(q, deptAll ? 'ALL' : 'ENG', 60)
      setItems(data)
    } catch (e) {
      setErr(t('workOrder.inv.connectError'))
    } finally {
      setLoading(false)
    }
  }, [deptAll, t])

  useEffect(() => {
    const id = setTimeout(() => load(query), 250)
    return () => clearTimeout(id)
  }, [query, load])

  async function handleScan(data) {
    setScanning(false)
    try {
      const item = data.id ? await inventory.byId(data.id) : await inventory.byCode(data.code)
      pick(item)
    } catch {
      toast.error(t('workOrder.inv.notFound'))
    }
  }

  function pick(item) {
    onSelect({
      name: lang === 'th' ? item.name_th : item.name,
      qty: 1,
      unit: item.unit || 'ชิ้น',
      unit_cost: item.unit_cost || 0,
      inventory_item_id: item.id,
      code: item.code,
      _stock: item.current_stock,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        {/* header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">{t('workOrder.inv.pickTitle')}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* search bar */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('workOrder.inv.searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-orange-300 text-orange-700 rounded-xl text-sm font-medium hover:bg-orange-50"
            >
              <QrCode className="w-4 h-4" />
              QR
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={deptAll} onChange={e => setDeptAll(e.target.checked)}
              className="rounded border-gray-300 text-orange-500 focus:ring-orange-400" />
            {t('workOrder.inv.showAllDepts')}
          </label>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">{t('workOrder.inv.loading')}</div>
          ) : err ? (
            <div className="text-center py-10 text-red-500 text-sm px-6">{err}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">{t('workOrder.inv.noItems')}</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.map(item => {
                const out = item.current_stock <= 0
                const low = !out && item.current_stock <= 5
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pick(item)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-orange-50 transition-colors"
                  >
                    {item.image_url ? (
                      <img src={inventory.imgUrl(item.image_url)} alt={item.code}
                        className="w-9 h-9 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-900 truncate">
                        {lang === 'th' ? item.name_th : item.name}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">{item.code}</div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                      out ? 'bg-red-100 text-red-700' :
                      low ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {out && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                      {item.current_stock} {item.unit}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {scanning && <InventoryQRScanner onResult={handleScan} onClose={() => setScanning(false)} />}
    </div>
  )
}
