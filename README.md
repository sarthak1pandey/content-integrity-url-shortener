# LinkGuard — Content-Integrity URL Shortener

> **Patent Pending** — VIT Vellore, IPR & TT Cell (Document No. 02-IPR-R003)

A URL shortening service that cryptographically verifies destination page content on every click. Detects and notifies users when shared content has been tampered with or modified.

---

## The Invention

When you shorten a URL, this system:
1. **Fetches** the destination page
2. **Normalizes** it (removes ads, timestamps, nav — volatile elements that aren't real content)
3. **Hashes** the normalized content with SHA-256 (stores this as the "baseline")
4. On **every click**, re-fetches, re-hashes, compares with baseline
5. Shows the clicker a **trust indicator**: ✓ Unchanged or ⚠ Modified
6. Optionally **generates a QR code** for easy offline-to-online secure sharing

This combination is **not patented anywhere in the world** (verified across USPTO, WIPO, Google Patents, Lens.org, Espacenet).

---

## Quick Start

### Prerequisites
- Node.js 16 or higher → https://nodejs.org
- npm (comes with Node.js)

### Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env

# 3. Start the server
npm start

# Open: http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

---

## Deployment (Free — Railway)

1. Create a free account at **railway.app**
2. Click **"New Project"** → **"Deploy from GitHub"**
3. Push this folder to a GitHub repo and connect it
4. Add environment variable: `BASE_URL = https://your-app.railway.app`
5. Deploy — it auto-detects Node.js and runs `npm start`

Your app will be live at `https://your-app.railway.app` in ~2 minutes.

---

## Project Structure

```
link-integrity/
├── server.js              ← Express server, all routes
├── src/
│   ├── database.js        ← SQLite initialization & schema
│   ├── crawler.js         ← Web fetching & normalization pipeline
│   ├── linkService.js     ← Core business logic (THE INVENTION)
│   └── utils.js           ← SHA-256, short code generator, helpers
├── public/
│   ├── index.html         ← Landing page + URL shortener
│   ├── dashboard.html     ← All links dashboard
│   ├── redirect.html      ← Integrity check overlay (shown on every click)
│   ├── link.html          ← Individual link stats + modification history
│   ├── css/style.css      ← Complete design system
│   └── js/app.js          ← Shared JS utilities
├── data/                  ← SQLite database (auto-created)
├── .env                   ← Your environment variables
└── railway.toml           ← One-click Railway deployment config
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/shorten` | Create a short link + take content snapshot |
| `GET`  | `/api/check/:code` | **Core invention** — re-check integrity on click |
| `GET`  | `/api/stats/:code` | Full stats + modification history |
| `GET`  | `/api/links` | All links (dashboard) |
| `DELETE` | `/api/links/:code` | Delete a link |
| `GET`  | `/api/health` | Health check for deployment platforms |

### Example: Shorten a URL
```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

### Example: Check Integrity
```bash
curl http://localhost:3000/api/check/abc1234
```

Response:
```json
{
  "success": true,
  "data": {
    "shortCode": "abc1234",
    "originalUrl": "https://example.com/article",
    "integrityStatus": "UNCHANGED",
    "hashMatch": true,
    "baselineHash": "3f4a9c2b...",
    "currentHash": "3f4a9c2b...",
    "modificationCount": 0,
    "createdAt": "2025-03-20 14:30:00",
    "clickCount": 12
  }
}
```

---

## Database Schema

```sql
-- Main links table
links (
  shortCode TEXT,       -- e.g. "k3mx9pz"
  originalUrl TEXT,     -- destination URL
  title TEXT,           -- page title at creation
  baselineHash TEXT,    -- SHA-256 of normalized content at creation
  contentLength INT,    -- length of normalized content
  createdAt TEXT,       -- creation timestamp
  clickCount INT,       -- total clicks
  modificationCount INT,-- detected content changes
  lastModifiedAt TEXT,  -- when last change was detected
  lastCheckedAt TEXT    -- when last integrity check ran
)

-- Every detected change is logged
modifications (
  shortCode TEXT,       -- which link
  detectedAt TEXT,      -- when detected
  previousHash TEXT,    -- hash before change
  newHash TEXT          -- hash after change
)

-- Click analytics
clicks (
  shortCode TEXT,       -- which link
  clickedAt TEXT,       -- when
  integrityStatus TEXT  -- what the check found
)
```

---

## The Normalization Pipeline

The key technical challenge: web pages have **volatile elements** that change constantly without meaningful content changes (ad slots, timestamps, cookie banners, social counts). If we hashed the raw page, these would cause constant false "Modified" alerts.

The pipeline removes:
- Scripts, styles, iframes
- Navigation, header, footer
- Advertisement elements (`[class*="ad-"]`, etc.)
- Cookie/consent banners
- Timestamps and date elements
- Social share counts
- Sidebar content
- Comment sections
- Related articles recommendations

Only the **article body / main content** is hashed. This means only actual editorial content changes (rewrites, deletions, insertions) trigger a modification alert.

---

## Patent Information

- **Invention Title**: Content-Integrity-Aware URL Shortening System with Cryptographic Destination Page Snapshot and Tamper Indication
- **Filed Via**: VIT Vellore, IPR & TT Cell
- **Document**: 02-IPR-R003 (IDF-B)
- **TRL**: 2 → moving to TRL 3 with this implementation
- **Jurisdiction**: India (Chennai Patent Office) + PCT planned

---

*Built with Node.js, Express, SQLite, Cheerio, and Axios.*
