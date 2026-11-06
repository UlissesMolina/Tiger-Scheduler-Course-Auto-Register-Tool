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
    <>
      <section className="panel-section">
        <label className="switch">
          <span>
            <strong>Open seats only</strong>
            <small>Hide full sections</small>
          </span>
          <input type="checkbox" role="switch" checked={filters.openOnly} onChange={(e) => set({ openOnly: e.target.checked })} />
          <i aria-hidden="true" />
        </label>
      </section>

      <section className="panel-section">
        <h3 id="days-label">Days</h3>
        <div className="segmented" role="group" aria-labelledby="days-label">
          {DAY_ORDER.slice(0, 6).map((d) => (
            <button
              key={d}
              type="button"
              className={filters.days.includes(d) ? 'on' : ''}
              aria-pressed={filters.days.includes(d)}
              aria-label={DAY_NAMES[d]}
              onClick={() => toggleDay(d)}
            >
              {DAY_NAMES[d].slice(0, 2)}
            </button>
          ))}
        </div>
        <small className="hint">Only sections that meet on the selected days</small>
      </section>

      <section className="panel-section">
        <h3>Time</h3>
        <div className="field-row">
          <label className="field">
            <span>Starts after</span>
            <select value={filters.startAfter} onChange={(e) => set({ startAfter: e.target.value })}>
              <option value="">Any</option>
              {TIMES.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Ends by</span>
            <select value={filters.endBefore} onChange={(e) => set({ endBefore: e.target.value })}>
              <option value="">Any</option>
              {TIMES.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="panel-section">
        <label className="field">
          <span className="h3">Format</span>
          <select value={filters.method} onChange={(e) => set({ method: e.target.value })}>
            <option value="">Any format</option>
            {methods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </section>
    </>
  )
}
