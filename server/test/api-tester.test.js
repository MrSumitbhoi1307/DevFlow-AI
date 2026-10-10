const { after, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')
const User = require('../models/user')
const SavedRequest = require('../models/savedRequest')
const { isBlockedAddress, sendHttpRequest, validateTarget } = require('../services/apiTester')

const jwtSecret = 'test-api-tester-secret-that-is-at-least-32-characters'
const config = { clientOrigin: 'http://localhost:5173', jwtSecret }
let mongoServer
let user
let sequence = 0

const safeTestValidator = async (value) => ({
  url: new URL(value),
  addresses: [{ address: '93.184.216.34', family: 4 }],
})
const successfulSender = async () => ({
  status: 200,
  statusText: 'OK',
  durationMs: 5,
  headers: { 'content-type': 'text/plain', 'set-cookie': 'private=secret' },
  body: 'A plain-text response',
  truncated: false,
})

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  await Promise.all([User.init(), SavedRequest.init()])
})

beforeEach(async () => {
  await Promise.all([SavedRequest.deleteMany({}), User.deleteMany({})])
  sequence += 1
  user = await User.create({
    name: `API Tester ${sequence}`,
    email: `api-tester-${sequence}@example.test`,
    password: 'StrongPassword123',
  })
})

after(async () => {
  await Promise.all([SavedRequest.deleteMany({}), User.deleteMany({})])
  await disconnectDatabase()
  await mongoServer?.stop()
})

function tokenFor(target = user) {
  return jwt.sign({ sub: target.id }, jwtSecret, { expiresIn: '1h', issuer: 'devflow-ai', audience: 'devflow-ai' })
}

function makeApp({ validator = safeTestValidator, sender = successfulSender } = {}) {
  return createApp(config, { validator, sender })
}

function send(app, body, target = user) {
  return request(app).post('/api/api-tester/send')
    .set('Authorization', `Bearer ${tokenFor(target)}`)
    .send(body)
}

function authenticated(app, target, method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${tokenFor(target)}`)
}

test('SSRF validator rejects local, private, link-local, mapped, special and unsupported destinations', async () => {
  const blockedUrls = [
    'http://127.0.0.1',
    'http://localhost',
    'http://10.0.0.1',
    'http://172.16.0.1',
    'http://192.168.1.1',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]',
    'http://[::ffff:127.0.0.1]',
    'http://[fc00::1]',
    'http://[fe80::1]',
    'http://[::]',
    'http://[ff02::1]',
    'http://100.64.0.1',
    'file:///etc/passwd',
    'ftp://example.com/file',
    'http://user:password@example.com',
  ]
  for (const url of blockedUrls) {
    await assert.rejects(validateTarget(url), undefined, `expected ${url} to be blocked`)
  }
  assert.equal(isBlockedAddress('::ffff:10.1.2.3'), true)
  assert.equal(isBlockedAddress('::ffff:169.254.169.254'), true)
  assert.equal(isBlockedAddress('2606:4700:4700::1111'), false)
})

test('API request requires authentication and validates request fields', async () => {
  const app = makeApp({ validator: validateTarget })
  assert.equal((await request(app).post('/api/api-tester/send').send({})).status, 401)
  assert.equal((await send(app, { method: 'TRACE', url: 'https://example.com' })).status, 400)
  assert.equal((await send(app, { method: 'GET', url: 'file:///etc/passwd' })).status, 400)
  assert.equal((await send(app, { method: 'GET', url: 'https://example.com', headers: Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`x-${index}`, 'v'])) })).status, 400)
  assert.equal((await send(app, { method: 'POST', url: 'https://example.com', body: 'x'.repeat(102_401) })).status, 400)
})

test('successful API request uses injected sender and does not forward caller JWT or cookies', async () => {
  let senderArgs
  const app = makeApp({ sender: async (args) => { senderArgs = args; return successfulSender() } })
  const response = await request(app).post('/api/api-tester/send')
    .set('Authorization', `Bearer ${tokenFor()}`)
    .set('Cookie', 'session=should-not-leak')
    .send({ method: 'GET', url: 'https://example.com/data', headers: { Accept: 'text/plain' } })

  assert.equal(response.status, 200)
  assert.equal(response.body.status, 200)
  assert.equal(response.body.body, 'A plain-text response')
  assert.deepEqual(response.body.headers, { 'content-type': 'text/plain' })
  assert.equal(senderArgs.method, 'GET')
  assert.deepEqual(senderArgs.headers, { Accept: 'text/plain' })
  assert.equal(Object.hasOwn(senderArgs.headers, 'Authorization'), false)
  assert.equal(Object.hasOwn(senderArgs.headers, 'Cookie'), false)
})

test('response body is limited to 1 MB and reports truncation', async () => {
  const app = makeApp({ sender: async () => ({ ...await successfulSender(), body: 'a'.repeat(1_048_577) }) })
  const response = await send(app, { method: 'GET', url: 'https://example.com' })
  assert.equal(response.status, 200)
  assert.equal(Buffer.byteLength(response.body.body), 1_048_576)
  assert.equal(response.body.truncated, true)
})

test('8-second outbound deadline is passed to the sender and timeout is returned as 504', async () => {
  let timeoutMs
  const app = makeApp({ sender: async (options) => {
    timeoutMs = options.timeoutMs
    const error = new Error('timed out')
    error.code = 'ETIMEDOUT'
    throw error
  } })
  const response = await send(app, { method: 'GET', url: 'https://example.com' })
  assert.equal(timeoutMs, 8_000)
  assert.equal(response.status, 504)
  assert.match(response.body.error, /timed out after 8 seconds/i)
})

test('rate limit rejects excess outbound requests', async () => {
  const app = makeApp()
  let lastResponse
  for (let index = 0; index < 21; index += 1) {
    lastResponse = await send(app, { method: 'GET', url: 'https://example.com' })
  }
  assert.equal(lastResponse.status, 429)
})

test('redirect response is returned and never followed to a private address', async () => {
  let requests = 0
  const localServer = http.createServer((req, res) => {
    requests += 1
    res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' })
    res.end('redirect response')
  })
  await new Promise((resolve) => localServer.listen(0, '127.0.0.1', resolve))
  try {
    const { port } = localServer.address()
    const validator = async (value) => ({
      url: new URL(value),
      addresses: [{ address: '127.0.0.1', family: 4 }],
    })
    const app = makeApp({ validator, sender: sendHttpRequest })
    const response = await send(app, { method: 'GET', url: `http://example.invalid:${port}/redirect` })
    assert.equal(response.status, 200)
    assert.equal(response.body.status, 302)
    assert.equal(response.body.headers.location, 'http://169.254.169.254/latest/meta-data')
    assert.equal(response.body.body, 'redirect response')
    assert.equal(requests, 1)
  } finally {
    await new Promise((resolve, reject) => localServer.close((error) => error ? reject(error) : resolve()))
  }
})

