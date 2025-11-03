// worksphere-backend/models/Tab.js
const mongoose = require('mongoose');

const tabSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  tabs: [
    {
      name: { type: String, required: true },
      type: {
        type: String,
        enum: ['excel', 'powerpoint', 'docs', 'notes', 'code', 'web'],
        required: true,
      },
      fileData: { type: Buffer }, // For uploaded files
      content: { type: String }, // For editor content
      googleSlideId: { type: String }, // ← NEW: Google Slides ID
      status: { type: String, enum: ['active', 'done'], default: 'active' },
    },
  ],
});

module.exports = mongoose.model('Tab', tabSchema);