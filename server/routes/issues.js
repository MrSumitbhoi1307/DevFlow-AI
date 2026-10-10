const express = require('express')
const mongoose = require('mongoose')
const { z } = require('zod')
const Issue = require('../models/issue')
const Project = require('../models/project')
const User = require('../models/user')
const { createAuthenticate } = require('../middleware/authenticate')

const objectId = z.string().regex(/^[a-f\d]{24}$/i)
const createIssueSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional().default(''),
  status: z.enum(['open', 'in-progress', 'closed']).optional().default('open'),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  projectId: objectId,
  assigneeId: objectId.optional(),
}).strict()
const updateIssueSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(['open', 'in-progress', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0)
const listQuerySchema = z.object({ projectId: objectId.optional() }).strict()

function projectScope(user) {
  return user.role === 'admin'
    ? {}
    : { $or: [{ owner: user._id }, { members: user._id }] }
}

function issuePopulation(query) {
  return query
    .populate('project', 'name')
    .populate('reporter', 'name email')
    .populate('assignee', 'name email')
}

function sendValidationError(res, error, message) {
  return res.status(400).json({
    success: false,
    error: message,
    details: error.issues.map(({ path, message: issueMessage }) => ({ path, message: issueMessage })),
  })
}

async function findVisibleProject(user, projectId, projectModel) {
  if (!mongoose.isValidObjectId(projectId)) return null
  return projectModel.findOne({ _id: projectId, ...projectScope(user) }).select('_id')
}

async function findVisibleIssue(req, res, issueModel, projectModel) {
  if (!mongoose.isValidObjectId(req.params.issueId)) {
    res.status(404).json({ success: false, error: 'Issue not found' })
    return null
  }

  const issue = await issueModel.findById(req.params.issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: 'Issue not found' })
    return null
  }

  const project = await findVisibleProject(req.user, issue.project, projectModel)
  if (!project) {
    res.status(404).json({ success: false, error: 'Issue not found' })
    return null
  }
  return issue
}

function canManageIssue(user, issue) {
  return user.role === 'admin' || String(issue.reporter) === String(user._id)
}

function createIssuesRouter({ jwtSecret, issueModel = Issue, projectModel = Project, userModel = User }) {
  const router = express.Router()
  router.use(createAuthenticate({ jwtSecret, userModel }))

  router.get('/', async (req, res, next) => {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) return sendValidationError(res, parsed.error, 'Invalid issue filters')

    try {
      let projectIds
      if (parsed.data.projectId) {
        const project = await findVisibleProject(req.user, parsed.data.projectId, projectModel)
        if (!project) return res.status(404).json({ success: false, error: 'Project not found' })
        projectIds = [project._id]
      } else {
        const projects = await projectModel.find(projectScope(req.user), '_id').lean()
        projectIds = projects.map((project) => project._id)
      }

      const issues = await issuePopulation(issueModel.find({ project: { $in: projectIds } })
        .sort({ createdAt: -1 })).lean()
      return res.json({ success: true, issues })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/', async (req, res, next) => {
    const parsed = createIssueSchema.safeParse(req.body)
    if (!parsed.success) return sendValidationError(res, parsed.error, 'Invalid issue details')

    try {
      const project = await findVisibleProject(req.user, parsed.data.projectId, projectModel)
      if (!project) return res.status(404).json({ success: false, error: 'Project not found' })

      let assignee = null
      if (parsed.data.assigneeId) {
        assignee = await userModel.findOne({ _id: parsed.data.assigneeId, status: 'active' }).select('_id')
        if (!assignee) return res.status(400).json({ success: false, error: 'Assignee must be an active user' })
      }

      const issue = await issueModel.create({
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        priority: parsed.data.priority,
        project: project._id,
        reporter: req.user._id,
        assignee: assignee?._id || null,
      })
      const populated = await issuePopulation(issueModel.findById(issue._id)).lean()
      return res.status(201).json({ success: true, issue: populated })
    } catch (error) {
      return next(error)
    }
  })

  router.get('/:issueId', async (req, res, next) => {
    try {
      const issue = await findVisibleIssue(req, res, issueModel, projectModel)
      if (!issue) return
      const populated = await issuePopulation(issueModel.findById(issue._id)).lean()
      return res.json({ success: true, issue: populated })
    } catch (error) {
      return next(error)
    }
  })

  router.patch('/:issueId', async (req, res, next) => {
    const parsed = updateIssueSchema.safeParse(req.body)
    if (!parsed.success) return sendValidationError(res, parsed.error, 'Invalid issue update')

    try {
      const issue = await findVisibleIssue(req, res, issueModel, projectModel)
      if (!issue) return
      if (!canManageIssue(req.user, issue)) {
        return res.status(403).json({ success: false, error: 'You can only update issues you reported' })
      }

      await issueModel.updateOne({ _id: issue._id }, parsed.data, { runValidators: true })
      const updated = await issuePopulation(issueModel.findById(issue._id)).lean()
      return res.json({ success: true, issue: updated })
    } catch (error) {
      return next(error)
    }
  })

  router.delete('/:issueId', async (req, res, next) => {
    try {
      const issue = await findVisibleIssue(req, res, issueModel, projectModel)
      if (!issue) return
      if (!canManageIssue(req.user, issue)) {
        return res.status(403).json({ success: false, error: 'You can only remove issues you reported' })
      }

      await issueModel.deleteOne({ _id: issue._id })
      return res.json({ success: true, issueId: String(issue._id) })
    } catch (error) {
      return next(error)
    }
  })

  return router
}

module.exports = { createIssuesRouter }
