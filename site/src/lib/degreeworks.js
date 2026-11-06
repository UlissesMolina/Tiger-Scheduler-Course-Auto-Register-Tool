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
const NOT_COMPLETE = /^(.*?)\s*Not complete/
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
  let block = 'Degree'
  let requirement = null
  let degree = null
  let auditDate = null
  let inOtherCourses = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!degree && line === 'Degree' && i > 0) degree = lines[i - 1]
    const date = line.match(/^Audit date (\S+)/)
    if (date) auditDate = date[1]

    if (TABLE_HEADER.test(line)) {
      // The block name is the nearest real heading above the course table.
      for (let j = i - 1; j >= 0; j--) {
        const prev = lines[j]
        if (/^(Unmet conditions|Minimum credits|\*\*)/.test(prev)) continue
        block = prev
        break
      }
      inOtherCourses = /not degree-applicable/i.test(block)
      continue
    }

    const notComplete = line.match(NOT_COMPLETE)
    if (notComplete && notComplete[1]) {
      requirement = notComplete[1]
      continue
    }

    const need = line.match(NEEDED_LINE)
    if (need && i > 0 && lines.slice(Math.max(0, i - 2), i).includes('Still needed:')) {
      const { options, except } = parseCourseSpec(need[3])
      if (options.length) {
        needed.push({
          block,
          name: requirement ?? block,
          amount: Number(need[1]),
          unit: /^Class/.test(need[2]) ? 'classes' : 'credits',
          spec: need[3],
          options,
          except,
        })
      }
      continue
    }

    const course = line.match(COURSE_LINE)
    if (course) {
      // Course rows run: code, title, grade, credits, term.
      const [, , grade, credits, term] = lines.slice(i, i + 5)
      if (grade === undefined || !TERM.test(term ?? '')) continue
      const code = `${course[1]} ${course[2]}`
      if (grade === '--' || /^\(.*\)$/.test(credits)) inProgress[code] = term
      else if (!inOtherCourses || !(code in taken)) taken[code] = term
      i += 4
    }
  }

  for (const code of Object.keys(inProgress)) delete taken[code]
  return { degree, auditDate, needed, taken, inProgress, importedAt: new Date().toISOString() }
}

/**
 * Like majorTagger, for "Still needed": a course gets the first unmet
 * requirement it can satisfy, unless it is already taken or in progress.
 */
export function auditTagger(audit) {
  if (!audit) return null
  return (code, subject, number) => {
    if (code in audit.taken || code in audit.inProgress) return null
    const at = audit.needed.findIndex((r) => satisfies(r, subject, number))
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
