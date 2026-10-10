const express = require('express')
const User = require('../models/user')
const { createAuthenticate, requireRole } = require('../middleware/authenticate')

function createAdminRouter({ jwtSecret, userModel = User }) {
  const router = express.Router()
  router.use(createAuthenticate({ jwtSecret, userModel }))
  router.use(requireRole('admin'))

  router.get('/users', async (req, res, next) => {
    try {
      const users = await userModel.find({}, 'name email role status createdAt')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
      return res.json({ success: true, users })
    } catch (error) {
      return next(error)
    }
  })

  return router
}

module.exports = { createAdminRouter }
