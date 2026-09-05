// background.js - Service worker for coordinating grayscale filter across tabs with temporary override support
import { extractDomain } from './utils/domain.js';
import { shouldApplyGrayscaleFilter } from './utils/filter.js';
import { safeSendMessage } from './utils/messaging.js';

// ============================================
// WRITE SERIALIZATION
// ============================================
// Multiple message/alarm handlers can race to read-modify-write
// `temporaryOverrides` concurrently (lost-update problem). Chain every
// mutation onto a single promise so they run one at a time in order.
let writeQueue = Promise.resolve();

function enqueueWrite(taskFn) {
  const run = () => taskFn();
  const resultPromise = writeQueue.then(run, run);
  // Keep the chain alive even if a task throws/rejects.
  writeQueue = resultPromise.catch(() => {});
  return resultPromise;
}

// Check if domain matches and apply/remove filter (with temporary override support)
// Read-only: an expired override is treated as absent by shouldApplyGrayscaleFilter
// but is NOT deleted here. Actual expiry cleanup is owned exclusively by the
// cleanupExpiredOverrides alarm, so this function never writes to storage -
// otherwise the storage.onChanged fan-out (below) would trigger a write per
// affected tab every time a tab is checked, risking the sync write quota.
export async function checkAndApplyFilterWithOverrides(tabId, url) {
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

    // Determine filter state using priority algorithm (expired overrides
    // are treated as absent internally - see utils/filter.js)
    const shouldApplyGrayscale = shouldApplyGrayscaleFilter(domain, domains, temporaryOverrides);

    safeSendMessage(tabId, {
      action: shouldApplyGrayscale ? 'apply' : 'remove',
      domain
    });
  } catch (error) {
    console.error('Grayscale Filter: Error in checkAndApplyFilterWithOverrides:', error);
  }
}

// Periodic cleanup of expired overrides. This is the single owner of
// override-expiry deletion (see checkAndApplyFilterWithOverrides above).
export async function cleanupExpiredOverrides() {
  return enqueueWrite(async () => {
    try {
      const result = await chrome.storage.sync.get(['temporaryOverrides']);
      const temporaryOverrides = result.temporaryOverrides || {};

      let hasChanges = false;
      const now = Date.now();

      // Remove expired overrides
      for (const domain in temporaryOverrides) {
        if (temporaryOverrides[domain].expiresAt <= now) {
          delete temporaryOverrides[domain];
          hasChanges = true;
        }
      }

      // Saving triggers storage.onChanged, which fans the update out to
      // all tabs - no need to do that separately here.
      if (hasChanges) {
        await chrome.storage.sync.set({ temporaryOverrides });
      }
    } catch (error) {
      console.error('Grayscale Filter: Error cleaning expired overrides:', error);
    }
  });
}

// Set temporary override for a domain
export async function handleTemporaryOverride(domain, state, durationMs) {
  return enqueueWrite(async () => {
    const result = await chrome.storage.sync.get(['domains', 'temporaryOverrides']);
    const domains = result.domains || [];
    const temporaryOverrides = result.temporaryOverrides || {};

    temporaryOverrides[domain] = {
      state: state,
      expiresAt: Date.now() + durationMs,
      originallyInList: domains.includes(domain),
      // Stored so the popup can render a progress bar (remaining / total)
      // without re-deriving "total" from anything but the source of truth.
      // An override written by a previous version of this extension won't
      // have this field - callers must treat a missing durationMs as
      // "can't render a ratio" rather than computing NaN.
      durationMs: durationMs
    };

    // storage.onChanged fans this out to all tabs - no manual tab loop needed.
    await chrome.storage.sync.set({ temporaryOverrides });
  });
}

// Clear temporary override for a domain
export async function clearTemporaryOverride(domain) {
  return enqueueWrite(async () => {
    const result = await chrome.storage.sync.get(['temporaryOverrides']);
    const temporaryOverrides = result.temporaryOverrides || {};

    delete temporaryOverrides[domain];

    // storage.onChanged fans this out to all tabs - no manual tab loop needed.
    await chrome.storage.sync.set({ temporaryOverrides });
  });
}

// Setup alarm for periodic cleanup (every 1 minute).
// IMPORTANT: this must NOT run at module top level. chrome.alarms.create()
// with an existing alarm name REPLACES it and resets its countdown, so
// calling this on every service-worker wake (which happens frequently under
// normal MV3 worker churn) could keep resetting the timer and prevent
// cleanup from ever firing. onInstalled/onStartup only fire once per
// install/browser-launch, so the alarm's periodic schedule is left alone
// in between.
function setupCleanupAlarm() {
  chrome.alarms.create('cleanupExpiredOverrides', { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(setupCleanupAlarm);
chrome.runtime.onStartup.addListener(setupCleanupAlarm);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupExpiredOverrides') {
    cleanupExpiredOverrides();
  }
});

// Listen for tab updates (navigation, page loads).
// Only 'loading' is needed to catch navigations; also handling 'complete'
// doubled the number of storage reads/messages per navigation for no
// behavioral benefit.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
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

// Listen for storage changes (when user adds/removes domains or overrides).
// This is the single fan-out path that updates all open tabs; handlers that
// mutate storage (handleTemporaryOverride, clearTemporaryOverride,
// cleanupExpiredOverrides) rely on this rather than looping over tabs
// themselves.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && (changes.domains || changes.temporaryOverrides)) {
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
          remainingMs: override.expiresAt - Date.now(),
          // May be undefined for an override written before durationMs
          // existed (already sitting in chrome.storage.sync) - the popup
          // is responsible for handling that gracefully.
          durationMs: override.durationMs
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

  // Unhandled message action - don't hold the message port open.
  return false;
});

console.log('Grayscale Filter: Background service worker initialized with temporary override support');
