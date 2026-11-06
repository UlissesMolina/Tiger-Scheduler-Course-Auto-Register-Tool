const KINDS = [
  ['required', 'Required'],
  ['elective', 'Electives'],
  ['core', 'Core'],
]

export default function MajorPicker({ majors, majorId, onMajor, kinds, onToggleKind }) {
  if (!majors.length) return null
  const major = majors.find((m) => m.id === majorId)

  return (
    <div className="major-picker">
      <label>
        Major
        <select value={majorId} onChange={(e) => onMajor(e.target.value)}>
          <option value="">All courses</option>
          {majors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      {major && (
        <>
          <span className="kinds" role="group" aria-label="Show">
            {KINDS.map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className={kinds[kind] ? `chip on ${kind}` : 'chip'}
                aria-pressed={kinds[kind]}
                onClick={() => onToggleKind(kind)}
              >
                {label}
              </button>
            ))}
          </span>
          <a className="muted curriculum" href={major.url} target="_blank" rel="noreferrer">Curriculum ↗</a>
        </>
      )}
    </div>
  )
}
