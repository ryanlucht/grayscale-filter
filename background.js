// background.js - Service worker for coordinating grayscale filter across tabs with temporary override support

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '').toLowerCase();
  } catch (error) {
    return null;
  }
}

// Determine if grayscale should be applied based on permanent list and temporary overrides
function shouldApplyGrayscaleFilter(domain, permanentDomains, temporaryOverrides) {
  const override = temporaryOverrides[domain];

  // Check for active temporary override (highest priority)
  if (override && override.expiresAt > Date.now()) {
    return override.state === 'grayscale';
  }

  // Fall back to permanent list
  return permanentDomains.includes(domain);
}

// Check if domain matches and apply/remove filter (with temporary override support)
async function checkAndApplyFilterWithOverrides(tabId, url) {
  const domain = extractDomain(url);
  if (!domain) return;

  // Skip chrome://, edge://, about:, and other special URLs
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return;
  }

  try {
    const result = await chrome.storage.sync.get(['domains', 'temporaryOverrides']);
    const domains = result.domains || [];
    const temporaryOverrides = result.temporaryOverrides || {};

    // Clean expired override for this domain inline
    if (temporaryOverrides[domain] && temporaryOverrides[domain].expiresAt <= Date.now()) {
      delete temporaryOverrides[domain];
      await chrome.storage.sync.set({ temporaryOverrides });
    }

    // Determine filter state using priority algorithm
    const shouldApplyGrayscale = shouldApplyGrayscaleFilter(domain, domains, temporaryOverrides);

    // Send message to content script
    chrome.tabs.sendMessage(
      tabId,
      {
        action: shouldApplyGrayscale ? 'apply' : 'remove',
        domain: domain
      },
      (response) => {
        // Ignore errors if content script isn't ready yet
        if (chrome.runtime.lastError) {
          // Content script may not be injected yet, that's okay
        }
      }
    );
  } catch (error) {
    console.error('Grayscale Filter: Error in checkAndApplyFilterWithOverrides:', error);
  }
}

// Periodic cleanup of expired overrides
async function cleanupExpiredOverrides() {
  try {
    const result = await chrome.storage.sync.get(['temporaryOverrides']);
    const temporaryOverrides = result.temporaryOverrides || {};

    let hasChanges = false;
    const now = Date.now();
    const affectedDomains = [];

    // Remove expired overrides
    for (const domain in temporaryOverrides) {
      if (temporaryOverrides[domain].expiresAt <= now) {
        affectedDomains.push(domain);
        delete temporaryOverrides[domain];
        hasChanges = true;
      }
    }

    // Save and update affected tabs
    if (hasChanges) {
      await chrome.storage.sync.set({ temporaryOverrides });

      // Update all tabs for affected domains
      const tabs = await chrome.tabs.query({});
      tabs.forEach((tab) => {
        if (tab.url) {
          const tabDomain = extractDomain(tab.url);
          if (affectedDomains.includes(tabDomain)) {
            checkAndApplyFilterWithOverrides(tab.id, tab.url);
          }
        }
      });
    }
  } catch (error) {
    console.error('Grayscale Filter: Error cleaning expired overrides:', error);
  }
}

// Set temporary override for a domain
async function handleTemporaryOverride(domain, state, durationMs) {
  const result = await chrome.storage.sync.get(['domains', 'temporaryOverrides']);
  const domains = result.domains || [];
  const temporaryOverrides = result.temporaryOverrides || {};

  temporaryOverrides[domain] = {
    state: state,
    expiresAt: Date.now() + durationMs,
    originallyInList: domains.includes(domain)
  };

  await chrome.storage.sync.set({ temporaryOverrides });

  // Update all tabs with this domain
  const tabs = await chrome.tabs.query({});
  tabs.forEach((tab) => {
    if (tab.url) {
      const tabDomain = extractDomain(tab.url);
      if (tabDomain === domain) {
        checkAndApplyFilterWithOverrides(tab.id, tab.url);
      }
    }
  });
}

// Clear temporary override for a domain
async function clearTemporaryOverride(domain) {
  const result = await chrome.storage.sync.get(['temporaryOverrides']);
  const temporaryOverrides = result.temporaryOverrides || {};

  delete temporaryOverrides[domain];
  await chrome.storage.sync.set({ temporaryOverrides });

  // Update all tabs with this domain
  const tabs = await chrome.tabs.query({});
  tabs.forEach((tab) => {
    if (tab.url) {
      const tabDomain = extractDomain(tab.url);
      if (tabDomain === domain) {
        checkAndApplyFilterWithOverrides(tab.id, tab.url);
      }
    }
  });
}

// Setup alarm for periodic cleanup (every 1 minute)
chrome.alarms.create('cleanupExpiredOverrides', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupExpiredOverrides') {
    cleanupExpiredOverrides();
  }
});

// Listen for tab updates (navigation, page loads)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only act when the page is loading or complete
  if (changeInfo.status === 'loading' || changeInfo.status === 'complete') {
    if (tab.url) {
      checkAndApplyFilterWithOverrides(tabId, tab.url);
    }
  }
});

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      checkAndApplyFilterWithOverrides(activeInfo.tabId, tab.url);
    }
  } catch (error) {
    console.error('Grayscale Filter: Error in onActivated:', error);
  }
});

// Listen for storage changes (when user adds/removes domains or overrides)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && (changes.domains || changes.temporaryOverrides)) {
    // Domain list or overrides changed, update all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.url) {
          checkAndApplyFilterWithOverrides(tab.id, tab.url);
        }
      });
    });
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setTemporaryOverride') {
    handleTemporaryOverride(message.domain, message.state, message.duration)
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error('Error setting temporary override:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  if (message.action === 'getTemporaryOverride') {
    chrome.storage.sync.get(['temporaryOverrides']).then((result) => {
      const temporaryOverrides = result.temporaryOverrides || {};
      const override = temporaryOverrides[message.domain];

      if (override && override.expiresAt > Date.now()) {
        sendResponse({
          active: true,
          state: override.state,
          expiresAt: override.expiresAt,
          remainingMs: override.expiresAt - Date.now()
        });
      } else {
        sendResponse({ active: false });
      }
    }).catch((error) => {
      console.error('Error getting temporary override:', error);
      sendResponse({ active: false });
    });
    return true;
  }

  if (message.action === 'clearTemporaryOverride') {
    clearTemporaryOverride(message.domain)
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error('Error clearing temporary override:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.action === 'updateAllTabs') {
    // Force update all tabs when requested by popup
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.url) {
          checkAndApplyFilterWithOverrides(tab.id, tab.url);
        }
      });
    });
    sendResponse({ success: true });
    return true;
  }

  return true;
});

console.log('Grayscale Filter: Background service worker initialized with temporary override support');
