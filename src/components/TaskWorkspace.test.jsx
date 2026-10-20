// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskWorkspace from './TaskWorkspace'
import * as api from '../lib/tasks'
vi.mock('../lib/tasks', () => ({
  loadTasks: vi.fn(), createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(),
  createStep: vi.fn(), updateStep: vi.fn(), deleteStep: vi.fn(), reorderTasks: vi.fn(),
  migrationMessage: 'Apply the task details migration and reload.',
}))
const first = { id: 's1', task_id: 't1', description: 'Open document', position: 0, is_complete: false }
const second = { id: 's2', task_id: 't1', description: 'Write one line', position: 1, is_complete: false }
const task = { id: 't1', title: 'Write report', steps: [second, first] }
beforeEach(() => { vi.resetAllMocks(); api.loadTasks.mockResolvedValue({ tasks: [], supportsDetails: true }) })
afterEach(cleanup)
async function openTask(user) {
  api.loadTasks.mockResolvedValue({ tasks: [task], supportsDetails: true })
  render(<TaskWorkspace userId="user1" />)
  await user.click(await screen.findByRole('button', { name: 'Write report' }))
}

test('creates a task and multiple ordered steps, then reloads saved data', async () => {
  api.createTask.mockResolvedValue({ id: 't1', title: 'Write report' })
  api.createStep.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
  const user = userEvent.setup()
  const view = render(<TaskWorkspace userId="user1" />)
  expect(await screen.findByText(/No tasks yet/)).toBeTruthy()
  await user.type(screen.getByLabelText('Task title'), '  Write report  ')
  await user.click(screen.getByRole('button', { name: 'Create task' }))
  expect(api.createTask).toHaveBeenCalledWith('user1', 'Write report', { description: null, due_at: null, sort_position: 0 })
  for (const description of ['Open document', 'Write one line']) {
    await user.type(screen.getByLabelText('Add a small step'), description)
    await user.click(screen.getByRole('button', { name: 'Add step', exact: true }))
  }
  expect(api.createStep).toHaveBeenNthCalledWith(1, 't1', 'Open document', 0)
  expect(api.createStep).toHaveBeenNthCalledWith(2, 't1', 'Write one line', 1)
  expect(within(screen.getByRole('region', { name: 'Your next step' })).getByText('Open document')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: 'Your next step' })).queryByText('Write one line')).toBeNull()
  view.unmount()
  api.loadTasks.mockResolvedValue({ tasks: [task], supportsDetails: true })
  render(<TaskWorkspace userId="user1" />)
  await user.click(await screen.findByRole('button', { name: 'Write report' }))
  expect(within(screen.getByRole('region', { name: 'Your next step' })).getByText('Open document')).toBeTruthy()
})

test('emphasizes only the next incomplete step and finishes after both updates', async () => {
  api.updateStep.mockResolvedValueOnce({ ...first, is_complete: true }).mockResolvedValueOnce({ ...second, is_complete: true })
  const user = userEvent.setup()
  await openTask(user)
  expect(within(screen.getByRole('region', { name: 'Your next step' })).queryByText('Write one line')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Mark step complete' }))
  expect(within(await screen.findByRole('region', { name: 'Your next step' })).getByText('Write one line')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: 'Your next step' })).queryByText('Open document')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Mark step complete' }))
  expect(await screen.findByText(/All steps are finished/)).toBeTruthy()
  expect(api.updateStep).toHaveBeenNthCalledWith(1, 't1', 's1', { is_complete: true })
})

test('rejects whitespace titles and step descriptions without database writes', async () => {
  const user = userEvent.setup()
  render(<TaskWorkspace userId="user1" />)
  await user.type(await screen.findByLabelText('Task title'), '   ')
  await user.click(screen.getByRole('button', { name: 'Create task' }))
  expect(screen.getByRole('alert').textContent).toContain('Enter a task title')
  expect(api.createTask).not.toHaveBeenCalled()
  cleanup()
  await openTask(user)
  await user.type(screen.getByLabelText('Add a small step'), '   ')
  await user.click(screen.getByRole('button', { name: 'Add step', exact: true }))
  expect(screen.getByRole('alert').textContent).toContain('Enter a step description')
  expect(api.createStep).not.toHaveBeenCalled()
})

