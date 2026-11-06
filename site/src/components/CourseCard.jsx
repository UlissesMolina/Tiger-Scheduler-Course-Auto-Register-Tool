import { useState } from 'react'
import { formatCredits, formatInstructor, formatPlace, formatTime } from '../lib/format.js'
import Icon from './Icon.jsx'

const COLLAPSED = 5
const WEEK = ['M', 'T', 'W', 'R', 'F']

function seatTone(available, capacity) {
  if (!capacity) return 'closed'
  if (!(available > 0)) return 'full'
  return available <= Math.max(3, capacity * 0.1) ? 'low' : 'open'
}

/** M T W R F with the meeting's days lit; weekend days are added only when used. */
function DayStrip({ days = '' }) {
  const shown = [...WEEK, ...['S', 'U'].filter((d) => days.includes(d))]
  return (
    <span className="day-strip" aria-label={days ? `Meets ${days}` : 'No set days'}>
      {shown.map((d) => <span key={d} className={days.includes(d) ? 'on' : ''}>{d}</span>)}
    </span>
  )
}

function Meeting({ meeting }) {
  if (!meeting.days && !meeting.begin) {
    return <span className="meeting tba"><Icon name="clock" size={14} /> Time TBA</span>
  }
  const place = formatPlace(meeting)
  return (
    <span className="meeting">
      <DayStrip days={meeting.days} />
      <span className="time">{meeting.begin ? `${formatTime(meeting.begin)}–${formatTime(meeting.end)}` : 'TBA'}</span>
      {place && <span className="place"><Icon name="pin" size={13} />{place}</span>}
    </span>
  )
}

function SeatMeter({ section }) {
  const { available, capacity, enrolled, waitlist } = section
  const tone = seatTone(available, capacity)
  const fill = capacity ? Math.min(100, Math.round(((enrolled ?? 0) / capacity) * 100)) : 100
  return (
    <div className={`seat ${tone}`}>
      <div className="seat-label">
        <strong>{tone === 'closed' ? 'No seats' : available > 0 ? `${available} open` : 'Full'}</strong>
        {tone !== 'closed' && <span className="muted">/ {capacity}</span>}
      </div>
      <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={enrolled} aria-label="Seats taken">
        <span style={{ width: `${fill}%` }} />
      </div>
      {waitlist > 0 && <span className="waitlist">{waitlist} waitlisted</span>}
    </div>
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
    <button type="button" className={copied ? 'crn copied' : 'crn'} onClick={copy} title="Copy CRN">
      <span>{crn}</span>
      <Icon name={copied ? 'check' : 'copy'} size={13} />
    </button>
  )
}

function SectionRow({ section }) {
  const instructors = section.instructors.length
    ? section.instructors.map((i) => formatInstructor(i.name)).join(', ')
    : 'Instructor TBA'
  return (
    <li className="section-row">
      <div className="sec">
        <span className="sec-num">{section.section}</span>
        <span className="sec-type">{section.schedule}</span>
      </div>
      <div className="when">
        {(section.meetings.length ? section.meetings : [{}]).map((m, i) => <Meeting key={i} meeting={m} />)}
      </div>
      <div className="who"><Icon name="user" size={14} /><span>{instructors}</span></div>
      <SeatMeter section={section} />
      <CopyCrn crn={section.crn} />
    </li>
  )
}

export default function CourseCard({ course, index = 0, watched, onToggleWatch }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? course.sections : course.sections.slice(0, COLLAPSED)
  const hidden = course.sections.length - shown.length
  const tone = seatTone(course.available, course.capacity)

  return (
    <article className="course" style={{ '--i': Math.min(index, 8) }}>
      <header className="course-head">
        <div className="course-title">
          <div className="course-kicker">
            <span className="code">{course.code}</span>
            {course.tag && <span className={`tag ${course.tag.kind}`}>{course.tag.label}</span>}
          </div>
          <h2>{course.title}</h2>
          <p className="course-sub">
            <span>{formatCredits(course.credits)}</span>
            <span>{course.sections.length} section{course.sections.length === 1 ? '' : 's'}</span>
            <span className={`pill ${tone}`}><i />{course.available} of {course.capacity} open</span>
          </p>
        </div>
        <button
          type="button"
          className={watched ? 'watch on' : 'watch'}
          aria-pressed={watched}
          onClick={() => onToggleWatch(course.code)}
        >
          <Icon name="star" size={15} filled={watched} />
          {watched ? 'Watching' : 'Watch'}
        </button>
      </header>

      <ul className="sections" aria-label={`${course.code} sections`}>
        {shown.map((s) => <SectionRow key={s.crn} section={s} />)}
      </ul>

      {course.sections.length > COLLAPSED && (
        <button type="button" className="more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `Show ${hidden} more section${hidden === 1 ? '' : 's'}`}
          <Icon name="chevron" size={14} className={expanded ? 'flip' : ''} />
        </button>
      )}
    </article>
  )
}
