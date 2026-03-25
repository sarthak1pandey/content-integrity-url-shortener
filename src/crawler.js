const axios = require('axios');
const cheerio = require('cheerio');

/**
 * ═══════════════════════════════════════════════════════════
 *  THE NORMALIZATION PIPELINE — Core of the Invention
 * ═══════════════════════════════════════════════════════════
 *
 *  The challenge: web pages contain many elements that change
 *  constantly but do NOT represent meaningful content changes:
 *    - Timestamps ("Last updated: 5 mins ago")
 *    - Ad slots (change on every page load)
 *    - Navigation menus (site-wide, not article-specific)
 *    - Social share counts ("1,234 shares" → "1,235 shares")
 *    - Session tokens / CSRF tokens in hidden fields
 *    - Cookie consent banners
 *    - Related articles (recommendations that rotate)
 *
 *  If we hash the raw page, these would cause constant false
 *  positives — triggering "modified" alerts when nothing
 *  meaningful changed.
 *
 *  The normalization pipeline:
 *    1. Remove all structural/peripheral elements
 *    2. Extract only the main semantic content
 *    3. Normalize whitespace
 *    4. Lowercase (removes capitalization changes from CMS)
 *
 *  RESULT: Only actual content changes (text edits, additions,
 *  deletions in the article body) trigger a modification alert.
 * ═══════════════════════════════════════════════════════════
 */

// Timeout for HTTP requests (ms)
const FETCH_TIMEOUT = 15000;

// HTTP headers to mimic a real browser
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

/**
 * CSS selectors for volatile elements to REMOVE before hashing.
 * These change frequently without meaningful content changes.
 */
const VOLATILE_SELECTORS = [
  // Scripts and styles (never content)
  'script', 'style', 'noscript', 'link[rel="stylesheet"]',

  // Structural/navigation elements
  'nav', 'header', 'footer',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '.navbar', '.nav', '#nav', '.header', '#header', '.footer', '#footer',
  '.site-header', '.site-footer', '.site-nav',

  // Advertisement elements
  '[class*="ad-"]', '[class*="-ad"]', '[id*="ad-"]',
  '[class*="advertisement"]', '[class*="sponsored"]',
  '[class*="promo"]', '[class*="banner"]',
  '.ads', '#ads', '.ad', '#ad',
  'ins.adsbygoogle',

  // Dynamic/volatile UI elements
  '[class*="cookie"]', '[class*="consent"]', '[class*="gdpr"]',
  '[class*="popup"]', '[class*="modal"]', '[class*="overlay"]',
  '[class*="notification"]', '[class*="alert"]',
  '[class*="toast"]', '[class*="snackbar"]',

  // Timestamps and dates (high false-positive source)
  'time', '[class*="timestamp"]', '[class*="date"]', '[class*="time"]',
  '[class*="posted"]', '[class*="published"]', '[class*="updated"]',
  '[class*="modified"]', '[datetime]',

  // Social elements (counts change constantly)
  '[class*="share"]', '[class*="social"]', '[class*="like"]',
  '[class*="follow"]', '[class*="subscribe"]',

  // Sidebar and supplementary content
  'aside', '[class*="sidebar"]', '[class*="side-bar"]',
  '[role="complementary"]',

  // Comment sections (user-generated, highly dynamic)
  '[class*="comment"]', '[id*="comment"]', '#disqus_thread',
  '[class*="discuss"]', '[class*="replies"]',

  // Recommended/related articles (change frequently)
  '[class*="related"]', '[class*="recommended"]', '[class*="more-stories"]',
  '[class*="also-read"]', '[class*="you-might"]',

  // Metered paywall overlays
  '[class*="paywall"]', '[class*="subscription"]', '[class*="metered"]',

  // Iframes (ads, embeds, etc.)
  'iframe'
];

/**
 * Priority selectors for main content.
 * We try these in order and use the first match.
 * This ensures we capture the article body, not the whole page.
 */
const CONTENT_SELECTORS = [
  'article',
  '[role="main"]',
  'main',
  '.article-body', '.article-content', '.article-text',
  '.post-body', '.post-content', '.post-text',
  '.entry-content', '.entry-body',
  '.content-body', '.page-content', '.main-content',
  '#article-body', '#post-body', '#content',
  '.story-body', '.story-content',
  '.body-copy', '.body-text',
  'section.content',
  '[itemprop="articleBody"]',
  '[itemprop="text"]'
];

/**
 * Fetch a URL and return normalized content for hashing.
 *
 * @param {string} url - The URL to fetch
 * @returns {{ text: string, title: string, contentLength: number }}
 */
async function fetchAndNormalize(url) {
  let response;

  try {
    response = await axios.get(url, {
      headers: BROWSER_HEADERS,
      timeout: FETCH_TIMEOUT,
      maxRedirects: 5,
      responseType: 'text',
      // Don't throw on non-2xx (we'll handle it)
      validateStatus: (status) => status < 500
    });
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      throw new Error(`Domain not found: ${url}`);
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      throw new Error(`Page took too long to respond (>${FETCH_TIMEOUT / 1000}s)`);
    }
    throw new Error(`Could not fetch page: ${err.message}`);
  }

  if (response.status === 404) throw new Error('Page not found (404)');
  if (response.status === 403) throw new Error('Access denied (403)');

  const $ = cheerio.load(response.data);

  // ── Extract title BEFORE stripping elements ──
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').text().trim() ||
    $('h1').first().text().trim() ||
    'Untitled Page';

  // ── NORMALIZATION: Remove volatile elements ──
  VOLATILE_SELECTORS.forEach(selector => {
    try { $(selector).remove(); } catch (e) { /* ignore invalid selectors */ }
  });

  // ── Extract main content ──
  let contentText = '';

  for (const selector of CONTENT_SELECTORS) {
    const el = $(selector);
    if (el.length > 0) {
      contentText = el.text();
      if (contentText.trim().length > 100) break; // Found meaningful content
    }
  }

  // Fallback: use body text if no main content found
  if (!contentText || contentText.trim().length < 100) {
    contentText = $('body').text();
  }

  // ── Final normalization ──
  // 1. Collapse all whitespace (spaces, tabs, newlines → single space)
  // 2. Lowercase (so capitalization fixes don't trigger false alerts)
  // 3. Trim
  const normalizedText = contentText
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return {
    text: normalizedText,
    title: title.trim().substring(0, 200), // Cap title length
    contentLength: normalizedText.length
  };
}

module.exports = { fetchAndNormalize };
