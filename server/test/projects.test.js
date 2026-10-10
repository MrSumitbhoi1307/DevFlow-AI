const { after, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { createApp } = require('../app')
const User = require('../models/user')
const Project = require('../models/project')

const jwtSecret = 'test-project-secret-that-is-at-least-32-characters'
let mongoServer
let app
let ownerToken

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await connectDatabase(mongoServer.getUri())
  await User.init()
  app = createApp({ clientOrigin: 'http://localhost:5173', jwtSecret })
})

beforeEach(async () => {
  await Project.deleteMany({})
  await User.deleteMany({})
  const registration = await request(app).post('/api/auth/register').send({
    name: 'Project Owner',
    email: 'project-owner@example.com',
    password: 'StrongPassword123',
  })
  ownerToken = registration.body.token
})

after(async () => {
  await Project.deleteMany({})
  await User.deleteMany({})
  await disconnectDatabase()
  await mongoServer?.stop()
})

test('authenticated developer creates and lists an owned project', async () => {
  const created = await request(app).post('/api/projects')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'DevFlow', description: 'Workspace project' })
  assert.equal(created.status, 201)
  assert.equal(created.body.project.name, 'DevFlow')

  const list = await request(app).get('/api/projects')
    .set('Authorization', `Bearer ${ownerToken}`)
  assert.equal(list.status, 200)
  assert.equal(list.body.projects.length, 1)
  assert.equal(list.body.projects[0].name, 'DevFlow')
})

test('projects require authentication and validate create input', async () => {
  assert.equal((await request(app).get('/api/projects')).status, 401)
  const invalid = await request(app).post('/api/projects')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'X', owner: 'forged' })
  assert.equal(invalid.status, 400)
})

test('developer cannot view or update another user project', async () => {
  const project = await Project.create({ name: 'Private Project', owner: (await User.findOne({ email: 'project-owner@example.com' }))._id })
  const other = await request(app).post('/api/auth/register').send({
    name: 'Other Developer',
    email: 'other-dev@example.com',
    password: 'OtherStrongPassword123',
  })
  const token = other.body.token

  assert.equal((await request(app).get(`/api/projects/${project.id}`).set('Authorization', `Bearer ${token}`)).status, 404)
  assert.equal((await request(app).patch(`/api/projects/${project.id}`).set('Authorization', `Bearer ${token}`).send({ name: 'Hijacked' })).status, 404)
})

test('owner can update and archive a project', async () => {
  const created = await request(app).post('/api/projects')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Editable Project' })
  const updated = await request(app).patch(`/api/projects/${created.body.project._id}`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Updated Project', status: 'archived' })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.project.name, 'Updated Project')
  assert.equal(updated.body.project.status, 'archived')
})
