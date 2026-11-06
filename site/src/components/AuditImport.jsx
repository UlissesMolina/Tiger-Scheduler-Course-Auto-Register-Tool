import { useMemo, useState } from 'react'
import { parseAudit } from '../lib/degreeworks.js'
import Icon from './Icon.jsx'

/** Paste-in dialog for a Degree Works audit. Parsing happens here, in the browser. */
export default function AuditImport({ onSave, onClose }) {
  const [text, setText] = useState('')

  const result = useMemo(() => {
    if (!text.trim()) return null
    try {
      return { audit: parseAudit(text) }
    } catch (e) {
      return { error: e.message }
    }
  }, [text])

  const audit = result?.audit
  const ready = audit && audit.needed.length > 0

  return (
    <div className="palette-scrim" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="audit-title" onMouseDown={(e) => e.stopPropagation()}>
        <header className="dialog-head">
          <h2 id="audit-title">Import Degree Works audit</h2>
          <button type="button" className="ghost-icon" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
        </header>

        <ol className="steps">
          <li>Open your audit in Degree Works (from AU Access)</li>
          <li>Press <kbd>Ctrl</kbd> <kbd>A</kbd>, then <kbd>Ctrl</kbd> <kbd>C</kbd> to copy the whole page</li>
          <li>Paste it below</li>
        </ol>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="Paste your audit here…"
          spellCheck={false}
          aria-label="Degree Works audit text"
        />

        {result?.error && <p className="dialog-note error-text">{result.error}</p>}
        {audit && (
          <div className="audit-summary">
            <span><b>{audit.needed.length}</b> requirement{audit.needed.length === 1 ? '' : 's'} still needed</span>
            <span><b>{Object.keys(audit.taken).length}</b> taken</span>
            <span><b>{Object.keys(audit.inProgress).length}</b> in progress</span>
            {audit.auditDate && <span className="faint">Audit from {audit.auditDate}</span>}
          </div>
        )}
        {audit && !ready && <p className="dialog-note">Nothing is listed as still needed in this audit.</p>}

        <p className="dialog-note privacy">
          <Icon name="check" size={13} />
          Read in your browser and never uploaded. Only requirements and course codes are kept;
          your name, student ID, GPA and grades are discarded.
        </p>

        <footer className="dialog-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={!ready} onClick={() => onSave(audit)}>
            Import
          </button>
        </footer>
      </div>
    </div>
  )
}
