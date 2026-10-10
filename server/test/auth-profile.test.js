const { after, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')
const User = require('../models/user')
const AuditLog = require('../models/auditLog')

const jwtSecret = 'test-profile-secret-that-is-at-least-32-characters-long'
const originalPassword = 'StrongPassword123'
const nextPassword = 'DifferentPassword456'
let mongoServer
let app

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  await Promise.all([User.init(), AuditLog.init()])
  app = createApp({ clientOrigin: 'http://localhost:5173', jwtSecret })
})

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), AuditLog.deleteMany({})])
})

after(async () => {
  await Promise.all([User.deleteMany({}), AuditLog.deleteMany({})])
  await disconnectDatabase()
  await mongoServer?.stop()
})

async function registerUser() {
  const registration = await request(app).post('/api/auth/register').send({
    name: 'Profile User',
    email: 'profile@example.com',
    password: originalPassword,
  })
  assert.equal(registration.status, 201)
  return registration.body
}

function authenticated(method, path, token) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`)
}

function assertPublicUser(user) {
  assert.equal(typeof user.createdAt, 'string')
  assert.equal(Object.hasOwn(user, 'password'), false)
  assert.equal(Object.hasOwn(user, 'passwordHash'), false)
}

test('profile update and password change both require authentication', async () => {
  const missingNameAuth = await request(app).patch('/api/auth/me').send({ name: 'Updated User' })
  const missingPasswordAuth = await request(app).post('/api/auth/change-password').send({
    currentPassword: originalPassword,
    newPassword: nextPassword,
  })

  assert.equal(missingNameAuth.status, 401)
  assert.equal(missingPasswordAuth.status, 401)
})

test('register, login, and me include createdAt and omit password hashes', async () => {
  const registered = await registerUser()
  assertPublicUser(registered.user)

  const login = await request(app).post('/api/auth/login').send({
    email: 'profile@example.com',
    password: originalPassword,
  })
  assert.equal(login.status, 200)
  assertPublicUser(login.body.user)

  const profile = await authenticated('get', '/api/auth/me', registered.token)
  assert.equal(profile.status, 200)
  assertPublicUser(profile.body.user)
})

test('a user can update their own trimmed name and receives the public user payload', async () => {
  const registered = await registerUser()
  const response = await authenticated('patch', '/api/auth/me', registered.token)
    .send({ name: '  Updated Profile  ' })

  assert.equal(response.status, 200)
  assert.equal(response.body.user.name, 'Updated Profile')
  assertPublicUser(response.body.user)
  const stored = await User.findById(response.body.user.id)
  assert.equal(stored.name, 'Updated Profile')

  const audit = await AuditLog.findOne({ action: 'user.name_changed' }).lean()
  assert.ok(audit)
  assert.equal(String(audit.actor), stored.id)
  assert.deepEqual(audit.metadata ?? {}, {})
})

test('profile name validation rejects short, long, and unknown fields without changing protected data', async () => {
  const registered = await registerUser()
  for (const name of ['x', 'N'.repeat(61)]) {
    const invalid = await authenticated('patch', '/api/auth/me', registered.token).send({ name })
    assert.equal(invalid.status, 400)
  }

  for (const field of ['role', 'email', 'status']) {
    const escalation = await authenticated('patch', '/api/auth/me', registered.token)
      .send({ name: 'Updated Profile', [field]: field === 'role' ? 'admin' : 'attacker@example.com' })
    assert.equal(escalation.status, 400)
  }

  const stored = await User.findOne({ email: 'profile@example.com' })
  assert.equal(stored.name, 'Profile User')
  assert.equal(stored.email, 'profile@example.com')
  assert.equal(stored.role, 'developer')
  assert.equal(stored.status, 'active')
})

test('password change hashes the new password and invalidates the old login', async () => {
  const registered = await registerUser()
  const changed = await authenticated('post', '/api/auth/change-password', registered.token)
    .send({ currentPassword: originalPassword, newPassword: nextPassword })

  assert.equal(changed.status, 200)
  assert.equal(changed.body.success, true)
  assert.equal(JSON.stringify(changed.body).includes(nextPassword), false)

  const oldLogin = await request(app).post('/api/auth/login').send({
    email: 'profile@example.com',
    password: originalPassword,
  })
  assert.equal(oldLogin.status, 401)

  const newLogin = await request(app).post('/api/auth/login').send({
    email: 'profile@example.com',
    password: nextPassword,
  })
  assert.equal(newLogin.status, 200)
  assertPublicUser(newLogin.body.user)

  const audit = await AuditLog.findOne({ action: 'user.password_changed' }).lean()
  assert.ok(audit)
  assert.deepEqual(audit.metadata ?? {}, {})
  assert.equal(JSON.stringify(audit).includes(originalPassword), false)
  assert.equal(JSON.stringify(audit).includes(nextPassword), false)
})

test('password change returns a clear error for an incorrect current password', async () => {
  const registered = await registerUser()
  const response = await authenticated('post', '/api/auth/change-password', registered.token)
    .send({ currentPassword: 'WrongPassword123', newPassword: nextPassword })

  assert.equal(response.status, 400)
  assert.equal(response.body.error, 'Current password is incorrect')
  assert.equal(JSON.stringify(response.body).includes('WrongPassword123'), false)
  assert.equal(JSON.stringify(response.body).includes(nextPassword), false)
})

test('password change rejects reuse of the current password', async () => {
  const registered = await registerUser()
  const response = await authenticated('post', '/api/auth/change-password', registered.token)
    .send({ currentPassword: originalPassword, newPassword: originalPassword })

  assert.equal(response.status, 400)
  assert.equal(response.body.error, 'New password must be different from current password')
})

test('password change rejects weak passwords and unknown fields', async () => {
  const registered = await registerUser()
  const weak = await authenticated('post', '/api/auth/change-password', registered.token)
    .send({ currentPassword: originalPassword, newPassword: 'weak' })
  assert.equal(weak.status, 400)

  const unknown = await authenticated('post', '/api/auth/change-password', registered.token)
    .send({ currentPassword: originalPassword, newPassword: nextPassword, role: 'admin' })
  assert.equal(unknown.status, 400)
})
