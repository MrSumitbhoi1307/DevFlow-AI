const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const mongoose = require('mongoose')
const { getConfig } = require('./config/env')
const { createAuthRouter } = require('./routes/auth')
const { createAdminRouter } = require('./routes/admin')
const { createProjectsRouter } = require('./routes/projects')
const { createIssuesRouter } = require('./routes/issues')
const { createDashboardRouter } = require('./routes/dashboard')
const { createTeamRouter } = require('./routes/team')

function createApp(config = getConfig()) {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin: config.clientOrigin, credentials: true }))
  app.use(express.json({ limit: '16kb' }))

  app.use('/api/auth', createAuthRouter({ jwtSecret: config.jwtSecret }))
  app.use('/api/admin', createAdminRouter({ jwtSecret: config.jwtSecret }))
  app.use('/api/projects', createProjectsRouter({ jwtSecret: config.jwtSecret }))
  app.use('/api/issues', createIssuesRouter({ jwtSecret: config.jwtSecret }))
  app.use('/api/dashboard', createDashboardRouter({ jwtSecret: config.jwtSecret }))
  app.use('/api/team', createTeamRouter({ jwtSecret: config.jwtSecret }))

  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'DevFlow AI backend is running!',
    })
  })

  app.get('/api/health', (req, res) => {
    const connected = mongoose.connection.readyState === 1
    res.status(connected ? 200 : 503).json({
      success: connected,
      status: connected ? 'healthy' : 'unavailable',
      database: connected ? 'connected' : 'disconnected',
    })
  })

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, error: 'Request body must contain valid JSON' })
    }
    console.error('Unhandled API error:', error.message)
    return res.status(500).json({ success: false, error: 'An unexpected error occurred' })
  })

  return app
}

module.exports = { createApp }
