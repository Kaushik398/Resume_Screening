import { supabase } from './supabase'

// Direct backend URL works without Vite proxy (e.g. opening wrong port or preview build).
// Override with VITE_API_URL in .env if needed.
export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  
  let token = null
  try {
    const { data } = await supabase.auth.getSession()
    if (data?.session) {
      token = data.session.access_token
    }
  } catch (e) {
    console.error('Error fetching session for API request:', e)
  }

  const headers = { ...options.headers }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const fetchOptions = {
    ...options,
    headers,
  }

  try {
    const res = await fetch(url, fetchOptions)
    return res
  } catch {
    throw new Error(
      `Cannot reach the API at ${API_BASE}. Start the backend: cd backend → .\\venv\\Scripts\\activate → uvicorn main:app --reload --port 8000`
    )
  }
}

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) })
    return res.ok
  } catch {
    return false
  }
}
