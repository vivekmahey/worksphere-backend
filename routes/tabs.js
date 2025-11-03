// worksphere-backend/routes/tabs.js
const express = require('express');
const router = express.Router();
const Busboy = require('busboy');
const fetch = require('node-fetch'); // npm install node-fetch
const Tab = require('../models/Tab');

router.post('/tabs', (req, res) => {
  console.log('=== UPLOAD STARTED ===');
  const busboy = Busboy({ headers: req.headers, limits: { fileSize: 200 * 1024 * 1024, files: 1 } });

  let name, type, fileBuffer, fileName;
  let finished = false;

  const done = () => {
    if (finished) return;
    finished = true;

    if (!name || !type) return res.status(400).json({ error: 'Name and type required' });

    const tabData = { name, type, status: 'active' };
    if (fileBuffer) tabData.fileData = fileBuffer;

    (async () => {
      try {
        let doc = await Tab.findOne({ userId: 'test-user' });
        if (!doc) doc = new Tab({ userId: 'test-user', tabs: [] });
        doc.tabs.push(tabData);
        await doc.save();
        res.status(201).json(doc);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    })();
  };

  busboy.on('field', (fieldname, val) => {
    if (fieldname === 'name') name = val;
    if (fieldname === 'type') type = val;
  });

  busboy.on('file', (fieldname, file, filename) => {
    fileName = filename;
    const chunks = [];
    file.on('data', chunk => chunks.push(chunk));
    file.on('end', () => {
      fileBuffer = Buffer.concat(chunks);
      console.log(`File uploaded: ${filename} (${fileBuffer.length} bytes)`);
    });
  });

  busboy.on('finish', done);
  busboy.on('error', (err) => {
    if (!finished) {
      finished = true;
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  req.pipe(busboy);
});

// GET ALL TABS
router.get('/tabs', async (req, res) => {
  const doc = await Tab.findOne({ userId: 'test-user' });
  res.json(doc ? doc.tabs : []);
});

// DELETE TAB
router.delete('/tabs/:idx', async (req, res) => {
  const idx = parseInt(req.params.idx);
  const doc = await Tab.findOne({ userId: 'test-user' });
  if (!doc || !doc.tabs[idx]) return res.status(404).json({ error: 'not found' });
  doc.tabs.splice(idx, 1);
  await doc.save();
  res.json(doc.tabs);
});

// GET FILE
router.get('/tabs/:idx/file', async (req, res) => {
  const idx = parseInt(req.params.idx);
  const doc = await Tab.findOne({ userId: 'test-user' });
  const tab = doc?.tabs[idx];
  if (!tab?.fileData) return res.status(404).json({ error: 'no file' });

  const mimeTypes = {
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    powerpoint: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    docs: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  res.set('Content-Type', mimeTypes[tab.type] || 'application/octet-stream');
  res.send(tab.fileData);
});

// PATCH TAB (SAVE googleSlideId, name, etc.)
router.patch('/tabs/:idx', async (req, res) => {
  const idx = parseInt(req.params.idx);
  const { updates } = req.body;

  try {
    const doc = await Tab.findOne({ userId: 'test-user' });
    if (!doc || !doc.tabs[idx]) return res.status(404).json({ error: 'not found' });

    // SUPPORT googleSlideId
    if (updates.googleSlideId !== undefined) {
      doc.tabs[idx].googleSlideId = updates.googleSlideId;
      
      // ** RECOMMENDED ADDITION **
      // If we just saved a googleSlideId, we don't need the raw file anymore.
      if (updates.googleSlideId) {
        doc.tabs[idx].fileData = undefined; // Clear the file buffer
      }
    }
    if (updates.name) doc.tabs[idx].name = updates.name;
    if (updates.content) doc.tabs[idx].content = updates.content;
    
    // This line is now only for Excel/Docs, not PowerPoint
    if (updates.fileData) doc.tabs[idx].fileData = updates.fileData;

    await doc.save();
    res.json(doc.tabs[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// DOWNLOAD FROM GOOGLE SLIDES
router.get('/tabs/:idx/download', async (req, res) => {
  const idx = parseInt(req.params.idx);
  const doc = await Tab.findOne({ userId: 'test-user' });
  const tab = doc?.tabs[idx];
  if (!tab?.googleSlideId) return res.status(404).json({ error: 'No Google Slide' });

  const url = `https://docs.google.com/presentation/d/${tab.googleSlideId}/export/pptx`;
  res.redirect(url);
});

// OPTIONAL: ONLYOFFICE SAVE (if you still use it)
router.post('/save-pptx/:index', async (req, res) => {
  const index = parseInt(req.params.index);
  const { url } = req.body;

  try {
    const response = await fetch(url);
    const buffer = await response.buffer();
    const doc = await Tab.findOne({ userId: 'test-user' });
    if (!doc || !doc.tabs[index]) return res.status(404).send('Not found');
    doc.tabs[index].fileData = buffer;
    await doc.save();
    res.json({ status: 'saved' });
  } catch (err) {
    res.status(500).json({ error: 'Save failed' });
  }
});

module.exports = router;