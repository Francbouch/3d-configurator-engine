const SUPABASE_URL = 'https://jetogsbyptglaihktdel.supabase.co'
const SUPABASE_KEY = 'sb_publishable_YQndqxq2W7Bq2C-0crv0rQ_V4Upvbja'
const SESSION_KEY = 'configurator-admin-session'

function headers(token) {
  return {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function loadAdminSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (!session?.access_token || !session?.expires_at) return null
    if (session.expires_at * 1000 <= Date.now()) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

export function clearAdminSession() {
  localStorage.removeItem(SESSION_KEY)
}

function saveSession(data) {
  if (data?.access_token) localStorage.setItem(SESSION_KEY, JSON.stringify(data))
  return data
}

export async function signInAdmin(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.msg || data?.error_description || 'Connexion impossible.')
  return saveSession(data)
}

export async function signUpAdmin(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.msg || data?.error_description || 'Création du compte impossible.')
  if (data?.access_token) saveSession(data)
  return data
}
