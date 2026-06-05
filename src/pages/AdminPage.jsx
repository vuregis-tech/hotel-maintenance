import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, Check } from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'ผู้ดูแลระบบ' },
  { value: 'supervisor', label: 'หัวหน้าช่าง' },
  { value: 'technician', label: 'ช่าง' },
  { value: 'staff', label: 'พนักงาน' },
]

// ─── Mini reusable inline edit row ───────────────────
function EditableItem({ name, onSave, onDelete, children }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(name)

  async function save() {
    if (!val.trim()) return
    try { await onSave(val); setEditing(false) }
    catch (err) { toast.error(err.message) }
  }

  if (editing) return (
    <div className="flex items-center gap-2 py-1">
      <input value={val} onChange={e => setVal(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && save()}
        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <button onClick={save} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
      <button onClick={() => { setEditing(false); setVal(name) }} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
    </div>
  )

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <span className="flex-1 text-sm text-gray-800">{name}</span>
      {children}
      <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Departments Tab ──────────────────────────────────
function DepartmentsTab() {
  const [depts, setDepts] = useState([])
  const [newName, setNewName] = useState('')

  useEffect(() => {
    api.getDepartments().then(setDepts).catch(err => toast.error('โหลดแผนกไม่ได้: ' + err.message))
  }, [])

  async function add() {
    if (!newName.trim()) return
    try {
      const d = await api.createDepartment({ name: newName.trim() })
      setDepts(x => [...x, d])
      setNewName('')
      toast.success('เพิ่มแผนกสำเร็จ')
    } catch (err) { toast.error(err.message) }
  }

  async function del(id) {
    if (!confirm('ลบแผนกนี้?')) return
    try { await api.deleteDepartment(id); setDepts(d => d.filter(x => x.id !== id)); toast.success('ลบสำเร็จ') }
    catch (err) { toast.error(err.message) }
  }

  async function save(id, name) {
    await api.updateDepartment(id, { name })
    setDepts(d => d.map(x => x.id === id ? { ...x, name } : x))
    toast.success('แก้ไขสำเร็จ')
  }

  return (
    <div>
      <h2 className="font-semibold text-gray-900 mb-4">จัดการแผนก</h2>
      <div className="flex gap-2 mb-4">
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="ชื่อแผนกใหม่"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={add} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> เพิ่ม
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {depts.length === 0 && <p className="px-4 py-6 text-sm text-gray-400 text-center">ยังไม่มีแผนก</p>}
        {depts.map(d => (
          <div key={d.id} className="px-4">
            <EditableItem name={d.name} onSave={name => save(d.id, name)} onDelete={() => del(d.id)} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([])
  const [depts, setDepts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', full_name: '', department: '', position: '', role: 'staff' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getUsers().then(setUsers)
    api.getDepartments().then(setDepts).catch(() => {})
  }, [])

  function openNew() { setForm({ username: '', password: '', full_name: '', department: '', position: '', role: 'staff' }); setEditUser(null); setShowForm(true) }
  function openEdit(u) { setForm({ username: u.username, password: '', full_name: u.full_name, department: u.department, position: u.position, role: u.role }); setEditUser(u); setShowForm(true) }

  async function handleSave() {
    if (!form.full_name || !form.username || (!editUser && !form.password)) return toast.error('กรุณากรอกข้อมูลให้ครบ')
    setSaving(true)
    try {
      if (editUser) {
        const updated = await api.updateUser(editUser.id, { full_name: form.full_name, department: form.department, position: form.position, role: form.role, ...(form.password ? { password: form.password } : {}) })
        setUsers(u => u.map(x => x.id === editUser.id ? updated : x))
      } else {
        const created = await api.createUser(form)
        setUsers(u => [...u, created])
      }
      setShowForm(false)
      toast.success(editUser ? 'แก้ไขสำเร็จ' : 'เพิ่มผู้ใช้สำเร็จ')
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(u) {
    if (!confirm(`ลบผู้ใช้ ${u.full_name}?`)) return
    try { await api.deleteUser(u.id); setUsers(us => us.filter(x => x.id !== u.id)); toast.success('ลบสำเร็จ') }
    catch (err) { toast.error(err.message) }
  }

  const ROLE_LABELS = { admin: 'ผู้ดูแลระบบ', supervisor: 'หัวหน้าช่าง', technician: 'ช่าง', staff: 'พนักงาน' }
  const ROLE_COLORS = { admin: 'bg-purple-100 text-purple-700', supervisor: 'bg-orange-100 text-orange-700', technician: 'bg-green-100 text-green-700', staff: 'bg-blue-100 text-blue-700' }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">ผู้ใช้งานระบบ ({users.length})</h2>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> เพิ่มผู้ใช้
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['ชื่อ', 'ชื่อผู้ใช้', 'ตำแหน่ง', 'แผนก', 'บทบาท', 'สถานะ', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3 text-gray-600">{u.position}</td>
                <td className="px-4 py-3 text-gray-600">{u.department}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{u.is_active ? 'ใช้งาน' : 'ระงับ'}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-4">{editUser ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</h3>
            <div className="space-y-3">
              {[['full_name', 'ชื่อ-นามสกุล', 'text'], ['username', 'ชื่อผู้ใช้', 'text'], ['password', editUser ? 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่าน', 'password'], ['position', 'ตำแหน่ง', 'text']].map(([f, label, type]) => (
                <div key={f}>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>
                  <input type={type} value={form[f]} onChange={e => setForm(x => ({ ...x, [f]: e.target.value }))}
                    disabled={editUser && f === 'username'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">แผนก</label>
                <select value={form.department} onChange={e => setForm(x => ({ ...x, department: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- เลือกแผนก --</option>
                  {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  {form.department && !depts.find(d => d.name === form.department) && (
                    <option value={form.department}>{form.department} (เดิม)</option>
                  )}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">บทบาท</label>
                <select value={form.role} onChange={e => setForm(x => ({ ...x, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {editUser && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.is_active ?? true}
                    onChange={e => setForm(x => ({ ...x, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-gray-700">บัญชีใช้งานได้</span>
                </label>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Areas Tab ────────────────────────────────────────
function AreasTab() {
  const [areas, setAreas] = useState([])
  const [expanded, setExpanded] = useState({})
  const [newAreaName, setNewAreaName] = useState('')
  const [newSubName, setNewSubName] = useState({})

  useEffect(() => { api.getAreas().then(setAreas) }, [])

  async function addArea() {
    if (!newAreaName.trim()) return
    try {
      const a = await api.createArea({ name: newAreaName })
      setAreas(x => [...x, a])
      setNewAreaName('')
      toast.success('เพิ่มพื้นที่สำเร็จ')
    } catch (err) { toast.error(err.message) }
  }

  async function addSub(areaId) {
    const name = newSubName[areaId]
    if (!name?.trim()) return
    try {
      const sub = await api.createSubArea({ name, main_area_id: areaId })
      setAreas(areas => areas.map(a => a.id === areaId ? { ...a, sub_areas: [...(a.sub_areas || []), sub] } : a))
      setNewSubName(x => ({ ...x, [areaId]: '' }))
      toast.success('เพิ่มพื้นที่ย่อยสำเร็จ')
    } catch (err) { toast.error(err.message) }
  }

  async function deleteArea(id) {
    if (!confirm('ลบพื้นที่หลักนี้?')) return
    try { await api.deleteArea(id); setAreas(a => a.filter(x => x.id !== id)); toast.success('ลบสำเร็จ') }
    catch (err) { toast.error(err.message) }
  }

  async function deleteSub(areaId, subId) {
    if (!confirm('ลบพื้นที่ย่อยนี้?')) return
    try {
      await api.deleteSubArea(subId)
      setAreas(areas => areas.map(a => a.id === areaId ? { ...a, sub_areas: a.sub_areas.filter(s => s.id !== subId) } : a))
      toast.success('ลบสำเร็จ')
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div>
      <h2 className="font-semibold text-gray-900 mb-4">จัดการพื้นที่</h2>
      <div className="flex gap-2 mb-4">
        <input value={newAreaName} onChange={e => setNewAreaName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addArea()}
          placeholder="ชื่อพื้นที่หลักใหม่"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={addArea} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> เพิ่ม
        </button>
      </div>

      <div className="space-y-2">
        {areas.map(area => (
          <div key={area.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 cursor-pointer"
              onClick={() => setExpanded(e => ({ ...e, [area.id]: !e[area.id] }))}>
              {expanded[area.id] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              <span className="flex-1 font-medium text-gray-900 text-sm">{area.name}</span>
              <span className="text-xs text-gray-400">{area.sub_areas?.length || 0} พื้นที่ย่อย</span>
              <button onClick={e => { e.stopPropagation(); deleteArea(area.id) }}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded ml-2">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {expanded[area.id] && (
              <div className="px-6 py-3 space-y-1">
                {area.sub_areas?.filter(s => s.is_active).map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 py-1 group">
                    <span className="flex-1 text-sm text-gray-700">{sub.name}</span>
                    <button onClick={() => deleteSub(area.id, sub.id)}
                      className="p-1 text-gray-300 hover:text-red-500 rounded opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                  <input value={newSubName[area.id] || ''} onChange={e => setNewSubName(x => ({ ...x, [area.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addSub(area.id)}
                    placeholder="เพิ่มพื้นที่ย่อย"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={() => addSub(area.id)}
                    className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Issue Types Tab ──────────────────────────────────
function IssueTypesTab() {
  const [types, setTypes] = useState([])
  const [newName, setNewName] = useState('')

  useEffect(() => { api.getIssueTypes().then(setTypes) }, [])

  async function add() {
    if (!newName.trim()) return
    try {
      const t = await api.createIssueType({ name: newName })
      setTypes(x => [...x, t])
      setNewName('')
      toast.success('เพิ่มสำเร็จ')
    } catch (err) { toast.error(err.message) }
  }

  async function del(id) {
    if (!confirm('ลบประเภทงานนี้?')) return
    try { await api.deleteIssueType(id); setTypes(t => t.filter(x => x.id !== id)); toast.success('ลบสำเร็จ') }
    catch (err) { toast.error(err.message) }
  }

  async function save(id, name) {
    await api.updateIssueType(id, { name })
    setTypes(t => t.map(x => x.id === id ? { ...x, name } : x))
    toast.success('แก้ไขสำเร็จ')
  }

  return (
    <div>
      <h2 className="font-semibold text-gray-900 mb-4">ประเภทงานซ่อม</h2>
      <div className="flex gap-2 mb-4">
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="ชื่อประเภทงานใหม่"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={add} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> เพิ่ม
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {types.map(t => (
          <div key={t.id} className="px-4">
            <EditableItem name={t.name} onSave={name => save(t.id, name)} onDelete={() => del(t.id)} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main AdminPage ───────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState('users')
  const tabs = [
    { key: 'users', label: 'ผู้ใช้งาน' },
    { key: 'departments', label: 'แผนก' },
    { key: 'areas', label: 'พื้นที่' },
    { key: 'issue_types', label: 'ประเภทงาน' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">จัดการระบบ</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {tab === 'users' && <UsersTab />}
        {tab === 'departments' && <DepartmentsTab />}
        {tab === 'areas' && <AreasTab />}
        {tab === 'issue_types' && <IssueTypesTab />}
      </div>
    </div>
  )
}
