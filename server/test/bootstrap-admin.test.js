const { after, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const User = require('../models/user')
const AdminBootstrap = require('../models/adminBootstrap')
const { bootstrapInitialAdmin } = require('../services/bootstrapAdmin')

const validEnv = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/devflow_test',
  INITIAL_ADMIN_NAME: 'First Admin',
  INITIAL_ADMIN_EMAIL: 'FIRST@example.com',
  INITIAL_ADMIN_PASSWORD: 'InitialStrongPassword123',
}
let mongoServer

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  await User.init()
  await AdminBootstrap.init()
})

beforeEach(async () => {
  await User.deleteMany({})
  await AdminBootstrap.deleteMany({})
})

after(async () => {
  await User.deleteMany({})
  await AdminBootstrap.deleteMany({})
  await disconnectDatabase()
  await mongoServer?.stop()
})

test('initial admin bootstrap creates one hashed Admin without returning credentials', async () => {
  const result = await bootstrapInitialAdmin(validEnv)
  assert.equal(typeof result.userId, 'string')

  const admin = await User.findOne({ email: 'first@example.com' }).select('+password')
  assert.equal(admin.role, 'admin')
  assert.equal(admin.status, 'active')
  assert.notEqual(admin.password, validEnv.INITIAL_ADMIN_PASSWORD)
  assert.match(admin.password, /^\$2[aby]\$/)
  assert.equal(await User.countDocuments({ role: 'admin', status: 'active' }), 1)
})

test('initial admin bootstrap refuses a second run', async () => {
  await bootstrapInitialAdmin(validEnv)
  await assert.rejects(bootstrapInitialAdmin(validEnv), /already run or is currently in progress/)
  assert.equal(await User.countDocuments({ role: 'admin', status: 'active' }), 1)
})

test('bootstrap refuses to run when an active Admin already exists', async () => {
  await User.create({
    name: 'Existing Admin',
    email: 'existing-admin@example.com',
    password: 'ExistingStrongPassword123',
    role: 'admin',
  })
  await assert.rejects(bootstrapInitialAdmin({ ...validEnv, INITIAL_ADMIN_EMAIL: 'another@example.com' }), /active Admin already exists/)
  assert.equal(await User.countDocuments({ role: 'admin', status: 'active' }), 1)
  assert.equal(await AdminBootstrap.countDocuments({}), 0)
})

test('bootstrap rejects missing or weak credentials before writing records', async () => {
  await assert.rejects(bootstrapInitialAdmin({ ...validEnv, INITIAL_ADMIN_PASSWORD: 'weak' }), /Set a valid MongoDB URI/)
  assert.equal(await AdminBootstrap.countDocuments({}), 0)
  assert.equal(await User.countDocuments({}), 0)
})