test('saved requests require authentication and validate input', async () => {
  const app = makeApp()
  assert.equal((await request(app).get('/api/api-tester/saved')).status, 401)
  assert.equal((await request(app).post('/api/api-tester/saved').send({})).status, 401)
  assert.equal((await request(app).delete(`/api/api-tester/saved/${'a'.repeat(24)}`)).status, 401)

  const invalid = await authenticated(app, user, 'post', '/api/api-tester/saved').send({
    name: '', method: 'TRACE', url: 'file:///etc/passwd',
  })
  assert.equal(invalid.status, 400)
})

test('saved requests are listed and deleted only by their owner', async () => {
  const app = makeApp()
  const other = await User.create({
    name: 'Other API Tester',
    email: 'other-api-tester@example.test',
    password: 'StrongPassword123',
  })
  const payload = {
    name: 'List health endpoint',
    method: 'GET',
    url: 'https://example.com/health',
    headers: { Accept: 'application/json' },
    body: '',
  }
  const created = await authenticated(app, user, 'post', '/api/api-tester/saved').send(payload)
  assert.equal(created.status, 201)
  assert.equal(created.body.savedRequest.name, payload.name)
  assert.equal(created.body.savedRequest.method, payload.method)
  assert.equal(created.body.savedRequest.url, payload.url)
  const id = created.body.savedRequest._id

  const ownerList = await authenticated(app, user, 'get', '/api/api-tester/saved')
  assert.equal(ownerList.status, 200)
  assert.equal(ownerList.body.savedRequests.length, 1)
  assert.equal(String(ownerList.body.savedRequests[0]._id), id)

  const otherList = await authenticated(app, other, 'get', '/api/api-tester/saved')
  assert.equal(otherList.status, 200)
  assert.deepEqual(otherList.body.savedRequests, [])
  const forbiddenDelete = await authenticated(app, other, 'delete', `/api/api-tester/saved/${id}`)
  assert.equal(forbiddenDelete.status, 404)
  assert.equal(await SavedRequest.countDocuments({ _id: id }), 1)

  const ownerDelete = await authenticated(app, user, 'delete', `/api/api-tester/saved/${id}`)
  assert.equal(ownerDelete.status, 200)
  assert.equal(await SavedRequest.countDocuments({ _id: id }), 0)
})
