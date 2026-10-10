const express = require('express')
const jwt = require('jsonwebtoken')
const { z } = require('zod')
const User = require('../models/user')
const { createAuthenticate } = require('../middleware/authenticate')

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string()
    .min(10)
    .max(128)
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[0-9]/, 'Password must include a number'),
}).strict()

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict()

function createAuthRouter({ jwtSecret, userModel = User }) {
  const router = express.Router()
  const authenticate = createAuthenticate({ jwtSecret, userModel })

  router.get('/me', authenticate, (req, res) => {
    res.json({ success: true, user: req.user.toPublicJSON() })
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

module.exports = { createAuthRouter }
