import assert from 'node:assert/strict'
import { test } from 'node:test'
import { auditProgress, auditTagger, courseStatus, parseAudit, parseCourseSpec, satisfies } from './degreeworks.js'

// A made-up audit in the exact shape Degree Works pastes as (Ctrl+A, Ctrl+C):
// blank lines between fields, requirement names repeated, course rows as
// code / title / grade / credits / term. Not a real student's record.
const AUDIT = `Current page is worksheetsSkip to main content
Ellucian Logo
Worksheets
Doe, Jane
Worksheets
900000000
Student ID
Doe, Jane
Name
Bachelor of Software Engr
Degree
Level UndergraduateClassification JuniorMajor Software Engineering - SENG
Overall GPA

3.50
Audit date 11/05/2026 8:25 PM

Bachelor of Software Engineering
GRADUATION COURSE Not complete
GRADUATION COURSE

Required Graduation Course Not completeRequired Graduation Course

Still needed:

1 Class in UNIV 4AA0
Software Engineering Major Courses
Unmet conditions for this set of requirements:

Minimum credits unsatisfied

Course    Title    Grade    Credits    Term    Repeated
Fundamentals of Computing I Requirement is completeFundamentals of Computing I

COMP 1210

Fundamentals Of Computing I

B

3

Fall 2024

Introduction to Operating Systems When the in-progress classes are completed this requirement should be completeIntroduction to Operating Systems

COMP 3500

Intro To Operating Systems

--

(3)

Fall 2026

Software Process Not completeSoftware Process

Still needed:

3 Credits in COMP 5700
Select 9 Hours of Technical Electives Not completeSelect 9 Hours of Technical Electives

COMP 4200

Formal Languages

--

(3)

Spring 2027

Still needed:

3 Credits in COMP 5970 or 5130 or 5210
Software Engineering Supporting Courses
Course    Title    Grade    Credits    Term    Repeated
Math Electives Not completeMath Electives

Still needed:

3 Credits in MATH 2630 or 2637 or 4@ or 5@ or STAT 3@ or 4@ Except STAT 3010
Free Elective Requirement is completeFree Elective

MATH 1130

Precalculus Trigonometry

S

3

Spring 2025

Satisfied by: AP6601 - Math: Calculus AB - Advanced Placement Credit

Other Courses - These courses are not degree-applicable
Course    Title    Grade    Credits    Term    Repeated
ENGR 3920

Internship in Engineering

S

0

Summer 2026

Legend
@

Any course number
Ellucian Degree Works - © Copyright 1995-2025 Ellucian Company L.P. and its affiliates`

test('parses still-needed requirements with their names and blocks', () => {
  const audit = parseAudit(AUDIT)
  assert.deepEqual(audit.needed.map((r) => [r.block, r.name, r.amount, r.unit]), [
    ['Degree', 'Required Graduation Course', 1, 'classes'],
    ['Software Engineering Major Courses', 'Software Process', 3, 'credits'],
    ['Software Engineering Major Courses', 'Select 9 Hours of Technical Electives', 3, 'credits'],
    ['Software Engineering Supporting Courses', 'Math Electives', 3, 'credits'],
  ])
  assert.equal(audit.degree, 'Bachelor of Software Engr')
  assert.equal(audit.auditDate, '11/05/2026')
})

test('separates taken from in-progress courses', () => {
  const audit = parseAudit(AUDIT)
  assert.deepEqual(Object.keys(audit.taken).sort(), ['COMP 1210', 'ENGR 3920', 'MATH 1130'])
  assert.deepEqual(audit.inProgress, { 'COMP 3500': 'Fall 2026', 'COMP 4200': 'Spring 2027' })
})

test('keeps nothing personal', () => {
  const stored = JSON.stringify(parseAudit(AUDIT))
  for (const secret of ['Doe', 'Jane', '900000000', '3.50', '"B"']) assert.ok(!stored.includes(secret), secret)
})

