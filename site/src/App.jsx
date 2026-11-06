import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import AuditImport from './components/AuditImport.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import CourseGroup from './components/CourseGroup.jsx'
import DegreeWorks from './components/DegreeWorks.jsx'
import FilterBar from './components/FilterBar.jsx'
import Filters from './components/Filters.jsx'
import Icon from './components/Icon.jsx'
import MajorPicker from './components/MajorPicker.jsx'
import Watching from './components/Watching.jsx'
import { auditTagger, courseStatus } from './lib/degreeworks.js'
import { formatUpdated } from './lib/format.js'
import { activeFilterCount, buildIndex, majorTagger, methods, searchCourses } from './lib/search.js'
import { load, save } from './lib/storage.js'

const PAGE = 40
const NO_FILTERS = { openOnly: false, days: [], startAfter: '', endBefore: '', method: '' }
const ALL_KINDS = { required: true, elective: true, core: true }
const NEXT_THEME = { system: 'light', light: 'dark', dark: 'system' }
const THEME_ICON = { system: 'monitor', light: 'sun', dark: 'moon' }
const groupId = (code) => `g-${code.replace(' ', '-')}`

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.json()
}

function readUrl() {
  const p = new URLSearchParams(location.search)
  return { term: p.get('term') ?? '', q: p.get('q') ?? '', major: p.get('major') }
}