test('edits task and step and deletes a step and the parent task', async () => {
  api.updateTask.mockResolvedValue({ id: 't1', title: 'Small report' })
  api.updateStep.mockResolvedValue({ ...first, description: 'Find document' })
  api.deleteStep.mockResolvedValue({ id: 's1' })
  api.deleteTask.mockResolvedValue({ id: 't1' })
  const user = userEvent.setup()
  await openTask(user)
  await user.click(screen.getByRole('button', { name: 'Edit task title' }))
  await user.clear(screen.getByLabelText('Task title'))
  await user.type(screen.getByLabelText('Task title'), 'Small report')
  await user.click(screen.getByRole('button', { name: 'Save task' }))
  expect(await screen.findByRole('heading', { name: 'Small report' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Edit or delete steps' }))
  await user.click(screen.getByRole('button', { name: 'Edit step: Open document' }))
  await user.clear(screen.getByLabelText('Edit step description'))
  await user.type(screen.getByLabelText('Edit step description'), 'Find document')
  await user.click(screen.getByRole('button', { name: 'Save step' }))
  await user.click(await screen.findByRole('button', { name: 'Delete step: Find document' }))
  await waitFor(() => expect(screen.queryByText('Find document')).toBeNull())
  expect(api.deleteStep).toHaveBeenCalledWith('t1', 's1')
  await user.click(screen.getByRole('button', { name: 'Delete task', exact: true }))
  expect(api.deleteTask).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Delete task permanently' }))
  expect(await screen.findByText(/No tasks yet/)).toBeTruthy()
  expect(api.deleteTask).toHaveBeenCalledWith('user1', 't1')
})

test('load failures can be retried and failed completion keeps the current step', async () => {
  api.loadTasks.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ tasks: [task], supportsDetails: true })
  api.updateStep.mockRejectedValue(new Error('Permission denied'))
  const user = userEvent.setup()
  render(<TaskWorkspace userId="user1" />)
  expect(screen.getByRole('status').textContent).toContain('Loading')
  expect((await screen.findByRole('alert')).textContent).toContain('Offline')
  await user.click(screen.getByRole('button', { name: 'Reload tasks' }))
  await user.click(await screen.findByRole('button', { name: 'Write report' }))
  await user.click(screen.getByRole('button', { name: 'Mark step complete' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Permission denied')
  expect(within(screen.getByRole('region', { name: 'Your next step' })).getByText('Open document')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: 'Your next step' })).queryByText('Write one line')).toBeNull()
})

test('dashboard cards expose progress and support keyboard navigation into a task', async () => {
  api.loadTasks.mockResolvedValue({ tasks: [
    { ...task, steps: [{ ...first, is_complete: true }, second] },
    { id: 'empty', title: 'A new task', steps: [] },
    { id: 'done', title: 'Finished task', steps: [{ ...first, is_complete: true }] },
  ], supportsDetails: true })
  const user = userEvent.setup()
  render(<TaskWorkspace userId="user1" />)
  const card = await screen.findByRole('button', { name: 'Write report' })
  expect(document.getElementById(card.getAttribute('aria-describedby')).textContent).toContain('1/2 steps complete')
  expect(screen.getByText('0/0 steps complete')).toBeTruthy()
  expect(screen.getByText('1/1 steps complete')).toBeTruthy()
  card.focus()
  await user.keyboard('{Enter}')
  expect(within(await screen.findByRole('region', { name: 'Your next step' })).getByText('Write one line')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: 'Your next step' })).queryByText('Open document')).toBeNull()
  await user.click(screen.getByRole('button', { name: /Back to tasks/ }))
  expect(await screen.findByRole('navigation', { name: 'Your tasks' })).toBeTruthy()
})

test('card progress updates after completing a step and returning to dashboard', async () => {
  api.updateStep.mockResolvedValue({ ...first, is_complete: true })
  const user = userEvent.setup()
  await openTask(user)
  await user.click(screen.getByRole('button', { name: 'Mark step complete' }))
  await waitFor(() => expect(within(screen.getByRole('region', { name: 'Your next step' })).getByText('Write one line')).toBeTruthy())
  await user.click(screen.getByRole('button', { name: /Back to tasks/ }))
  expect(await screen.findByText('1/2 steps complete')).toBeTruthy()
})

