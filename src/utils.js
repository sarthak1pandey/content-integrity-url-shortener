const crypto = require('crypto');
const { customAlphabet } = require('nanoid');

// URL-safe alphabet for short codes — no ambiguous characters (0/O, 1/l)
const nanoid = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789', 7);

/**
 * Generate a SHA-256 cryptographic hash of input string.
 * This is the core fingerprinting mechanism of the invention.
 */
function sha256(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Generate a unique 7-character short code.
 * e.g. "k3mx9pz"
 */
function generateShortCode() {
  return nanoid();
}

/**
 * Format current timestamp as readable string.
 */
function now() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Validate and normalize a URL.
 * Returns the normalized URL or throws if invalid.
 */
function validateAndNormalizeUrl(rawUrl) {
  let url = rawUrl.trim();

  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Validate using URL constructor
  const parsed = new URL(url);

  // Block local/private URLs in production
  const hostname = parsed.hostname;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.')
  ) {
    throw new Error('Local/private URLs are not allowed');
  }

  return url;
}

/**
 * Return a short preview of a hash for display purposes.
 * e.g. "3f4a9c2b...e7d8f6a1"
 */
function hashPreview(hash) {
  if (!hash || hash.length < 16) return hash;
  return hash.substring(0, 8) + '...' + hash.substring(hash.length - 8);
}

/**
 * Format a relative time string.
 * e.g. "3 days ago", "just now"
 */
function timeAgo(dateStr) {
  if (!dateStr) return 'never';
  const now = new Date();
  const then = new Date(dateStr.replace(' ', 'T') + 'Z');
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return dateStr.substring(0, 10);
}

module.exports = {
  sha256,
  generateShortCode,
  now,
  validateAndNormalizeUrl,
  hashPreview,
  timeAgo
};
