const express = require('express')
const { rateLimit } = require('express-rate-limit')
const { z } = require('zod')
const User = require('../models/user')
const CodeReview = require('../models/codeReview')
const { createAuthenticate } = require('../middleware/authenticate')
const { MAX_CODE_BYTES, reviewCode } = require('../services/codeReview')

const objectIdPattern = /^[a-f\d]{24}$/i
const reviewSchema = z.object({
  language: z.enum(['javascript', 'typescript', 'other']),
  title: z.string().trim().max(100).optional(),
  code: z.string().refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_CODE_BYTES, {
    message: 'Code must not exceed 50 KB',
  }),
}).strict()

function validationError(res, error, message = 'Invalid code review request') {
  return res.status(400).json({
    success: false,
    error: message,
    details: error.issues.map(({ path, message: issueMessage }) => ({ path, message: issueMessage })),
  })
}

function createCodeReviewRouter({ jwtSecret, userModel = User, codeReviewModel = CodeReview, limiter } = {}) {
  const router = express.Router()
  router.use(createAuthenticate({ jwtSecret, userModel }))
  const reviewLimiter = limiter || rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: 'Too many code reviews. Try again later.' },
  })

  router.post('/', reviewLimiter, async (req, res, next) => {
    const parsed = reviewSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)

    try {
      const result = reviewCode(parsed.data.code)
      const review = await codeReviewModel.create({
        owner: req.user._id,
        title: parsed.data.title || 'Untitled review',
        language: parsed.data.language,
        summary: result.summary,
        findings: result.findings,
      })
      return res.json({
        success: true,
        reviewer: result.reviewer,
        summary: result.summary,
        findings: result.findings,
        createdAt: review.createdAt,
      })
    } catch (error) {
      return next(error)
    }
  })

  router.get('/history', async (req, res, next) => {
    try {
      const reviews = await codeReviewModel.find({ owner: req.user._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('title language summary findings createdAt')
        .lean()
      return res.json({ success: true, reviews })
    } catch (error) {
      return next(error)
    }
  })

  router.delete('/history/:reviewId', async (req, res, next) => {
    if (!objectIdPattern.test(req.params.reviewId)) {
      return res.status(404).json({ success: false, error: 'Review not found' })
    }
    try {
      const removed = await codeReviewModel.findOneAndDelete({
        _id: req.params.reviewId,
        owner: req.user._id,
      })
      if (!removed) return res.status(404).json({ success: false, error: 'Review not found' })
      return res.json({ success: true, reviewId: String(removed._id) })
    } catch (error) {
      return next(error)
    }
  })

  return router
}

module.exports = { createCodeReviewRouter, reviewSchema }
