const mongoose = require('mongoose');

const tabSchema = new mongoose.Schema({

  userId: {
    type: String,
    required: true,
    default: 'test-user'
  },

  name: {
    type: String,
    required: true
  },

  type: {
    type: String,
   enum: ['excel','powerpoint','docs','pdf','notes','code','web'],
    required: true
  },

  fileData: {
    type: Buffer
  },

  content: {
    type: String
  },

  /* needed for pdf detection */
  mimeType: {
    type: String
  },

  googleSlideId: {
    type: String
  },

  googleSheetId: {
    type: String
  },

  status: {
    type: String,
    enum: [
      'active',
      'done'
    ],
    default: 'active'
  }

});

module.exports =
  mongoose.model(
    'Tab',
    tabSchema
  );