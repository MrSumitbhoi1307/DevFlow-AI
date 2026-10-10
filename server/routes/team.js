const express = require('express')
const User = require('../models/user')
const Project = require('../models/project')
const Issue = require('../models/issue')
const { createAuthenticate } = require('../middleware/authenticate')

async function countByUser(model, field, ids) {
  if (ids.length === 0) return new Map()
  const rows = await model.aggregate([
    { $match: { [field]: { $in: ids } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ])
  return new Map(rows.map(({ _id, count }) => [String(_id), count]))
}

function createTeamRouter({ jwtSecret, userModel = User, projectModel = Project, issueModel = Issue }) {
  const router = express.Router()
  router.use(createAuthenticate({ jwtSecret, userModel }))

  router.get('/', async (req, res, next) => {
    try {
      const projection = req.user.role === 'admin' ? 'name role email' : 'name role'
      const users = await userModel.find({ status: 'active' }, projection).sort({ name: 1 }).lean()
      const ids = users.map(({ _id }) => _id)
      const [projectsOwned, issuesReported] = await Promise.all([
        countByUser(projectModel, 'owner', ids),
        countByUser(issueModel, 'reporter', ids),
      ])
      const members = users.map((user) => ({
        id: String(user._id),
        name: user.name,
        role: user.role,
        projectsOwned: projectsOwned.get(String(user._id)) || 0,
        issuesReported: issuesReported.get(String(user._id)) || 0,
        ...(req.user.role === 'admin' ? { email: user.email } : {}),
      }))
      return res.json({ success: true, members })
    } catch (error) {
      return next(error)
    }
  })

  return router
}

module.exports = { createTeamRouter }
