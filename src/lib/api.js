const BASE = ''  // use Vite proxy — /api/* and /uploads/* are proxied to backend

// แปลง filename/URL จาก DB → URL ที่แสดงใน browser
// รองรับ: Cloudinary URL (https://...), local path (/uploads/xxx), filename เก่า (xxx.jpg)
export function imgUrl(filename) {
  if (!filename) return ''
  if (filename.startsWith('http')) return filename          // Cloudinary URL
  if (filename.startsWith('/')) return filename             // /uploads/xxx
  return `/uploads/${filename}`                             // legacy filename
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
  getTechnicians: () => request('GET', '/api/users/technicians'),
  createUser: (data) => request('POST', '/api/users', data),
  updateUser: (id, data) => request('PUT', `/api/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/api/users/${id}`),

  // Areas
  getAreas: () => request('GET', '/api/areas'),
  createArea: (data) => request('POST', '/api/areas', data),
  updateArea: (id, data) => request('PUT', `/api/areas/${id}`, data),
  deleteArea: (id) => request('DELETE', `/api/areas/${id}`),
  createSubArea: (data) => request('POST', '/api/areas/sub', data),
  updateSubArea: (id, data) => request('PUT', `/api/areas/sub/${id}`, data),
  deleteSubArea: (id) => request('DELETE', `/api/areas/sub/${id}`),

  // Issue Types
  getIssueTypes: () => request('GET', '/api/issue-types'),
  createIssueType: (data) => request('POST', '/api/issue-types', data),
  updateIssueType: (id, data) => request('PUT', `/api/issue-types/${id}`, data),
  deleteIssueType: (id) => request('DELETE', `/api/issue-types/${id}`),

  // Jobs
  getJobs: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request('GET', `/api/jobs${qs ? `?${qs}` : ''}`)
  },
  getJob: (id) => request('GET', `/api/jobs/${id}`),
  createJob: (data) => request('POST', '/api/jobs', data),
  uploadImage: (id, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request('POST', `/api/jobs/${id}/images`, fd, true)
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
}
