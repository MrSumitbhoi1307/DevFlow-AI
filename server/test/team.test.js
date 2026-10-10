const { after, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')
const User = require('../models/user')
const Project = require('../models/project')
const Issue = require('../models/issue')

const jwtSecret = 'test-team-api-secret-that-is-at-least-32-characters'
let mongoServer
let app
let admin
let developer
let inactive

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  await Promise.all([User.init(), Project.init(), Issue.init()])
  app = createApp({ clientOrigin: 'http://localhost:5173', jwtSecret })
})

beforeEach(async () => {
  await Promise.all([Issue.deleteMany({}), Project.deleteMany({}), User.deleteMany({})])
  admin = await User.create({ name: 'Team Admin', email: 'team-admin@example.com', password: 'StrongPassword123', role: 'admin' })
  developer = await User.create({ name: 'Team Developer', email: 'team-dev@example.com', password: 'StrongPassword123' })
  inactive = await User.create({ name: 'Inactive Member', email: 'inactive-team@example.com', password: 'StrongPassword123', status: 'inactive' })
})

after(async () => {
  await Promise.all([Issue.deleteMany({}), Project.deleteMany({}), User.deleteMany({})])
  await disconnectDatabase()
  await mongoServer?.stop()
})

function tokenFor(user) {
  return jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '1h', issuer: 'devflow-ai', audience: 'devflow-ai' })
}

test('team list requires authentication', async () => {
  assert.equal((await request(app).get('/api/team')).status, 401)
})

test('Developer sees active members and counts but no email or sensitive user fields', async () => {
  const owned = await Project.create({ name: 'Developer project', owner: developer._id })
  await Project.create({ name: 'Admin project', owner: admin._id })
  await Issue.create({ title: 'Reported issue', project: owned._id, reporter: developer._id })

  const response = await request(app).get('/api/team')
    .set('Authorization', `Bearer ${tokenFor(developer)}`)
  assert.equal(response.status, 200)
  assert.equal(response.body.members.length, 2)
  const devMember = response.body.members.find(({ id }) => id === developer.id)
  assert.deepEqual(devMember, {
    id: developer.id,
    name: 'Team Developer',
    role: 'developer',
    projectsOwned: 1,
    issuesReported: 1,
  })
  assert.equal(response.body.members.some(({ email }) => email !== undefined), false)
  assert.equal(response.body.members.some(({ password, status }) => password !== undefined || status !== undefined), false)
  assert.equal(response.body.members.some(({ id }) => id === inactive.id), false)
})

test('Admin sees member emails and correct project and issue counts', async () => {
  const project = await Project.create({ name: 'Shared project', owner: developer._id })
  await Issue.create({ title: 'First issue', project: project._id, reporter: developer._id })
  await Issue.create({ title: 'Second issue', project: project._id, reporter: developer._id })

  const response = await request(app).get('/api/team')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
  assert.equal(response.status, 200)
  const devMember = response.body.members.find(({ id }) => id === developer.id)
  assert.deepEqual(devMember, {
    id: developer.id,
    name: 'Team Developer',
    role: 'developer',
    email: developer.email,
    projectsOwned: 1,
    issuesReported: 2,
  })
})

test('team counts are zero when no projects or issues exist', async () => {
  const response = await request(app).get('/api/team')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
  assert.equal(response.status, 200)
  assert.equal(response.body.members.length, 2)
  assert.equal(response.body.members.every(({ projectsOwned, issuesReported }) => projectsOwned === 0 && issuesReported === 0), true)
})
