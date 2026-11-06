import { auditProgress } from '../lib/degreeworks.js'
import Icon, { StatusIcon } from './Icon.jsx'

const SEASON = { Spring: 1, Summer: 2, Fall: 3, Winter: 4 }
const termKey = (term) => {
  const [season, year] = term.split(' ')
  return Number(year) * 10 + (SEASON[season] ?? 0)
}

function Ring({ complete, progress, total, size = 76 }) {
  const r = 31
  const c = 2 * Math.PI * r
  const done = total ? complete / total : 0
  const going = total ? progress / total : 0
  return (
    <svg className="ring" width={size} height={size} viewBox="0 0 76 76" role="img" aria-label={`${Math.round(done * 100)}% of requirements complete`}>
      <circle cx="38" cy="38" r={r} className="ring-track" />
      <circle cx="38" cy="38" r={r} className="ring-progress" strokeDasharray={`${(done + going) * c} ${c}`} />
      <circle cx="38" cy="38" r={r} className="ring-done" strokeDasharray={`${done * c} ${c}`} />
      <text x="38" y="42" textAnchor="middle">{Math.round(done * 100)}%</text>
    </svg>
  )
}

function SegBar({ complete, progress, needed }) {
  const total = complete + progress + needed || 1
  return (
    <div className="segbar" aria-hidden="true">
      {complete > 0 && <span className="complete" style={{ flexGrow: complete / total }} />}
      {progress > 0 && <span className="progress" style={{ flexGrow: progress / total }} />}
      {needed > 0 && <span className="needed" style={{ flexGrow: needed / total }} />}
    </div>
  )
}

function neededText(n) {
  if (!n) return ''
  if (n.unit === 'classes') return `${n.amount} class${n.amount === 1 ? '' : 'es'}`
  return `${n.amount} cr`
}

