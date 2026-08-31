export type AccountRole = 'ADMIN' | 'PSYCHOLOGIST'
export type StudentOrigin = 'TRACKED' | 'AUTO'
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'SCALE' | 'TEXT'
export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface Profile {
  id: string
  login: string
  fullName: string
  role: AccountRole
  mustChangePassword: boolean
  totpEnabled: boolean
  hasPin: boolean
  pinIntervalMinutes: number
  locked: boolean
  setupStep: 'password' | 'totp' | 'pin' | 'done'
  unusedBackupCodes: number
}

export interface AccountRow {
  id: string
  login: string
  fullName: string
  role: AccountRole
  totpEnabled: boolean
  mustChangePassword: boolean
  tempPassword: string | null
  activeSessions: number
  lastSeenAt: string | null
  createdAt: string
}

export interface SessionRow {
  id: string
  current: boolean
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  ip: string
  userAgent: string
}

export interface ClassRow {
  id: string
  number: number
  letter: string
  name: string
  plannedSize: number
  homeroomTeacher: string
  trackedCount: number
  autoCount: number
  studentCount: number
  completedRuns: number
  archived: boolean
  archivedAt: string | null
  createdAt: string
}

export interface StudentTag {
  id: string
  label: string
  color: string
}

export interface StudentRow {
  id: string
  lastName: string
  firstName: string
  fullName: string
  origin: StudentOrigin
  classId: string
  className: string
  birthDate: string | null
  comment: string
  runCount: number
  noteCount: number
  lastRunAt: string | null
  tags: StudentTag[]
  possibleDuplicateOf: { id: string; fullName: string; origin: StudentOrigin } | null
  archived: boolean
  createdAt: string
}

export interface StudentNote {
  id: string
  text: string
  authorName: string
  createdAt: string
  updatedAt: string
}

export interface StudentDetail extends StudentRow {
  runs: {
    id: string
    testId: string
    testTitle: string
    className: string
    score: number | null
    maxScore: number | null
    interpretationLabel: string | null
    completedAt: string | null
  }[]
  notes: StudentNote[]
}

export interface Choice {
  text: string
  score: number
}

export interface QuestionOptions {
  choices?: Choice[]
  min?: number
  max?: number
  step?: number
  minLabel?: string
  maxLabel?: string
  reverse?: boolean
}

export interface Question {
  id: string
  text: string
  order: number
  type: QuestionType
  options: QuestionOptions
}

export interface Interpretation {
  id: string
  minScore: number
  maxScore: number
  label: string
  text: string
  color: string
  order: number
}

export interface TestSummary {
  id: string
  title: string
  description: string
  isBuiltIn: boolean
  isPublished: boolean
  showResult: boolean
  questionCount: number
  maxScore: number
  runCount: number
  authorName: string | null
  createdAt: string
  updatedAt: string
}

export interface TestView extends TestSummary {
  instructions: string
  questions: Question[]
  interpretations: Interpretation[]
}

export interface TakingQuestion {
  id: string
  text: string
  order: number
  type: QuestionType
  options: {
    choices?: { text: string }[]
    min?: number
    max?: number
    step?: number
    minLabel?: string
    maxLabel?: string
  }
}

export interface TakingTest {
  id: string
  title: string
  description: string
  instructions: string
  questions: TakingQuestion[]
}

export interface CampaignClassStats {
  classId: string
  className: string
  homeroomTeacher: string
  issued: number
  used: number
  revoked: number
}

export interface CampaignRow {
  id: string
  title: string
  testId: string
  testTitle: string
  authorName: string
  classes: CampaignClassStats[]
  totalIssued: number
  totalUsed: number
  createdAt: string
  expiresAt: string | null
  closedAt: string | null
}

export interface PrintCode {
  code: string
  formatted: string
  seq: number
  url: string
  used: boolean
}

export interface PrintSheet {
  campaignId: string
  title: string
  testTitle: string
  baseUrl: string
  createdAt: string
  expiresAt: string | null
  classes: { classId: string; className: string; homeroomTeacher: string; codes: PrintCode[] }[]
}

export interface RunRow {
  id: string
  testId: string
  testTitle: string
  studentId: string
  studentName: string
  className: string
  classId: string
  campaignId: string | null
  campaignTitle: string | null
  score: number | null
  maxScore: number | null
  percent: number | null
  interpretationLabel: string | null
  startedAt: string
  completedAt: string | null
}

export interface RunAnswer {
  questionId: string
  questionText: string
  type: QuestionType
  answerText: string
  score: number
}

export interface RunDetail extends RunRow {
  interpretationText: string | null
  studentOrigin: StudentOrigin
  instructions: string
  answers: RunAnswer[]
}

export interface LevelSlice {
  label: string
  color: string
  count: number
  percent: number
}

export interface ScopeStats {
  key: string
  label: string
  runs: number
  students: number
  avgScore: number | null
  avgPercent: number | null
  minScore: number | null
  maxScore: number | null
  levels: LevelSlice[]
}

export interface TestReport {
  test: {
    id: string
    title: string
    maxScore: number
    interpretations: { label: string; color: string; minScore: number; maxScore: number }[]
  }
  school: ScopeStats
  parallels: ScopeStats[]
  classes: ScopeStats[]
  timeline: { period: string; runs: number; avgPercent: number | null }[]
}

export interface ClassReport {
  className: string
  homeroomTeacher: string
  plannedSize: number
  testTitle: string
  rows: {
    runId: string
    studentId: string
    studentName: string
    origin: StudentOrigin
    score: number | null
    maxScore: number | null
    percent: number | null
    level: string | null
    color: string
    completedAt: string
  }[]
}

export interface Overview {
  tiles: {
    classes: number
    students: number
    trackedStudents: number
    tests: number
    publishedTests: number
    runs: number
    runsLast30: number
    activeCodes: number
    duplicates: number
  }
  coverage: {
    classId: string
    className: string
    plannedSize: number
    knownStudents: number
    testedStudents: number
    coveragePercent: number
  }[]
  activity: { date: string; runs: number }[]
  attention: {
    studentId: string
    studentName: string
    className: string
    reasons: string[]
    tags: StudentTag[]
    lastRunAt: string | null
  }[]
  recent: {
    id: string
    studentName: string
    className: string
    testTitle: string
    score: number | null
    interpretationLabel: string | null
    color: string
    completedAt: string
  }[]
}

export interface InviteIdentifyState {
  stage: 'identify'
  className: string
  test: { id: string; title: string; description: string; instructions: string; questionCount: number }
}

export interface InviteResumeState {
  stage: 'resume'
  className: string
  runToken: string
  test: TakingTest
  studentName: string
}

export type InviteState = InviteIdentifyState | InviteResumeState

export interface SubmitOutcome {
  ok: true
  showResult: boolean
  score?: number
  maxScore?: number
  interpretationLabel?: string | null
  interpretationText?: string | null
}
