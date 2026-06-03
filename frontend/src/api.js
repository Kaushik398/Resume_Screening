// Direct backend URL works without Vite proxy (e.g. opening wrong port or preview build).
// Override with VITE_API_URL in .env if needed.
export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  try {
    const res = await fetch(url, options)
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