export default function ProgressPage({ audit, termName, offered, onShowRequirement, onImport }) {
  if (!audit) {
    return (
      <div className="empty progress-empty">
        <Icon name="progress" size={26} />
        <b>See your degree progress</b>
        <span className="muted">Import your Degree Works audit to see what&apos;s done, what&apos;s in progress and what&apos;s left, with this term&apos;s sections for each.</span>
        <button type="button" className="btn primary" onClick={onImport}>Import Degree Works audit</button>
      </div>
    )
  }
  if (!audit.blocks) {
    return (
      <div className="empty progress-empty">
        <Icon name="progress" size={26} />
        <b>Re-import to see your progress</b>
        <span className="muted">Your audit was imported before this page existed. Paste it again to fill it in.</span>
        <button type="button" className="btn primary" onClick={onImport}>Update audit</button>
      </div>
    )
  }

  const totals = auditProgress(audit)
  const neededIndex = (r) => audit.needed.findIndex((n) => n.name === r.name && n.spec === r.needed?.spec)
  const stillNeeded = audit.blocks.flatMap((b) => b.requirements.filter((r) => r.status === 'needed').map((r) => ({ ...r, block: b.name })))

  const terms = new Map()
  for (const c of Object.values(audit.courses ?? {})) {
    if (!terms.has(c.term)) terms.set(c.term, [])
    terms.get(c.term).push(c)
  }
  const timeline = [...terms].sort(([a], [b]) => termKey(a) - termKey(b))

  return (
    <div className="progress-page">
      <section className="overview">
        <Ring complete={totals.complete} progress={totals.progress} total={totals.total} />
        <div className="ov-main">
          <h1>{audit.degree ?? 'Degree progress'}</h1>
          <p className="faint">
            Degree Works audit from {audit.auditDate ?? 'unknown date'} ·{' '}
            <button type="button" className="link-sm" onClick={onImport}>Update</button>
          </p>
          <SegBar complete={totals.complete} progress={totals.progress} needed={totals.needed} />
          <div className="ov-legend">
            <span><i className="complete" />{totals.complete} complete</span>
            <span><i className="progress" />{totals.progress} in progress</span>
            <span><i className="needed" />{totals.needed} still needed</span>
          </div>
        </div>
        <dl className="ov-stats">
          <div><dt>Credits earned</dt><dd>{totals.credits}</dd></div>
          <div><dt>In progress</dt><dd>{totals.creditsInProgress}<small> cr</small></dd></div>
          <div><dt>Requirements left</dt><dd>{totals.needed}</dd></div>
        </dl>
      </section>

      {stillNeeded.length > 0 && (
        <section className="pg-section">
          <h2>Still needed <span className="count">{stillNeeded.length}</span></h2>
          <ul className="req-list needed-list">
            {stillNeeded.map((r) => {
              const at = neededIndex(r)
              const count = at === -1 ? null : offered[at]
              const partial = r.courses.length > 0
              return (
                <li key={`${r.block}|${r.name}`} className="req-row">
                  <StatusIcon status={partial ? 'progress' : 'needed'} />
                  <span className="req-name">
                    {r.name}
                    <span className="faint"> · {r.block}</span>
                  </span>
                  <span className="req-courses">
                    {r.courses.map((c) => <span key={c.code} className="course-chip progress">{c.code}</span>)}
                  </span>
                  <span className="req-left">{neededText(r.needed)} left</span>
                  {count != null && (
                    <button
                      type="button"
                      className={count ? 'offered' : 'offered none'}
                      disabled={!count}
                      onClick={() => onShowRequirement(at)}
                      title={count ? `Show these courses in ${termName}` : `Nothing for this requirement in ${termName}`}
                    >
                      {count ? `${count} in ${termName}` : `None in ${termName}`}
                      {count > 0 && <Icon name="arrowRight" size={13} />}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="pg-section">
        <h2>Requirements</h2>
        {audit.blocks.map((b) => {
          const done = b.requirements.filter((r) => r.status === 'complete').length
          const going = b.requirements.filter((r) => r.status === 'progress').length
          const left = b.requirements.length - done - going
          return (
            <div key={b.name} className="block">
              <header className="block-head">
                <StatusIcon status={left ? (done || going ? 'progress' : 'needed') : going ? 'progress' : 'complete'} />
                <h3>{b.name === 'Degree' ? 'Degree requirements' : b.name}</h3>
                <span className="count">{done}/{b.requirements.length}</span>
                <span className="spacer" />
                <SegBar complete={done} progress={going} needed={left} />
              </header>
              <ul className="req-list">
                {b.requirements.map((r) => (
                  <li key={r.name + (r.needed?.spec ?? '')} className={`req-row ${r.status}`}>
                    <StatusIcon status={r.status === 'needed' && r.courses.length ? 'progress' : r.status} />
                    <span className="req-name">{r.name}</span>
                    <span className="req-courses">
                      {r.courses.map((c) => (
                        <span key={c.code} className={`course-chip ${c.status}`} title={`${c.title} · ${c.credits} cr · ${c.term}`}>
                          {c.code}
                        </span>
                      ))}
                    </span>
                    <span className="req-left">
                      {r.status === 'needed'
                        ? `${neededText(r.needed)} left`
                        : r.courses.map((c) => c.term).filter((t, i, a) => a.indexOf(t) === i).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      <section className="pg-section">
        <h2>Timeline</h2>
        <div className="timeline">
          {timeline.map(([term, list]) => {
            const ongoing = list.some((c) => c.status === 'progress')
            const credits = list.reduce((n, c) => n + c.credits, 0)
            return (
              <div key={term} className={ongoing ? 'term ongoing' : 'term'}>
                <header>
                  <b>{term}</b>
                  <span className="faint">{credits} cr{ongoing ? ' · in progress' : ''}</span>
                </header>
                <ul>
                  {list.sort((a, b) => a.code.localeCompare(b.code)).map((c) => (
                    <li key={c.code} title={c.title}>
                      <span className="code">{c.code}</span>
                      <span className="t-title">{c.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      <p className="fineprint">
        From your Degree Works audit, read in this browser only. This is a guide; your official audit and advisor have the final word.
      </p>
    </div>
  )
}
