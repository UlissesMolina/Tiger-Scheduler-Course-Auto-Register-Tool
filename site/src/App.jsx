import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import CourseCard from './components/CourseCard.jsx'
import Filters from './components/Filters.jsx'
import Icon from './components/Icon.jsx'
import MajorPicker from './components/MajorPicker.jsx'
import WatchPanel from './components/WatchPanel.jsx'
import { formatUpdated } from './lib/format.js'
import { activeFilterCount, buildIndex, majorTagger, methods, searchCourses } from './lib/search.js'
import { load, save } from './lib/storage.js'

const PAGE = 40
const NO_FILTERS = { openOnly: false, days: [], startAfter: '', endBefore: '', method: '' }
const ALL_KINDS = { required: true, elective: true, core: true }

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
  const tagger = useMemo(() => majorTagger(major, majorsDoc?.core ?? {}, kinds), [major, majorsDoc, kinds])
  const courses = useMemo(() => searchCourses(index, deferredQuery, filters, tagger), [index, deferredQuery, filters, tagger])
  const sectionCount = useMemo(() => courses.reduce((n, c) => n + c.sections.length, 0), [courses])

  const toggleWatch = (code) =>
    setWatched((w) => (w.includes(code) ? w.filter((c) => c !== code) : [...w, code]))
  const toggleKind = (kind) => setKinds((k) => ({ ...k, [kind]: !k[kind] }))
  const filterCount = activeFilterCount(filters) + (major ? 1 : 0)
  const clearAll = () => { setFilters(NO_FILTERS); setMajorId('') }

  // Light / dark / follow the system, remembered per browser.
  const [theme, setTheme] = useState(() => load('theme', 'system'))
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    save('theme', theme)
  }, [theme])
  const nextTheme = { system: 'light', light: 'dark', dark: 'system' }
  const themeIcon = { system: 'monitor', light: 'sun', dark: 'moon' }

  // "/" jumps to search from anywhere; Escape closes the phone filter sheet.
  const searchRef = useRef(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape') {
        setSheetOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={intro ? 'app intro' : 'app'}>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="./" aria-label="Auburn Course Finder home">
            <img src="./favicon.svg" alt="" width="28" height="28" />
            <span>
              <strong>Course Finder</strong>
              <small>Auburn University</small>
            </span>
          </a>
          <label className="search">
            <Icon name="search" size={18} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search COMP 1210, a title, professor or CRN"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search courses"
              autoFocus
            />
            {!query && <kbd>/</kbd>}
          </label>
          <select className="term" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Term">
            {terms.map((t) => <option key={t.code} value={t.code}>{t.description}</option>)}
          </select>
          <button
            type="button"
            className="icon-btn theme-toggle"
            onClick={() => setTheme(nextTheme[theme])}
            title={`Theme: ${theme} (click for ${nextTheme[theme]})`}
            aria-label={`Theme: ${theme}`}
          >
            <Icon name={themeIcon[theme]} size={18} />
          </button>
          <button type="button" className="sheet-toggle" onClick={() => setSheetOpen(true)} aria-expanded={sheetOpen}>
            <Icon name="sliders" size={16} />
            Filters
            {filterCount > 0 && <span className="count">{filterCount}</span>}
          </button>
        </div>
      </header>

      <div className="layout">
        <div className={sheetOpen ? 'scrim show' : 'scrim'} onClick={() => setSheetOpen(false)} aria-hidden="true" />
        <aside className={sheetOpen ? 'sidebar open' : 'sidebar'} aria-label="Filters">
          <div className="sidebar-head">
            <h2>Filters</h2>
            {filterCount > 0 && <button type="button" className="link" onClick={clearAll}>Clear all</button>}
            <button type="button" className="icon-btn close" onClick={() => setSheetOpen(false)} aria-label="Close filters">
              <Icon name="x" size={18} />
            </button>
          </div>
          <MajorPicker majors={majors} majorId={major ? majorId : ''} onMajor={setMajorId} kinds={kinds} onToggleKind={toggleKind} />
          <Filters filters={filters} onChange={setFilters} methods={methodList} />
          <button type="button" className="sheet-done" onClick={() => setSheetOpen(false)}>
            Show {courses.length.toLocaleString()} course{courses.length === 1 ? '' : 's'}
          </button>
        </aside>

        <main>
          {error && <p className="error" role="alert">{error}</p>}
          {!error && !doc && (
            <div aria-busy="true" aria-label="Loading sections">
              <div className="status skeleton-line" />
              {[0, 1, 2].map((i) => <div key={i} className="course skeleton" style={{ '--i': i }} />)}
            </div>
          )}
          {doc && (
            <>
              <div className="status" aria-live="polite">
                <span>
                  <strong>{courses.length.toLocaleString()}</strong> course{courses.length === 1 ? '' : 's'}
                  <span className="muted"> · {sectionCount.toLocaleString()} section{sectionCount === 1 ? '' : 's'}</span>
                </span>
                <span className="updated"><i aria-hidden="true" />Seats as of {formatUpdated(doc.fetchedAt)}</span>
              </div>
              {courses.slice(0, limit).map((c, i) => (
                <CourseCard key={c.code} index={i} course={c} watched={watched.includes(c.code)} onToggleWatch={toggleWatch} />
              ))}
              {courses.length > limit && (
                <button type="button" className="load-more" onClick={() => setPage({ key: pageKey, limit: limit + PAGE })}>
                  Show more courses <span className="muted">· {(courses.length - limit).toLocaleString()} left</span>
                </button>
              )}
              {!courses.length && (
                <div className="empty">
                  <Icon name="inbox" size={28} />
                  <strong>No sections match</strong>
                  <span className="muted">Try fewer words, another term, or fewer filters.</span>
                  {filterCount > 0 && <button type="button" className="btn" onClick={clearAll}>Clear filters</button>}
                </div>
              )}
            </>
          )}
          <footer>
            Data from Auburn's public class search, refreshed daily. Seats change constantly, so check TigerSchedule before you register.
          </footer>
        </main>
      </div>

      <WatchPanel watched={watched} onRemove={toggleWatch} />
    </div>
  )
}
