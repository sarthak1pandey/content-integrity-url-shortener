const { db } = require('./database');
const { fetchAndNormalize } = require('./crawler');
const { sha256, generateShortCode, now, validateAndNormalizeUrl, hashPreview } = require('./utils');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Create a new short link with content integrity snapshot.
 *
 * Process:
 * 1. Validate and normalize the URL
 * 2. Fetch the destination page
 * 3. Run normalization pipeline
 * 4. Compute SHA-256 hash of normalized content
 * 5. Store everything in database
 * 6. Return short link details
 */
async function createShortLink(rawUrl) {
  // Validate URL
  const url = validateAndNormalizeUrl(rawUrl);

  // Check if URL was already shortened (return existing record)
  const existing = db.prepare(
    'SELECT * FROM links WHERE originalUrl = ?'
  ).get(url);

  if (existing) {
    return formatLinkResponse(existing, true);
  }

  // Fetch and normalize the destination page content
  const content = await fetchAndNormalize(url);

  // Compute the baseline cryptographic hash
  const baselineHash = sha256(content.text);

  // Generate unique short code
  let shortCode;
  let attempts = 0;
  do {
    shortCode = generateShortCode();
    attempts++;
    if (attempts > 10) throw new Error('Could not generate unique short code');
  } while (db.prepare('SELECT 1 FROM links WHERE shortCode = ?').get(shortCode));

  const createdAt = now();

  // Store in database
  db.prepare(`
    INSERT INTO links (shortCode, originalUrl, title, baselineHash, contentLength, createdAt, lastCheckedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(shortCode, url, content.title, baselineHash, content.contentLength, createdAt, createdAt);

  const record = db.prepare('SELECT * FROM links WHERE shortCode = ?').get(shortCode);
  return formatLinkResponse(record, false);
}

/**
 * Check integrity of a link and return full integrity report.
 *
 * This is THE CORE INVENTION — executed on every click:
 * 1. Look up the baseline hash stored at creation time
 * 2. Re-fetch the destination page right now
 * 3. Re-run the normalization pipeline
 * 4. Compute fresh hash
 * 5. Compare: if hashes match → UNCHANGED; if different → MODIFIED
 * 6. Log the click; update modification count if changed
 * 7. Return full integrity report to the user
 */
async function checkIntegrity(shortCode) {
  const record = db.prepare('SELECT * FROM links WHERE shortCode = ?').get(shortCode);
  if (!record) return null;

  const checkedAt = now();
  let integrityStatus = 'UNKNOWN';
  let freshHash = null;
  let freshTitle = record.title;
  let errorMessage = null;

  // Re-fetch and re-hash the destination page
  try {
    const content = await fetchAndNormalize(record.originalUrl);
    freshHash = sha256(content.text);
    freshTitle = content.title;

    if (freshHash === record.baselineHash) {
      integrityStatus = 'UNCHANGED';
    } else {
      integrityStatus = 'MODIFIED';

      // Log the modification to history
      db.prepare(`
        INSERT INTO modifications (shortCode, detectedAt, previousHash, newHash)
        VALUES (?, ?, ?, ?)
      `).run(shortCode, checkedAt, record.baselineHash, freshHash);

      // Update the record with new modification count and latest hash
      db.prepare(`
        UPDATE links
        SET modificationCount = modificationCount + 1,
            lastModifiedAt = ?,
            baselineHash = ?,
            lastCheckedAt = ?
        WHERE shortCode = ?
      `).run(checkedAt, freshHash, checkedAt, shortCode);
    }
  } catch (err) {
    integrityStatus = 'CHECK_FAILED';
    errorMessage = err.message;
  }

  // Update click count and last checked time
  db.prepare(`
    UPDATE links SET clickCount = clickCount + 1, lastCheckedAt = ?
    WHERE shortCode = ?
  `).run(checkedAt, shortCode);

  // Log this click
  db.prepare(`
    INSERT INTO clicks (shortCode, clickedAt, integrityStatus)
    VALUES (?, ?, ?)
  `).run(shortCode, checkedAt, integrityStatus);

  // Fetch updated record
  const updated = db.prepare('SELECT * FROM links WHERE shortCode = ?').get(shortCode);

  return {
    shortCode,
    originalUrl: record.originalUrl,
    title: freshTitle || record.title,
    shortUrl: `${BASE_URL}/s/${shortCode}`,

    // ── Integrity Report ──
    integrityStatus,            // 'UNCHANGED' | 'MODIFIED' | 'CHECK_FAILED'
    hashMatch: freshHash ? (freshHash === record.baselineHash) : null,

    // Hash values for display
    baselineHash: record.baselineHash,
    currentHash: freshHash || null,
    baselineHashPreview: hashPreview(record.baselineHash),
    currentHashPreview: freshHash ? hashPreview(freshHash) : null,

    // Metadata
    createdAt: record.createdAt,
    checkedAt,
    clickCount: updated.clickCount,
    modificationCount: updated.modificationCount,
    lastModifiedAt: updated.lastModifiedAt,

    errorMessage
  };
}

/**
 * Get full statistics for a link, including modification history.
 */
function getLinkStats(shortCode) {
  const record = db.prepare('SELECT * FROM links WHERE shortCode = ?').get(shortCode);
  if (!record) return null;

  const modifications = db.prepare(`
    SELECT * FROM modifications WHERE shortCode = ? ORDER BY detectedAt DESC
  `).all(shortCode);

  const recentClicks = db.prepare(`
    SELECT * FROM clicks WHERE shortCode = ? ORDER BY clickedAt DESC LIMIT 20
  `).all(shortCode);

  return {
    ...formatLinkResponse(record, false),
    modifications: modifications.map(m => ({
      detectedAt: m.detectedAt,
      previousHashPreview: hashPreview(m.previousHash),
      newHashPreview: hashPreview(m.newHash)
    })),
    recentClicks,
    modificationRate: record.clickCount > 0
      ? ((record.modificationCount / record.clickCount) * 100).toFixed(1)
      : 0
  };
}

/**
 * Get all links for dashboard view.
 */
function getAllLinks() {
  const links = db.prepare(`
    SELECT * FROM links ORDER BY createdAt DESC LIMIT 100
  `).all();

  return links.map(l => formatLinkResponse(l, false));
}

/**
 * Get global statistics for the dashboard header.
 */
function getGlobalStats() {
  const totalLinks = db.prepare('SELECT COUNT(*) as count FROM links').get().count;
  const totalClicks = db.prepare('SELECT SUM(clickCount) as total FROM links').get().total || 0;
  const modifiedLinks = db.prepare('SELECT COUNT(*) as count FROM links WHERE modificationCount > 0').get().count;
  const totalModifications = db.prepare('SELECT SUM(modificationCount) as total FROM links').get().total || 0;

  return { totalLinks, totalClicks, modifiedLinks, totalModifications };
}

/**
 * Delete a link and all associated records.
 */
function deleteLink(shortCode) {
  db.prepare('DELETE FROM modifications WHERE shortCode = ?').run(shortCode);
  db.prepare('DELETE FROM clicks WHERE shortCode = ?').run(shortCode);
  db.prepare('DELETE FROM links WHERE shortCode = ?').run(shortCode);
  return true;
}

// ── Internal helpers ──

function formatLinkResponse(record, isExisting) {
  return {
    shortCode: record.shortCode,
    shortUrl: `${BASE_URL}/s/${record.shortCode}`,
    originalUrl: record.originalUrl,
    title: record.title,
    baselineHashPreview: hashPreview(record.baselineHash),
    baselineHash: record.baselineHash,
    createdAt: record.createdAt,
    clickCount: record.clickCount,
    modificationCount: record.modificationCount,
    lastModifiedAt: record.lastModifiedAt,
    lastCheckedAt: record.lastCheckedAt,
    contentLength: record.contentLength,
    isExisting: isExisting || false,
    integrityStatus: record.modificationCount > 0 ? 'MODIFIED' : 'UNCHANGED'
  };
}

module.exports = {
  createShortLink,
  checkIntegrity,
  getLinkStats,
  getAllLinks,
  getGlobalStats,
  deleteLink
};
