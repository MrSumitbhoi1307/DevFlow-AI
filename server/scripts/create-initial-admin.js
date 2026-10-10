const path = require('node:path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const { connectDatabase, disconnectDatabase } = require('../config/database')
const { bootstrapInitialAdmin } = require('../services/bootstrapAdmin')

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in the server environment')
  }
  await connectDatabase(process.env.MONGODB_URI)
  await bootstrapInitialAdmin(process.env)
  console.log('Initial Admin created successfully. Remove the bootstrap credentials from the local environment.')
}

main()
  .catch(() => {
    console.error('Initial Admin setup failed. Check local configuration and database availability.')
    process.exitCode = 1
  })
  .finally(() => disconnectDatabase())
