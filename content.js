// content.js - Applies grayscale CSS filter to web pages

const STYLE_ID = 'grayscale-filter-extension';

// Extract domain from current URL
function getCurrentDomain() {
  try {
    const url = new URL(window.location.href);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch (error) {
    return null;
  }
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
  } catch (e) {
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
      } catch (e) {
        // Context invalidated during callback - ignore
      }
    });
  } catch (e) {
    // Context invalidated - ignore
  }
}

// Check if current domain should have grayscale applied
function checkAndApplyGrayscale() {
  const currentDomain = getCurrentDomain();
  if (!currentDomain) return;

  safeStorageGet(['domains'], (result) => {
    const domains = result.domains || [];
    if (domains.includes(currentDomain)) {
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
      } catch (e) {
        // Context invalidated - ignore
      }

      return true;
    });
  } catch (e) {
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
