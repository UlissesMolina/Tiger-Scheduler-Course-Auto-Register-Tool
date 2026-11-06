/**
 * Reads a Degree Works audit copied from the browser (Ctrl+A, Ctrl+C on the
 * audit page) into what the site needs: requirements still needed, and the
 * courses already taken or in progress.
 *
 * Only that is kept. Name, student ID, GPA, grades and advisor are in the
 * pasted text but are never returned, so they are never stored.
 */

const COURSE_LINE = /^([A-Z]{2,4}) (\d[0-9A-Z]{3})$/
const NEEDED_LINE = /^(\d+(?:\.\d+)?) (Class|Classes|Credit|Credits|Hour|Hours) in (.+)$/
const TABLE_HEADER = /^Course\s+Title\s+Grade\s+Credits\s+Term/
const TERM = /^(Fall|Spring|Summer|Winter) \d{4}$/

/**
 * "MATH 2630 or 2637 or 4@ or STAT 3@ Except STAT 3010" ->
 * { options: [{subject:'MATH', number:'2630'}, ..., {subject:'MATH', prefix:'4'}, {subject:'STAT', prefix:'3'}],
 *   except: [{subject:'STAT', number:'3010'}] }
 * A bare number inherits the subject before it; "4@" is any 4000-level course.
 */
export function parseCourseSpec(spec) {
  const [include, exclude = ''] = spec.split(/\s+Except\s+/i)
  return { options: parseCourseList(include), except: parseCourseList(exclude) }
}

function parseCourseList(text) {
  const out = []
  let subject = null
  for (const raw of text.split(/\s+(?:or|and)\s+|,\s*/i)) {
    const token = raw.trim()
    if (!token) continue
    const m = token.match(/^(?:([A-Z]{2,4}|@)\s+)?(\d[0-9A-Z@]{0,3}|@)$/)
    if (!m) continue
    if (m[1]) subject = m[1]
    if (!subject) continue
    const number = m[2]
    const anySubject = subject === '@'
    if (number === '@') out.push({ subject: anySubject ? null : subject, prefix: '' })
    else if (number.endsWith('@')) out.push({ subject: anySubject ? null : subject, prefix: number.slice(0, -1) })
    else out.push({ subject: anySubject ? null : subject, number })
  }
  return out
}

function matchesOption(option, subject, number) {
  if (option.subject && option.subject !== subject) return false
  return option.number != null ? option.number === number : number.startsWith(option.prefix)
}

export function satisfies(requirement, subject, number) {
  return requirement.options.some((o) => matchesOption(o, subject, number))
    && !requirement.except.some((o) => matchesOption(o, subject, number))
}

