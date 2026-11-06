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

export function activeFilterCount(filters) {
  return [filters.openOnly, filters.days.length, filters.startAfter, filters.endBefore, filters.method].filter(Boolean).length
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

export const YEAR_ORDER = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Fifth Year']
const KIND_ORDER = { required: 0, elective: 1, core: 2 }

/**
 * For a major from majors.json, a function from course to how it counts:
 * required (with the year the plan puts it in), a possible elective (an
 * undergraduate 3000-5999 course in the major's own subjects), or Core (in a
 * Core area the plan leaves open). Courses that do none of these get null.
 * `kinds` switches each of the three on or off.
 */
export function majorTagger(major, core, kinds) {
  if (!major) return null
  const coreArea = new Map()
  for (const area of major.coreAreas) for (const code of core[area] ?? []) if (!coreArea.has(code)) coreArea.set(code, area)
  return (code, subject, number) => {
    if (code in major.required) {
      if (!kinds.required) return null
      const year = major.required[code]
      return { kind: 'required', label: year ? `Required · ${year}` : 'Required', year }
    }
    if (kinds.elective && major.subjects.includes(subject) && number >= '3000' && number < '6000') {
      return { kind: 'elective', label: 'Possible elective' }
    }
    if (kinds.core && coreArea.has(code)) return { kind: 'core', label: `Core · ${coreArea.get(code)}` }
    return null
  }
}

function tagRank(tag) {
  if (!tag) return [9, 9]
  if (tag.kind === 'needed') return [0, tag.order]  // Degree Works order
  const year = YEAR_ORDER.indexOf(tag.year)
  return [KIND_ORDER[tag.kind], year === -1 ? 8 : year]
}

/** Group matching sections into courses, sorted by subject then number. */
export function searchCourses(index, query, filters, tagger = null) {
  const match = makeMatcher(query)
  const courses = new Map()
  const tags = new Map()
  for (const { section, text } of index) {
    const key = courseCode(section)
    if (tagger) {
      if (!tags.has(key)) tags.set(key, tagger(key, section.subject, section.number))
      if (!tags.get(key)) continue
    }
    if (!match(section, text) || !passesFilters(section, filters)) continue
    let course = courses.get(key)
    if (!course) {
      course = { code: key, subject: section.subject, number: section.number, title: section.title, credits: section.credits, sections: [], available: 0, capacity: 0, tag: tags.get(key) ?? null }
      courses.set(key, course)
    }
    course.sections.push(section)
    course.available += Math.max(0, section.available ?? 0)
    course.capacity += section.capacity ?? 0
  }
  // "comp" also matches titles like "Computational ...", but the COMP courses
  // are what was asked for, so code matches come first.
  const code = query.trim().toLowerCase().match(CODE_QUERY)
  const isCodeMatch = (c) => (code && c.subject.toLowerCase() === code[1] && c.number.startsWith(code[2]) ? 0 : 1)
  // With a major chosen, its required courses come first in plan order (year by year).
  const byTag = (a, b) => {
    if (!tagger) return 0
    const [ka, ya] = tagRank(a.tag)
    const [kb, yb] = tagRank(b.tag)
    return ka - kb || ya - yb
  }
  return [...courses.values()].sort((a, b) =>
    isCodeMatch(a) - isCodeMatch(b) || byTag(a, b) || a.subject.localeCompare(b.subject) || a.number.localeCompare(b.number))
}

export function buildIndex(sections) {
  return sections.map((section) => ({ section, text: haystack(section) }))
}

export function methods(sections) {
  return [...new Set(sections.map((s) => s.method).filter(Boolean))].sort()
}
