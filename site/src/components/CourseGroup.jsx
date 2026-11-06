import { useState } from 'react'
import { formatCredits, formatInstructor, formatPlace, formatTime, seatTone } from '../lib/format.js'
import Icon, { SeatPie } from './Icon.jsx'

const COLLAPSED = 6
const WEEK = ['M', 'T', 'W', 'R', 'F']

function DayStrip({ days = '' }) {
  const shown = [...WEEK, ...['S', 'U'].filter((d) => days.includes(d))]
  return (
    <span className="days" aria-label={days ? `Meets ${days}` : 'No set days'}>
      {shown.map((d) => <span key={d} className={days.includes(d) ? 'on' : ''}>{d}</span>)}
    </span>
  )
}

function Meeting({ meeting }) {
  if (!meeting.days && !meeting.begin) {
    return <><span className="faint">—</span><span className="faint">Time TBA</span><span /></>
  }
  return (
    <>
      <DayStrip days={meeting.days} />
      <span className="time">{meeting.begin ? `${formatTime(meeting.begin)} – ${formatTime(meeting.end)}` : 'TBA'}</span>
      <span className="room">{formatPlace(meeting) || <span className="faint">—</span>}</span>
    </>
  )
}

function Seats({ section }) {
  const { available, capacity, enrolled, waitlist } = section
  const tone = seatTone(available, capacity)
  return (
    <span className={`seats ${tone}`} title={capacity ? `${enrolled} of ${capacity} taken${waitlist ? `, ${waitlist} waitlisted` : ''}` : 'No seats offered'}>
      <SeatPie taken={enrolled ?? 0} capacity={capacity} tone={tone} />
      {tone === 'closed' ? <span>No seats</span> : (
        <span>
          <b>{available > 0 ? available : 'Full'}</b>
          {available > 0 && <span className="faint"> / {capacity}</span>}
        </span>
      )}
      {waitlist > 0 && <span className="wl">+{waitlist} wl</span>}
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
    <button type="button" className={copied ? 'crn copied' : 'crn'} onClick={copy} title="Copy CRN">
      {crn}
      <Icon name={copied ? 'check' : 'copy'} size={12} />
    </button>
  )
}

function SectionRow({ section }) {
  const instructors = section.instructors.map((i) => formatInstructor(i.name)).join(', ')
  return (
    <li className="row">
      <span className="sec">{section.section}</span>
      <span className="type">{section.schedule}</span>
      <span className="mtgs">
        {(section.meetings.length ? section.meetings : [{}]).map((m, i) => <Meeting key={i} meeting={m} />)}
      </span>
      <span className="who">{instructors || <span className="faint">Instructor TBA</span>}</span>
      <Seats section={section} />
      <CopyCrn crn={section.crn} />
    </li>
  )
}

export default function CourseGroup({ course, index = 0, watched, focused, status, onToggleWatch }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? course.sections : course.sections.slice(0, COLLAPSED)
  const hidden = course.sections.length - shown.length
  const tone = seatTone(course.available, course.capacity)

  return (
    <section
      id={`g-${course.code.replace(' ', '-')}`}
      className={focused ? 'group focused' : 'group'}
      style={{ '--i': Math.min(index, 10) }}
      aria-label={`${course.code} ${course.title}`}
    >
      <header className="group-head">
        <button
          type="button"
          className="collapse"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sections' : 'Collapse sections'}
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon name="chevron" size={14} className={collapsed ? 'turned' : ''} />
        </button>
        <span className="code">{course.code}</span>
        <h2>{course.title}</h2>
        {course.tag && (
          <span className={`label ${course.tag.kind}`}><i />{course.tag.label}</span>
        )}
        {status && <span className={`status ${status.kind}`}>{status.label}</span>}
        <span className="credits">{formatCredits(course.credits)}</span>
        <span className="count">{course.sections.length}</span>
        <span className="spacer" />
        <span className={`seats ${tone}`}>
          <SeatPie taken={course.capacity - course.available} capacity={course.capacity} tone={tone} />
          <span><b>{course.available}</b><span className="faint"> / {course.capacity} open</span></span>
        </span>
        <button
          type="button"
          className={watched ? 'star on' : 'star'}
          aria-pressed={watched}
          title={watched ? 'Stop watching (w)' : 'Watch (w)'}
          onClick={() => onToggleWatch(course.code)}
        >
          <Icon name="star" size={14} filled={watched} />
        </button>
      </header>

      {!collapsed && (
        <ul className="rows">
          {shown.map((s) => <SectionRow key={s.crn} section={s} />)}
          {course.sections.length > COLLAPSED && (
            <li>
              <button type="button" className="row more" onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Show fewer' : `${hidden} more section${hidden === 1 ? '' : 's'}`}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
