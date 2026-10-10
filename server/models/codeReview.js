const mongoose = require('mongoose')

const findingSchema = new mongoose.Schema({
  rule: { type: String, required: true, maxlength: 80 },
  severity: { type: String, enum: ['info', 'warning', 'error'], required: true },
  line: { type: Number, required: true, min: 1 },
  message: { type: String, required: true, maxlength: 240 },
  suggestion: { type: String, required: true, maxlength: 300 },
}, { _id: false })

const codeReviewSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  language: { type: String, enum: ['javascript', 'typescript', 'other'], required: true },
  summary: {
    findings: { type: Number, required: true, min: 0 },
    bySeverity: {
      info: { type: Number, required: true, min: 0 },
      warning: { type: Number, required: true, min: 0 },
      error: { type: Number, required: true, min: 0 },
    },
    score: { type: Number, required: true, min: 0, max: 100 },
  },
  findings: { type: [findingSchema], default: [] },
}, { timestamps: { createdAt: true, updatedAt: false } })

codeReviewSchema.index({ owner: 1, createdAt: -1 })

module.exports = mongoose.models.CodeReview || mongoose.model('CodeReview', codeReviewSchema)
