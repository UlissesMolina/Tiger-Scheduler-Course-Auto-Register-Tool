import Icon from './Icon.jsx'

const KINDS = [
  ['required', 'Required'],
  ['elective', 'Possible electives'],
  ['core', 'Core'],
]

export default function MajorPicker({ majors, majorId, onMajor, kinds, onToggleKind, counts }) {
  if (!majors.length) return null
  const major = majors.find((m) => m.id === majorId)

  return (
    <div className="nav-group">
      <div className="nav-label">Major</div>
      <label className="nav-select">
        <Icon name="book" size={15} />
        <select value={majorId} onChange={(e) => onMajor(e.target.value)} aria-label="Major">
          <option value="">All courses</option>
          {majors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <Icon name="chevron" size={13} className="caret" />
      </label>
      {major && (
        <>
          {KINDS.map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className={kinds[kind] ? `nav-item kind ${kind} on` : `nav-item kind ${kind}`}
              aria-pressed={kinds[kind]}
              onClick={() => onToggleKind(kind)}
            >
              <i className="dot" aria-hidden="true" />
              <span>{label}</span>
              <span className="nav-count">{counts?.[kind] ?? ''}</span>
            </button>
          ))}
          <a className="nav-item subtle" href={major.url} target="_blank" rel="noreferrer">
            <Icon name="external" size={14} />
            <span>Official curriculum</span>
          </a>
        </>
      )}
    </div>
  )
}
