import Icon from './Icon.jsx'

/** Sidebar group for the imported audit: the Still needed view and its options. */
export default function DegreeWorks({ audit, planView, onPlanView, hideTaken, onHideTaken, neededCount, onImport, onRemove }) {
  if (!audit) {
    return (
      <div className="nav-group">
        <div className="nav-label">Degree Works</div>
        <button type="button" className="nav-item" onClick={onImport}>
          <Icon name="inbox" size={15} />
          <span>Import your audit</span>
        </button>
        <p className="nav-empty">See only the courses you still need, with taken classes hidden.</p>
      </div>
    )
  }

  return (
    <div className="nav-group">
      <div className="nav-label">Degree Works</div>
      <button
        type="button"
        className={planView ? 'nav-item view on' : 'nav-item view'}
        aria-pressed={planView}
        onClick={() => onPlanView(!planView)}
      >
        <Icon name="check" size={15} />
        <span>Still needed</span>
        <span className="nav-count">{neededCount ?? ''}</span>
      </button>
      <label className="nav-item toggle">
        <Icon name="layers" size={15} />
        <span>Hide courses I&apos;ve taken</span>
        <input type="checkbox" role="switch" checked={hideTaken} onChange={(e) => onHideTaken(e.target.checked)} />
        <i className="switch" aria-hidden="true" />
      </label>
      <div className="nav-meta">
        <span>{audit.degree ?? 'Audit'}{audit.auditDate ? ` · ${audit.auditDate}` : ''}</span>
        <button type="button" className="link-sm" onClick={onImport}>Update</button>
        <button type="button" className="link-sm" onClick={onRemove}>Remove</button>
      </div>
    </div>
  )
}