test('course specs: inherited subjects, wildcards and exceptions', () => {
  const { options, except } = parseCourseSpec('MATH 2630 or 2637 or 4@ or STAT 3@ or 4@ Except STAT 3010')
  assert.deepEqual(options, [
    { subject: 'MATH', number: '2630' },
    { subject: 'MATH', number: '2637' },
    { subject: 'MATH', prefix: '4' },
    { subject: 'STAT', prefix: '3' },
    { subject: 'STAT', prefix: '4' },
  ])
  assert.deepEqual(except, [{ subject: 'STAT', number: '3010' }])
  const req = { options, except }
  assert.equal(satisfies(req, 'STAT', '3600'), true)
  assert.equal(satisfies(req, 'STAT', '3010'), false)
  assert.equal(satisfies(req, 'MATH', '4310'), true)
  assert.equal(satisfies(req, 'MATH', '2660'), false)
  assert.equal(satisfies(req, 'COMP', '4310'), false)
})

test('alphanumeric course numbers', () => {
  assert.deepEqual(parseCourseSpec('UNIV 4AA0').options, [{ subject: 'UNIV', number: '4AA0' }])
})

test('tagger: still-needed courses in audit order, skipping taken and in progress', () => {
  const tag = auditTagger(parseAudit(AUDIT))
  assert.deepEqual(tag('COMP 5700', 'COMP', '5700'), { kind: 'needed', label: 'Software Process · 3 cr', order: 1 })
  assert.equal(tag('UNIV 4AA0', 'UNIV', '4AA0').label, 'Required Graduation Course · 1 class')
  assert.equal(tag('STAT 3600', 'STAT', '3600').order, 3)
  assert.equal(tag('COMP 3500', 'COMP', '3500'), null) // in progress
  assert.equal(tag('COMP 1210', 'COMP', '1210'), null) // taken
  assert.equal(tag('COMP 2210', 'COMP', '2210'), null) // not needed
})

test('course status', () => {
  const audit = parseAudit(AUDIT)
  assert.deepEqual(courseStatus(audit, 'COMP 3500'), { kind: 'progress', label: 'In progress · Fall 2026' })
  assert.deepEqual(courseStatus(audit, 'COMP 1210'), { kind: 'taken', label: 'Taken' })
  assert.equal(courseStatus(audit, 'COMP 5700'), null)
})

test('progress: every requirement with its status and courses, grouped by block', () => {
  const audit = parseAudit(AUDIT)
  assert.deepEqual(audit.blocks.map((b) => b.name), [
    'Degree', 'Software Engineering Major Courses', 'Software Engineering Supporting Courses',
  ])
  const major = audit.blocks[1].requirements
  assert.deepEqual(major.map((r) => [r.name, r.status]), [
    ['Fundamentals of Computing I', 'complete'],
    ['Introduction to Operating Systems', 'progress'],
    ['Software Process', 'needed'],
    ['Select 9 Hours of Technical Electives', 'needed'],
  ])
  assert.deepEqual(major[0].courses, [{ code: 'COMP 1210', title: 'Fundamentals Of Computing I', credits: 3, term: 'Fall 2024', status: 'taken' }])
  assert.deepEqual(major[3].courses.map((c) => [c.code, c.status]), [['COMP 4200', 'progress']])
  assert.deepEqual(major[3].needed, { amount: 3, unit: 'credits', spec: 'COMP 5970 or 5130 or 5210' })
  // Other Courses is not degree-applicable and is left out of the blocks.
  assert.ok(!audit.blocks.some((b) => /Other Courses/.test(b.name)))
})

test('progress totals count unique credits', () => {
  const totals = auditProgress(parseAudit(AUDIT))
  assert.deepEqual(totals, { total: 7, complete: 2, progress: 1, needed: 4, credits: 6, creditsInProgress: 6 })
})

test('tagger narrowed to one requirement', () => {
  const audit = parseAudit(AUDIT)
  const tech = audit.needed.findIndex((r) => r.name.startsWith('Select 9'))
  const tag = auditTagger(audit, tech)
  assert.equal(tag('COMP 5130', 'COMP', '5130').order, tech)
  assert.equal(tag('COMP 5700', 'COMP', '5700'), null)
})

test('rejects text that is not an audit', () => {
  assert.throws(() => parseAudit('hello world'), /Degree Works audit/)
})
