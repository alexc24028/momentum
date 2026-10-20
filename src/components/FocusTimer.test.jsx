// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import FocusTimer from './FocusTimer'

afterEach(() => { cleanup(); vi.useRealTimers() })

test('starts, pauses without losing time, resumes and resets', () => {
  vi.useFakeTimers()
  const focus = vi.fn()
  render(<FocusTimer onFocusChange={focus} />)
  expect(screen.getByRole('timer').textContent).toBe('5:00')
  fireEvent.click(screen.getByRole('button', { name: 'Start 5-minute focus' }))
  expect(focus).toHaveBeenLastCalledWith(true)
  act(() => vi.advanceTimersByTime(60_000))
  expect(screen.getByRole('timer').textContent).toBe('4:00')
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
  act(() => vi.advanceTimersByTime(90_000))
  expect(screen.getByRole('timer').textContent).toBe('4:00')
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
  act(() => vi.advanceTimersByTime(30_000))
  expect(screen.getByRole('timer').textContent).toBe('3:30')
  fireEvent.click(screen.getByRole('button', { name: 'Reset timer' }))
  expect(screen.getByRole('timer').textContent).toBe('5:00')
  expect(focus).toHaveBeenLastCalledWith(false)
  act(() => vi.advanceTimersByTime(60_000))
  expect(screen.getByRole('timer').textContent).toBe('5:00')
})

test('finishes gently, never goes negative, and can start again', () => {
  vi.useFakeTimers()
  const focus = vi.fn()
  render(<FocusTimer onFocusChange={focus} />)
  fireEvent.click(screen.getByRole('button', { name: 'Start 5-minute focus' }))
  act(() => vi.advanceTimersByTime(300_000))
  expect(screen.getByRole('timer').textContent).toBe('0:00')
  expect(screen.getByRole('status').textContent).toContain('keep going or take a break')
  expect(focus).toHaveBeenLastCalledWith(false)
  act(() => vi.advanceTimersByTime(20_000))
  expect(screen.getByRole('timer').textContent).toBe('0:00')
  fireEvent.click(screen.getByRole('button', { name: 'Reset timer' }))
  expect(screen.getByRole('button', { name: 'Start 5-minute focus' })).toBeTruthy()
})

test('uses elapsed wall time after background throttling and cleans up on leaving', () => {
  vi.useFakeTimers()
  const focus = vi.fn()
  const view = render(<FocusTimer onFocusChange={focus} />)
  fireEvent.click(screen.getByRole('button', { name: 'Start 5-minute focus' }))
  vi.setSystemTime(Date.now() + 301_000)
  fireEvent(document, new Event('visibilitychange'))
  expect(screen.getByRole('timer').textContent).toBe('0:00')
  view.unmount()
  expect(vi.getTimerCount()).toBe(0)
  expect(focus).toHaveBeenLastCalledWith(false)
})
