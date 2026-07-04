const BASE = ''  // use Vite proxy — /api/* and /uploads/* are proxied to backend

// แปลง date+hour+minute → ISO string พร้อม local timezone offset เช่น "2026-06-15T14:30:00+07:00"
export function schedToISO(date, hour, minute) {
  if (!date) return null
  const off = -new Date().getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const mm = String(Math.abs(off) % 60).padStart(2, '0')
  return `${date}T${hour}:${minute}:00${sign}${hh}:${mm}`
}

// แปลง filename/URL จาก DB → URL ที่แสดงใน browser
// รองรับ: Cloudinary URL (https://...), local path (/uploads/xxx), filename เก่า (xxx.jpg)
export function imgUrl(filename) {
  if (!filename) return ''
  if (filename.startsWith('http')) return filename          // Cloudinary URL
  if (filename.startsWith('/')) return filename             // /uploads/xxx
  return `/uploads/${filename}`                             // legacy filename
}

// Returns the current active work order for a job (last non-rejected/transferred one)
// Fixes the bug where work_orders[0] could be an old rejected/transferred order
export function activeWorkOrder(job) {
  if (!job?.work_orders?.length) return null
  const inactive = ['rejected', 'transferred']
  return [...job.work_orders].reverse().find(w => !inactive.includes(w.status)) ?? null
}

export function isVideoUrl(url) {
  if (!url) return false
  const u = url.toLowerCase()
  return u.includes('/video/upload/') || /\.(mp4|mov|webm|m4v|avi)(\?|$)/.test(u)
}

function getToken() {
  return localStorage.getItem('token')
}

async function request(method, path, body, isFormData = false) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && path !== '/api/auth/login') {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  const data = res.ok ? await res.json() : await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'เกิดข้อผิดพลาด')
  return data
}

