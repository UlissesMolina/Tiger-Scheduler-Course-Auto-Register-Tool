export const DAY_ORDER = ['M', 'T', 'W', 'R', 'F', 'S', 'U']
export const DAY_NAMES = { M: 'Mon', T: 'Tue', W: 'Wed', R: 'Thu', F: 'Fri', S: 'Sat', U: 'Sun' }

/** "1230" -> "12:30p", "0800" -> "8:00a" */
export function formatTime(hhmm) {
  if (!hhmm || hhmm.length !== 4) return ''
  const h = Number(hhmm.slice(0, 2))
  const m = hhmm.slice(2)
  const suffix = h >= 12 ? 'p' : 'a'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m}${suffix}`
}

export function formatMeeting(meeting) {
  if (!meeting.days && !meeting.begin) return 'TBA'
  const time = meeting.begin ? `${formatTime(meeting.begin)}–${formatTime(meeting.end)}` : 'TBA'
  return meeting.days ? `${meeting.days} ${time}` : time
}

export function formatPlace(meeting) {
  if (!meeting.building) return ''
  return meeting.room ? `${meeting.building} ${meeting.room}` : meeting.building
}

/** "Heston, Gregory" -> "Gregory Heston" */
export function formatInstructor(name) {
  const [last, first] = name.split(',').map((s) => s.trim())
  return first ? `${first} ${last}` : last
}

export function formatCredits(credits) {
  if (credits == null) return ''
  if (Array.isArray(credits)) return `${credits[0]}–${credits[1]} cr`
  return `${credits} cr`
}

export function courseCode(section) {
  return `${section.subject} ${section.number}`
}

export function formatUpdated(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/** open, low (a few seats left), full, or closed (no seats offered at all). */
export function seatTone(available, capacity) {
  if (!capacity) return 'closed'
  if (!(available > 0)) return 'full'
  return available <= Math.max(3, capacity * 0.1) ? 'low' : 'open'
}

export const TIMES = ['0700', '0800', '0900', '1000', '1100', '1200', '1300', '1400', '1500', '1600', '1700', '1800', '1900', '2000', '2100']

/** "1300" -> "1pm" */
export function timeLabel(hhmm) {
  const h = Number(hhmm.slice(0, 2))
  return `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'pm' : 'am'}`
}
