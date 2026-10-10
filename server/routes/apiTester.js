const express = require('express')
const { rateLimit } = require('express-rate-limit')
const { z } = require('zod')
const User = require('../models/user')
const SavedRequest = require('../models/savedRequest')
const { createAuthenticate } = require('../middleware/authenticate')
const {
  MAX_BODY_BYTES,
  MAX_HEADER_BYTES,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
  sendHttpRequest,
  validateTarget,
} = require('../services/apiTester')

const requestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: z.string().trim().min(1).max(2048),
  headers: z.record(z.string(), z.string()).optional().default({}).superRefine((headers, context) => {
    const entries = Object.entries(headers)
    if (entries.length > 10) context.addIssue({ code: 'custom', message: 'A maximum of 10 headers is allowed' })
    if (Buffer.byteLength(JSON.stringify(headers), 'utf8') > MAX_HEADER_BYTES) {
      context.addIssue({ code: 'custom', message: 'Headers must not exceed 16 KB' })
    }
    for (const [name, value] of entries) {
      if (!/^[!#$%&'*+.^_`|~\da-z-]+$/i.test(name)) {
        context.addIssue({ code: 'custom', message: 'Header names must be valid HTTP tokens' })
      }
      if (/[\r\n]/.test(value)) context.addIssue({ code: 'custom', message: 'Header values cannot contain line breaks' })
    }
  }),
  body: z.string().optional().default('').refine((body) => Buffer.byteLength(body, 'utf8') <= MAX_BODY_BYTES, {
    message: 'Request body must not exceed 100 KB',
  }),
}).strict()

const savedRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  ...requestSchema.shape,
}).strict()

function validationError(res, error, message = 'Invalid API request') {
  return res.status(400).json({
    success: false,
    error: message,
    details: error.issues.map(({ path, message: issueMessage }) => ({ path, message: issueMessage })),
  })
}

function publicResponseHeaders(headers = {}) {
  const safe = {}
  const allow = new Set(['cache-control', 'content-type', 'etag', 'last-modified', 'location', 'retry-after'])
  for (const [name, value] of Object.entries(headers)) {
    if (allow.has(name.toLowerCase())) safe[name.toLowerCase()] = value
  }
  return safe
}

function createApiTesterRouter({
  jwtSecret,
  userModel = User,
  validator = validateTarget,
  sender = sendHttpRequest,
  savedRequestModel = SavedRequest,
  limiter,
} = {}) {
  if (typeof validator !== 'function' || typeof sender !== 'function') {
    throw new TypeError('The API Tester requires a validator and an HTTP sender')
  }
  const router = express.Router()
  router.use(createAuthenticate({ jwtSecret, userModel }))
  const outboundLimiter = limiter || rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: 'Too many outbound requests. Try again later.' },
  })

  router.post('/send', outboundLimiter, async (req, res) => {
    const parsed = requestSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)

    let target
    try {
      target = await validator(parsed.data.url)
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message || 'The destination is not allowed' })
    }

    try {
      const result = await sender({
        target,
        method: parsed.data.method,
        headers: parsed.data.headers,
        body: parsed.data.body,
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxResponseBytes: MAX_RESPONSE_BYTES,
      })
      const resultBody = Buffer.from(String(result.body ?? ''), 'utf8')
      const truncated = Boolean(result.truncated) || resultBody.length > MAX_RESPONSE_BYTES
      const body = resultBody.subarray(0, MAX_RESPONSE_BYTES).toString('utf8')
      return res.json({
        success: true,
        status: result.status,
        statusText: result.statusText,
        durationMs: result.durationMs,
        headers: publicResponseHeaders(result.headers),
        body,
        truncated,
      })
    } catch (error) {
      if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
        return res.status(504).json({ success: false, error: 'The outbound request timed out after 8 seconds' })
      }
      return res.status(502).json({ success: false, error: 'The outbound request could not be completed' })
    }
  })

  router.get('/saved', async (req, res, next) => {
    try {
      const savedRequests = await savedRequestModel.find({ owner: req.user._id })
        .sort({ updatedAt: -1 })
        .select('name method url headers body createdAt updatedAt')
        .lean()
      return res.json({ success: true, savedRequests })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/saved', async (req, res, next) => {
    const parsed = savedRequestSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error, 'Invalid saved request')
    try {
      const savedRequest = await savedRequestModel.create({ ...parsed.data, owner: req.user._id })
      return res.status(201).json({ success: true, savedRequest })
    } catch (error) {
      return next(error)
    }
  })

  router.delete('/saved/:savedRequestId', async (req, res, next) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.savedRequestId)) {
      return res.status(404).json({ success: false, error: 'Saved request not found' })
    }
    try {
      const removed = await savedRequestModel.findOneAndDelete({
        _id: req.params.savedRequestId,
        owner: req.user._id,
      })
      if (!removed) return res.status(404).json({ success: false, error: 'Saved request not found' })
      return res.json({ success: true, savedRequestId: String(removed._id) })
    } catch (error) {
      return next(error)
    }
  })

  return router
}

module.exports = { createApiTesterRouter, requestSchema, savedRequestSchema }
