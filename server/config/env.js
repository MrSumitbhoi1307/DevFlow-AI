function getConfig(env = process.env) {
  const port = Number(env.PORT || 5000)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  const mongoUri = env.MONGODB_URI?.trim()
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required')
  }

  const jwtSecret = env.JWT_SECRET
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters')
  }

  const clientOrigin = env.CLIENT_ORIGIN || 'http://localhost:5173'
  let parsedClientOrigin
  try {
    parsedClientOrigin = new URL(clientOrigin)
  } catch {
    throw new Error('CLIENT_ORIGIN must be a valid HTTP(S) origin')
  }
  if (!['http:', 'https:'].includes(parsedClientOrigin.protocol) || parsedClientOrigin.origin !== clientOrigin) {
    throw new Error('CLIENT_ORIGIN must be a valid HTTP(S) origin without a path')
  }

  return { port, mongoUri, jwtSecret, clientOrigin }
}

module.exports = { getConfig }
