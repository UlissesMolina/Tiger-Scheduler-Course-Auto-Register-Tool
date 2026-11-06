import { useEffect, useMemo, useRef, useState } from 'react'
import { seatTone } from '../lib/format.js'
import { searchCourses } from '../lib/search.js'
import Icon, { SeatPie } from './Icon.jsx'

const NO_FILTERS = { openOnly: false, days: [], startAfter: '', endBefore: '', method: '' }

/**
 * ⌘K palette: jump to a course, switch major, or run an action.
 * Mounted only while open, so each opening starts empty.
 */
export default function CommandPalette({ index, majors, actions, onPickCourse, onPickMajor, onClose }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef(null)

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = []
    if (needle) {
      const courses = searchCourses(index, needle, NO_FILTERS).slice(0, 7)
      if (courses.length) {
        out.push({ title: 'Courses', items: courses.map((c) => ({ id: `c:${c.code}`, kind: 'course', course: c, run: () => onPickCourse(c.code) })) })
      }
      const words = needle.split(/\s+/)
      const ms = majors.filter((m) => words.every((w) => m.name.toLowerCase().includes(w))).slice(0, 5)
      if (ms.length) {
        out.push({ title: 'Majors', items: ms.map((m) => ({ id: `m:${m.id}`, kind: 'major', label: m.name, run: () => onPickMajor(m.id) })) })
      }
    }
    const acts = actions.filter((a) => !needle || a.label.toLowerCase().includes(needle))
    if (acts.length) out.push({ title: 'Actions', items: acts.map((a) => ({ id: `a:${a.label}`, kind: 'action', ...a })) })
    return out
  }, [q, index, majors, actions, onPickCourse, onPickMajor])

  const flat = groups.flatMap((g) => g.items)
  const current = Math.min(active, Math.max(0, flat.length - 1))

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current, q])

  const run = (item) => {
    if (!item) return
    item.run()
    onClose()
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((current + 1) % Math.max(1, flat.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((current - 1 + flat.length) % Math.max(1, flat.length)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(flat[current]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  let n = -1
  return (
    <div className="palette-scrim" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command menu" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <Icon name="search" size={16} />
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0) }}
            onKeyDown={onKey}
            placeholder="Jump to a course, pick a major, or run a command…"
            aria-label="Command"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {!flat.length && <p className="palette-empty">No results for “{q}”</p>}
          {groups.map((g) => (
            <div key={g.title} role="group" aria-label={g.title}>
              <div className="palette-group">{g.title}</div>
              {g.items.map((item) => {
                n += 1
                const i = n
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={i === current}
                    data-active={i === current}
                    className="palette-item"
                    onMouseMove={() => i !== current && setActive(i)}
                    onClick={() => run(item)}
                  >
                    {item.kind === 'course' && (
                      <>
                        <SeatPie
                          taken={item.course.capacity - item.course.available}
                          capacity={item.course.capacity}
                          tone={seatTone(item.course.available, item.course.capacity)}
                        />
                        <span className="code">{item.course.code}</span>
                        <span className="palette-label">{item.course.title}</span>
                        <span className="faint">{item.course.available} open</span>
                      </>
                    )}
                    {item.kind === 'major' && (
                      <><Icon name="book" size={15} /><span className="palette-label">{item.label}</span></>
                    )}
                    {item.kind === 'action' && (
                      <>
                        <Icon name={item.icon} size={15} />
                        <span className="palette-label">{item.label}</span>
                        {item.hint && <kbd>{item.hint}</kbd>}
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>/</kbd> search</span>
          <span><kbd>j</kbd><kbd>k</kbd> move</span>
          <span><kbd>w</kbd> watch</span>
        </div>
      </div>
    </div>
  )
}