export default function App() {
  const [initial] = useState(readUrl)
  const [terms, setTerms] = useState([])
  const [listError, setListError] = useState('')
  const [chosenTerm, setTerm] = useState(initial.term)
  // A term from the URL that is no longer listed falls back to the newest one.
  const term = terms.some((t) => t.code === chosenTerm) ? chosenTerm : terms[0]?.code ?? ''
  // Keyed by term, so switching terms shows "Loading" instead of the old term's results.
  const [loaded, setLoaded] = useState({ term: '', doc: null, error: '' })
  const doc = loaded.term === term ? loaded.doc : null
  const error = listError || (loaded.term === term ? loaded.error : '')
  const [query, setQuery] = useState(initial.q)
  const [filters, setFilters] = useState(NO_FILTERS)
  const [watched, setWatched] = useState(() => load('watched', []))
  const [majorsDoc, setMajorsDoc] = useState(null)
  // A shared link's major wins; otherwise remember the visitor's own.
  const [majorId, setMajorId] = useState(() => initial.major ?? load('major', ''))
  const [kinds, setKinds] = useState(ALL_KINDS)
  const deferredQuery = useDeferredValue(query)
  // "Show more" depth resets whenever the search, filters or term change.
  const pageKey = `${term}|${deferredQuery}|${JSON.stringify(filters)}|${majorId}|${JSON.stringify(kinds)}`
  const [page, setPage] = useState({ key: '', limit: PAGE })
  const limit = page.key === pageKey ? page.limit : PAGE

  useEffect(() => {
    getJson('./data/terms.json')
      .then(({ terms }) => setTerms(terms))
      .catch((e) => setListError(`Could not load the term list (${e.message}).`))
    // The major filter is optional; the site works without it.
    getJson('./data/majors.json').then(setMajorsDoc).catch(() => {})
  }, [])

  useEffect(() => {
    const entry = terms.find((t) => t.code === term)
    if (!entry) return
    let stale = false
    getJson(`./data/${entry.file}`)
      .then((d) => !stale && setLoaded({ term, doc: d, error: '' }))
      .catch((e) => !stale && setLoaded({ term, doc: null, error: `Could not load ${entry.description} (${e.message}).` }))
    return () => { stale = true }
  }, [term, terms])

  useEffect(() => {
    const p = new URLSearchParams()
    if (term) p.set('term', term)
    if (query.trim()) p.set('q', query.trim())
    if (majorId) p.set('major', majorId)
    history.replaceState(null, '', `${location.pathname}${p.size ? `?${p}` : ''}`)
  }, [term, query, majorId])

  useEffect(() => save('watched', watched), [watched])
  useEffect(() => save('major', majorId), [majorId])

  // Cards rise in on the first load only; after that, typing a search swaps
  // results instantly instead of replaying the entrance.
  const [intro, setIntro] = useState(true)
  const hasDoc = doc !== null
  useEffect(() => {
    if (!hasDoc) return
    const t = setTimeout(() => setIntro(false), 1200)
    return () => clearTimeout(t)
  }, [hasDoc])

  const index = useMemo(() => (doc ? buildIndex(doc.sections) : []), [doc])
  const methodList = useMemo(() => (doc ? methods(doc.sections) : []), [doc])
  const majors = majorsDoc?.majors ?? []
  const major = majors.find((m) => m.id === majorId) ?? null

  // Degree Works audit: only parsed requirements and course codes, kept in this browser.
  const [audit, setAudit] = useState(() => load('audit', null))
  const [planView, setPlanView] = useState(() => load('planView', false))
  const [hideTaken, setHideTaken] = useState(() => load('hideTaken', true))
  const [importOpen, setImportOpen] = useState(false)
  const inPlan = planView && audit !== null
  useEffect(() => save('audit', audit), [audit])
  useEffect(() => save('planView', planView), [planView])
  useEffect(() => save('hideTaken', hideTaken), [hideTaken])

  // "Still needed" replaces the major filter while it is on.
  const tagger = useMemo(
    () => (inPlan ? auditTagger(audit) : majorTagger(major, majorsDoc?.core ?? {}, kinds)),
    [inPlan, audit, major, majorsDoc, kinds],
  )
  const courses = useMemo(() => {
    const found = searchCourses(index, deferredQuery, filters, tagger)
    if (!audit || !hideTaken) return found
    return found.filter((c) => !(c.code in audit.taken) && !(c.code in audit.inProgress))
  }, [index, deferredQuery, filters, tagger, audit, hideTaken])
  const neededCount = useMemo(
    () => (audit ? searchCourses(index, deferredQuery, filters, auditTagger(audit)).length : null),
    [index, deferredQuery, filters, audit],
  )
  const sectionCount = useMemo(() => courses.reduce((n, c) => n + c.sections.length, 0), [courses])

  // Course counts per kind for the sidebar, with every kind switched on.
  const kindCounts = useMemo(() => {
    if (!major || inPlan) return null
    const all = searchCourses(index, deferredQuery, filters, majorTagger(major, majorsDoc?.core ?? {}, ALL_KINDS))
    const counts = { required: 0, elective: 0, core: 0 }
    for (const c of all) counts[c.tag.kind] += 1
    return counts
  }, [index, deferredQuery, filters, major, majorsDoc, inPlan])

  const toggleWatch = (code) =>
    setWatched((w) => (w.includes(code) ? w.filter((c) => c !== code) : [...w, code]))
  const toggleKind = (kind) => setKinds((k) => ({ ...k, [kind]: !k[kind] }))
  const filtersOn = activeFilterCount(filters) + (inPlan || major ? 1 : 0)
  const clearAll = () => { setFilters(NO_FILTERS); setMajorId(''); setPlanView(false) }
  const saveAudit = (parsed) => { setAudit(parsed); setPlanView(true); setImportOpen(false) }
  const removeAudit = () => { setAudit(null); setPlanView(false) }

  // Light / dark / follow the system, remembered per browser.
  const [theme, setTheme] = useState(() => load('theme', 'system'))
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    save('theme', theme)
  }, [theme])

  const searchRef = useRef(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const visible = courses.slice(0, limit)
  // j / k move a focus ring between courses; w watches the focused one.
  const [focusedCode, setFocusedCode] = useState(null)
  const focused = visible.some((c) => c.code === focusedCode) ? focusedCode : null

  const showCourse = (code) => {
    setQuery(code)
    setFocusedCode(code)
    setDrawerOpen(false)
  }

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!importOpen) setPaletteOpen((open) => !open)
        return
      }
      if (paletteOpen || importOpen) return
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '')
      if (e.key === 'Escape') {
        setDrawerOpen(false)
        if (typing) document.activeElement.blur()
        else setFocusedCode(null)
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'j' || e.key === 'k') {
        if (!visible.length) return
        const at = visible.findIndex((c) => c.code === focused)
        const next = e.key === 'j' ? Math.min(visible.length - 1, at + 1) : Math.max(0, at === -1 ? 0 : at - 1)
        const code = visible[next].code
        setFocusedCode(code)
        document.getElementById(groupId(code))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      } else if (e.key === 'w' && focused) {
        toggleWatch(focused)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const nextTheme = NEXT_THEME[theme]
  const actions = [
    { label: filters.openOnly ? 'Show full sections too' : 'Show open seats only', icon: 'bolt', run: () => setFilters((f) => ({ ...f, openOnly: !f.openOnly })) },
    { label: 'Focus search', icon: 'search', hint: '/', run: () => setTimeout(() => searchRef.current?.focus(), 0) },
    audit
      ? { label: inPlan ? 'Show all courses' : 'Show courses I still need', icon: 'check', run: () => setPlanView(!inPlan) }
      : { label: 'Import Degree Works audit', icon: 'inbox', run: () => setImportOpen(true) },
    { label: `Theme: switch to ${nextTheme}`, icon: THEME_ICON[nextTheme], run: () => setTheme(nextTheme) },
    ...terms.filter((t) => t.code !== term).map((t) => ({ label: `Switch term to ${t.description}`, icon: 'calendar', run: () => setTerm(t.code) })),
    ...(filtersOn ? [{ label: 'Clear all filters', icon: 'x', run: clearAll }] : []),
  ]

  const termName = terms.find((t) => t.code === term)?.description ?? 'Loading'

  return (
    <div className={intro ? 'shell intro' : 'shell'}>
      <div className={drawerOpen ? 'scrim show' : 'scrim'} onClick={() => setDrawerOpen(false)} aria-hidden="true" />

      <aside className={drawerOpen ? 'sidebar open' : 'sidebar'} aria-label="Navigation and filters">
        <div className="workspace">
          <img src="./favicon.svg" alt="" width="22" height="22" />
          <span className="workspace-name">Course Finder</span>
          <button
            type="button"
            className="ghost-icon"
            onClick={() => setTheme(nextTheme)}
            title={`Theme: ${theme}`}
            aria-label={`Theme: ${theme}. Switch to ${nextTheme}`}
          >
            <Icon name={THEME_ICON[theme]} size={15} />
          </button>
        </div>

        <button type="button" className="nav-item search-trigger" onClick={() => setPaletteOpen(true)}>
          <Icon name="search" size={15} />
          <span>Search or jump to…</span>
          <kbd>⌘K</kbd>
        </button>

        <DegreeWorks
          audit={audit}
          planView={inPlan}
          onPlanView={setPlanView}
          hideTaken={hideTaken}
          onHideTaken={setHideTaken}
          neededCount={neededCount}
          onImport={() => setImportOpen(true)}
          onRemove={removeAudit}
        />
        {!inPlan && <MajorPicker majors={majors} majorId={major ? majorId : ''} onMajor={setMajorId} kinds={kinds} onToggleKind={toggleKind} counts={kindCounts} />}
        <Filters filters={filters} onChange={setFilters} methods={methodList} />
        <Watching watched={watched} onRemove={toggleWatch} onPick={showCourse} />

        <div className="sidebar-foot">
          {doc
            ? <span className="synced"><i aria-hidden="true" />Seats as of {formatUpdated(doc.fetchedAt)}</span>
            : <span className="faint">Loading seats…</span>}
        </div>
      </aside>

      <main className="panel">
        <header className="panel-head">
          <button type="button" className="ghost-icon menu" onClick={() => setDrawerOpen(true)} aria-label="Open filters">
            <Icon name="menu" size={16} />
            {filtersOn > 0 && <span className="badge-dot" aria-hidden="true" />}
          </button>
          <nav className="crumbs" aria-label="View">
            <span className="crumb muted">Courses</span>
            <Icon name="chevronRight" size={12} className="faint" />
            <label className="crumb-select">
              <select value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Term">
                {terms.map((t) => <option key={t.code} value={t.code}>{t.description}</option>)}
              </select>
              <span aria-hidden="true">{termName}</span>
              <Icon name="chevron" size={12} />
            </label>
            {(inPlan || major) && (
              <>
                <Icon name="chevronRight" size={12} className="faint" />
                <span className="crumb">{inPlan ? 'Still needed' : major.name}</span>
              </>
            )}
          </nav>
          <label className="search">
            <Icon name="search" size={14} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Filter by course, title, professor, CRN"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search courses"
            />
            {!query && <kbd>/</kbd>}
          </label>
        </header>

        <FilterBar
          filters={filters}
          onChange={setFilters}
          major={inPlan ? null : major}
          onClearMajor={() => setMajorId('')}
          view={inPlan ? 'Still needed' : null}
          onClearView={() => setPlanView(false)}
          onClearAll={clearAll}
        />

        <div className="list">
          {error && <p className="error" role="alert">{error}</p>}
          {!error && !doc && (
            <div aria-busy="true" aria-label="Loading sections">
              {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ '--i': i }} />)}
            </div>
          )}
          {doc && (
            <>
              <div className="list-meta" aria-live="polite">
                <span><b>{courses.length.toLocaleString()}</b> course{courses.length === 1 ? '' : 's'}</span>
                <span className="faint">·</span>
                <span>{sectionCount.toLocaleString()} section{sectionCount === 1 ? '' : 's'}</span>
              </div>
              {visible.map((c, i) => (
                <CourseGroup
                  key={c.code}
                  index={i}
                  course={c}
                  watched={watched.includes(c.code)}
                  focused={focused === c.code}
                  status={courseStatus(audit, c.code)}
                  onToggleWatch={toggleWatch}
                />
              ))}
              {courses.length > limit && (
                <button type="button" className="load-more" onClick={() => setPage({ key: pageKey, limit: limit + PAGE })}>
                  Load {Math.min(PAGE, courses.length - limit)} more <span className="faint">of {(courses.length - limit).toLocaleString()}</span>
                </button>
              )}
              {!courses.length && (
                <div className="empty">
                  <Icon name="inbox" size={22} />
                  <b>No sections match</b>
                  <span className="muted">Try fewer words, another term, or fewer filters.</span>
                  {filtersOn > 0 && <button type="button" className="btn" onClick={clearAll}>Clear filters</button>}
                </div>
              )}
              <p className="fineprint">
                Data from Auburn&apos;s public class search, refreshed daily. Seats change constantly, so check TigerSchedule before you register.
              </p>
            </>
          )}
        </div>
      </main>

      {importOpen && <AuditImport onSave={saveAudit} onClose={() => setImportOpen(false)} />}

      {paletteOpen && (
        <CommandPalette
          index={index}
          majors={majors}
          actions={actions}
          onPickCourse={showCourse}
          onPickMajor={setMajorId}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  )
}
