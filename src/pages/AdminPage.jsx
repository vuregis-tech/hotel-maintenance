import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useLang } from '../context/LangContext'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, Check, ArrowUp, ArrowDown, Cloud, CloudOff, HardDrive } from 'lucide-react'

// ─── Mini reusable inline edit row ───────────────────
function EditableItem({ name, onSave, onDelete, onMoveUp, onMoveDown, children }) {
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
    <div className="flex items-center gap-1 py-1.5 group">
      {(onMoveUp || onMoveDown) && (
        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onMoveUp} disabled={!onMoveUp} className="p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-20 disabled:cursor-default"><ArrowUp className="w-3 h-3" /></button>
          <button onClick={onMoveDown} disabled={!onMoveDown} className="p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-20 disabled:cursor-default"><ArrowDown className="w-3 h-3" /></button>
        </div>
      )}
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
  const { t } = useLang()
  const [depts, setDepts] = useState([])
  const [newName, setNewName] = useState('')

  useEffect(() => {
    api.getDepartments().then(setDepts).catch(err => toast.error(err.message))
  }, [])

  async function add() {
    if (!newName.trim()) return
    try {
      const d = await api.createDepartment({ name: newName.trim() })
      setDepts(x => [...x, d])
      setNewName('')
      toast.success(t('admin.department.addSuccess'))
    } catch (err) { toast.error(err.message) }
  }

  async function del(id) {
    if (!confirm(t('admin.department.confirmDelete'))) return
    try { await api.deleteDepartment(id); setDepts(d => d.filter(x => x.id !== id)); toast.success(t('admin.department.deleteSuccess')) }
    catch (err) { toast.error(err.message) }
  }

  async function save(id, name) {
    await api.updateDepartment(id, { name })
    setDepts(d => d.map(x => x.id === id ? { ...x, name } : x))
    toast.success(t('admin.department.editSuccess'))
  }

  async function toggleOOO(id, checked) {
    try {
      await api.updateDepartment(id, { show_in_ooo: checked })
      setDepts(d => d.map(x => x.id === id ? { ...x, show_in_ooo: checked } : x))
      toast.success(checked ? t('admin.department.showInOOO') : t('admin.department.editSuccess'))
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div>
      <h2 className="font-semibold text-gray-900 mb-4">{t('admin.department.title')}</h2>
      <div className="flex gap-2 mb-4">
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={t('admin.department.namePlaceholder')}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={add} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> {t('common.add')}
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {depts.length === 0 && <p className="px-4 py-6 text-sm text-gray-400 text-center">{t('admin.department.noData')}</p>}
        {depts.map(d => (
          <div key={d.id} className="px-4">
            <EditableItem name={d.name} onSave={name => save(d.id, name)} onDelete={() => del(d.id)}>
              <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 text-xs text-gray-500">
                <input type="checkbox" checked={!!d.show_in_ooo}
                  onChange={e => toggleOOO(d.id, e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 rounded" />
                {t('admin.department.showInOOO')}
              </label>
            </EditableItem>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────
function UsersTab() {
  const { t } = useLang()
  const [users, setUsers] = useState([])
  const [depts, setDepts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', full_name: '', department: '', position: '', role: 'staff' })
  const [saving, setSaving] = useState(false)

  const ROLE_OPTIONS = [
    { value: 'admin', label: t('admin.user.roles.admin') },
    { value: 'supervisor', label: t('admin.user.roles.supervisor') },
    { value: 'technician', label: t('admin.user.roles.technician') },
    { value: 'staff', label: t('admin.user.roles.staff') },
  ]

  const ROLE_LABELS = {
    admin: t('admin.user.roles.admin'),
    supervisor: t('admin.user.roles.supervisor'),
    technician: t('admin.user.roles.technician'),
    staff: t('admin.user.roles.staff'),
  }

  const ROLE_COLORS = { admin: 'bg-purple-100 text-purple-700', supervisor: 'bg-orange-100 text-orange-700', technician: 'bg-green-100 text-green-700', staff: 'bg-blue-100 text-blue-700' }

  useEffect(() => {
    api.getUsers().then(setUsers)
    api.getDepartments().then(setDepts).catch(() => {})
  }, [])

  function openNew() { setForm({ username: '', password: '', full_name: '', department: '', position: '', role: 'staff' }); setEditUser(null); setShowForm(true) }
  function openEdit(u) { setForm({ username: u.username, password: '', full_name: u.full_name, department: u.department, position: u.position, role: u.role, is_active: u.is_active }); setEditUser(u); setShowForm(true) }

  async function handleSave() {
    if (!form.full_name || !form.username || (!editUser && !form.password)) return toast.error(t('common.required'))
    setSaving(true)
    try {
      if (editUser) {
        const updated = await api.updateUser(editUser.id, { full_name: form.full_name, department: form.department, position: form.position, role: form.role, is_active: form.is_active, ...(form.password ? { password: form.password } : {}) })
        setUsers(u => u.map(x => x.id === editUser.id ? updated : x))
      } else {
        const created = await api.createUser(form)
        setUsers(u => [...u, created])
      }
      setShowForm(false)
      toast.success(editUser ? t('admin.department.editSuccess') : t('admin.user.addUser') + ' ' + t('common.success'))
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(u) {
    if (!confirm(`${t('admin.user.confirmDelete')}${u.full_name}?`)) return
    try { await api.deleteUser(u.id); setUsers(us => us.filter(x => x.id !== u.id)); toast.success(t('admin.department.deleteSuccess')) }
    catch (err) { toast.error(err.message) }
  }

  const formFields = [
    ['full_name', t('admin.user.fullName'), 'text'],
    ['username', t('admin.user.username'), 'text'],
    ['password', editUser ? t('admin.user.passwordChangeHint') : t('admin.user.password'), 'password'],
    ['position', t('admin.user.position'), 'text'],
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">{t('admin.user.usersTitle')} ({users.length})</h2>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> {t('admin.user.addUser')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {[
                t('admin.user.tableHeaders.name'),
                t('admin.user.tableHeaders.username'),
                t('admin.user.tableHeaders.position'),
                t('admin.user.tableHeaders.department'),
                t('admin.user.tableHeaders.role'),
                t('admin.user.tableHeaders.status'),
                '',
              ].map(h => (
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
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{u.is_active ? t('admin.user.active') : t('admin.user.inactive')}</span></td>
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
            <h3 className="font-semibold text-gray-900 mb-4">{editUser ? t('admin.user.editUser') : t('admin.user.newUserTitle')}</h3>
            <div className="space-y-3">
              {formFields.map(([f, label, type]) => (
                <div key={f}>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>
                  <input type={type} value={form[f]} onChange={e => setForm(x => ({ ...x, [f]: e.target.value }))}
                    disabled={editUser && f === 'username'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{t('admin.user.department')}</label>
                <select value={form.department} onChange={e => setForm(x => ({ ...x, department: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{t('admin.user.selectDept')}</option>
                  {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  {form.department && !depts.find(d => d.name === form.department) && (
                    <option value={form.department}>{form.department}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{t('admin.user.role')}</label>
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
                  <span className="text-sm text-gray-700">{t('admin.user.activeAccount')}</span>
                </label>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {saving ? t('common.saving') : t('common.save')}
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
  const { t } = useLang()
  const [areas, setAreas] = useState([])
  const [expanded, setExpanded] = useState({})
  const [newAreaName, setNewAreaName] = useState('')
  const [newSubName, setNewSubName] = useState({})
  const [editAreaId, setEditAreaId] = useState(null)
  const [editAreaName, setEditAreaName] = useState('')
  const [editSubId, setEditSubId] = useState(null)
  const [editSubName, setEditSubName] = useState('')

  useEffect(() => { api.getAreas().then(setAreas) }, [])

  async function addArea() {
    if (!newAreaName.trim()) return
    try {
      const a = await api.createArea({ name: newAreaName })
      setAreas(x => [...x, a])
      setNewAreaName('')
      toast.success(t('admin.area.addSuccess'))
    } catch (err) { toast.error(err.message) }
  }

  async function addSub(areaId) {
    const name = newSubName[areaId]
    if (!name?.trim()) return
    try {
      const sub = await api.createSubArea({ name, main_area_id: areaId })
      setAreas(areas => areas.map(a => a.id === areaId ? { ...a, sub_areas: [...(a.sub_areas || []), sub] } : a))
      setNewSubName(x => ({ ...x, [areaId]: '' }))
      toast.success(t('admin.area.addSubSuccess'))
    } catch (err) { toast.error(err.message) }
  }

  async function deleteArea(id) {
    if (!confirm(t('admin.area.confirmDeleteArea'))) return
    try { await api.deleteArea(id); setAreas(a => a.filter(x => x.id !== id)); toast.success(t('admin.area.deleteSuccess')) }
    catch (err) { toast.error(err.message) }
  }

  async function deleteSub(areaId, subId) {
    if (!confirm(t('admin.area.confirmDeleteSub'))) return
    try {
      await api.deleteSubArea(subId)
      setAreas(areas => areas.map(a => a.id === areaId ? { ...a, sub_areas: a.sub_areas.filter(s => s.id !== subId) } : a))
      toast.success(t('admin.area.deleteSuccess'))
    } catch (err) { toast.error(err.message) }
  }

  async function saveAreaName(id) {
    if (!editAreaName.trim()) return
    try {
      await api.updateArea(id, { name: editAreaName.trim() })
      setAreas(a => a.map(x => x.id === id ? { ...x, name: editAreaName.trim() } : x))
      setEditAreaId(null)
      toast.success(t('admin.area.editSuccess'))
    } catch (err) { toast.error(err.message) }
  }

  async function saveSubName(areaId, subId) {
    if (!editSubName.trim()) return
    try {
      await api.updateSubArea(subId, { name: editSubName.trim() })
      setAreas(areas => areas.map(a => a.id === areaId
        ? { ...a, sub_areas: a.sub_areas.map(s => s.id === subId ? { ...s, name: editSubName.trim() } : s) }
        : a))
      setEditSubId(null)
      toast.success(t('admin.area.editSuccess'))
    } catch (err) { toast.error(err.message) }
  }

  async function moveArea(idx, dir) {
    const next = [...areas]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setAreas(next)
    try { await api.reorderAreas(next.map(a => a.id)) } catch (err) { toast.error(err.message) }
  }

  async function moveSub(areaId, subIdx, dir) {
    let newSubs = []
    const nextAreas = areas.map(a => {
      if (a.id !== areaId) return a
      const subs = a.sub_areas.filter(s => s.is_active)
      const target = subIdx + dir
      if (target < 0 || target >= subs.length) return a
      ;[subs[subIdx], subs[target]] = [subs[target], subs[subIdx]]
      newSubs = subs
      return { ...a, sub_areas: subs }
    })
    setAreas(nextAreas)
    if (newSubs.length) {
      try { await api.reorderSubAreas(newSubs.map(s => s.id)) } catch (err) { toast.error(err.message) }
    }
  }

  return (
    <div>
      <h2 className="font-semibold text-gray-900 mb-4">{t('admin.area.title')}</h2>
      <div className="flex gap-2 mb-4">
        <input value={newAreaName} onChange={e => setNewAreaName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addArea()}
          placeholder={t('admin.area.namePlaceholder')}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={addArea} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> {t('common.add')}
        </button>
      </div>

      <div className="space-y-2">
        {areas.map((area, idx) => (
          <div key={area.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Area header row */}
            <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 group">
              {/* Reorder buttons */}
              <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => moveArea(idx, -1)} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-20 disabled:cursor-default"><ArrowUp className="w-3 h-3" /></button>
                <button onClick={() => moveArea(idx, 1)} disabled={idx === areas.length - 1} className="p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-20 disabled:cursor-default"><ArrowDown className="w-3 h-3" /></button>
              </div>

              {editAreaId === area.id ? (
                <>
                  <input value={editAreaName} onChange={e => setEditAreaName(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveAreaName(area.id); if (e.key === 'Escape') setEditAreaId(null) }}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={() => saveAreaName(area.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditAreaId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  <button onClick={() => setExpanded(e => ({ ...e, [area.id]: !e[area.id] }))}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    {expanded[area.id] ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <span className="font-medium text-gray-900 text-sm truncate">{area.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{area.sub_areas?.filter(s => s.is_active).length || 0} {t('admin.area.subAreaCount')}</span>
                  </button>
                  <button onClick={() => { setEditAreaId(area.id); setEditAreaName(area.name) }}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteArea(area.id)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Sub-areas */}
            {expanded[area.id] && (
              <div className="px-4 py-3 space-y-0.5">
                {area.sub_areas?.filter(s => s.is_active).map((sub, subIdx) => {
                  const activeSubs = area.sub_areas.filter(s => s.is_active)
                  return (
                    <div key={sub.id} className="flex items-center gap-1 py-1 group/sub">
                      {/* Sub reorder */}
                      <div className="flex flex-col opacity-0 group-hover/sub:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => moveSub(area.id, subIdx, -1)} disabled={subIdx === 0} className="p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-20 disabled:cursor-default"><ArrowUp className="w-3 h-3" /></button>
                        <button onClick={() => moveSub(area.id, subIdx, 1)} disabled={subIdx === activeSubs.length - 1} className="p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-20 disabled:cursor-default"><ArrowDown className="w-3 h-3" /></button>
                      </div>

                      {editSubId === sub.id ? (
                        <>
                          <input value={editSubName} onChange={e => setEditSubName(e.target.value)} autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') saveSubName(area.id, sub.id); if (e.key === 'Escape') setEditSubId(null) }}
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <button onClick={() => saveSubName(area.id, sub.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditSubId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-gray-700 pl-1">{sub.name}</span>
                          <button onClick={() => { setEditSubId(sub.id); setEditSubName(sub.name) }}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover/sub:opacity-100 transition-opacity">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => deleteSub(area.id, sub.id)}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover/sub:opacity-100 transition-opacity">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
                <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                  <input value={newSubName[area.id] || ''} onChange={e => setNewSubName(x => ({ ...x, [area.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addSub(area.id)}
                    placeholder={t('admin.area.subAreaPlaceholder')}
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
  const { t } = useLang()
  const [types, setTypes] = useState([])
  const [newName, setNewName] = useState('')

  useEffect(() => { api.getIssueTypes().then(setTypes) }, [])

  async function add() {
    if (!newName.trim()) return
    try {
      const it = await api.createIssueType({ name: newName })
      setTypes(x => [...x, it])
      setNewName('')
      toast.success(t('admin.issueType.addSuccess'))
    } catch (err) { toast.error(err.message) }
  }

  async function del(id) {
    if (!confirm(t('admin.issueType.confirmDelete'))) return
    try { await api.deleteIssueType(id); setTypes(tp => tp.filter(x => x.id !== id)); toast.success(t('admin.issueType.deleteSuccess')) }
    catch (err) { toast.error(err.message) }
  }

  async function save(id, name) {
    await api.updateIssueType(id, { name })
    setTypes(tp => tp.map(x => x.id === id ? { ...x, name } : x))
    toast.success(t('admin.issueType.editSuccess'))
  }

  async function move(idx, dir) {
    const next = [...types]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setTypes(next)
    try { await api.reorderIssueTypes(next.map(x => x.id)) } catch (err) { toast.error(err.message) }
  }

  return (
    <div>
      <h2 className="font-semibold text-gray-900 mb-4">{t('admin.issueType.title')}</h2>
      <div className="flex gap-2 mb-4">
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={t('admin.issueType.namePlaceholder')}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={add} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> {t('common.add')}
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {types.map((tp, idx) => (
          <div key={tp.id} className="px-4">
            <EditableItem name={tp.name} onSave={name => save(tp.id, name)} onDelete={() => del(tp.id)}
              onMoveUp={idx > 0 ? () => move(idx, -1) : null}
              onMoveDown={idx < types.length - 1 ? () => move(idx, 1) : null} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main AdminPage ───────────────────────────────────
function StorageStatusBanner() {
  const [status, setStatus] = useState(null)
  useEffect(() => { api.getStorageStatus().then(setStatus).catch(() => {}) }, [])
  if (!status) return null
  if (status.cloudinary_enabled) return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
      <Cloud className="w-4 h-4 text-green-600 flex-shrink-0" />
      <span><strong>Cloudinary:</strong> เชื่อมต่อแล้ว — รูปภาพจะถูกบันทึกบน Cloud</span>
    </div>
  )
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border-2 border-red-300 rounded-xl text-sm text-red-800">
      <CloudOff className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-bold">⚠️ Cloudinary ยังไม่ได้ตั้งค่า — รูปภาพจะไม่ถูกบันทึก!</p>
        <p className="mt-1 text-red-700">{status.warning}</p>
        <p className="mt-2 text-xs text-red-600 font-mono">กรุณาเพิ่ม environment variables ใน Railway:<br/>
          CLOUDINARY_CLOUD_NAME · CLOUDINARY_API_KEY · CLOUDINARY_API_SECRET</p>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { t } = useLang()
  const [tab, setTab] = useState('users')

  const tabs = [
    { key: 'users', label: t('admin.tabs.users') },
    { key: 'departments', label: t('admin.tabs.departments') },
    { key: 'areas', label: t('admin.tabs.areas') },
    { key: 'issue_types', label: t('admin.tabs.issueTypes') },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('admin.title')}</h1>
      <StorageStatusBanner />

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === tb.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tb.label}
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
