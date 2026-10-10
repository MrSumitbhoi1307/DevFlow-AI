const jwt = require('jsonwebtoken')
const User = require('../models/user')

function createAuthenticate({ jwtSecret, userModel = User }) {
  return async function authenticate(req, res, next) {
    const authorization = req.get('authorization') || ''
    const match = authorization.match(/^Bearer\s+(.+)$/i)
    if (!match) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    try {
      const claims = jwt.verify(match[1], jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'devflow-ai',
        audience: 'devflow-ai',
      })
      const user = await userModel.findById(claims.sub)
      if (!user || user.status !== 'active') {
        return res.status(401).json({ success: false, error: 'Authentication required' })
      }
      req.user = user
      return next()
    } catch {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }
  }
}

function requireRole(...roles) {
  return function authorizeRole(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'You do not have permission to perform this action' })
    }
    return next()
  }
}

module.exports = { createAuthenticate, requireRole }
