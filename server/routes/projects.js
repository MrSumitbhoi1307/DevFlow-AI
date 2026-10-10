const express = require('express')
const mongoose = require('mongoose')
const { z } = require('zod')
const Project = require('../models/project')
const { createAuthenticate } = require('../middleware/authenticate')

const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().default(''),
}).strict()

const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['active', 'archived']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

function projectScope(user) {
  return user.role === 'admin'
    ? {}
    : { $or: [{ owner: user._id }, { members: user._id }] }
}

function createProjectsRouter({ jwtSecret, projectModel = Project }) {
  const router = express.Router()
  router.use(createAuthenticate({ jwtSecret }))

  router.get('/', async (req, res, next) => {
    try {
      const projects = await projectModel.find(projectScope(req.user))
        .populate('owner', 'name email')
        .sort({ updatedAt: -1 })
        .lean()
      return res.json({ success: true, projects })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/', async (req, res, next) => {
    const parsed = createProjectSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid project details' })
    }
    try {
      const project = await projectModel.create({ ...parsed.data, owner: req.user._id })
      return res.status(201).json({ success: true, project })
    } catch (error) {
      return next(error)
    }
  })

  router.get('/:projectId', async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.projectId)) {
      return res.status(404).json({ success: false, error: 'Project not found' })
    }
    try {
      const project = await projectModel.findOne({
        _id: req.params.projectId,
        ...projectScope(req.user),
      }).populate('owner', 'name email').lean()
      if (!project) return res.status(404).json({ success: false, error: 'Project not found' })
      return res.json({ success: true, project })
    } catch (error) {
      return next(error)
    }
  })

  router.patch('/:projectId', async (req, res, next) => {
    const parsed = updateProjectSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid project update' })
    }
    if (!mongoose.isValidObjectId(req.params.projectId)) {
      return res.status(404).json({ success: false, error: 'Project not found' })
    }
    const canEdit = req.user.role === 'admin' ? {} : { owner: req.user._id }
    try {
      const project = await projectModel.findOneAndUpdate({
        _id: req.params.projectId,
        ...canEdit,
      }, parsed.data, { returnDocument: 'after', runValidators: true })
      if (!project) return res.status(404).json({ success: false, error: 'Project not found' })
      return res.json({ success: true, project })
    } catch (error) {
      return next(error)
    }
  })

  return router
}

module.exports = { createProjectsRouter }
