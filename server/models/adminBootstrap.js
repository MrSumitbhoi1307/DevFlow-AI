const mongoose = require('mongoose')

const adminBootstrapSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  state: { type: String, enum: ['running', 'complete'], required: true },
}, { timestamps: true, versionKey: false })

module.exports = mongoose.models.AdminBootstrap || mongoose.model('AdminBootstrap', adminBootstrapSchema)