test('all steps stay ordered and progress, checkmarks, and next highlight follow completion', async () => {
  api.updateStep.mockResolvedValueOnce({ ...first, is_complete: true }).mockResolvedValueOnce({ ...second, is_complete: true })
  const user = userEvent.setup()
  await openTask(user)
  const allSteps = screen.getByRole('region', { name: 'All steps' })
  const rows = () => within(allSteps).getAllByRole('listitem')
  expect(rows().map(row => row.querySelector('.step-description').textContent)).toEqual(['Open document', 'Write one line'])
  expect(rows()[0].getAttribute('aria-current')).toBe('step')
  expect(rows()[1].getAttribute('aria-current')).toBeNull()
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  await user.click(screen.getByRole('button', { name: 'Mark step complete' }))
  await waitFor(() => expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50'))
  expect(within(allSteps).getByText('1/2 steps complete')).toBeTruthy()
  expect(rows()[0].classList.contains('is-complete')).toBe(true)
  expect(within(rows()[0]).getByText('✓')).toBeTruthy()
  expect(within(rows()[0]).getByText('Complete')).toBeTruthy()
  expect(rows()[0].getAttribute('aria-current')).toBeNull()
  expect(rows()[1].getAttribute('aria-current')).toBe('step')
  await user.click(screen.getByRole('button', { name: 'Mark step complete' }))
  await waitFor(() => expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100'))
  expect(rows().every(row => row.classList.contains('is-complete'))).toBe(true)
  expect(allSteps.querySelector('[aria-current]')).toBeNull()
  expect(screen.queryByRole('region', { name: 'Your next step' })).toBeNull()
})

test('an empty task shows an empty list and zero progress without claiming completion', async () => {
  api.loadTasks.mockResolvedValue({ tasks: [{ ...task, steps: [] }], supportsDetails: true })
  const user = userEvent.setup()
  render(<TaskWorkspace userId="user1" />)
  await user.click(await screen.findByRole('button', { name: 'Write report' }))
  expect(screen.getByText('0/0 steps complete')).toBeTruthy()
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  expect(screen.queryByText(/All steps are finished/)).toBeNull()
  expect(screen.getByText('Your steps will appear here as you add them.')).toBeTruthy()
})

test('creates a task with optional description and a local due time', async () => {
  api.createTask.mockResolvedValue({ id: 'new', title: 'Report', description: 'A short report', due_at: '2026-11-01T17:00:00Z' })
  const user = userEvent.setup()
  render(<TaskWorkspace userId="user1" />)
  await user.type(await screen.findByLabelText('Task title'), 'Report')
  await user.click(screen.getByText('Add description or due date'))
  await user.type(screen.getByLabelText('Description (optional)'), 'A short report')
  // datetime-local is assigned directly because browser date controls do not type like text fields.
  const { fireEvent } = await import('@testing-library/react')
  fireEvent.change(screen.getByLabelText('Due date and time (optional)'), { target: { value: '2026-11-01T12:00' } })
  await user.click(screen.getByRole('button', { name: 'Create task' }))
  expect(api.createTask).toHaveBeenCalledWith('user1', 'Report', {
    description: 'A short report', due_at: new Date('2026-11-01T12:00').toISOString(), sort_position: 0,
  })
  expect(await screen.findByText('A short report')).toBeTruthy()
})

test('description and due date edits save and can be cleared', async () => {
  api.updateTask.mockResolvedValueOnce({ id: 't1', description: 'New context' }).mockResolvedValueOnce({ id: 't1', due_at: null })
  const user = userEvent.setup()
  api.loadTasks.mockResolvedValue({ tasks: [{ ...task, due_at: '2026-11-01T17:00:00Z' }], supportsDetails: true })
  render(<TaskWorkspace userId="user1" />)
  await user.click(await screen.findByRole('button', { name: 'Write report' }))
  await user.click(screen.getByRole('button', { name: 'Edit description' }))
  await user.type(screen.getByLabelText('Description'), 'New context')
  await user.click(screen.getByRole('button', { name: 'Save details' }))
  expect(await screen.findByText('New context')).toBeTruthy()
  expect(api.updateTask).toHaveBeenNthCalledWith(1, 'user1', 't1', { description: 'New context' })
  await user.click(screen.getByRole('button', { name: 'Edit due date' }))
  const { fireEvent } = await import('@testing-library/react')
  fireEvent.change(screen.getByLabelText('Due date and time'), { target: { value: '' } })
  await user.click(screen.getByRole('button', { name: 'Save details' }))
  expect(await screen.findByText('No due date')).toBeTruthy()
  expect(api.updateTask).toHaveBeenNthCalledWith(2, 'user1', 't1', { due_at: null })
})

const reorderFixtures = [task, { id: 't2', title: 'Second task', steps: [] }]
test('keyboard handles save custom ordering and preserve handle focus', async () => {
  api.loadTasks.mockResolvedValue({ tasks: reorderFixtures, supportsDetails: true })
  api.reorderTasks.mockResolvedValue(null)
  const user = userEvent.setup()
  render(<TaskWorkspace userId="user1" />)
  const handle = await screen.findByRole('button', { name: 'Reorder Write report' })
  handle.focus()
  await user.keyboard('{ArrowDown}')
  expect(api.reorderTasks).toHaveBeenCalledWith(['t2', 't1'])
  await waitFor(() => expect(document.querySelectorAll('[data-task-id]')[0].dataset.taskId).toBe('t2'))
  expect(document.activeElement).toBe(handle)
  expect(screen.getByRole('status').textContent).toContain('position 2 of 2')
})

test('pointer handle drop saves ordering; a failed save keeps the previous order', async () => {
  api.loadTasks.mockResolvedValue({ tasks: reorderFixtures, supportsDetails: true })
  api.reorderTasks.mockRejectedValue(new Error('Offline'))
  const { fireEvent } = await import('@testing-library/react')
  render(<TaskWorkspace userId="user1" />)
  const handle = await screen.findByRole('button', { name: 'Reorder Write report' })
  handle.setPointerCapture = vi.fn()
  const originalHitTest = document.elementFromPoint
  document.elementFromPoint = vi.fn(() => document.querySelector('[data-task-id="t2"]'))
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1 })
  fireEvent.pointerUp(handle, { clientX: 20, clientY: 20, pointerId: 1 })
  expect((await screen.findByRole('alert')).textContent).toContain('Offline')
  expect(api.reorderTasks).toHaveBeenCalledWith(['t2', 't1'])
  expect(document.querySelectorAll('[data-task-id]')[0].dataset.taskId).toBe('t1')
  document.elementFromPoint = originalHitTest
})

