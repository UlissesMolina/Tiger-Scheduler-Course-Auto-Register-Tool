import { DAY_NAMES, DAY_ORDER, timeLabel } from '../lib/format.js'
import Icon from './Icon.jsx'

/** Active filters as removable chips under the header, the way Linear shows a view's filters. */
export default function FilterBar({ filters, onChange, major, onClearMajor, onClearAll }) {
  const chips = []
  if (major) chips.push({ key: 'major', label: 'Major', value: major.name, clear: onClearMajor })
  if (filters.openOnly) chips.push({ key: 'open', label: 'Seats', value: 'Open only', clear: () => onChange({ ...filters, openOnly: false }) })
  if (filters.days.length) {
    const days = DAY_ORDER.filter((d) => filters.days.includes(d)).map((d) => DAY_NAMES[d]).join(', ')
    chips.push({ key: 'days', label: 'Days', value: days, clear: () => onChange({ ...filters, days: [] }) })
  }
  if (filters.startAfter) chips.push({ key: 'after', label: 'Starts', value: `after ${timeLabel(filters.startAfter)}`, clear: () => onChange({ ...filters, startAfter: '' }) })
  if (filters.endBefore) chips.push({ key: 'before', label: 'Ends', value: `by ${timeLabel(filters.endBefore)}`, clear: () => onChange({ ...filters, endBefore: '' }) })
  if (filters.method) chips.push({ key: 'method', label: 'Format', value: filters.method, clear: () => onChange({ ...filters, method: '' }) })
  if (!chips.length) return null

  return (
    <div className="filter-bar" aria-label="Active filters">
      {chips.map((c) => (
        <span key={c.key} className="chip">
          <span className="chip-label">{c.label}</span>
          <span className="chip-op">is</span>
          <span className="chip-value">{c.value}</span>
          <button type="button" onClick={c.clear} aria-label={`Remove ${c.label} filter`}>
            <Icon name="x" size={12} />
          </button>
        </span>
      ))}
      {chips.length > 1 && <button type="button" className="clear-all" onClick={onClearAll}>Clear</button>}
    </div>
  )
}
