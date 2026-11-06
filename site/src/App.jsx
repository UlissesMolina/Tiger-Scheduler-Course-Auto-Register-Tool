import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import CourseCard from './components/CourseCard.jsx'
import Filters from './components/Filters.jsx'
import WatchPanel from './components/WatchPanel.jsx'
import { formatUpdated } from './lib/format.js'
import { buildIndex, methods, searchCourses } from './lib/search.js'
import { load, save } from './lib/storage.js'

const PAGE = 40
const NO_FILTERS = { openOnly: false, days: [], startAfter: '', endBefore: '', method: '' }

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.json()
}

function readUrl() {
  const p = new URLSearchParams(location.search)
  return { term: p.get('term') ?? '', q: p.get('q') ?? '' }
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
  const deferredQuery = useDeferredValue(query)
  // "Show more" depth resets whenever the search, filters or term change.
  const pageKey = `${term}|${deferredQuery}|${JSON.stringify(filters)}`
  const [page, setPage] = useState({ key: '', limit: PAGE })
  const limit = page.key === pageKey ? page.limit : PAGE

  useEffect(() => {
    getJson('./data/terms.json')
      .then(({ terms }) => setTerms(terms))
      .catch((e) => setListError(`Could not load the term list (${e.message}).`))
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
    history.replaceState(null, '', `${location.pathname}${p.size ? `?${p}` : ''}`)
  }, [term, query])

  useEffect(() => save('watched', watched), [watched])

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
  const courses = useMemo(() => searchCourses(index, deferredQuery, filters), [index, deferredQuery, filters])
  const sectionCount = useMemo(() => courses.reduce((n, c) => n + c.sections.length, 0), [courses])

  const toggleWatch = (code) =>
    setWatched((w) => (w.includes(code) ? w.filter((c) => c !== code) : [...w, code]))
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)

  return (
    <div className={intro ? 'app intro' : 'app'}>
      <header className="top">
        <div className="brand">
          <h1>Auburn Course Finder</h1>
          {doc && <span className="muted">Seats as of {formatUpdated(doc.fetchedAt)}</span>}
        </div>
        <div className="search-row">
          <input
            type="search"
            className="search"
            placeholder="Course (COMP 1210), title, professor or CRN"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search courses"
            autoFocus
          />
          <select value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Term">
            {terms.map((t) => <option key={t.code} value={t.code}>{t.description}</option>)}
          </select>
        </div>
        <Filters filters={filters} onChange={setFilters} methods={methodList} />
      </header>

      <WatchPanel watched={watched} onRemove={toggleWatch} />

      <main>
        {error && <p className="error" role="alert">{error}</p>}
        {!error && !doc && (
          <div aria-busy="true" aria-label="Loading sections">
            {[0, 1, 2].map((i) => <div key={i} className="course skeleton" style={{ '--i': i }} />)}
          </div>
        )}
        {doc && (
          <>
            <p className="muted status" aria-live="polite">
              {courses.length.toLocaleString()} course{courses.length === 1 ? '' : 's'} ·{' '}
              {sectionCount.toLocaleString()} section{sectionCount === 1 ? '' : 's'}
              {filtersActive && (
                <> · <button type="button" className="link" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button></>
              )}
            </p>
            {courses.slice(0, limit).map((c, i) => (
              <CourseCard key={c.code} index={i} course={c} watched={watched.includes(c.code)} onToggleWatch={toggleWatch} />
            ))}
            {courses.length > limit && (
              <button type="button" className="more page" onClick={() => setPage({ key: pageKey, limit: limit + PAGE })}>
                Show more courses ({(courses.length - limit).toLocaleString()} left)
              </button>
            )}
            {!courses.length && <p className="muted status">No sections match. Try fewer words or clear the filters.</p>}
          </>
        )}
      </main>

      <footer className="muted">
        Data from Auburn's public class search, refreshed daily. Seats change constantly; check TigerSchedule before you register.
      </footer>
    </div>
  )
}
