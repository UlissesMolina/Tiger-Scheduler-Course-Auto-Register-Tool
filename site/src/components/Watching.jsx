import { useState } from 'react'
import Icon from './Icon.jsx'

/** The watch list as a sidebar group, like Linear's favorites, plus the COURSES= line for the seat watcher. */
export default function Watching({ watched, onRemove, onPick }) {
  const [copied, setCopied] = useState(false)
  const line = `COURSES=${watched.join(',')}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(line)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked; the line is in the item's title
    }
  }

  return (
    <div className="nav-group">
      <div className="nav-label">Watching</div>
      {!watched.length && <p className="nav-empty">Star a course to watch it, then copy the list into the seat watcher.</p>}
      {watched.map((code) => (
        <div key={code} className="nav-item watched">
          <button type="button" className="watched-name" onClick={() => onPick(code)} title={`Show ${code}`}>
            <Icon name="star" size={14} filled />
            <span>{code}</span>
          </button>
          <button type="button" className="remove" onClick={() => onRemove(code)} aria-label={`Stop watching ${code}`}>
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
      {watched.length > 0 && (
        <button type="button" className="nav-item subtle" onClick={copy} title={line}>
          <Icon name={copied ? 'check' : 'copy'} size={14} />
          <span>{copied ? 'Copied' : 'Copy .env line'}</span>
        </button>
      )}
    </div>
  )
}
