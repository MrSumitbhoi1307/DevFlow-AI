const { after, before, test } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')
const User = require('../models/user')

const jwtSecret = 'test-auth-secret-that-is-at-least-32-characters-long'
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

test('registration hashes passwords, forces developer role, and returns a JWT', async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Dev User',
    email: 'DEV@example.com',
    password: 'StrongPassword123',
  })

  assert.equal(response.status, 201)
  assert.equal(response.body.user.email, 'dev@example.com')
  assert.equal(response.body.user.role, 'developer')
  assert.equal(response.body.user.password, undefined)
  assert.equal(typeof response.body.token, 'string')

  const stored = await User.findOne({ email: 'dev@example.com' }).select('+password')
  assert.notEqual(stored.password, 'StrongPassword123')
  assert.match(stored.password, /^\$2[aby]\$/)
})

test('registration rejects admin role assignment and invalid input', async () => {
  const escalation = await request(app).post('/api/auth/register').send({
    name: 'Bad Actor',
    email: 'bad@example.com',
    password: 'StrongPassword123',
    role: 'admin',
  })
  assert.equal(escalation.status, 400)

  const invalid = await request(app).post('/api/auth/register').send({
    name: 'A',
    email: 'not-an-email',
    password: 'weak',
  })
  assert.equal(invalid.status, 400)
  assert.equal(invalid.body.success, false)
})

test('registration rejects duplicate email addresses', async () => {
  const payload = { name: 'Same User', email: 'same@example.com', password: 'StrongPassword123' }
  assert.equal((await request(app).post('/api/auth/register').send(payload)).status, 201)
  assert.equal((await request(app).post('/api/auth/register').send(payload)).status, 409)
})

test('login returns a token for valid credentials and rejects invalid credentials', async () => {
  const payload = { name: 'Login User', email: 'login@example.com', password: 'StrongPassword123' }
  await request(app).post('/api/auth/register').send(payload)

  const success = await request(app).post('/api/auth/login').send({
    email: payload.email,
    password: payload.password,
  })
  assert.equal(success.status, 200)
  assert.equal(success.body.user.password, undefined)

  const failure = await request(app).post('/api/auth/login').send({
    email: payload.email,
    password: 'WrongPassword123',
  })
  assert.equal(failure.status, 401)
  assert.equal(failure.body.error, 'Invalid email or password')
})
