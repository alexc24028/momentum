import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import TaskWorkspace from './components/TaskWorkspace'

function confirmationError() {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  return hash.has('error') || query.has('error')
    ? 'This confirmation link could not be used. It may have expired. Try signing in, or request a new confirmation email.' : ''
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState('welcome')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(confirmationError)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    let receivedEvent = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      receivedEvent = true
      setSession(nextSession)
      setLoading(false)
      setPassword('')
      if (event === 'SIGNED_OUT') {
        setScreen('welcome')
        setMessage('You’re signed out.')
      }
    })
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (!receivedEvent) setSession(data?.session ?? null)
      if (sessionError) setError('We couldn’t restore your session. Please try signing in again.')
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setError('We couldn’t check your session. Please refresh and try again.')
      setLoading(false)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  function changeScreen(next) {
    setScreen(next)
    setPassword('')
    setError('')
    setMessage('')
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const credentials = { email: email.trim(), password }
      const result = screen === 'signup'
        ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword(credentials)
      if (result.error) throw result.error
      setPassword('')
      setMessage(result.data.session ? 'You’re signed in. Welcome to Momentum.'
        : 'Check your email for a confirmation link, then return here to sign in. If you already have an account, try signing in instead.')
    } catch (err) {
      setError(err.message || 'We couldn’t connect. Please try again.')
    } finally { setBusy(false) }
  }

  async function resendConfirmation() {
    if (!email.trim()) { setError('Enter your email address first.'); return }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: window.location.origin } })
      if (error) throw error
      setMessage('If your account needs confirmation, a new link has been sent. Check your email.')
    } catch (err) {
      setError(err.message || 'We couldn’t send the email. Please try again.')
    } finally { setBusy(false) }
  }

  async function signOut() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (err) {
      setError(err.message || 'We couldn’t sign you out. Please try again.')
    } finally { setBusy(false) }
  }

  if (!loading && session) return (
    <div className="app-shell">
      <a className="skip-link" href="#dashboard">Skip to tasks</a>
      <header className="app-header">
        <div className="header-inner">
          <div className="compact-brand">
            <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
            <h1>Momentum</h1>
          </div>
          <button className="sign-out" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </header>
      <main id="dashboard" className="dashboard" tabIndex={-1}>
        <div className="dashboard-intro">
          <h2>A little space to begin.</h2>
          <p>One task. One small step. At your own pace.</p>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        {message && <p className="notice" role="status">{message}</p>}
        <TaskWorkspace key={session.user.id} userId={session.user.id} />
      </main>
    </div>
  )

  return (
    <main className="welcome">
      <div className="welcome-content">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <h1>Momentum</h1>
        {loading ? <p role="status">Getting things ready…</p> : <>
          <>
            <p>A gentler way to get started.</p>
            {screen === 'welcome' ? <>
              <button onClick={() => changeScreen('signup')}>Get Started</button>
              <button className="text-button" onClick={() => changeScreen('signin')}>Already have an account? Sign in</button>
            </> : <>
              <h2>{screen === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
              <form onSubmit={submit} aria-busy={busy}>
                <fieldset disabled={busy}>
                  <label htmlFor="email">Email</label>
                  <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
                  <label htmlFor="password">Password</label>
                  <input id="password" type="password" autoComplete={screen === 'signup' ? 'new-password' : 'current-password'} required minLength={screen === 'signup' ? 6 : undefined} value={password} onChange={e => setPassword(e.target.value)} />
                  {screen === 'signup' && <small>Use at least 6 characters. Your account may require a stronger password.</small>}
                  <button type="submit">{busy ? 'Please wait…' : screen === 'signup' ? 'Create account' : 'Sign in'}</button>
                </fieldset>
              </form>
              <button className="text-button" disabled={busy} onClick={() => changeScreen(screen === 'signup' ? 'signin' : 'signup')}>
                {screen === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
              </button>
              <button className="text-button" disabled={busy} onClick={resendConfirmation}>Resend confirmation email</button>
              <button className="text-button" disabled={busy} onClick={() => changeScreen('welcome')}>Back to welcome</button>
            </>}
          </>
          {error && <p className="notice error" role="alert">{error}</p>}
          {message && <p className="notice" role="status">{message}</p>}
        </>}
      </div>
    </main>
  )
}
