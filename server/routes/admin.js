const express = require('express')
const mongoose = require('mongoose')
const { z } = require('zod')
const User = require('../models/user')
const { createAuthenticate, requireRole } = require('../middleware/authenticate')

const roleSchema = z.object({ role: z.enum(['admin', 'developer']) }).strict()
const statusSchema = z.object({ status: z.enum(['active', 'inactive']) }).strict()

function sendInvalid(res, parsed, message) {
  return res.status(400).json({
    success: false,
    error: message,
    details: parsed.error.issues.map(({ path, message: issueMessage }) => ({ path, message: issueMessage })),
  })
}

async function findUser(req, res, userModel) {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    res.status(400).json({ success: false, error: 'Invalid user ID' })
    return null
  }

  const user = await userModel.findById(req.params.userId)
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' })
    return null
  }
  return user
}

async function isLastActiveAdmin(user, userModel) {
  if (user.role !== 'admin' || user.status !== 'active') return false
  return (await userModel.countDocuments({ role: 'admin', status: 'active' })) <= 1
}

function publicUser(user) {
  return typeof user.toPublicJSON === 'function'
    ? user.toPublicJSON()
    : {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    }
}

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

  router.patch('/users/:userId/role', async (req, res, next) => {
    const parsed = roleSchema.safeParse(req.body)
    if (!parsed.success) return sendInvalid(res, parsed, 'Invalid role')

    try {
      const user = await findUser(req, res, userModel)
      if (!user) return
      if (parsed.data.role === user.role) {
        return res.json({ success: true, user: publicUser(user) })
      }

      if (parsed.data.role === 'developer' && await isLastActiveAdmin(user, userModel)) {
        return res.status(409).json({ success: false, error: 'Cannot demote the last active Admin' })
      }

      const updated = await userModel.findByIdAndUpdate(
        user.id,
        { role: parsed.data.role },
        { new: true, runValidators: true },
      )
      return res.json({ success: true, user: publicUser(updated) })
    } catch (error) {
      return next(error)
    }
  })

  router.patch('/users/:userId/status', async (req, res, next) => {
    const parsed = statusSchema.safeParse(req.body)
    if (!parsed.success) return sendInvalid(res, parsed, 'Invalid status')

    try {
      const user = await findUser(req, res, userModel)
      if (!user) return
      if (parsed.data.status === user.status) {
        return res.json({ success: true, user: publicUser(user) })
      }

      if (parsed.data.status === 'inactive' && await isLastActiveAdmin(user, userModel)) {
        return res.status(409).json({ success: false, error: 'Cannot deactivate the last active Admin' })
      }

      const updated = await userModel.findByIdAndUpdate(
        user.id,
        { status: parsed.data.status },
        { new: true, runValidators: true },
      )
      return res.json({ success: true, user: publicUser(updated) })
    } catch (error) {
      return next(error)
    }
  })

  router.delete('/users/:userId', async (req, res, next) => {
    try {
      const user = await findUser(req, res, userModel)
      if (!user) return
      if (await isLastActiveAdmin(user, userModel)) {
        return res.status(409).json({ success: false, error: 'Cannot remove the last active Admin' })
      }

      await userModel.deleteOne({ _id: user._id })
      return res.json({ success: true, userId: String(user._id) })
    } catch (error) {
      return next(error)
    }
  })

  return router
}

module.exports = { createAdminRouter }
