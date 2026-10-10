const { after, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')
const User = require('../models/user')

const jwtSecret = 'test-admin-management-secret-that-is-at-least-32-characters'
let mongoServer
let app

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  await User.init()
  app = createApp({ clientOrigin: 'http://localhost:5173', jwtSecret })
})

beforeEach(async () => {
  await User.deleteMany({})
})

after(async () => {
  await User.deleteMany({})
  await disconnectDatabase()
  await mongoServer?.stop()
})

function tokenFor(user) {
  return jwt.sign({ sub: user.id }, jwtSecret, {
    expiresIn: '1h',
    issuer: 'devflow-ai',
    audience: 'devflow-ai',
  })
}

async function createUser({ role = 'developer', status = 'active', suffix }) {
  return User.create({
    name: `${role} ${suffix}`,
    email: `${role}-${suffix}@example.com`,
    password: 'StrongPassword123',
    role,
    status,
  })
}

function adminRequest(user, method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${tokenFor(user)}`)
}

test('Admin can promote a Developer to Admin', async () => {
  const admin = await createUser({ role: 'admin', suffix: 'promoter' })
  const developer = await createUser({ suffix: 'promotee' })

  const response = await adminRequest(admin, 'patch', `/api/admin/users/${developer.id}/role`)
    .send({ role: 'admin' })

  assert.equal(response.status, 200)
  assert.equal(response.body.user.role, 'admin')
  assert.equal(response.body.user.password, undefined)
})

test('Admin can demote an Admin when another active Admin remains', async () => {
  const actor = await createUser({ role: 'admin', suffix: 'demoter' })
  const target = await createUser({ role: 'admin', suffix: 'demotee' })

  const response = await adminRequest(actor, 'patch', `/api/admin/users/${target.id}/role`)
    .send({ role: 'developer' })

  assert.equal(response.status, 200)
  assert.equal(response.body.user.role, 'developer')
})

test('Admin can deactivate an Admin when another active Admin remains', async () => {
  const actor = await createUser({ role: 'admin', suffix: 'deactivator' })
  const target = await createUser({ role: 'admin', suffix: 'deactivatee' })

  const response = await adminRequest(actor, 'patch', `/api/admin/users/${target.id}/status`)
    .send({ status: 'inactive' })

  assert.equal(response.status, 200)
  assert.equal(response.body.user.status, 'inactive')
})

test('Admin can reactivate an inactive Developer', async () => {
  const admin = await createUser({ role: 'admin', suffix: 'reactivator' })
  const target = await createUser({ status: 'inactive', suffix: 'reactivatee' })

  const response = await adminRequest(admin, 'patch', `/api/admin/users/${target.id}/status`)
    .send({ status: 'active' })

  assert.equal(response.status, 200)
  assert.equal(response.body.user.status, 'active')
})

test('Admin can remove a Developer', async () => {
  const admin = await createUser({ role: 'admin', suffix: 'remover' })
  const target = await createUser({ suffix: 'removee' })

  const response = await adminRequest(admin, 'delete', `/api/admin/users/${target.id}`)

  assert.equal(response.status, 200)
  assert.equal(await User.findById(target.id), null)
})

test('last active Admin cannot demote, deactivate, or remove themselves', async () => {
  const admin = await createUser({ role: 'admin', suffix: 'last-admin' })

  const demote = await adminRequest(admin, 'patch', `/api/admin/users/${admin.id}/role`)
    .send({ role: 'developer' })
  assert.equal(demote.status, 409)
  assert.match(demote.body.error, /last active Admin/i)

  const deactivate = await adminRequest(admin, 'patch', `/api/admin/users/${admin.id}/status`)
    .send({ status: 'inactive' })
  assert.equal(deactivate.status, 409)
  assert.match(deactivate.body.error, /last active Admin/i)

  const remove = await adminRequest(admin, 'delete', `/api/admin/users/${admin.id}`)
  assert.equal(remove.status, 409)
  assert.match(remove.body.error, /last active Admin/i)

  const stillActive = await User.findById(admin.id)
  assert.equal(stillActive.role, 'admin')
  assert.equal(stillActive.status, 'active')
})

test('Developer cannot call Admin mutation routes', async () => {
  const developer = await createUser({ suffix: 'forbidden' })
  const target = await createUser({ suffix: 'protected' })

  const response = await adminRequest(developer, 'patch', `/api/admin/users/${target.id}/role`)
    .send({ role: 'admin' })

  assert.equal(response.status, 403)
  assert.equal((await User.findById(target.id)).role, 'developer')
})

test('inactive user cannot log in', async () => {
  const user = await createUser({ status: 'inactive', suffix: 'inactive-login' })

  const response = await request(app).post('/api/auth/login').send({
    email: user.email,
    password: 'StrongPassword123',
  })

  assert.equal(response.status, 401)
  assert.equal(response.body.error, 'Invalid email or password')
})
