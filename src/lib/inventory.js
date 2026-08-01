// Client สำหรับเรียก Inventory Stock app (read-only endpoints)
// ตัด/คืน stock จริงทำที่ backend ฝั่ง Work Order (server-to-server) — ที่นี่แค่ค้นหา/lookup

const INVENTORY_URL =
  (import.meta.env.VITE_INVENTORY_URL || 'http://localhost:8001').replace(/\/$/, '')

async function invGet(path) {
  const res = await fetch(`${INVENTORY_URL}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Inventory HTTP ${res.status}`)
  }
  return res.json()
}

export const inventory = {
  url: INVENTORY_URL,

  // ค้นหา item สำหรับ picker (default = แผนกช่าง ENG, ใช้ 'ALL' เพื่อดูทุกแผนก)
  searchItems: (q = '', deptCode = 'ENG', limit = 50) =>
    invGet(`/api/integration/items?dept_code=${encodeURIComponent(deptCode)}&q=${encodeURIComponent(q)}&limit=${limit}`),

  // lookup จาก QR scan (code)
  byCode: (code) =>
    invGet(`/api/integration/item/by-code/${encodeURIComponent(code)}`),

  byId: (id) =>
    invGet(`/api/integration/item/${id}`),

  // แปลง path รูปให้เป็น absolute URL ของ Inventory app
  imgUrl: (path) =>
    !path ? '' : (path.startsWith('http') ? path : `${INVENTORY_URL}${path}`),
}
