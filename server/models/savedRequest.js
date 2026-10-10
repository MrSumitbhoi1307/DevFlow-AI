const mongoose = require('mongoose')

const savedRequestSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  method: { type: String, required: true, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
  url: { type: String, required: true, trim: true, maxlength: 2048 },
  headers: { type: mongoose.Schema.Types.Mixed, default: {} },
  body: { type: String, default: '', maxlength: 102400 },
}, { timestamps: true })

module.exports = mongoose.models.SavedRequest || mongoose.model('SavedRequest', savedRequestSchema)
