const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true, trim: true, maxlength: 80, index: true },
  targetType: { type: String, required: true, trim: true, maxlength: 40 },
  targetId: { type: String, required: true, trim: true, maxlength: 100 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } })

auditLogSchema.index({ createdAt: -1 })

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)
