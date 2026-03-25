require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDB } = require('./src/database');
const {
  createShortLink,
  checkIntegrity,
  getLinkStats,
  getAllLinks,
  getGlobalStats,
  deleteLink
} = require('./src/linkService');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Initialize Database ──
initDB();

// ════════════════════════════════════════
//  API ROUTES
// ════════════════════════════════════════

/**
 * POST /api/shorten
 * Create a new short link with content integrity snapshot.
 * Body: { url: string }
 */
app.post('/api/shorten', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return res.status(400).json({ error: 'A valid URL is required.' });
  }

  try {
    const result = await createShortLink(url.trim());
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error creating short link:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/check/:shortCode
 * Check integrity of a link (re-fetches destination, compares hash).
 * This is THE core invention endpoint — called on every click.
 */
app.get('/api/check/:shortCode', async (req, res) => {
  const { shortCode } = req.params;

  try {
    const result = await checkIntegrity(shortCode);

    if (!result) {
      return res.status(404).json({ error: 'Short link not found.' });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error checking integrity:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/stats/:shortCode
 * Get full statistics for a link including modification history.
 */
app.get('/api/stats/:shortCode', (req, res) => {
  try {
    const result = getLinkStats(req.params.shortCode);

    if (!result) {
      return res.status(404).json({ error: 'Short link not found.' });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/links
 * Get all links for the dashboard.
 */
app.get('/api/links', (req, res) => {
  try {
    const links = getAllLinks();
    const stats = getGlobalStats();
    res.json({ success: true, data: { links, stats } });
  } catch (err) {
    console.error('Error fetching links:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/links/:shortCode
 * Delete a short link.
 */
app.delete('/api/links/:shortCode', (req, res) => {
  try {
    deleteLink(req.params.shortCode);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/health
 * Health check endpoint for deployment platforms.
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    invention: 'Content-Integrity-Aware URL Shortener',
    inventor: process.env.INVENTOR_NAME || 'Sarthak Pandey, VIT Vellore'
  });
});

// ════════════════════════════════════════
//  PAGE ROUTES
// ════════════════════════════════════════

/**
 * GET /s/:shortCode
 * The redirect route — serves the integrity check page.
 * The page JS calls /api/check/:shortCode, shows result, then redirects.
 */
app.get('/s/:shortCode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'redirect.html'));
});

/**
 * GET /link/:shortCode
 * Link statistics detail page.
 */
app.get('/link/:shortCode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'link.html'));
});

/**
 * GET /dashboard
 * Dashboard page showing all links.
 */
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

/**
 * Catch-all: serve index for any unmatched routes
 */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start Server ──
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   Content-Integrity URL Shortener                    ║');
  console.log('║   Patent Demo — VIT Vellore                          ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║   🚀  Server running at http://localhost:${PORT}          ║`);
  console.log(`║   📊  Dashboard: http://localhost:${PORT}/dashboard        ║`);
  console.log(`║   🔍  API Health: http://localhost:${PORT}/api/health      ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});
