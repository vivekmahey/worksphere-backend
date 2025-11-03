// worksphere-backend/scripts/migrate.js
const mongoose = require('mongoose');
require('../models/Tab'); // Your Tab model

mongoose.connect('mongodb://localhost:27017/worksphere', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const run = async () => {
  try {
    await mongoose.connection.collection('tabs').updateMany(
      { 'tabs.googleSlideId': { $exists: false } },
      { $set: { 'tabs.$[].googleSlideId': null } }
    );
    console.log('Migration complete: googleSlideId added!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    mongoose.disconnect();
  }
};

run();