// content.js - Applies grayscale CSS filter to web pages

const STYLE_ID = 'grayscale-filter-extension';

// Extract domain from current URL
// NOTE: this duplicates utils/domain.js:extractDomain (minus the URL-object
// input) because content.js is a classic script and cannot use ES imports.
function getCurrentDomain() {
  try {
    const href = window.location.href;

    // Skip non-http(s) URLs, matching utils/domain.js:extractDomain
    if (!href.startsWith('http://') && !href.startsWith('https://')) {
      return null;
    }

    const url = new URL(href);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

// Determine if grayscale should be applied given the permanent domain list
// and any temporary overrides.
// NOTE: this duplicates the priority rule in utils/filter.js:shouldApplyGrayscaleFilter.
// That file is the canonical copy; content.js is a classic script (document_start,
// no ES imports available) so the logic is inlined here to avoid an async
// chrome.runtime.getURL() import that would reintroduce a flash of color on load.
function shouldApplyGrayscaleFilter(domain, permanentDomains, temporaryOverrides) {
  const override = temporaryOverrides[domain];

  // Check for active temporary override (highest priority)
  if (override && override.expiresAt > Date.now()) {
    return override.state === 'grayscale';
  }

  // Fall back to permanent list
  return permanentDomains.includes(domain);
}

// Apply grayscale filter to the page
function applyGrayscale() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html {
      filter: grayscale(100%) !important;
      -webkit-filter: grayscale(100%) !important;
    }
  `;

  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (!document.getElementById(STYLE_ID)) {
        document.head.appendChild(style);
      }
    });
  }
}

// Remove grayscale filter from the page
function removeGrayscale() {
  const style = document.getElementById(STYLE_ID);
  if (style) {
    style.remove();
  }
}

// Safely check if extension context is still valid
function isContextValid() {
  try {
    // This will throw if context is invalidated
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

// Safely call Chrome APIs with error suppression
function safeStorageGet(keys, callback) {
  if (!isContextValid()) return;

  try {
    chrome.storage.sync.get(keys, (result) => {
      try {
        if (chrome.runtime.lastError) return;
        callback(result);
      } catch {
        // Context invalidated during callback - ignore
      }
    });
  } catch {
    // Context invalidated - ignore
  }
}

// Check if current domain should have grayscale applied
function checkAndApplyGrayscale() {
  const currentDomain = getCurrentDomain();
  if (!currentDomain) return;

  safeStorageGet(['domains', 'temporaryOverrides'], (result) => {
    const domains = result.domains || [];
    const temporaryOverrides = result.temporaryOverrides || {};

    if (shouldApplyGrayscaleFilter(currentDomain, domains, temporaryOverrides)) {
      applyGrayscale();
    } else {
      removeGrayscale();
    }
  });
}

// Set up message listener with error handling
function setupMessageListener() {
  if (!isContextValid()) return;

  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        if (!isContextValid()) return;

        const currentDomain = getCurrentDomain();

        if (message.action === 'apply' && message.domain === currentDomain) {
          applyGrayscale();
          sendResponse({ success: true });
        } else if (message.action === 'remove' && message.domain === currentDomain) {
          removeGrayscale();
          sendResponse({ success: true });
        } else if (message.action === 'check') {
          checkAndApplyGrayscale();
          sendResponse({ success: true });
        }
      } catch {
        // Context invalidated - ignore
      }

      return true;
    });
  } catch {
    // Context invalidated during setup - ignore
  }
}

// Initialize
setupMessageListener();
checkAndApplyGrayscale();

// Handle visibility changes (back/forward navigation)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkAndApplyGrayscale();
  }
});
