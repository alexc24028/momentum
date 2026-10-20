import { beforeEach, expect, test, vi } from 'vitest'
import { createTask, loadTasks, reorderTasks, updateTask } from './tasks'
const { supabase } = vi.hoisted(() => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))
vi.mock('./supabase', () => ({ supabase }))
const requests = []
const responses = []
beforeEach(() => {
  vi.resetAllMocks()
  requests.length = 0
  responses.length = 0
  supabase.from.mockImplementation(table => {
    const response = responses.shift()
    const query = { table }
    for (const method of ['select', 'eq', 'order', 'insert', 'update', 'single']) {
      query[method] = vi.fn(() => query)
    }
    query.then = (resolve, reject) => Promise.resolve(response).then(resolve, reject)
    requests.push(query)
    return query
  })
})

test('loads custom order only for the signed-in owner', async () => {
  responses.push({ data: [{ id: 'task' }], error: null })
  expect(await loadTasks('owner')).toEqual({ tasks: [{ id: 'task' }], supportsDetails: true })
  expect(requests[0].eq).toHaveBeenCalledWith('user_id', 'owner')
  expect(requests[0].order).toHaveBeenNthCalledWith(1, 'sort_position')
})

test('missing new columns falls back to original schema without losing tasks', async () => {
  responses.push({ error: { code: '42703', message: 'column tasks.sort_position does not exist' } }, { data: [{ id: 'existing' }], error: null })
  expect(await loadTasks('owner')).toEqual({ tasks: [{ id: 'existing' }], supportsDetails: false })
  expect(requests[1].select.mock.calls[0][0]).not.toContain('due_at')
  expect(requests[1].eq).toHaveBeenCalledWith('user_id', 'owner')
})

test('permission and network errors are not mistaken for a missing migration', async () => {
  const error = { code: '42501', message: 'Permission denied' }
  responses.push({ error })
  await expect(loadTasks('owner')).rejects.toEqual(error)
  expect(requests).toHaveLength(1)
})

test('title-only inserts remain compatible and metadata updates retain owner scope', async () => {
  responses.push({ data: { id: 'task' }, error: null }, { data: { id: 'task', description: null }, error: null })
  await createTask('owner', 'Task')
  expect(requests[0].insert).toHaveBeenCalledWith({ user_id: 'owner', title: 'Task' })
  await updateTask('owner', 'task', { description: null, due_at: null })
  expect(requests[1].update).toHaveBeenCalledWith({ description: null, due_at: null })
  expect(requests[1].eq).toHaveBeenCalledWith('user_id', 'owner')
})

test('reordering uses one atomic RPC and reports a missing migration helpfully', async () => {
  supabase.rpc.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { code: 'PGRST202' } })
  await reorderTasks(['second', 'first'])
  expect(supabase.rpc).toHaveBeenCalledWith('reorder_tasks', { task_ids: ['second', 'first'] })
  await expect(reorderTasks(['first'])).rejects.toThrow('20261020010000_task_details_and_order.sql')
})
