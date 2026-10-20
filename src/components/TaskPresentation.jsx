export function Icon({ name }) {
  const paths = {
    pencil: 'm16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  }
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

export function localDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function DueDate({ value }) {
  return value ? <time dateTime={value}>Due {new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time> : <span>No due date</span>
}

export function OptionalTaskFields({ description, due, onDescription, onDue }) {
  return <>
    <label htmlFor="task-description">Description (optional)</label>
    <textarea id="task-description" rows={3} value={description} onChange={e => onDescription(e.target.value)} />
    <label htmlFor="task-due">Due date and time (optional)</label>
    <input id="task-due" type="datetime-local" value={due} onChange={e => onDue(e.target.value)} />
    <small>Times use your local time zone.</small>
  </>
}
