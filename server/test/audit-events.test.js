const { after, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')
const { bootstrapInitialAdmin } = require('../services/bootstrapAdmin')
const User = require('../models/user')
const Project = require('../models/project')
const Issue = require('../models/issue')
const AuditLog = require('../models/auditLog')
const AdminBootstrap = require('../models/adminBootstrap')

const jwtSecret = 'test-audit-event-secret-that-is-at-least-32-characters'
let mongoServer
let app
let admin
let developer

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  await Promise.all([User.init(), Project.init(), Issue.init(), AuditLog.init(), AdminBootstrap.init()])
  app = createApp({ clientOrigin: 'http://localhost:5173', jwtSecret })
})

beforeEach(async () => {
  await Promise.all([
    AuditLog.deleteMany({}), Issue.deleteMany({}), Project.deleteMany({}),
    AdminBootstrap.deleteMany({}), User.deleteMany({}),
  ])
  admin = await User.create({
    name: 'Audit Admin', email: 'audit-admin@example.com', password: 'StrongPassword123', role: 'admin',
  })
  developer = await User.create({
    name: 'Audit Developer', email: 'audit-dev@example.com', password: 'StrongPassword123', role: 'developer',
  })
})

after(async () => {
  await Promise.all([AuditLog.deleteMany({}), Issue.deleteMany({}), Project.deleteMany({}), User.deleteMany({})])
  await disconnectDatabase()
  await mongoServer?.stop()
})

function tokenFor(user) {
  return jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '1h', issuer: 'devflow-ai', audience: 'devflow-ai' })
}

function asAdmin(method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${tokenFor(admin)}`)
}

test('Admin role changes create safe audit entries', async () => {
  const response = await asAdmin('patch', `/api/admin/users/${developer.id}/role`).send({ role: 'admin' })
  assert.equal(response.status, 200)

  const entry = await AuditLog.findOne({ action: 'user.role_changed' }).lean()
  assert.equal(String(entry.actor), admin.id)
  assert.equal(entry.targetType, 'user')
  assert.equal(entry.targetId, developer.id)
  assert.deepEqual(entry.metadata, { fromRole: 'developer', toRole: 'admin' })
})

test('both account deactivation and activation create audit entries', async () => {
  const deactivated = await asAdmin('patch', `/api/admin/users/${developer.id}/status`).send({ status: 'inactive' })
  assert.equal(deactivated.status, 200)
  const activated = await asAdmin('patch', `/api/admin/users/${developer.id}/status`).send({ status: 'active' })
  assert.equal(activated.status, 200)

  const entries = await AuditLog.find({ action: 'user.status_changed' }).sort({ createdAt: 1 }).lean()
  assert.equal(entries.length, 2)
  assert.deepEqual(entries.map(({ metadata }) => metadata), [
    { fromStatus: 'active', toStatus: 'inactive' },
    { fromStatus: 'inactive', toStatus: 'active' },
  ])
})

test('Admin user removal creates an audit entry without storing user secrets', async () => {
  const response = await asAdmin('delete', `/api/admin/users/${developer.id}`)
  assert.equal(response.status, 200)
  const entry = await AuditLog.findOne({ action: 'user.removed' }).lean()
  assert.equal(entry.targetId, developer.id)
  assert.deepEqual(entry.metadata, { role: 'developer', status: 'active' })
  assert.equal(Object.hasOwn(entry, 'password'), false)
})

test('issue creation and deletion each create an audit entry', async () => {
  const project = await Project.create({ name: 'Audit project', owner: developer._id })
  const created = await request(app).post('/api/issues')
    .set('Authorization', `Bearer ${tokenFor(developer)}`)
    .send({ title: 'Audit issue', projectId: String(project._id), priority: 'high' })
  assert.equal(created.status, 201)

  const issueId = created.body.issue._id
  const removed = await request(app).delete(`/api/issues/${issueId}`)
    .set('Authorization', `Bearer ${tokenFor(developer)}`)
  assert.equal(removed.status, 200)

  const entries = await AuditLog.find({ targetId: issueId }).sort({ action: 1 }).lean()
  assert.deepEqual(entries.map(({ action }) => action), ['issue.created', 'issue.deleted'])
  assert.deepEqual(entries.find(({ action }) => action === 'issue.created').metadata, {
    projectId: String(project._id), status: 'open', priority: 'high',
  })
  for (const entry of entries) {
    assert.equal(Object.hasOwn(entry.metadata, 'password'), false)
    assert.equal(Object.hasOwn(entry.metadata, 'token'), false)
  }
})

test('successful initial Admin bootstrap is logged without credentials', async () => {
  await User.deleteMany({})
  const result = await bootstrapInitialAdmin({
    MONGODB_URI: 'mongodb://localhost/test',
    INITIAL_ADMIN_NAME: 'Bootstrap Admin',
    INITIAL_ADMIN_EMAIL: 'bootstrap-audit@example.com',
    INITIAL_ADMIN_PASSWORD: 'BootstrapPassword123',
  })
  const entry = await AuditLog.findOne({ action: 'admin.bootstrap_completed' }).lean()
  assert.equal(entry.actor.toString(), result.userId)
  assert.equal(entry.targetId, result.userId)
  assert.deepEqual(entry.metadata, { role: 'admin', status: 'active', bootstrap: true })
  assert.equal(JSON.stringify(entry).includes('BootstrapPassword123'), false)
})

test('an audit storage failure does not fail a successful Admin action', async () => {
  const originalCreate = AuditLog.create
  AuditLog.create = async () => { throw new Error('audit storage unavailable') }
  try {
    const response = await asAdmin('patch', `/api/admin/users/${developer.id}/role`).send({ role: 'admin' })
    assert.equal(response.status, 200)
    assert.equal((await User.findById(developer.id)).role, 'admin')
  } finally {
    AuditLog.create = originalCreate
  }
})
