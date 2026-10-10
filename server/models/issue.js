const mongoose = require('mongoose')

const issueSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 5000, default: '' },
  status: { type: String, enum: ['open', 'in-progress', 'closed'], default: 'open', required: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true })

issueSchema.index({ project: 1, status: 1 })

module.exports = mongoose.models.Issue || mongoose.model('Issue', issueSchema)
