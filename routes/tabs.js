// worksphere-backend/routes/tabs.js
const express = require('express');
const router = express.Router();
const Busboy = require('busboy');
const fetch = require('node-fetch');
const Tab = require('../models/Tab');

// POST A NEW TAB
router.post('/tabs', (req, res) => {
  console.log('=== UPLOAD STARTED ===');
  const busboy = Busboy({ headers: req.headers, limits: { fileSize: 200 * 1024 * 1024, files: 1 } });

  let name, type, fileBuffer;
  let finished = false;

  const done = () => {
    if (finished) return;
    finished = true;
    if (!name || !type) return res.status(400).json({ error: 'Name and type required' });

    const tabData = {
      userId: 'test-user',
      name,
      type,
      status: 'active',
    };
    if (fileBuffer) tabData.fileData = fileBuffer;

    (async () => {
      try {
        const newTab = new Tab(tabData);
        await newTab.save();
        res.status(201).json(newTab);
      } catch (err) {
        if (err.code === 13113) {
            return res.status(413).send('File is too large (max 16MB)');
        }
        res.status(500).json({ error: err.message });
      }
    })();
  };

  busboy.on('field', (fieldname, val) => {
    if (fieldname === 'name') name = val;
    if (fieldname === 'type') type = val;
  });

  busboy.on('file', (fieldname, file, filename) => {
    const chunks = [];
    file.on('data', chunk => chunks.push(chunk));
    file.on('end', () => {
      fileBuffer = Buffer.concat(chunks);
      console.log(`File uploaded: ${filename} (${fileBuffer.length} bytes)`);
    });
  });

  busboy.on('finish', done);
  req.pipe(busboy);
});

// GET ALL TABS
router.get('/tabs', async (req, res) => {
  const tabs = await Tab.find({ userId: 'test-user' }).select('-fileData');
  res.json(tabs);
});

// DELETE TAB BY ID
router.delete('/tabs/:id', async (req, res) => {
  try {
    const tab = await Tab.findByIdAndDelete(req.params.id);
    if (!tab) return res.status(404).json({ error: 'not found' });
    res.json({ message: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- THIS ROUTE IS THE FIX ---
// GET A SINGLE TAB (for the Docs Editor)
router.get('/tabs/:id', async (req, res) => {
  try {
    // Find the tab and include its 'content' and 'fileData'
    const tab = await Tab.findById(req.params.id).select('+content +fileData');
    if (!tab) {
      return res.status(404).json({ error: 'no tab found' });
    }
    res.json(tab); // Send the full tab data back
  } catch (err) {
    console.error("Error fetching tab:", err);
    res.status(500).json({ error: err.message });
  }
});
// --- END OF NEW ROUTE ---

// GET FILE BY ID (for PowerPoint/Excel)
router.get('/tabs/:id/file', async (req, res) => {
  try {
    const tab = await Tab.findById(req.params.id).select('+fileData');
    if (!tab || !tab.fileData) { 
      return res.status(404).json({ error: 'no file found' });
    }
    const mimeTypes = {
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      powerpoint: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      docs: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    res.set('Content-Type', mimeTypes[tab.type] || 'application/octet-stream');
    res.send(tab.fileData);
  } catch (err) {
    console.error("Error fetching file:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH TAB BY ID
router.patch('/tabs/:id', async (req, res) => {
  const { updates } = req.body;
  try {
    const tab = await Tab.findById(req.params.id);
    if (!tab) return res.status(404).json({ error: 'not found' });

    if (updates.googleSlideId !== undefined) {
      tab.googleSlideId = updates.googleSlideId;
      tab.fileData = undefined; 
    }
    if (updates.googleSheetId !== undefined) {
      tab.googleSheetId = updates.googleSheetId;
      tab.fileData = undefined;
    }
    if (updates.name) tab.name = updates.name;
    // Make sure we can save 'content' (which will be HTML from Quill)
    if (updates.content !== undefined) {
      tab.content = updates.content;
      tab.fileData = undefined; // Clear the file buffer if we save text
    }
    if (updates.fileData) tab.fileData = updates.fileData;

    await tab.save();
    res.json(tab);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;