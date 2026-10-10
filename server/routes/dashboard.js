const express = require('express')
const Issue = require('../models/issue')
const Project = require('../models/project')
const User = require('../models/user')
const { createAuthenticate } = require('../middleware/authenticate')

function projectScope(user) {
  return user.role === 'admin'
    ? {}
    : { $or: [{ owner: user._id }, { members: user._id }] }
}

function createDashboardRouter({ jwtSecret, projectModel = Project, issueModel = Issue, userModel = User }) {
  const router = express.Router()
  router.use(createAuthenticate({ jwtSecret, userModel }))

  router.get('/summary', async (req, res, next) => {
    try {
      const visibleProjects = await projectModel.find(projectScope(req.user), '_id').lean()
      const projectIds = visibleProjects.map(({ _id }) => _id)
      const [openIssues, teamMembers] = await Promise.all([
        projectIds.length ? issueModel.countDocuments({ project: { $in: projectIds }, status: 'open' }) : 0,
        req.user.role === 'admin'
          ? userModel.countDocuments({ role: 'developer', status: 'active' })
          : Promise.resolve(undefined),
      ])
      const summary = { totalProjects: projectIds.length, openIssues }
      if (req.user.role === 'admin') summary.teamMembers = teamMembers
      return res.json({ success: true, summary })
    } catch (error) {
      return next(error)
    }
  })

  return router
}

module.exports = { createDashboardRouter }
