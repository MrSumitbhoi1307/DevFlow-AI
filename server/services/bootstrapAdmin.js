const { z } = require('zod')
const User = require('../models/user')
const AdminBootstrap = require('../models/adminBootstrap')

const credentialsSchema = z.object({
  MONGODB_URI: z.string().trim().min(1),
  INITIAL_ADMIN_NAME: z.string().trim().min(2).max(100),
  INITIAL_ADMIN_EMAIL: z.string().trim().email().max(254),
  INITIAL_ADMIN_PASSWORD: z.string()
    .min(10)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
})

async function bootstrapInitialAdmin(env = process.env, { userModel = User, lockModel = AdminBootstrap } = {}) {
  const parsed = credentialsSchema.safeParse(env)
  if (!parsed.success) {
    throw new Error('Set a valid MongoDB URI and strong initial Admin name, email, and password in the local environment')
  }

  try {
    await lockModel.create({ _id: 'initial-admin', state: 'running' })
  } catch (error) {
    if (error.code === 11000) {
      throw new Error('Initial Admin setup has already run or is currently in progress')
    }
    throw error
  }

  try {
    const activeAdmins = await userModel.countDocuments({ role: 'admin', status: 'active' })
    if (activeAdmins > 0) {
      throw new Error('An active Admin already exists; bootstrap is not available')
    }

    const user = await userModel.create({
      name: parsed.data.INITIAL_ADMIN_NAME,
      email: parsed.data.INITIAL_ADMIN_EMAIL.toLowerCase(),
      password: parsed.data.INITIAL_ADMIN_PASSWORD,
      role: 'admin',
      status: 'active',
    })
    await lockModel.updateOne({ _id: 'initial-admin' }, { $set: { state: 'complete' } })
    return { userId: user.id }
  } catch (error) {
    await lockModel.deleteOne({ _id: 'initial-admin' })
    throw error
  }
}

module.exports = { bootstrapInitialAdmin }
