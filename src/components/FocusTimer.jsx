import { useEffect, useRef, useState } from 'react'

const FIVE_MINUTES = 5 * 60 * 1000

export default function FocusTimer({ onFocusChange }) {
  const [remaining, setRemaining] = useState(FIVE_MINUTES)
  const [phase, setPhase] = useState('idle')
  const deadline = useRef(null)

  useEffect(() => {
    onFocusChange(phase === 'running' || phase === 'paused')
  }, [phase, onFocusChange])
  useEffect(() => () => onFocusChange(false), [onFocusChange])

  useEffect(() => {
    if (phase !== 'running') return
    function tick() {
      const next = Math.max(0, deadline.current - Date.now())
      setRemaining(next)
      if (next === 0) setPhase('finished')
    }
    // Use a deadline so background-tab throttling doesn't extend the timer.
    const interval = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    tick()
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [phase])

  function start() {
    deadline.current = Date.now() + remaining
    setPhase('running')
  }
  function pause() {
    const next = Math.max(0, deadline.current - Date.now())
    setRemaining(next)
    setPhase(next ? 'paused' : 'finished')
  }
  function reset() {
    deadline.current = null
    setRemaining(FIVE_MINUTES)
    setPhase('idle')
  }
  const seconds = Math.ceil(remaining / 1000)
  const display = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return <section className="focus-timer" aria-labelledby="focus-timer-heading">
    <h4 id="focus-timer-heading">Just start · 5 minutes</h4>
    <span className="timer-digits" role="timer" aria-label="Time remaining" aria-live="off">{display}</span>
    <div className="timer-actions">
      {phase === 'idle' && <button className="secondary-button" onClick={start}>Start 5-minute focus</button>}
      {phase === 'running' && <button className="secondary-button" onClick={pause}>Pause</button>}
      {phase === 'paused' && <button className="secondary-button" onClick={start}>Resume</button>}
      {phase !== 'idle' && <button className="text-button" onClick={reset}>Reset timer</button>}
    </div>
    <p className="timer-message" role="status">{phase === 'finished'
      ? 'Five minutes, one small start. You can keep going or take a break.'
      : phase === 'paused' ? 'Paused. Take the time you need.'
        : phase === 'running' ? 'Just this step. You can pause or stop whenever you need.' : 'An optional little space to begin.'}</p>
  </section>
}
