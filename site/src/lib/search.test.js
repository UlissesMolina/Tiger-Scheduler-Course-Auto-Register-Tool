import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatInstructor, formatMeeting, formatTime } from './format.js'
import { buildIndex, majorTagger, passesFilters, searchCourses } from './search.js'

const section = (over) => ({
  crn: '10001', subject: 'COMP', number: '1210', section: '001', title: 'Fundamentals of Computing I',
  credits: 3, method: 'Campus', enrolled: 10, capacity: 40, available: 30, waitlist: 0,
  instructors: [{ name: 'Smith, Jane', email: 'jas0001@auburn.edu', primary: true }],
  meetings: [{ days: 'MW', begin: '0900', end: '0950', building: 'SHEL', room: '1101' }],
  ...over,
})

const SECTIONS = [
  section({}),
  section({ crn: '10002', section: '002', available: 0, enrolled: 40, meetings: [{ days: 'TR', begin: '1400', end: '1515' }] }),
  section({ crn: '10003', number: '2210', title: 'Fundamentals of Computing II', instructors: [{ name: 'Lee, Ana' }] }),
  section({ crn: '10004', subject: 'MATH', number: '1610', title: 'Calculus I', method: 'Online', instructors: [], meetings: [] }),
]
const index = buildIndex(SECTIONS)
const NONE = { openOnly: false, days: [], startAfter: '', endBefore: '', method: '' }
const codes = (q, f = NONE) => searchCourses(index, q, f).map((c) => c.code)

test('course code queries match by prefix, with or without a space', () => {
  assert.deepEqual(codes('comp 1210'), ['COMP 1210'])
  assert.deepEqual(codes('COMP1210'), ['COMP 1210'])
  assert.deepEqual(codes('comp 12'), ['COMP 1210'])
  assert.deepEqual(codes('comp'), ['COMP 1210', 'COMP 2210'])
})

test('code matches rank ahead of title matches', () => {
  const extra = buildIndex([...SECTIONS, section({ crn: '10005', subject: 'AERO', number: '7140', title: 'Advanced Computational Fluid Dynamics' })])
  assert.deepEqual(searchCourses(extra, 'comp', NONE).map((c) => c.code), ['COMP 1210', 'COMP 2210', 'AERO 7140'])
})

test('major filter tags required, elective and core courses and orders them', () => {
  const sections = [
    section({ crn: '1', subject: 'COMP', number: '2210' }),
    section({ crn: '2', subject: 'COMP', number: '1210' }),
    section({ crn: '3', subject: 'COMP', number: '4320' }),
    section({ crn: '4', subject: 'COMP', number: '7970' }),
    section({ crn: '5', subject: 'HIST', number: '1010' }),
    section({ crn: '6', subject: 'ARTS', number: '1510' }),
  ]
  const major = { required: { 'COMP 1210': 'Freshman', 'COMP 2210': 'Sophomore' }, subjects: ['COMP'], coreAreas: ['History'] }
  const core = { History: ['HIST 1010'], 'Fine Arts': ['ARTS 1510'] }
  const all = { required: true, elective: true, core: true }
  const run = (kinds) => searchCourses(buildIndex(sections), '', NONE, majorTagger(major, core, kinds))
  const result = run(all)
  assert.deepEqual(result.map((c) => c.code), ['COMP 1210', 'COMP 2210', 'COMP 4320', 'HIST 1010'])
  assert.deepEqual(result.map((c) => c.tag.label), ['Required · Freshman', 'Required · Sophomore', 'Possible elective', 'Core · History'])
  assert.deepEqual(run({ ...all, required: false }).map((c) => c.code), ['COMP 4320', 'HIST 1010'])
  assert.equal(majorTagger(null, core, all), null)
})

test('words match title, instructor and CRN', () => {
  assert.deepEqual(codes('calculus'), ['MATH 1610'])
  assert.deepEqual(codes('ana lee'), ['COMP 2210'])
  assert.deepEqual(codes('10004'), ['MATH 1610'])
  assert.deepEqual(codes('computing ii'), ['COMP 2210'])
})

test('sections group under their course with seat totals', () => {
  const [course] = searchCourses(index, 'comp 1210', NONE)
  assert.equal(course.sections.length, 2)
  assert.equal(course.available, 30)
  assert.equal(course.capacity, 80)
})

test('filters', () => {
  assert.equal(passesFilters(SECTIONS[1], { ...NONE, openOnly: true }), false)
  assert.equal(passesFilters(SECTIONS[0], { ...NONE, days: ['M', 'W', 'F'] }), true)
  assert.equal(passesFilters(SECTIONS[1], { ...NONE, days: ['M', 'W', 'F'] }), false)
  assert.equal(passesFilters(SECTIONS[3], { ...NONE, days: ['M'] }), true, 'no meeting days is not excluded')
  assert.equal(passesFilters(SECTIONS[0], { ...NONE, startAfter: '1000' }), false)
  assert.equal(passesFilters(SECTIONS[1], { ...NONE, startAfter: '1000', endBefore: '1600' }), true)
  assert.equal(passesFilters(SECTIONS[1], { ...NONE, endBefore: '1500' }), false)
  assert.deepEqual(codes('', { ...NONE, method: 'Online' }), ['MATH 1610'])
})

test('formatting', () => {
  assert.equal(formatTime('0900'), '9:00a')
  assert.equal(formatTime('1200'), '12:00p')
  assert.equal(formatTime('1515'), '3:15p')
  assert.equal(formatInstructor('Smith, Jane'), 'Jane Smith')
  assert.equal(formatMeeting({ days: 'MW', begin: '0900', end: '0950' }), 'MW 9:00a–9:50a')
  assert.equal(formatMeeting({}), 'TBA')
})
