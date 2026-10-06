import { useState } from 'react'
import {
  clearAdminSession,
  consumeAdminSessionFromUrl,
  loadAdminSession,
  resendSignupConfirmation,
  signInAdmin,
  signUpAdmin,
} from './AdminAuth'

export default function AdminGate({ children }) {
  const [session, setSession] = useState(() => consumeAdminSessionFromUrl() || loadAdminSession())
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState('')
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setStatus('')

    try {
      if (mode === 'signup' && password !== confirmPassword) {
        throw new Error('Les deux mots de passe ne sont pas identiques.')
      }

      const data = mode === 'signup'
        ? await signUpAdmin(email.trim(), password)
        : await signInAdmin(email.trim(), password)

      const active = loadAdminSession()
      if (active) {
        setSession(active)
        return
      }

      if (mode === 'signup' && data?.user) {
        setAwaitingConfirmation(true)
        setStatus('Compte créé. Vérifie maintenant ton courriel et clique sur le lien de confirmation. Ensuite, connecte-toi avec le même mot de passe.')
        return
      }

      setStatus('Connexion impossible.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue.'
      setStatus(message)
      if (/pas encore confirmée/i.test(message)) setAwaitingConfirmation(true)
    } finally {
      setBusy(false)
    }
  }

  async function resendConfirmation() {
    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setStatus('Entre d’abord ton adresse courriel.')
      return
    }

    setBusy(true)
    setStatus('')
    try {
      await resendSignupConfirmation(cleanEmail)
      setAwaitingConfirmation(true)
      setStatus('Courriel de confirmation renvoyé. Vérifie aussi tes courriels indésirables.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Impossible de renvoyer le courriel.')
    } finally {
      setBusy(false)
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setStatus('')
    setAwaitingConfirmation(false)
    setPassword('')
    setConfirmPassword('')
  }

  if (session) {
    return <>{children({ session, signOut: () => { clearAdminSession(); setSession(null) } })}</>
  }

  const isSignup = mode === 'signup'

  return (
    <main className="admin-login">
      <section className="admin-login__card">
        <div className="admin__eyebrow">Configurateur 3D · Administration</div>
        <h1>{isSignup ? 'Créer le compte administrateur' : 'Connexion'}</h1>
        <p>
          {isSignup
            ? 'Crée ton compte avec ton courriel et ton mot de passe. Tu confirmeras ensuite ton adresse par courriel.'
            : 'Connecte-toi avec ton courriel et ton mot de passe.'}
        </p>

        <form onSubmit={submit}>
          <label>
            <span>Adresse courriel</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            <span>{isSignup ? 'Créer un mot de passe' : 'Mot de passe'}</span>
            <input
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength="8"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {isSignup && (
            <label>
              <span>Confirmer le mot de passe</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength="8"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          )}

          {status && <div className="admin-login__status">{status}</div>}

          <button type="submit" disabled={busy}>
            {busy ? 'Un instant…' : isSignup ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>

        {awaitingConfirmation && (
          <button
            className="admin-login__switch"
            type="button"
            disabled={busy}
            onClick={resendConfirmation}
          >
            Renvoyer le courriel de confirmation
          </button>
        )}

        <button
          className="admin-login__switch"
          type="button"
          disabled={busy}
          onClick={() => switchMode(isSignup ? 'login' : 'signup')}
        >
          {isSignup ? 'J’ai déjà un compte' : 'Créer mon compte administrateur'}
        </button>
      </section>
    </main>
  )
}
