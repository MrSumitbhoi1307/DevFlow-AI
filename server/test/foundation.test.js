const { after, before, test } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')
const { getConfig } = require('../config/env')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')

let mongoServer
let app

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  app = createApp({
    clientOrigin: 'http://localhost:5173',
    jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
  })
})

after(async () => {
  await disconnectDatabase()
  await mongoServer?.stop()
})

test('environment config validates required database and token settings', () => {
  const config = getConfig({
    PORT: '5001',
    CLIENT_ORIGIN: 'http://localhost:5173',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/devflow_test',
    JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  })

  assert.equal(config.port, 5001)
  assert.equal(config.mongoUri, 'mongodb://127.0.0.1:27017/devflow_test')
  assert.equal(config.clientOrigin, 'http://localhost:5173')
  assert.throws(() => getConfig({}), /MONGODB_URI is required/)
  assert.throws(() => getConfig({ MONGODB_URI: 'mongodb://localhost/db', JWT_SECRET: 'short' }), /at least 32 characters/)
  assert.throws(() => getConfig({ MONGODB_URI: 'mongodb://localhost/db', JWT_SECRET: 'x'.repeat(32), CLIENT_ORIGIN: 'https://site.test/path' }), /without a path/)
})

test('MongoDB connection helper connects and disconnects cleanly', async () => {
  assert.equal(mongoose.connection.readyState, 1)
  await disconnectDatabase()
  assert.equal(mongoose.connection.readyState, 0)
  await connectDatabase(mongoServer.getUri())
  assert.equal(mongoose.connection.readyState, 1)
})

test('health reports database availability', async () => {
  const response = await request(app).get('/api/health')
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    success: true,
    status: 'healthy',
    database: 'connected',
  })
})
