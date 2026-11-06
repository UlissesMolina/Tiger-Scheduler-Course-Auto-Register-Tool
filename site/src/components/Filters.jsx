import { DAY_NAMES, DAY_ORDER } from '../lib/format.js'

const TIMES = ['0700', '0800', '0900', '1000', '1100', '1200', '1300', '1400', '1500', '1600', '1700', '1800', '1900', '2000', '2100']

function timeLabel(hhmm) {
  const h = Number(hhmm.slice(0, 2))
  return `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'pm' : 'am'}`
}

export default function Filters({ filters, onChange, methods }) {
  const set = (patch) => onChange({ ...filters, ...patch })
  const toggleDay = (d) =>
    set({ days: filters.days.includes(d) ? filters.days.filter((x) => x !== d) : [...filters.days, d] })

  return (
    <div className="filters">
      <label className="check">
        <input type="checkbox" checked={filters.openOnly} onChange={(e) => set({ openOnly: e.target.checked })} />
        Open seats only
      </label>

      <fieldset className="days">
        <legend>Days</legend>
        {DAY_ORDER.slice(0, 6).map((d) => (
          <button
            key={d}
            type="button"
            className={filters.days.includes(d) ? 'chip on' : 'chip'}
            aria-pressed={filters.days.includes(d)}
            onClick={() => toggleDay(d)}
            title={`Only sections meeting on the selected days`}
          >
            {DAY_NAMES[d]}
          </button>
        ))}
      </fieldset>

      <label>
        Starts after
        <select value={filters.startAfter} onChange={(e) => set({ startAfter: e.target.value })}>
          <option value="">Any</option>
          {TIMES.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
        </select>
      </label>

      <label>
        Ends by
        <select value={filters.endBefore} onChange={(e) => set({ endBefore: e.target.value })}>
          <option value="">Any</option>
          {TIMES.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
        </select>
      </label>

      <label>
        Format
        <select value={filters.method} onChange={(e) => set({ method: e.target.value })}>
          <option value="">Any</option>
          {methods.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
    </div>
  )
}