test('before migration, title-only tasks still work and new fields and handles are unavailable', async () => {
  api.loadTasks.mockResolvedValue({ tasks: reorderFixtures, supportsDetails: false })
  api.createTask.mockResolvedValue({ id: 'new', title: 'Legacy task' })
  const user = userEvent.setup()
  render(<TaskWorkspace userId="user1" />)
  expect(await screen.findByText(/Apply the task details migration/)).toBeTruthy()
  expect(screen.queryByText('Add description or due date')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Reorder Write report' })).toBeNull()
  await user.type(screen.getByLabelText('Task title'), 'Legacy task')
  await user.click(screen.getByRole('button', { name: 'Create task' }))
  expect(api.createTask).toHaveBeenCalledWith('user1', 'Legacy task', undefined)
  expect(await screen.findByRole('heading', { name: 'Legacy task' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Edit description' })).toBeNull()
})

test('focus keeps the current step visible, hides other steps, and resets for the next step', async () => {
  api.updateStep.mockResolvedValue({ ...first, is_complete: true })
  const user = userEvent.setup()
  await openTask(user)
  await user.click(screen.getByRole('button', { name: 'Start 5-minute focus' }))
  expect(within(screen.getByRole('region', { name: 'Your next step' })).getByText('Open document')).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'All steps' })).toBeNull()
  expect(screen.queryByText('Write one line')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Pause' }))
  expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Reset timer' }))
  expect(screen.getByRole('region', { name: 'All steps' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Start 5-minute focus' }))
  await user.click(screen.getByRole('button', { name: 'Mark step complete' }))
  expect(await screen.findByRole('button', { name: 'Start 5-minute focus' })).toBeTruthy()
  expect(screen.getByRole('timer').textContent).toBe('5:00')
  expect(within(screen.getByRole('region', { name: 'Your next step' })).getByText('Write one line')).toBeTruthy()
})
