const PASSWORD_KEY = 'pktsx_admin_password'

export function getAdminPassword() {
  try {
    return sessionStorage.getItem(PASSWORD_KEY) ?? ''
  } catch {
    // Trinh duyet chan storage (che do rieng tu) -- coi nhu chua dang nhap.
    return ''
  }
}

export function setAdminPassword(value) {
  try {
    if (value) sessionStorage.setItem(PASSWORD_KEY, value)
    else sessionStorage.removeItem(PASSWORD_KEY)
  } catch {
    /* khong luu duoc thi thoi, phien nay van dung duoc */
  }
}

/** Loi mang duoc nem ra kem message tieng Viet de hien thang len toast. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const password = getAdminPassword()
  if (password) headers['x-admin-password'] = password
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(path, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new ApiError('Khong ket noi duoc toi may chu.', 0)
  }

  if (!res.ok) {
    let message = `May chu tra ve loi ${res.status}.`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* phan hoi khong phai JSON, giu message mac dinh */
    }
    throw new ApiError(message, res.status)
  }

  return res.status === 204 ? null : res.json()
}

export const api = {
  publicTree: () => request('/api/tree'),
  adminStatus: () => request('/api/admin/status'),
  adminTree: () => request('/api/admin/tree'),

  createNode: (payload) =>
    request('/api/admin/nodes', { method: 'POST', body: payload }),

  updateNode: (id, patch) =>
    request(`/api/admin/nodes/${id}`, { method: 'PATCH', body: patch }),

  deleteNode: (id) => request(`/api/admin/nodes/${id}`, { method: 'DELETE' }),

  reorder: (order) =>
    request('/api/admin/tree/order', { method: 'PUT', body: { order } }),

  // Noi dung tho cho khung xem truoc -- di duong nay de xem duoc ca muc dang tat.
  rawContent: (id) => request(`/api/admin/nodes/${id}/content`),

  uploadContent: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(`/api/admin/nodes/${id}/content`, { method: 'POST', form })
  },
}
