import { courseCode } from './format.js'

const CODE_QUERY = /^([a-z]{2,4})\s*(\d{0,4})$/

/** Lowercased text a section can be found by: code, title and instructors. */
export function haystack(section) {
  const names = section.instructors.map((i) => i.name.replace(',', '')).join(' ')
  return `${section.subject} ${section.number} ${section.subject}${section.number} ${section.title ?? ''} ${names} ${section.crn}`.toLowerCase()
}

/**
 * Build a predicate for a free-text query.
 * "comp", "comp 12", "COMP1210" match by course code prefix; anything else must
 * match every word somewhere in the code, title, instructor names or CRN.
 */
export function makeMatcher(query) {
  const q = query.trim().toLowerCase()
  if (!q) return () => true
  const code = q.match(CODE_QUERY)
  const words = q.split(/\s+/)
  return (section, text) => {
    if (code && section.subject.toLowerCase() === code[1] && section.number.startsWith(code[2])) return true
    return words.every((w) => text.includes(w))
  }
}

/** Minutes since midnight for "HHMM", or null. */
function minutes(hhmm) {
  return hhmm ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2)) : null
}

export function passesFilters(section, filters) {
  if (filters.openOnly && !(section.available > 0)) return false
  if (filters.method && section.method !== filters.method) return false
  if (filters.days.length) {
    const allowed = new Set(filters.days)
    for (const m of section.meetings) {
      for (const d of m.days ?? '') if (!allowed.has(d)) return false
    }
  }
  if (filters.startAfter || filters.endBefore) {
    const after = minutes(filters.startAfter)
    const before = minutes(filters.endBefore)
    for (const m of section.meetings) {
      const b = minutes(m.begin)
      const e = minutes(m.end)
      if (after != null && b != null && b < after) return false
      if (before != null && e != null && e > before) return false
    }
  }
  return true
}

/** Group matching sections into courses, sorted by subject then number. */
export function searchCourses(index, query, filters) {
  const match = makeMatcher(query)
  const courses = new Map()
  for (const { section, text } of index) {
    if (!match(section, text) || !passesFilters(section, filters)) continue
    const key = courseCode(section)
    let course = courses.get(key)
    if (!course) {
      course = { code: key, subject: section.subject, number: section.number, title: section.title, credits: section.credits, sections: [], available: 0, capacity: 0 }
      courses.set(key, course)
    }
    course.sections.push(section)
    course.available += Math.max(0, section.available ?? 0)
    course.capacity += section.capacity ?? 0
  }
  return [...courses.values()].sort((a, b) => a.subject.localeCompare(b.subject) || a.number.localeCompare(b.number))
}

export function buildIndex(sections) {
  return sections.map((section) => ({ section, text: haystack(section) }))
}

export function methods(sections) {
  return [...new Set(sections.map((s) => s.method).filter(Boolean))].sort()
}
