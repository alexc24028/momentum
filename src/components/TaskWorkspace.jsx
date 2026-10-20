import { useEffect, useRef, useState } from 'react'
import * as api from '../lib/tasks'
import FocusTimer from './FocusTimer'
import { Icon, DueDate, OptionalTaskFields, localDateTime } from './TaskPresentation'

const ordered = steps => [...steps].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))

export default function TaskWorkspace({ userId }) {
  const [tasks, setTasks] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [focusing, setFocusing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [editingTask, setEditingTask] = useState(false)
  const [editingStep, setEditingStep] = useState(null)
  const [managing, setManaging] = useState(false)
  const [stepsExpanded, setStepsExpanded] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const deleteTrigger = useRef(null)
  const [supportsDetails, setSupportsDetails] = useState(false)
  const [taskDescription, setTaskDescription] = useState('')
  const [due, setDue] = useState('')
  const [draggedId, setDraggedId] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const dragSource = useRef(null)
  const handleRefs = useRef(new Map())
  const pendingHandleFocus = useRef(null)
  const task = tasks.find(item => item.id === selectedId)
  const pendingDelete = tasks.find(item => item.id === deletingId)
  const steps = ordered(task?.steps ?? [])
  const current = steps.find(step => !step.is_complete)
  const completed = steps.filter(step => step.is_complete).length

  useEffect(() => {
    if (!busy && pendingHandleFocus.current) {
      handleRefs.current.get(pendingHandleFocus.current)?.focus()
      pendingHandleFocus.current = null
    }
  }, [busy])

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadFailed(false)
    setError('')
    api.loadTasks(userId).then(({ tasks: data, supportsDetails }) => {
      if (active) {
        setTasks(data.map(task => ({ ...task, steps: task.steps ?? [] })))
        setSupportsDetails(supportsDetails)
      }
    }).catch(err => {
      if (active) {
        setLoadFailed(true)
        setError(`Couldn’t load your tasks. ${err.message || 'Please try again.'}`)
      }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId, reload])

  function openTask(id) {
    setSelectedId(id)
    setStepsExpanded(false)
    setFocusing(false)
    setTaskDescription('')
    setDue('')
    setTitle('')
    setDescription('')
    setEditingTask(false)
    setEditingStep(null)
    setManaging(false)
    setDeletingId(null)
    setError('')
    setMessage('')
  }

  async function save(action) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try { await action() } catch (err) {
      setError(`Couldn’t save that change. ${err.message || 'Please try again.'}`)
    } finally { setBusy(false) }
  }

  function replaceTask(next) {
    setTasks(items => items.map(item => item.id === task.id ? { ...item, ...next } : item))
  }

  function submitTask(event) {
    event.preventDefault()
    if (!title.trim()) { setError('Enter a task title.'); return }
    save(async () => {
      if (editingTask) {
        const values = { title: title.trim(), ...(supportsDetails ? {
          description: taskDescription.trim() || null,
          due_at: due ? new Date(due).toISOString() : null,
        } : {}) }
        const updated = await api.updateTask(userId, task.id, values)
        replaceTask(updated)
        setEditingTask(false)
        setTitle('')
      } else {
        const details = supportsDetails ? {
          description: taskDescription.trim() || null,
          due_at: due ? new Date(due).toISOString() : null,
          sort_position: tasks.length ? Math.max(...tasks.map(item => item.sort_position ?? 0)) + 1 : 0,
        } : undefined
        const created = await api.createTask(userId, title.trim(), details)
        setTasks(items => [...items, { ...created, steps: [] }])
        openTask(created.id)
      }
    })
  }

  function submitStep(event) {
    event.preventDefault()
    if (!description.trim()) { setError('Enter a step description.'); return }
    save(async () => {
      if (editingStep) {
        const updated = await api.updateStep(task.id, editingStep, { description: description.trim() })
        replaceTask({ steps: steps.map(step => step.id === updated.id ? updated : step) })
      } else {
        const position = steps.length ? Math.max(...steps.map(step => step.position)) + 1 : 0
        const created = await api.createStep(task.id, description.trim(), position)
        replaceTask({ steps: [...steps, created] })
      }
      setDescription('')
      setEditingStep(null)
    })
  }

  function moveTask(id, targetIndex) {
    if (busy || !supportsDetails) return
    const from = tasks.findIndex(item => item.id === id)
    if (from < 0 || targetIndex < 0 || targetIndex >= tasks.length || from === targetIndex) return
    const next = [...tasks]
    next.splice(targetIndex, 0, next.splice(from, 1)[0])
    save(async () => {
      await api.reorderTasks(next.map(item => item.id))
      setTasks(next.map((item, index) => ({ ...item, sort_position: index })))
      setMessage(`${tasks[from].title} moved to position ${targetIndex + 1} of ${tasks.length}.`)
      pendingHandleFocus.current = id
    })
  }

  function requestDelete(event, item) {
    event.stopPropagation()
    deleteTrigger.current = event.currentTarget
    setDeletingId(item.id)
    setError('')
  }

  function cancelDelete() {
    setDeletingId(null)
    setError('')
    deleteTrigger.current?.focus()
  }

  const deleteConfirmation = pendingDelete && <div className="notice delete-confirmation" role="group" aria-label="Delete task confirmation">
    <p>Delete “{pendingDelete.title}” and all its steps? This cannot be undone.</p>
    <div className="delete-confirmation-actions">
      <button onClick={() => save(async () => {
        await api.deleteTask(userId, pendingDelete.id)
        setTasks(items => items.filter(item => item.id !== pendingDelete.id))
        if (selectedId === pendingDelete.id) openTask(null)
        else setDeletingId(null)
      })}>Delete task permanently</button>
      <button className="text-button" autoFocus onClick={cancelDelete}>Cancel deletion</button>
    </div>
  </div>

  if (loading) return <p role="status">Loading your tasks…</p>
  if (loadFailed) return <section className="task-workspace">
    <p role="alert" className="notice error">{error}</p>
    <button onClick={() => setReload(value => value + 1)}>Reload tasks</button>
  </section>

  return <section className={`task-workspace ${task ? 'task-detail' : ''}`} aria-label="Break It Down" aria-busy={busy}>
    {error && <p role="alert" className="notice error">{error}</p>}
    {message && <p role="status" className="sr-only">{message}</p>}
    {!supportsDetails && <p className="notice" role="status">{api.migrationMessage}</p>}
    <fieldset disabled={busy}>
      {!task ? <>
        <form className="task-entry" onSubmit={submitTask}>
          <label htmlFor="task-title">Task title</label>
          <div className="task-entry-row">
            <input id="task-title" placeholder="What would you like to get started on?" value={title} onChange={e => setTitle(e.target.value)} required />
            <button type="submit" aria-label="Create task"><span aria-hidden="true">+ </span>Add task</button>
          </div>
          {supportsDetails && <details className="optional-details"><summary>Add description or due date</summary>
            <OptionalTaskFields description={taskDescription} due={due} onDescription={setTaskDescription} onDue={setDue} />
          </details>}
        </form>
        <h2 className="tasks-heading">Your tasks</h2>
        {deleteConfirmation}
        {!tasks.length && <div className="empty-tasks"><h3>A fresh place to begin.</h3><p>No tasks yet. What would you like to make a little easier?</p></div>}
        {supportsDetails && tasks.length > 1 && <p className="reorder-help" id="reorder-help">Drag a handle to reorder. With the keyboard, focus a handle and use arrow keys to move a task.</p>}
        {tasks.length > 0 && <nav aria-label="Your tasks" className="task-list">{tasks.map((item, index) => {
          const total = item.steps.length
          const complete = item.steps.filter(step => step.is_complete).length
          return <article className={`task-card ${draggedId === item.id ? 'is-dragging' : ''} ${dropTargetId === item.id && draggedId !== item.id ? 'is-drop-target' : ''}`} data-task-id={item.id} key={item.id}>
            {supportsDetails && tasks.length > 1 && <button type="button" className="drag-handle icon-button" aria-label={`Reorder ${item.title}`} aria-describedby="reorder-help" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
              ref={node => { if (node) handleRefs.current.set(item.id, node); else handleRefs.current.delete(item.id) }}
              onKeyDown={event => {
                const delta = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[event.key]
                if (delta) { event.preventDefault(); moveTask(item.id, index + delta) }
              }}
              onPointerDown={event => {
                if (event.button !== 0 || busy) return
                dragSource.current = item.id
                setDraggedId(item.id)
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={event => {
                if (!dragSource.current) return
                setDropTargetId(document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-task-id]')?.dataset.taskId ?? null)
              }}
              onPointerUp={event => {
                const source = dragSource.current
                dragSource.current = null
                setDraggedId(null)
                setDropTargetId(null)
                const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-task-id]')?.dataset.taskId
                if (source && target) moveTask(source, tasks.findIndex(item => item.id === target))
              }}
              onPointerCancel={() => { dragSource.current = null; setDraggedId(null); setDropTargetId(null) }}>
              <Icon name="grip" />
            </button>}
            <button type="button" className="icon-button delete-task card-delete" aria-label={`Delete ${item.title}`} title={`Delete ${item.title}`}
              onPointerDown={event => event.stopPropagation()} onClick={event => requestDelete(event, item)}>
              <Icon name="trash" />
            </button>
            <button className="task-card-open" aria-label={item.title} aria-describedby={`progress-${item.id}`} onClick={() => openTask(item.id)}>
            <span className="card-title">{item.title}</span>
            {item.description && <span className="card-description">{item.description}</span>}
            {item.due_at && <span className="card-due"><DueDate value={item.due_at} /></span>}
            <span className="card-footer" id={`progress-${item.id}`}>
              <span className="step-count">{complete}/{total} steps complete</span>
              <span className="progress-track" aria-hidden="true"><span style={{ width: `${total ? complete / total * 100 : 0}%` }} /></span>
            </span>
            </button>
          </article>
        })}</nav>}
        {error && <button className="text-button" onClick={() => setReload(value => value + 1)}>Reload tasks</button>}
      </> : <>
        <div className="task-detail-heading">
          <h2 className="task-title">{task.title}</h2>
          <button className="icon-button" aria-label="Edit task" title="Edit task" onClick={() => {
            setEditingTask(true)
            setTitle(task.title)
            setTaskDescription(task.description ?? '')
            setDue(localDateTime(task.due_at))
            setError('')
          }}><Icon name="pencil" /></button>
          <button className="icon-button delete-task" aria-label="Delete task" title="Delete task" onClick={event => requestDelete(event, task)}><Icon name="trash" /></button>
        </div>
        {supportsDetails && !focusing && !editingTask && (task.description || task.due_at) && <div className="task-metadata">
          {task.description && <p className="task-description">{task.description}</p>}
          {task.due_at && <DueDate value={task.due_at} />}
        </div>}
        {pendingDelete ? deleteConfirmation : editingTask ? <form onSubmit={submitTask}>
          <label htmlFor="task-title">Task title</label>
          <input id="task-title" autoFocus required value={title} onChange={e => setTitle(e.target.value)} />
          {supportsDetails && <OptionalTaskFields description={taskDescription} due={due} onDescription={setTaskDescription} onDue={setDue} />}
          <div className="edit-actions">
            <button>Save task</button>
            <button type="button" className="text-button" onClick={() => { setEditingTask(false); setTitle(''); setTaskDescription(''); setDue(''); setError('') }}>Cancel</button>
          </div>
        </form> : <>
          {current ? <div className="current-step" role="region" aria-label="Your next step">
            <h3>Your next step</h3>
            <p>{current.description}</p>
            <div className="focus-action-row">
              <button className="complete-step-button" onClick={() => save(async () => {
                const updated = await api.updateStep(task.id, current.id, { is_complete: true })
                replaceTask({ steps: steps.map(step => step.id === updated.id ? updated : step) })
              })}>Complete step</button>
              <FocusTimer key={current.id} onFocusChange={setFocusing} />
            </div>
          </div> : <p role="status">{steps.length ? 'All steps are finished. Take a moment to enjoy that.' : 'No steps yet. Add a small, actionable first step.'}</p>}
          {!focusing && <section className="all-steps" aria-labelledby="all-steps-heading">
            <h3 className="all-steps-title">
              <button type="button" className="all-steps-toggle" aria-label="All steps" aria-describedby="all-steps-count"
                aria-expanded={stepsExpanded} aria-controls="all-steps-panel" onClick={() => setStepsExpanded(value => !value)}>
                <span id="all-steps-heading">All steps</span>
                <span id="all-steps-count" className="step-count" aria-live="polite" aria-atomic="true">{completed}/{steps.length} steps complete</span>
                <svg className="accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            </h3>
            <div className="progress-track" role="progressbar" aria-label="Step completion" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={steps.length ? Math.round(completed / steps.length * 100) : 0}
              aria-valuetext={`${completed} of ${steps.length} steps complete`}>
              <span style={{ width: `${steps.length ? completed / steps.length * 100 : 0}%` }} />
            </div>
            <div id="all-steps-panel" hidden={!stepsExpanded}>
              {managing ? <>
                <h3>Edit your steps</h3>
                {!steps.length && <p>No steps yet.</p>}
                <ul className="step-list">{steps.map(step => <li key={step.id}>
                  <span>{step.description}{step.is_complete ? ' — complete' : ''}</span>
                  <button className="text-button" onClick={() => { setEditingStep(step.id); setDescription(step.description) }}>Edit step: {step.description}</button>
                  <button className="text-button" onClick={() => save(async () => {
                    await api.deleteStep(task.id, step.id)
                    replaceTask({ steps: steps.filter(item => item.id !== step.id) })
                    if (editingStep === step.id) { setEditingStep(null); setDescription('') }
                  })}>Delete step: {step.description}</button>
                </li>)}</ul>
                <button className="text-button" onClick={() => { setManaging(false); setEditingStep(null); setDescription('') }}>Return to step list</button>
              </> : <>
                {steps.length ? <ol className="all-steps-list">{steps.map((step, index) =>
                  <li key={step.id} className={step.is_complete ? 'is-complete' : step.id === current?.id ? 'is-current' : ''}
                    aria-current={step.id === current?.id ? 'step' : undefined}>
                    <span className="step-marker" aria-hidden="true">{step.is_complete ? '✓' : index + 1}</span>
                    <span className="step-description">{step.description}</span>
                    <span className="step-state">{step.is_complete ? 'Complete' : step.id === current?.id ? 'Next' : 'Upcoming'}</span>
                  </li>)}</ol> : <p>Your steps will appear here as you add them.</p>}
              </>}
              <form onSubmit={submitStep}>
                <label htmlFor="step-description">{editingStep ? 'Edit step description' : 'Add a small step'}</label>
                <input id="step-description" required value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Open the document" />
                <button className="secondary-button" type="submit">{editingStep ? 'Save step' : 'Add step'}</button>
                {editingStep && <button className="text-button" type="button" onClick={() => { setEditingStep(null); setDescription('') }}>Cancel step edit</button>}
              </form>
              {!managing && <button className="text-button" onClick={() => setManaging(true)}>Edit or delete steps</button>}
            </div>
          </section>}
        </>}
      </>}
      {task && <footer className="task-detail-footer"><button className="back-button" onClick={() => openTask(null)}>← Back to tasks</button></footer>}
    </fieldset>
    {busy && <p role="status">Saving…</p>}
  </section>
}
