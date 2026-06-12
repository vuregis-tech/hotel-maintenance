import { useLang } from '../../context/LangContext'

const STATUS_STYLE = {
  pending:            { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  assigned:           { bg: 'bg-blue-100',   text: 'text-blue-800' },
  in_progress:        { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  external_tech:      { bg: 'bg-purple-100', text: 'text-purple-800' },
  pending_inspection: { bg: 'bg-orange-100', text: 'text-orange-800' },
  completed:          { bg: 'bg-green-100',  text: 'text-green-800' },
  reopened:           { bg: 'bg-red-100',    text: 'text-red-800' },
  cancelled:          { bg: 'bg-gray-100',   text: 'text-gray-600' },
}

export default function StatusBadge({ status }) {
  const { t } = useLang()
  const style = STATUS_STYLE[status] || { bg: 'bg-gray-100', text: 'text-gray-600' }
  const label = t(`status.${status}`) || status
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {label}
    </span>
  )
}

export { STATUS_STYLE }
