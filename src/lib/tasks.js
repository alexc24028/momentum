import { supabase } from './supabase'

export const migrationMessage = 'Task descriptions, due dates, and saved ordering need the new database migration. Apply 20261020010000_task_details_and_order.sql, then reload this page.'
const baseFields = 'id,title,created_at,steps(id,task_id,description,is_complete,position)'
const isMissingDetails = error => ['42703', 'PGRST204'].includes(error?.code)
  && /description|due_at|sort_position/.test(error.message || '')

async function checked(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function loadTasks(userId) {
  const result = await supabase.from('tasks').select(`${baseFields},description,due_at,sort_position`)
    .eq('user_id', userId).order('sort_position').order('created_at', { ascending: false }).order('id')
  if (!result.error) return { tasks: result.data, supportsDetails: true }
  if (!isMissingDetails(result.error)) throw result.error
  const tasks = await checked(supabase.from('tasks').select(baseFields)
    .eq('user_id', userId).order('created_at', { ascending: false }).order('id'))
  return { tasks, supportsDetails: false }
}
export function createTask(userId, title, details) {
  return checked(supabase.from('tasks').insert({ user_id: userId, title, ...details }).select('*').single())
}
export function updateTask(userId, id, values) {
  return checked(supabase.from('tasks').update(typeof values === 'string' ? { title: values } : values)
    .eq('id', id).eq('user_id', userId).select('*').single())
}
export function deleteTask(userId, id) {
  return checked(supabase.from('tasks').delete().eq('id', id).eq('user_id', userId).select('id').single())
}
export async function reorderTasks(ids) {
  try { return await checked(supabase.rpc('reorder_tasks', { task_ids: ids })) } catch (error) {
    if (error.code === 'PGRST202') throw new Error(migrationMessage)
    throw error
  }
}
export function createStep(taskId, description, position) {
  return checked(supabase.from('steps').insert({ task_id: taskId, description, position }).select().single())
}
export function updateStep(taskId, id, values) {
  return checked(supabase.from('steps').update(values).eq('id', id).eq('task_id', taskId).select().single())
}
export function deleteStep(taskId, id) {
  return checked(supabase.from('steps').delete().eq('id', id).eq('task_id', taskId).select('id').single())
}
