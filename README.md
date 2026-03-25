# Shortt — Content-Integrity URL Shortener

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

* Node.js 16 or higher → https://nodejs.org
* npm (comes with Node.js)

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

## Project Structure

```
shortt/
├── server.js
├── src/
│   ├── database.js
│   ├── crawler.js
│   ├── linkService.js
│   └── utils.js
├── public/
│   ├── index.html
│   ├── dashboard.html
│   ├── redirect.html
│   ├── link.html
│   ├── css/style.css
│   └── js/app.js
├── .env
└── package.json
```

---

## API Reference

| Method   | Endpoint           | Description                                 |
| -------- | ------------------ | ------------------------------------------- |
| `POST`   | `/api/shorten`     | Create a short link + take content snapshot |
| `GET`    | `/api/check/:code` | Re-check integrity on click                 |
| `GET`    | `/api/stats/:code` | Full stats + modification history           |
| `GET`    | `/api/links`       | All links (dashboard)                       |
| `DELETE` | `/api/links/:code` | Delete a link                               |
| `GET`    | `/api/health`      | Health check                                |

---

## Example: Shorten a URL

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

---

## Example: Check Integrity

```bash
curl http://localhost:3000/api/check/abc1234
```

---

## Database Schema

```sql
links (
  shortCode TEXT,
  originalUrl TEXT,
  title TEXT,
  baselineHash TEXT,
  contentLength INT,
  createdAt TEXT,
  clickCount INT,
  modificationCount INT,
  lastModifiedAt TEXT,
  lastCheckedAt TEXT
)
```

---

## The Normalization Pipeline

Removes:

* Scripts, styles, iframes
* Navigation, header, footer
* Ads & cookie banners
* Timestamps & dynamic elements
* Social counts & sidebars

Only **core content** is hashed → reduces false positives.

---

## Tech Stack

* Node.js
* Express
* Supabase (PostgreSQL)
* Cheerio
* Axios

---

## Branding

**Shortt (shortt.it)** — Short links you can trust.
