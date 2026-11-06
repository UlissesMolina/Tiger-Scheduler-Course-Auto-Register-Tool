import { useState } from 'react'
import { formatCredits, formatInstructor, formatMeeting, formatPlace } from '../lib/format.js'

const COLLAPSED = 6

function Seats({ section }) {
  const { available, capacity } = section
  const tone = available > 0 ? (available <= Math.max(3, capacity * 0.1) ? 'low' : 'open') : 'full'
  return (
    <span className={`seats ${tone}`}>
      {available > 0 ? `${available} open` : 'Full'}
      <span className="muted"> / {capacity}</span>
    </span>
  )
}

function CopyCrn({ crn }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(crn)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard blocked; the CRN is still visible to copy by hand
    }
  }
  return (
    <button type="button" className="crn" onClick={copy} title="Copy CRN">
      {copied ? 'Copied' : crn}
    </button>
  )
}

function SectionRow({ section }) {
  const instructors = section.instructors.length
    ? section.instructors.map((i) => formatInstructor(i.name)).join(', ')
    : 'TBA'
  const meetings = section.meetings.length ? section.meetings : [{}]
  return (
    <div className="section-row" role="row">
      <span className="cell sec" role="cell">
        <strong>{section.section}</strong>
        <span className="muted">{section.schedule}</span>
      </span>
      <span className="cell when" role="cell">
        {meetings.map((m, i) => (
          <span key={i}>
            {formatMeeting(m)}
            {formatPlace(m) && <span className="muted"> · {formatPlace(m)}</span>}
          </span>
        ))}
      </span>
      <span className="cell who" role="cell">{instructors}</span>
      <span className="cell seat" role="cell">
        <Seats section={section} />
        {section.waitlist > 0 && <span className="muted">{section.waitlist} waitlisted</span>}
      </span>
      <span className="cell crn-cell" role="cell"><CopyCrn crn={section.crn} /></span>
    </div>
  )
}

export default function CourseCard({ course, index = 0, watched, onToggleWatch }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? course.sections : course.sections.slice(0, COLLAPSED)
  const hidden = course.sections.length - shown.length

  return (
    <article className="course" style={{ '--i': Math.min(index, 8) }}>
      <header>
        <div>
          <h2>
            <span className="code">{course.code}</span> {course.title}
          </h2>
          <p className="muted">
            {formatCredits(course.credits)} · {course.sections.length} section{course.sections.length === 1 ? '' : 's'} ·{' '}
            <span className={course.available > 0 ? 'ok' : 'bad'}>
              {course.available} of {course.capacity} seats open
            </span>
          </p>
        </div>
        <button
          type="button"
          className={watched ? 'watch on' : 'watch'}
          aria-pressed={watched}
          onClick={() => onToggleWatch(course.code)}
        >
          {watched ? '★ Watching' : '☆ Watch'}
        </button>
      </header>

      <div className="sections" role="table" aria-label={`${course.code} sections`}>
        <div className="section-row head" role="row">
          <span role="columnheader">Section</span>
          <span role="columnheader">When / where</span>
          <span role="columnheader">Instructor</span>
          <span role="columnheader">Seats</span>
          <span role="columnheader">CRN</span>
        </div>
        {shown.map((s) => <SectionRow key={s.crn} section={s} />)}
      </div>

      {(hidden > 0 || expanded) && course.sections.length > COLLAPSED && (
        <button type="button" className="more" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `Show ${hidden} more section${hidden === 1 ? '' : 's'}`}
        </button>
      )}
    </article>
  )
}
