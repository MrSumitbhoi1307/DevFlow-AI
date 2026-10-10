const { after, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')
const User = require('../models/user')
const Project = require('../models/project')
const Issue = require('../models/issue')

const jwtSecret = 'test-issues-secret-that-is-long-enough-to-meet-32-characters'
let mongoServer
let app
let sequence = 0

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  await Promise.all([User.init(), Project.init(), Issue.init()])
  app = createApp({ clientOrigin: 'http://localhost:5173', jwtSecret })
})

beforeEach(async () => {
  await Issue.deleteMany({})
  await Project.deleteMany({})
  await User.deleteMany({})
  sequence = 0
})

after(async () => {
  await Issue.deleteMany({})
  await Project.deleteMany({})
  await User.deleteMany({})
  await disconnectDatabase()
  await mongoServer?.stop()
})

async function createUser(role = 'developer', status = 'active') {
  sequence += 1
  return User.create({
    name: `${role} ${sequence}`,
    email: `${role}-${sequence}@example.com`,
    password: 'StrongPassword123',
    role,
    status,
  })
}

function tokenFor(user) {
  return jwt.sign({ sub: user.id }, jwtSecret, {
    expiresIn: '1h',
    issuer: 'devflow-ai',
    audience: 'devflow-ai',
  })
}

function asUser(user, method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${tokenFor(user)}`)
}

async function createProject(owner, members = []) {
  return Project.create({ name: `Project ${sequence}`, owner: owner._id, members })
}

async function createIssue(project, reporter, overrides = {}) {
  return Issue.create({
    title: 'Test issue',
    project: project._id,
    reporter: reporter._id,
    ...overrides,
  })
}

test('all issue routes require authentication', async () => {
  const reporter = await createUser()
  const project = await createProject(reporter)
  const issue = await createIssue(project, reporter)

  assert.equal((await request(app).get('/api/issues')).status, 401)
  assert.equal((await request(app).post('/api/issues').send({})).status, 401)
  assert.equal((await request(app).get(`/api/issues/${issue.id}`)).status, 401)
  assert.equal((await request(app).patch(`/api/issues/${issue.id}`).send({ status: 'closed' })).status, 401)
  assert.equal((await request(app).delete(`/api/issues/${issue.id}`)).status, 401)
})

test('Developer creates issues only in visible projects and reporter is taken from the token', async () => {
  const reporter = await createUser()
  const otherDeveloper = await createUser()
  const project = await createProject(reporter)
  const hiddenProject = await createProject(otherDeveloper)

  const created = await asUser(reporter, 'post', '/api/issues').send({
    title: '  Broken sign in  ',
    description: 'Button returns an error',
    projectId: String(project._id),
    priority: 'high',
  })
  assert.equal(created.status, 201)
  assert.equal(created.body.issue.title, 'Broken sign in')
  assert.equal(created.body.issue.status, 'open')
  assert.equal(created.body.issue.priority, 'high')
  assert.equal(created.body.issue.reporter._id, String(reporter._id))

  const hidden = await asUser(reporter, 'post', '/api/issues').send({
    title: 'Hidden project issue',
    projectId: String(hiddenProject._id),
  })
  assert.equal(hidden.status, 404)
})

test('issue creation rejects invalid fields, IDs, and inactive assignees', async () => {
  const reporter = await createUser()
  const inactive = await createUser('developer', 'inactive')
  const project = await createProject(reporter)

  const invalid = await asUser(reporter, 'post', '/api/issues').send({
    title: 'x',
    projectId: String(project._id),
    status: 'blocked',
    unexpected: true,
  })
  assert.equal(invalid.status, 400)

  const invalidId = await asUser(reporter, 'post', '/api/issues').send({ title: 'Valid title', projectId: 'bad-id' })
  assert.equal(invalidId.status, 400)

  const invalidAssignee = await asUser(reporter, 'post', '/api/issues').send({
    title: 'Valid title',
    projectId: String(project._id),
    assigneeId: String(inactive._id),
  })
  assert.equal(invalidAssignee.status, 400)
})

test('list supports a visible-project filter and hides issues in inaccessible projects', async () => {
  const reporter = await createUser()
  const other = await createUser()
  const project = await createProject(reporter)
  const hiddenProject = await createProject(other)
  await createIssue(project, reporter, { title: 'Visible issue' })
  await createIssue(hiddenProject, other, { title: 'Hidden issue' })

  const list = await asUser(reporter, 'get', '/api/issues')
  assert.equal(list.status, 200)
  assert.deepEqual(list.body.issues.map((issue) => issue.title), ['Visible issue'])

  const filter = await asUser(reporter, 'get', `/api/issues?projectId=${hiddenProject._id}`)
  assert.equal(filter.status, 404)
  const invalidFilter = await asUser(reporter, 'get', '/api/issues?projectId=bad-id')
  assert.equal(invalidFilter.status, 400)
})

test('read returns 404 for missing, malformed, or inaccessible issues', async () => {
  const reporter = await createUser()
  const other = await createUser()
  const project = await createProject(other)
  const issue = await createIssue(project, other)

  assert.equal((await asUser(reporter, 'get', '/api/issues/not-an-id')).status, 404)
  assert.equal((await asUser(reporter, 'get', `/api/issues/${issue._id}`)).status, 404)
  assert.equal((await asUser(other, 'get', `/api/issues/${issue._id}`)).status, 200)
})

test('Developers can update and remove their own issues but receive 403 for another reporter issue', async () => {
  const reporter = await createUser()
  const otherReporter = await createUser()
  const project = await createProject(reporter, [otherReporter._id])
  const ownIssue = await createIssue(project, reporter)
  const otherIssue = await createIssue(project, otherReporter)

  const updated = await asUser(reporter, 'patch', `/api/issues/${ownIssue._id}`).send({ status: 'in-progress' })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.issue.status, 'in-progress')

  const forbiddenUpdate = await asUser(reporter, 'patch', `/api/issues/${otherIssue._id}`).send({ title: 'Not allowed' })
  assert.equal(forbiddenUpdate.status, 403)
  const forbiddenDelete = await asUser(reporter, 'delete', `/api/issues/${otherIssue._id}`)
  assert.equal(forbiddenDelete.status, 403)

  assert.equal((await asUser(reporter, 'delete', `/api/issues/${ownIssue._id}`)).status, 200)
})

test('Admin can update and remove issues reported by another user', async () => {
  const reporter = await createUser()
  const admin = await createUser('admin')
  const project = await createProject(reporter)
  const issue = await createIssue(project, reporter)

  const updated = await asUser(admin, 'patch', `/api/issues/${issue._id}`).send({ priority: 'low', title: 'Admin edit' })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.issue.priority, 'low')
  assert.equal(updated.body.issue.title, 'Admin edit')
  assert.equal((await asUser(admin, 'delete', `/api/issues/${issue._id}`)).status, 200)
})

test('issue update validates the allowed fields and requires a non-empty change', async () => {
  const reporter = await createUser()
  const project = await createProject(reporter)
  const issue = await createIssue(project, reporter)

  assert.equal((await asUser(reporter, 'patch', `/api/issues/${issue._id}`).send({})).status, 400)
  assert.equal((await asUser(reporter, 'patch', `/api/issues/${issue._id}`).send({ status: 'blocked' })).status, 400)
  assert.equal((await asUser(reporter, 'patch', `/api/issues/${issue._id}`).send({ reporter: String(reporter._id) })).status, 400)
})
