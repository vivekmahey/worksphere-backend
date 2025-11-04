// worksphere-backend/models/Tab.js
const mongoose = require('mongoose');

// This is no longer a User schema. This is a Tab schema.
// Each tab will be its own document.
const tabSchema = new mongoose.Schema({
  userId: { type: String, required: true, default: 'test-user' }, // To know who owns it
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['excel', 'powerpoint', 'docs', 'notes', 'code', 'web'],
    required: true,
  },
  fileData: { type: Buffer }, // For uploaded files
  content: { type: String }, // For editor content
  googleSlideId: { type: String },
  status: { type: String, enum: ['active', 'done'], default: 'active' },
});

module.exports = mongoose.model('Tab', tabSchema);