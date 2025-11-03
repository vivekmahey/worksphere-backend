const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// 
//  THE FIX IS ON THIS LINE: Changed '/oauth' to '/'
//
router.post('/', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'No code' });
  }

  // Check if backend env vars are set
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('OAuth Error: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in backend .env');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    const params = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'http://localhost:5173/oauth-callback.html',
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    // Check if the response from Google is OK before trying to parse as JSON
    if (!tokenRes.ok) {
        const errorText = await tokenRes.text(); // Get the raw error
        console.error('Google OAuth Token Error:', errorText);
        // Try to parse as JSON, but fall back to text
        let googleError = 'Failed to fetch token from Google.';
        try {
            googleError = JSON.parse(errorText).error_description;
        } catch (e) {
            googleError = errorText;
        }
        return res.status(400).json({ error: googleError });
    }

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error });
    }

    res.json({ access_token: tokenData.access_token });
  } catch (err) {
    console.error('OAuth Catch Block Error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;