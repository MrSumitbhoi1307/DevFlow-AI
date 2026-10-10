const { after, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')
const User = require('../models/user')
const CodeReview = require('../models/codeReview')

const jwtSecret = 'test-code-review-secret-that-is-at-least-32-characters'
const config = { clientOrigin: 'http://localhost:5173', jwtSecret }
let mongoServer
let user
let app
let sequence = 0

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  await Promise.all([User.init(), CodeReview.init()])
})

beforeEach(async () => {
  await Promise.all([CodeReview.deleteMany({}), User.deleteMany({})])
  sequence += 1
  user = await User.create({
    name: `Review User ${sequence}`,
    email: `review-${sequence}@example.test`,
    password: 'StrongPassword123',
  })
  app = createApp(config)
})

after(async () => {
  await Promise.all([CodeReview.deleteMany({}), User.deleteMany({})])
  await disconnectDatabase()
  await mongoServer?.stop()
})

function tokenFor(target = user) {
  return jwt.sign({ sub: target.id }, jwtSecret, { expiresIn: '1h', issuer: 'devflow-ai', audience: 'devflow-ai' })
}

function authenticated(method, path, target = user) {
  return request(app)[method](path).set('Authorization', `Bearer ${tokenFor(target)}`)
}

function reviewPayload(overrides = {}) {
  return { language: 'javascript', title: 'Sample review', code: 'const value = 1', ...overrides }
}

test('code review and history endpoints require authentication', async () => {
  assert.equal((await request(app).post('/api/code-review').send(reviewPayload())).status, 401)
  assert.equal((await request(app).get('/api/code-review/history')).status, 401)
  assert.equal((await request(app).delete(`/api/code-review/history/${'a'.repeat(24)}`)).status, 401)
})

test('review validates language, title, and code fields', async () => {
  const invalidLanguage = await authenticated('post', '/api/code-review').send(reviewPayload({ language: 'python' }))
  const longTitle = await authenticated('post', '/api/code-review').send(reviewPayload({ title: 't'.repeat(101) }))
  const missingCode = await authenticated('post', '/api/code-review').send({ language: 'other' })
  const unknownField = await authenticated('post', '/api/code-review').send(reviewPayload({ owner: user.id }))
  assert.equal(invalidLanguage.status, 400)
  assert.equal(longTitle.status, 400)
  assert.equal(missingCode.status, 400)
  assert.equal(unknownField.status, 400)
})

test('code may be exactly 50 KB but a larger source is rejected', async () => {
  const accepted = await authenticated('post', '/api/code-review')
    .send(reviewPayload({ code: 'x'.repeat(50 * 1024) }))
  const rejected = await authenticated('post', '/api/code-review')
    .send(reviewPayload({ code: 'x'.repeat(50 * 1024 + 1) }))
  assert.equal(accepted.status, 200)
  assert.equal(rejected.status, 400)
  assert.match(rejected.body.error, /Invalid code review request/)
})

test('review response and stored history never contain submitted source code', async () => {
  const secret = 'private-source-that-must-not-be-persisted'
  const submittedCode = `const token = "${secret}"`
  const result = await authenticated('post', '/api/code-review').send(reviewPayload({ code: submittedCode }))
  assert.equal(result.status, 200)
  assert.equal(result.body.reviewer, 'rule-based')
  assert.equal(result.body.summary.findings, 1)
  assert.equal(JSON.stringify(result.body).includes(secret), false)

  const history = await authenticated('get', '/api/code-review/history')
  assert.equal(history.status, 200)
  assert.equal(history.body.reviews.length, 1)
  assert.equal(history.body.reviews[0].title, 'Sample review')
  assert.equal(Object.hasOwn(history.body.reviews[0], 'code'), false)
  assert.equal(JSON.stringify(history.body).includes(secret), false)
  const stored = await CodeReview.findById(history.body.reviews[0]._id).lean()
  assert.equal(Object.hasOwn(stored, 'code'), false)
})

test('history is private to its owner and only the owner can delete it', async () => {
  const created = await authenticated('post', '/api/code-review').send(reviewPayload())
  const reviewId = (await CodeReview.findOne({ owner: user._id })).id
  const other = await User.create({ name: 'Another User', email: 'another-review@example.test', password: 'StrongPassword123' })

  const ownerList = await authenticated('get', '/api/code-review/history')
  const otherList = await authenticated('get', '/api/code-review/history', other)
  const otherDelete = await authenticated('delete', `/api/code-review/history/${reviewId}`, other)
  assert.equal(created.status, 200)
  assert.equal(ownerList.body.reviews.length, 1)
  assert.deepEqual(otherList.body.reviews, [])
  assert.equal(otherDelete.status, 404)
  assert.equal(await CodeReview.countDocuments({ _id: reviewId }), 1)

  const ownerDelete = await authenticated('delete', `/api/code-review/history/${reviewId}`)
  assert.equal(ownerDelete.status, 200)
  assert.equal(await CodeReview.countDocuments({ _id: reviewId }), 0)
})

test('history returns only the latest 50 reviews', async () => {
  const reviews = Array.from({ length: 51 }, (_, index) => ({
    owner: user._id,
    title: `Review ${index}`,
    language: 'javascript',
    summary: { findings: 0, bySeverity: { info: 0, warning: 0, error: 0 }, score: 100 },
    findings: [],
    createdAt: new Date(Date.now() + index),
  }))
  await CodeReview.insertMany(reviews)
  const response = await authenticated('get', '/api/code-review/history')
  assert.equal(response.status, 200)
  assert.equal(response.body.reviews.length, 50)
  assert.equal(response.body.reviews[0].title, 'Review 50')
})

test('code review endpoint is rate-limited', async () => {
  let lastResponse
  for (let index = 0; index < 21; index += 1) {
    lastResponse = await authenticated('post', '/api/code-review').send(reviewPayload())
  }
  assert.equal(lastResponse.status, 429)
})
