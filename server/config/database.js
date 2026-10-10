const mongoose = require('mongoose')

async function connectDatabase(uri) {
  if (!uri) {
    throw new Error('A MongoDB connection URI is required')
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  return mongoose.connection
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}

module.exports = { connectDatabase, disconnectDatabase }
