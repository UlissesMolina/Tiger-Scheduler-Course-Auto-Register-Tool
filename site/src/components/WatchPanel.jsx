import { useState } from 'react'
import Icon from './Icon.jsx'

/** Floating dock with the watch list, exported as the COURSES= line the seat watcher reads from .env. */
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
      // clipboard blocked; the line is in the button's title
    }
  }

  return (
    <aside className="watch-dock" aria-label="Watched courses">
      <span className="dock-label"><Icon name="star" size={15} filled /><span>Watching</span></span>
      <div className="dock-list">
        {watched.map((code) => (
          <button key={code} type="button" className="dock-chip" onClick={() => onRemove(code)} title={`Stop watching ${code}`}>
            {code}
            <Icon name="x" size={12} />
          </button>
        ))}
      </div>
      <button type="button" className="dock-copy" onClick={copy} title={line}>
        <Icon name={copied ? 'check' : 'copy'} size={14} />
        {copied ? 'Copied' : 'Copy .env'}
      </button>
    </aside>
  )
}
