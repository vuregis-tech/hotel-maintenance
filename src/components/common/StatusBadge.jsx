const STATUS_CONFIG = {
  pending:            { label: 'รอรับงาน',        bg: 'bg-yellow-100', text: 'text-yellow-800' },
  assigned:           { label: 'จ่ายงานแล้ว',      bg: 'bg-blue-100',   text: 'text-blue-800' },
  in_progress:        { label: 'กำลังดำเนินการ',   bg: 'bg-indigo-100', text: 'text-indigo-800' },
  external_tech:      { label: 'งานช่างนอก',       bg: 'bg-purple-100', text: 'text-purple-800' },
  pending_inspection: { label: 'รอตรวจ',           bg: 'bg-orange-100', text: 'text-orange-800' },
  completed:          { label: 'เสร็จสิ้น',        bg: 'bg-green-100',  text: 'text-green-800' },
  reopened:           { label: 'ส่งซ่อมใหม่',      bg: 'bg-red-100',    text: 'text-red-800' },
  cancelled:          { label: 'ยกเลิก',           bg: 'bg-gray-100',   text: 'text-gray-600' },
}

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

export { STATUS_CONFIG }