export const api = {
  // Auth
  login: (username, password) => request('POST', '/api/auth/login', { username, password }),
  me: () => request('GET', '/api/auth/me'),

  // Users
  getUsers: () => request('GET', '/api/users'),
  getOOONotifyUsers: () => request('GET', '/api/users/ooo-notify'),
  getTechnicians: () => request('GET', '/api/users/technicians'),
  getTechWorkload: () => request('GET', '/api/users/technicians/workload'),
  createUser: (data) => request('POST', '/api/users', data),
  updateUser: (id, data) => request('PUT', `/api/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/api/users/${id}`),

  // Areas
  getAreas: () => request('GET', '/api/areas'),
  createArea: (data) => request('POST', '/api/areas', data),
  updateArea: (id, data) => request('PUT', `/api/areas/${id}`, data),
  deleteArea: (id) => request('DELETE', `/api/areas/${id}`),
  reorderAreas: (ids) => request('PUT', '/api/areas/reorder', { ids }),
  createSubArea: (data) => request('POST', '/api/areas/sub', data),
  updateSubArea: (id, data) => request('PUT', `/api/areas/sub/${id}`, data),
  deleteSubArea: (id) => request('DELETE', `/api/areas/sub/${id}`),
  reorderSubAreas: (ids) => request('PUT', '/api/areas/sub/reorder', { ids }),

  // Issue Types
  getIssueTypes: () => request('GET', '/api/issue-types'),
  createIssueType: (data) => request('POST', '/api/issue-types', data),
  updateIssueType: (id, data) => request('PUT', `/api/issue-types/${id}`, data),
  deleteIssueType: (id) => request('DELETE', `/api/issue-types/${id}`),
  reorderIssueTypes: (ids) => request('PUT', '/api/issue-types/reorder', { ids }),

  // Jobs
  getJobs: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request('GET', `/api/jobs${qs ? `?${qs}` : ''}`)
  },
  getJob: (id) => request('GET', `/api/jobs/${id}`),
  getCompletedToday: () => request('GET', '/api/jobs/completed-today'),
  createJob: (data) => request('POST', '/api/jobs', data),
  uploadImage: (id, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request('POST', `/api/jobs/${id}/images`, fd, true)
  },
  uploadVideo: (id, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request('POST', `/api/jobs/${id}/videos`, fd, true)
  },
  uploadInspectImage: (id, inspectionId, file) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('inspection_id', String(inspectionId))
    return request('POST', `/api/jobs/${id}/inspect-images`, fd, true)
  },
  uploadInspectVideo: (id, inspectionId, file) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('inspection_id', String(inspectionId))
    return request('POST', `/api/jobs/${id}/inspect-videos`, fd, true)
  },
  assignJob: (id, technicianId) => request('POST', `/api/jobs/${id}/assign`, { technician_id: technicianId }),
  acceptJob: (id) => request('POST', `/api/jobs/${id}/accept`),
  recallJob: (id, newTechnicianId = null) => request('POST', `/api/jobs/${id}/recall`, { new_technician_id: newTechnicianId }),
  reassignJob: (id, technicianId) => request('PUT', `/api/jobs/${id}/reassign`, { technician_id: technicianId }),
  coAssignJob: (id, technicianId) => request('POST', `/api/jobs/${id}/co-assign`, { technician_id: technicianId }),
  removeCoAssign: (id, coId) => request('DELETE', `/api/jobs/${id}/co-assign/${coId}`),
  completeJob: (id, data) => request('PUT', `/api/jobs/${id}/complete`, data),
  inspectJob: (id, data) => request('POST', `/api/jobs/${id}/inspect`, data),
  cancelJob: (id) => request('PUT', `/api/jobs/${id}/cancel`),
  getLocationHistory: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString()
    return request('GET', `/api/jobs/location-history${qs ? `?${qs}` : ''}`)
  },

  // Departments
  getDepartments: () => request('GET', '/api/departments'),
  createDepartment: (data) => request('POST', '/api/departments', data),
  updateDepartment: (id, data) => request('PUT', `/api/departments/${id}`, data),
  deleteDepartment: (id) => request('DELETE', `/api/departments/${id}`),

  // On-Duty
  getOnDuty: (date) => request('GET', `/api/onduty${date ? `?duty_date=${date}` : ''}`),
  getOnDutyMonth: (year, month) => request('GET', `/api/onduty/month?year=${year}&month=${month}`),
  setOnDuty: (data) => request('POST', '/api/onduty', data),
  removeOnDuty: (id) => request('DELETE', `/api/onduty/${id}`),
  amIOnDuty: () => request('GET', '/api/onduty/me/today'),

  // Job actions (new)
  selfAssignJob: (id) => request('POST', `/api/jobs/${id}/self-assign`),
  rejectJob: (id, reason) => request('POST', `/api/jobs/${id}/reject`, { reason }),
  transferJob: (id, technicianId, note) => request('POST', `/api/jobs/${id}/transfer`, { technician_id: technicianId, note }),
  editJob: (id, data) => request('PUT', `/api/jobs/${id}/edit`, data),

  // On-duty today (convenience)
  getOnDutyToday: () => request('GET', '/api/onduty'),

  // SLA
  getSLASettings: () => request('GET', '/api/admin/sla'),
  updateSLASettings: (data) => request('PUT', '/api/admin/sla', data),

  // Permissions
  getPermissions: () => request('GET', '/api/admin/permissions'),
  updatePermissions: (data) => request('PUT', '/api/admin/permissions', data),

  // System
  getStorageStatus: () => request('GET', '/api/system/storage-status'),
  reseedConfig: () => request('POST', '/api/admin/reseed-config'),
  getLogo: () => request('GET', '/api/system/logo'),
  uploadLogo: (file) => { const fd = new FormData(); fd.append('file', file); return request('POST', '/api/admin/logo', fd, true) },
  deleteLogo: () => request('DELETE', '/api/admin/logo'),

  // Auth extras
  changePassword: (data) => request('POST', '/api/auth/change-password', data),

  // Reports
  getReportSummary: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request('GET', `/api/reports/summary${qs ? `?${qs}` : ''}`)
  },
  getReportList: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request('GET', `/api/reports/list${qs ? `?${qs}` : ''}`)
  },
  getTechnicianReport: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request('GET', `/api/reports/technicians${qs ? `?${qs}` : ''}`)
  },
  getAreaReport: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request('GET', `/api/reports/by-area${qs ? `?${qs}` : ''}`)
  },
  getTopAssets: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request('GET', `/api/reports/top-assets${qs ? `?${qs}` : ''}`)
  },
  getStaffKpi: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request('GET', `/api/reports/staff-kpi${qs ? `?${qs}` : ''}`)
  },
  getMaterialsReport: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString()
    return request('GET', `/api/reports/materials${qs ? `?${qs}` : ''}`)
  },
}
