import { DAY_NAMES, DAY_ORDER, TIMES, timeLabel } from '../lib/format.js'
import Icon from './Icon.jsx'

export default function Filters({ filters, onChange, methods }) {
  const set = (patch) => onChange({ ...filters, ...patch })
  const toggleDay = (d) =>
    set({ days: filters.days.includes(d) ? filters.days.filter((x) => x !== d) : [...filters.days, d] })

  return (
    <div className="nav-group">
      <div className="nav-label">Filters</div>

      <label className="nav-item toggle">
        <Icon name="bolt" size={15} />
        <span>Open seats only</span>
        <input type="checkbox" role="switch" checked={filters.openOnly} onChange={(e) => set({ openOnly: e.target.checked })} />
        <i className="switch" aria-hidden="true" />
      </label>

      <div className="nav-field">
        <span className="nav-field-label"><Icon name="calendar" size={15} />Days</span>
        <div className="day-picker" role="group" aria-label="Days">
          {DAY_ORDER.slice(0, 6).map((d) => (
            <button
              key={d}
              type="button"
              className={filters.days.includes(d) ? 'on' : ''}
              aria-pressed={filters.days.includes(d)}
              aria-label={DAY_NAMES[d]}
              title={`Only sections meeting on the selected days`}
              onClick={() => toggleDay(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="nav-field">
        <span className="nav-field-label"><Icon name="clock" size={15} />Time</span>
        <div className="time-pair">
          <select value={filters.startAfter} onChange={(e) => set({ startAfter: e.target.value })} aria-label="Starts after">
            <option value="">From any</option>
            {TIMES.map((t) => <option key={t} value={t}>From {timeLabel(t)}</option>)}
          </select>
          <select value={filters.endBefore} onChange={(e) => set({ endBefore: e.target.value })} aria-label="Ends by">
            <option value="">To any</option>
            {TIMES.map((t) => <option key={t} value={t}>To {timeLabel(t)}</option>)}
          </select>
        </div>
      </div>

      <label className="nav-select">
        <Icon name="layers" size={15} />
        <select value={filters.method} onChange={(e) => set({ method: e.target.value })} aria-label="Format">
          <option value="">Any format</option>
          {methods.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <Icon name="chevron" size={13} className="caret" />
      </label>
    </div>
  )
}
