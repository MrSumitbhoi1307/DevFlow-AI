const express = require('express')
const jwt = require('jsonwebtoken')
const { rateLimit } = require('express-rate-limit')
const { z } = require('zod')
const User = require('../models/user')
const { createAuthenticate } = require('../middleware/authenticate')
const { writeAuditLog } = require('../services/auditLog')

const passwordSchema = z.string()
  .min(10)
  .max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number')

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: passwordSchema,
}).strict()

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict()

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60),
}).strict()

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
}).strict()

function createAuthRouter({ jwtSecret, userModel = User }) {
  const router = express.Router()
  const authenticate = createAuthenticate({ jwtSecret, userModel })
  const passwordChangeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: 'Too many password change attempts. Try again later.' },
  })

  router.get('/me', authenticate, (req, res) => {
    res.json({ success: true, user: req.user.toPublicJSON() })
  })

  router.patch('/me', authenticate, async (req, res, next) => {
    const parsed = profileUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid profile details',
        details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      })
    }

    try {
      req.user.name = parsed.data.name
      await req.user.save()
      await writeAuditLog({
        actor: req.user._id,
        action: 'user.name_changed',
        targetType: 'user',
        targetId: req.user._id,
      })
      return res.json({ success: true, user: req.user.toPublicJSON() })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/change-password', authenticate, passwordChangeLimiter, async (req, res, next) => {
    const parsed = passwordChangeSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password change details',
        details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      })
    }

    try {
      const user = await userModel.findById(req.user._id).select('+password')
      if (!user || !(await user.comparePassword(parsed.data.currentPassword))) {
        return res.status(400).json({ success: false, error: 'Current password is incorrect' })
      }
      if (parsed.data.newPassword === parsed.data.currentPassword) {
        return res.status(400).json({ success: false, error: 'New password must be different from current password' })
      }

      user.password = parsed.data.newPassword
      await user.save()
      await writeAuditLog({
        actor: user._id,
        action: 'user.password_changed',
        targetType: 'user',
        targetId: user._id,
      })
      return res.json({ success: true, message: 'Password changed successfully' })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/register', async (req, res, next) => {
    const parsed = registrationSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid registration details',
        details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      })
    }

    try {
      const user = await userModel.create({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        role: 'developer',
      })
      const token = jwt.sign({ sub: user.id }, jwtSecret, {
        expiresIn: '1h',
        issuer: 'devflow-ai',
        audience: 'devflow-ai',
      })

      return res.status(201).json({ success: true, token, user: user.toPublicJSON() })
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ success: false, error: 'An account with this email already exists' })
      }
      return next(error)
    }
  })

  router.post('/login', async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid login details',
        details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      })
    }

    try {
      const user = await userModel.findOne({ email: parsed.data.email }).select('+password')
      if (!user || user.status !== 'active' || !(await user.comparePassword(parsed.data.password))) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' })
      }

      const token = jwt.sign({ sub: user.id }, jwtSecret, {
        expiresIn: '1h',
        issuer: 'devflow-ai',
        audience: 'devflow-ai',
      })
      return res.json({ success: true, token, user: user.toPublicJSON() })
    } catch (error) {
      return next(error)
    }
  })

  return router
}

module.exports = { createAuthRouter, profileUpdateSchema, passwordChangeSchema }
