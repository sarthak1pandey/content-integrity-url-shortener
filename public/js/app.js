/* ═══════════════════════════════════════════════
   Shared JS Utilities — LinkGuard
═══════════════════════════════════════════════ */

const API = {
  async shorten(url) {
    const res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    return res.json();
  },

  async check(shortCode) {
    const res = await fetch(`/api/check/${shortCode}`);
    return res.json();
  },

  async stats(shortCode) {
    const res = await fetch(`/api/stats/${shortCode}`);
    return res.json();
  },

  async links() {
    const res = await fetch('/api/links');
    return res.json();
  },

  async deleteLink(shortCode) {
    const res = await fetch(`/api/links/${shortCode}`, { method: 'DELETE' });
    return res.json();
  }
};

// Copy to clipboard
async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    btn.style.color = 'var(--green)';
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
  } catch {
    showToast('Could not copy to clipboard', 'error');
  }
}

// Toast notifications
let toastTimeout;
function showToast(message, type = 'success', duration = 3000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  const color = type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--red)' : 'var(--cyan)';
  toast.innerHTML = `
    <span style="color:${color}; font-weight:700; font-family:var(--font-mono)">${icon}</span>
    <span style="font-size:0.9rem">${message}</span>
  `;

  clearTimeout(toastTimeout);
  requestAnimationFrame(() => {
    toast.classList.add('show');
    toastTimeout = setTimeout(() => toast.classList.remove('show'), duration);
  });
}

// Format date string nicely
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch { return dateStr; }
}

// Time ago
function timeAgo(dateStr) {
  if (!dateStr) return 'never';
  try {
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
  } catch { return dateStr; }
}

// Status badge HTML
function statusBadge(status) {
  const map = {
    UNCHANGED:    { cls: 'badge-unchanged', icon: '✓', label: 'Unchanged' },
    MODIFIED:     { cls: 'badge-modified',  icon: '⚠', label: 'Modified' },
    CHECK_FAILED: { cls: 'badge-failed',    icon: '?', label: 'Check Failed' },
    UNKNOWN:      { cls: 'badge-checking',  icon: '~', label: 'Unknown' }
  };
  const s = map[status] || map.UNKNOWN;
  return `<span class="badge ${s.cls}"><span class="badge-dot"></span>${s.label}</span>`;
}

// Truncate URL for display
function truncateUrl(url, max = 50) {
  if (!url || url.length <= max) return url;
  return url.substring(0, max) + '…';
}

// Get short code from current path
function getShortCodeFromPath() {
  const parts = window.location.pathname.split('/');
  return parts[parts.length - 1];
}
