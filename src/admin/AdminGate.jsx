import { useState } from 'react'
import { clearAdminSession, loadAdminSession, signInAdmin, signUpAdmin } from './AdminAuth'

export default function AdminGate({ children }) {
  const [session, setSession] = useState(() => loadAdminSession())
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setStatus('')
    try {
      const data = mode === 'signup'
        ? await signUpAdmin(email.trim(), password)
        : await signInAdmin(email.trim(), password)
      const active = loadAdminSession()
      if (active) setSession(active)
      else setStatus(data?.user ? 'Compte créé. Vérifie ton courriel si Supabase demande une confirmation, puis connecte-toi.' : 'Connexion impossible.')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (session) {
    return <>{children({ session, signOut: () => { clearAdminSession(); setSession(null) } })}</>
  }

  return (
    <main className="admin-login">
      <section className="admin-login__card">
        <div className="admin__eyebrow">Configurateur 3D · Administration</div>
        <h1>{mode === 'signup' ? 'Créer le compte administrateur' : 'Connexion'}</h1>
        <p>{mode === 'signup' ? 'Crée ton accès sécurisé au back-office.' : 'Connecte-toi pour modifier et publier le configurateur.'}</p>
        <form onSubmit={submit}>
          <label><span>Adresse courriel</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label><span>Mot de passe</span><input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength="8" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {status && <div className="admin-login__status">{status}</div>}
          <button type="submit" disabled={busy}>{busy ? 'Un instant…' : mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}</button>
        </form>
        <button className="admin-login__switch" type="button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setStatus('') }}>
          {mode === 'signup' ? 'J’ai déjà un compte' : 'Créer le compte administrateur'}
        </button>
      </section>
    </main>
  )
}
