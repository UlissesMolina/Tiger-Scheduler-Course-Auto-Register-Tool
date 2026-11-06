import { useState } from 'react'

/** The watch list, exported as the COURSES= line the auto-register tool reads from .env. */
export default function WatchPanel({ watched, onRemove }) {
  const [copied, setCopied] = useState(false)
  if (!watched.length) return null
  const line = `COURSES=${watched.join(',')}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(line)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked; the line is selectable
    }
  }

  return (
    <aside className="watch-panel" aria-label="Watched courses">
      <div className="watch-list">
        <strong>Watching</strong>
        {watched.map((code) => (
          <button key={code} type="button" className="chip on" onClick={() => onRemove(code)} title="Stop watching">
            {code} ✕
          </button>
        ))}
      </div>
      <div className="env-line">
        <code>{line}</code>
        <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy for .env'}</button>
      </div>
    </aside>
  )
}
