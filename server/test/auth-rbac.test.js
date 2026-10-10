const { after, before, test } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')
const User = require('../models/user')

const jwtSecret = 'test-rbac-secret-that-is-at-least-32-characters-long'
let mongoServer
let app

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  await User.init()
  app = createApp({ clientOrigin: 'http://localhost:5173', jwtSecret })
})

after(async () => {
  await User.deleteMany({})
  await disconnectDatabase()
  await mongoServer?.stop()
})

test('profile requires a valid JWT and returns only public user fields', async () => {
  const registration = await request(app).post('/api/auth/register').send({
    name: 'Profile User',
    email: 'profile@example.com',
    password: 'StrongPassword123',
  })

  const missing = await request(app).get('/api/auth/me')
  assert.equal(missing.status, 401)
  const invalid = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid-token')
  assert.equal(invalid.status, 401)

  const profile = await request(app).get('/api/auth/me')
    .set('Authorization', `Bearer ${registration.body.token}`)
  assert.equal(profile.status, 200)
  assert.equal(profile.body.user.email, 'profile@example.com')
  assert.equal(profile.body.user.password, undefined)
})

test('developer is denied admin access and admin can list users without hashes', async () => {
  const registration = await request(app).post('/api/auth/register').send({
    name: 'Regular User',
    email: 'regular@example.com',
    password: 'StrongPassword123',
  })
  const forbidden = await request(app).get('/api/admin/users')
    .set('Authorization', `Bearer ${registration.body.token}`)
  assert.equal(forbidden.status, 403)

  const admin = await User.create({
    name: 'Initial Admin',
    email: 'initial-admin@example.com',
    password: 'AdminPassword123',
    role: 'admin',
  })
  const adminToken = jwt.sign({ sub: admin.id }, jwtSecret, {
    expiresIn: '1h',
    issuer: 'devflow-ai',
    audience: 'devflow-ai',
  })
  const allowed = await request(app).get('/api/admin/users')
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(allowed.status, 200)
  assert.equal(allowed.body.success, true)
  assert.equal(allowed.body.users.some((user) => Object.hasOwn(user, 'password')), false)
})

test('deactivated user tokens stop working immediately', async () => {
  const registration = await request(app).post('/api/auth/register').send({
    name: 'Status User',
    email: 'status@example.com',
    password: 'StrongPassword123',
  })
  await User.updateOne({ email: 'status@example.com' }, { status: 'inactive' })
  const response = await request(app).get('/api/auth/me')
    .set('Authorization', `Bearer ${registration.body.token}`)
  assert.equal(response.status, 401)
})
