import Icon from './Icon.jsx'

const KINDS = [
  ['required', 'Required'],
  ['elective', 'Electives'],
  ['core', 'Core'],
]

export default function MajorPicker({ majors, majorId, onMajor, kinds, onToggleKind }) {
  if (!majors.length) return null
  const major = majors.find((m) => m.id === majorId)

  return (
    <section className="panel-section major-picker">
      <label className="field">
        <span className="h3">Major</span>
        <select value={majorId} onChange={(e) => onMajor(e.target.value)}>
          <option value="">All courses</option>
          {majors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      {major && (
        <>
          <div className="kinds" role="group" aria-label="Show">
            {KINDS.map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className={kinds[kind] ? `kind on ${kind}` : 'kind'}
                aria-pressed={kinds[kind]}
                onClick={() => onToggleKind(kind)}
              >
                <i aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <a className="curriculum" href={major.url} target="_blank" rel="noreferrer">
            Official curriculum <Icon name="external" size={13} />
          </a>
        </>
      )}
    </section>
  )
}