/** Parse pasted audit text. Throws when the text does not look like a Degree Works audit. */
export function parseAudit(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).map((l) => l.trim()).filter(Boolean)
  if (!lines.some((l) => l === 'Still needed:') && !lines.some((l) => /Degree Works/i.test(l))) {
    throw new Error("This doesn't look like a Degree Works audit. Open your audit, press Ctrl+A then Ctrl+C, and paste here.")
  }

  const needed = []
  const taken = {}
  const inProgress = {}
  const courses = {} // code -> { title, credits, term, status }, for the progress page
  let block = { name: 'Degree', skip: false, requirements: [] }
  const blocks = [block]
  let requirement = null
  let degree = null
  let auditDate = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!degree && line === 'Degree' && i > 0) degree = lines[i - 1]
    const date = line.match(/^Audit date (\S+)/)
    if (date) auditDate = date[1]

    if (TABLE_HEADER.test(line)) {
      // The block name is the nearest real heading above the course table.
      let name = 'Courses'
      for (let j = i - 1; j >= 0; j--) {
        if (/^(Unmet conditions|Minimum credits|\*\*)/.test(lines[j])) continue
        name = lines[j]
        break
      }
      block = { name, skip: SKIP_BLOCK.test(name), requirements: [] }
      blocks.push(block)
      requirement = null
      continue
    }

    const req = requirementLine(line)
    if (req) {
      requirement = { ...req, courses: [], needed: null }
      if (!block.skip && !/^See /.test(req.name)) block.requirements.push(requirement)
      continue
    }

    const need = line.match(NEEDED_LINE)
    if (need && i > 0 && lines.slice(Math.max(0, i - 2), i).includes('Still needed:')) {
      const { options, except } = parseCourseSpec(need[3])
      if (options.length) {
        const amount = Number(need[1])
        const unit = /^Class/.test(need[2]) ? 'classes' : 'credits'
        needed.push({ block: block.name, name: requirement?.name ?? block.name, amount, unit, spec: need[3], options, except })
        if (requirement) requirement.needed = { amount, unit, spec: need[3] }
      }
      continue
    }

    const course = line.match(COURSE_LINE)
    if (course) {
      // Course rows run: code, title, grade, credits, term. The grade is only
      // used to tell taken from in progress, and is not kept.
      const [, title, grade, credits, term] = lines.slice(i, i + 5)
      if (grade === undefined || !TERM.test(term ?? '')) continue
      const code = `${course[1]} ${course[2]}`
      const status = grade === '--' || /^\(.*\)$/.test(credits) ? 'progress' : 'taken'
      const entry = { code, title, credits: Number(credits.replace(/[()]/g, '')) || 0, term, status }
      if (status === 'progress') inProgress[code] = term
      else if (!(code in taken) || entry.credits > (courses[code]?.credits ?? 0)) taken[code] = term
      // The same course can be listed twice (an AP duplicate at 0 credits); keep the real one.
      if (!courses[code] || entry.credits > courses[code].credits || status === 'progress') courses[code] = entry
      requirement?.courses.push(entry)
      i += 4
    }
  }

  for (const code of Object.keys(inProgress)) delete taken[code]
  // Headings that only group other requirements ("Calculus", "Biology:") have no courses of their own.
  const kept = blocks
    .filter((b) => !b.skip)
    .map((b) => ({ name: b.name, requirements: b.requirements.filter((r) => r.courses.length || r.needed) }))
    .filter((b) => b.requirements.length)
  return { degree, auditDate, needed, taken, inProgress, courses, blocks: kept, importedAt: new Date().toISOString() }
}

const SKIP_BLOCK = /^(Pre-Requisites|Other Courses|In-progress and Preregistered)/i
const REQUIREMENT_STATUS = [
  [/\s*Requirement is complete/, 'complete'],
  [/\s*When the in-progress classes are completed this requirement should be complete/, 'progress'],
  [/\s*Nearly complete - see advisor/, 'needed'],
  [/\s*Not complete/, 'needed'],
]

/** "Software Process Not completeSoftware Process" -> { name: 'Software Process', status: 'needed' } */
function requirementLine(line) {
  for (const [re, status] of REQUIREMENT_STATUS) {
    const m = line.match(re)
    if (m && m.index > 0) return { name: line.slice(0, m.index).trim(), status }
  }
  return null
}

/** Totals for the progress page: requirement counts and unique credits. */
export function auditProgress(audit) {
  const reqs = (audit.blocks ?? []).flatMap((b) => b.requirements)
  const count = (s) => reqs.filter((r) => r.status === s).length
  let credits = 0
  let creditsInProgress = 0
  for (const c of Object.values(audit.courses ?? {})) {
    if (c.status === 'taken') credits += c.credits
    else creditsInProgress += c.credits
  }
  return { total: reqs.length, complete: count('complete'), progress: count('progress'), needed: count('needed'), credits, creditsInProgress }
}

/**
 * Like majorTagger, for "Still needed": a course gets the first unmet
 * requirement it can satisfy, unless it is already taken or in progress.
 * With `only`, just the courses for that one requirement (an index into needed).
 */
export function auditTagger(audit, only = null) {
  if (!audit) return null
  return (code, subject, number) => {
    if (code in audit.taken || code in audit.inProgress) return null
    const at = only != null
      ? (audit.needed[only] && satisfies(audit.needed[only], subject, number) ? only : -1)
      : audit.needed.findIndex((r) => satisfies(r, subject, number))
    if (at === -1) return null
    const r = audit.needed[at]
    const left = `${r.amount} ${r.unit === 'classes' ? (r.amount === 1 ? 'class' : 'classes') : 'cr'}`
    return { kind: 'needed', label: `${r.name} · ${left}`, order: at }
  }
}

/** 'taken', 'in progress' (with term), or null for a course code. */
export function courseStatus(audit, code) {
  if (!audit) return null
  if (code in audit.inProgress) return { kind: 'progress', label: `In progress · ${audit.inProgress[code]}` }
  if (code in audit.taken) return { kind: 'taken', label: 'Taken' }
  return null
}
