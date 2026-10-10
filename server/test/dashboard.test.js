const { after, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')
const User = require('../models/user')
const Project = require('../models/project')
const Issue = require('../models/issue')

const jwtSecret = 'test-dashboard-secret-that-is-at-least-32-characters'
let mongoServer
let app
let adminToken
let developerToken
let otherToken
let developer
let otherDeveloper

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  await User.init()
  app = createApp({ clientOrigin: 'http://localhost:5173', jwtSecret })
})

beforeEach(async () => {
  await Promise.all([Issue.deleteMany({}), Project.deleteMany({}), User.deleteMany({})])
  const register = async (name, email) => request(app).post('/api/auth/register').send({
    name, email, password: 'StrongPassword123',
  })
  const adminResult = await register('Dashboard Admin', 'dashboard-admin@example.com')
  const developerResult = await register('Dashboard Developer', 'dashboard-dev@example.com')
  const otherResult = await register('Other Developer', 'dashboard-other@example.com')
  adminToken = adminResult.body.token
  developerToken = developerResult.body.token
  otherToken = otherResult.body.token
  developer = await User.findOne({ email: 'dashboard-dev@example.com' })
  otherDeveloper = await User.findOne({ email: 'dashboard-other@example.com' })
  await User.updateOne({ email: 'dashboard-admin@example.com' }, { role: 'admin' })
})

after(async () => {
  await Promise.all([Issue.deleteMany({}), Project.deleteMany({}), User.deleteMany({})])
  await disconnectDatabase()
  await mongoServer?.stop()
})

test('dashboard summary requires authentication', async () => {
  assert.equal((await request(app).get('/api/dashboard/summary')).status, 401)
})

test('Developer summary counts only visible projects and their open issues', async () => {
  const visible = await Project.create({ name: 'Visible', owner: developer._id })
  const hidden = await Project.create({ name: 'Hidden', owner: otherDeveloper._id })
  await Issue.create({ title: 'Visible open', project: visible._id, reporter: developer._id })
  await Issue.create({ title: 'Visible closed', project: visible._id, reporter: developer._id, status: 'closed' })
  await Issue.create({ title: 'Hidden open', project: hidden._id, reporter: otherDeveloper._id })

  const response = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${developerToken}`)
  assert.equal(response.status, 200)
  assert.deepEqual(response.body.summary, { totalProjects: 1, openIssues: 1 })
  assert.equal(Object.hasOwn(response.body.summary, 'teamMembers'), false)
})

test('Admin summary includes active Developer count and returns zeros with no workspace data', async () => {
  const response = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${adminToken}`)
  assert.equal(response.status, 200)
  assert.deepEqual(response.body.summary, { totalProjects: 0, openIssues: 0, teamMembers: 2 })
})

test('Admin summary counts all projects and open issues', async () => {
  const project = await Project.create({ name: 'Developer project', owner: developer._id })
  await Issue.create({ title: 'Open', project: project._id, reporter: developer._id })
  await Issue.create({ title: 'In progress', project: project._id, reporter: developer._id, status: 'in-progress' })
  const response = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${adminToken}`)
  assert.deepEqual(response.body.summary, { totalProjects: 1, openIssues: 1, teamMembers: 2 })
})
