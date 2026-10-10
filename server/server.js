
require('dotenv').config()

const { getConfig } = require('./config/env')
const { connectDatabase, disconnectDatabase } = require('./config/database')
const { createApp } = require('./app')

async function startServer() {
  const config = getConfig()
  await connectDatabase(config.mongoUri)

  const app = createApp()
  const server = app.listen(config.port, () => {
    console.log(`DevFlow AI server running on port ${config.port}`)
  })

  return server
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`Unable to start DevFlow AI: ${error.message}`)
    disconnectDatabase()
      .catch(() => {})
      .finally(() => {
        process.exitCode = 1
      })
  })
}

module.exports = { startServer }
