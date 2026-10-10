const { after, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')
const User = require('../models/user')
const AuditLog = require('../models/auditLog')

const jwtSecret = 'test-audit-api-secret-that-is-at-least-32-characters'
let mongoServer
let app
let admin
let developer

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  await Promise.all([User.init(), AuditLog.init()])
  app = createApp({ clientOrigin: 'http://localhost:5173', jwtSecret })
})

beforeEach(async () => {
  await Promise.all([AuditLog.deleteMany({}), User.deleteMany({})])
  admin = await User.create({ name: 'Log Admin', email: 'log-admin@example.com', password: 'StrongPassword123', role: 'admin' })
  developer = await User.create({ name: 'Log Developer', email: 'log-dev@example.com', password: 'StrongPassword123' })
})

after(async () => {
  await Promise.all([AuditLog.deleteMany({}), User.deleteMany({})])
  await disconnectDatabase()
  await mongoServer?.stop()
})

function tokenFor(user) {
  return jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '1h', issuer: 'devflow-ai', audience: 'devflow-ai' })
}

test('audit log endpoint requires Admin authentication', async () => {
  assert.equal((await request(app).get('/api/admin/audit-logs')).status, 401)
  const denied = await request(app).get('/api/admin/audit-logs')
    .set('Authorization', `Bearer ${tokenFor(developer)}`)
  assert.equal(denied.status, 403)
})

test('Admin can read an empty audit log list', async () => {
  const response = await request(app).get('/api/admin/audit-logs')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
  assert.equal(response.status, 200)
  assert.deepEqual(response.body.auditLogs, [])
})

test('Admin can filter logs; results are newest first, capped at 100, and omit secret metadata', async () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z')
  await AuditLog.insertMany(Array.from({ length: 105 }, (_, index) => ({
    actor: admin._id,
    action: index === 104 ? 'issue.deleted' : 'user.role_changed',
    targetType: 'user',
    targetId: `target-${index}`,
    metadata: { toRole: 'admin', password: 'never-return-this', token: 'never-return-this-either' },
    createdAt: new Date(createdAt.getTime() + index),
  })))

  const response = await request(app).get('/api/admin/audit-logs?action=user.role_changed')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
  assert.equal(response.status, 200)
  assert.equal(response.body.auditLogs.length, 100)
  assert.equal(response.body.auditLogs[0].targetId, 'target-103')
  assert.equal(response.body.auditLogs.at(-1).targetId, 'target-4')
  assert.equal(response.body.auditLogs.every((entry) => entry.action === 'user.role_changed'), true)
  assert.deepEqual(response.body.auditLogs[0].metadata, { toRole: 'admin' })
  assert.deepEqual(response.body.auditLogs[0].actor, { name: 'Log Admin' })
  assert.equal(JSON.stringify(response.body).includes('password'), false)
  assert.equal(JSON.stringify(response.body).includes('never-return-this'), false)
  assert.equal(JSON.stringify(response.body).includes(admin.email), false)
})

test('audit log action filter validates input', async () => {
  const response = await request(app).get('/api/admin/audit-logs?action=')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
  assert.equal(response.status, 400)
})
