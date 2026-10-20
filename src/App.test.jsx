// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
vi.mock('./components/TaskWorkspace', () => ({ default: () => <section>Task workspace</section> }))

const { auth } = vi.hoisted(() => ({ auth: {
  getSession: vi.fn(), onAuthStateChange: vi.fn(), signUp: vi.fn(),
  signInWithPassword: vi.fn(), signOut: vi.fn(), resend: vi.fn(),
} }))
vi.mock('./lib/supabase', () => ({ supabase: { auth } }))
let notify
const session = { user: { email: 'person@example.com' } }
beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  auth.onAuthStateChange.mockImplementation(callback => {
    notify = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
})
afterEach(cleanup)

async function fillForm(user) {
  await user.type(screen.getByLabelText('Email'), 'person@example.com')
  await user.type(screen.getByLabelText('Password'), 'strong-password')
}

test('signup requests a confirmation redirect and shows email instructions', async () => {
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null })
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Get Started' }))
  await fillForm(user)
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  expect(auth.signUp).toHaveBeenCalledWith({ email: 'person@example.com', password: 'strong-password', options: { emailRedirectTo: window.location.origin } })
  expect((await screen.findByRole('status')).textContent).toContain('Check your email')
  expect(screen.getByLabelText('Password').value).toBe('')
})

test('sign-in errors are shown and a subsequent sign-in opens home', async () => {
  auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
  auth.signInWithPassword.mockImplementationOnce(async () => {
    notify('SIGNED_IN', session)
    return { data: { session }, error: null }
  })
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Already have an account? Sign in' }))
  await fillForm(user)
  await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
  expect((await screen.findByRole('alert')).textContent).toBe('Invalid login credentials')
  await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
  expect(await screen.findByText('A little space to begin.')).toBeTruthy()
  expect(screen.queryByText('You’re signed in. Welcome to Momentum.')).toBeNull()
})

test('restores saved session and signs out to welcome', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null })
  auth.signOut.mockImplementation(async () => { notify('SIGNED_OUT', null); return { error: null } })
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Sign out' }))
  expect(await screen.findByRole('button', { name: 'Get Started' })).toBeTruthy()
  expect(screen.queryByText('You’re signed out.')).toBeNull()
})

test('shows initial loading and does not overwrite a newer auth event', async () => {
  let resolve
  auth.getSession.mockReturnValue(new Promise(r => { resolve = r }))
  render(<App />)
  expect(screen.getByRole('status').textContent).toContain('Getting things ready')
  act(() => notify('SIGNED_IN', session))
  await act(async () => resolve({ data: { session: null }, error: null }))
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
})

test('expired confirmation link shows a helpful error and allows resend', async () => {
  window.history.replaceState(null, '', '/#error=access_denied&error_code=otp_expired')
  auth.resend.mockResolvedValue({ error: null })
  const user = userEvent.setup()
  render(<App />)
  expect((await screen.findByRole('alert')).textContent).toContain('expired')
  await user.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }))
  await user.type(screen.getByLabelText('Email'), 'person@example.com')
  await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
  expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'person@example.com', options: { emailRedirectTo: window.location.origin } })
  expect((await screen.findByRole('status')).textContent).toContain('new link')
})

test('failed sign-out keeps the user on home and displays the error', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null })
  auth.signOut.mockResolvedValue({ error: { message: 'Network unavailable' } })
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Sign out' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Network unavailable')
  expect(screen.getByText('A little space to begin.')).toBeTruthy()
})

test('signed-in header contains compact branding and sign-out above the dashboard', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null })
  render(<App />)
  const header = await screen.findByRole('banner')
  expect(header.querySelector('h1').textContent).toBe('Momentum')
  expect(header.contains(screen.getByRole('button', { name: 'Sign out' }))).toBe(true)
  expect(screen.getByRole('main').id).toBe('dashboard')
  expect(screen.queryByText('A gentler way to get started.')).toBeNull()
})
