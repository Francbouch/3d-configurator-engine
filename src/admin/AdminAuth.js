const SUPABASE_URL = 'https://vnaoawlrotdogslykbmm.supabase.co'
const SUPABASE_KEY = 'sb_publishable_YQndqxq2W7Bq2C-0crv0rQ_V4Upvbja'
const SESSION_KEY = 'configurator-admin-session'

function headers(token) {
  return {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function adminRedirectUrl() {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${window.location.pathname}?admin=model`
}

function authError(data, fallback) {
  const raw = data?.msg || data?.message || data?.error_description || data?.error || fallback

  const wait = String(raw).match(/after\s+(\d+)\s+seconds?/i)
  if (wait) {
    return `Une demande vient d’être envoyée. Réessaie dans environ ${wait[1]} secondes.`
  }

  if (/email rate limit exceeded|over_email_send_rate_limit/i.test(String(raw))) {
    return 'Supabase limite temporairement l’envoi de courriels. Attends quelques minutes avant de réessayer.'
  }

  if (/email not confirmed/i.test(String(raw))) {
    return 'Ton compte existe, mais ton adresse courriel n’est pas encore confirmée.'
  }

  if (/invalid login credentials/i.test(String(raw))) {
    return 'Adresse courriel ou mot de passe incorrect.'
  }

  if (/user already registered/i.test(String(raw))) {
    return 'Ce compte existe déjà. Connecte-toi avec ton mot de passe.'
  }

  return String(raw)
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

export function consumeAdminSessionFromUrl() {
  if (typeof window === 'undefined' || !window.location.hash) return null

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken) return null

  const expiresAt = Number(params.get('expires_at')) ||
    Math.floor(Date.now() / 1000) + Number(params.get('expires_in') || 3600)

  const session = saveSession({
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
    token_type: params.get('token_type') || 'bearer',
    expires_at: expiresAt,
  })

  window.history.replaceState({}, document.title, adminRedirectUrl())
  return session
}

export async function signInAdmin(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(authError(data, 'Connexion impossible.'))
  return saveSession(data)
}

export async function signUpAdmin(email, password) {
  const redirectTo = encodeURIComponent(adminRedirectUrl())
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup?redirect_to=${redirectTo}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(authError(data, 'Création du compte impossible.'))
  if (data?.access_token) saveSession(data)
  return data
}

export async function resendSignupConfirmation(email) {
  const redirectTo = encodeURIComponent(adminRedirectUrl())
  const response = await fetch(`${SUPABASE_URL}/auth/v1/resend?redirect_to=${redirectTo}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ type: 'signup', email }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(authError(data, 'Impossible de renvoyer le courriel de confirmation.'))
  return data
}
