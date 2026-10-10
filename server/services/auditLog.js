const AuditLog = require('../models/auditLog')

const ALLOWED_METADATA_KEYS = new Set([
  'fromRole', 'toRole', 'fromStatus', 'toStatus', 'role', 'status', 'projectId', 'priority', 'bootstrap',
])

function safeMetadata(metadata = {}) {
  return Object.fromEntries(Object.entries(metadata)
    .filter(([key, value]) => ALLOWED_METADATA_KEYS.has(key)
      && ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 8))
}

async function writeAuditLog(entry, { auditLogModel = AuditLog } = {}) {
  try {
    await auditLogModel.create({
      actor: entry.actor,
      action: entry.action,
      targetType: entry.targetType,
      targetId: String(entry.targetId),
      metadata: safeMetadata(entry.metadata),
    })
    return true
  } catch {
    // Audit storage is best effort; it must never roll back or fail the operation being recorded.
    return false
  }
}

module.exports = { writeAuditLog, safeMetadata }
