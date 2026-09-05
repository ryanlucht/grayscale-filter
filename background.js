// background.js - Service worker for coordinating grayscale filter across tabs with temporary override support
import { extractDomain } from './utils/domain.js';
import { shouldApplyGrayscaleFilter } from './utils/filter.js';
import { safeSendMessage } from './utils/messaging.js';

// ============================================
// WRITE SERIALIZATION
// ============================================
// Multiple message/alarm handlers can race to read-modify-write storage.
// Chain every mutation onto a single promise so permanent-domain and
// temporary-override updates run one at a time in arrival order.
let writeQueue = Promise.resolve();
let refreshGeneration = 0;
const tabUpdateGenerations = new Map();

function enqueueWrite(taskFn) {
  const run = () => taskFn();
  const resultPromise = writeQueue.then(run, run);
  // Keep the chain alive even if a task throws/rejects.
  writeQueue = resultPromise.catch(() => {});
  return resultPromise;
}

function beginTabUpdate(tabId) {
  const generation = (tabUpdateGenerations.get(tabId) || 0) + 1;
  tabUpdateGenerations.set(tabId, generation);
  return generation;
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
  const generation = beginTabUpdate(tabId);

  try {
    const result = await chrome.storage.sync.get(['domains', 'temporaryOverrides']);
    if (tabUpdateGenerations.get(tabId) !== generation) return;
    const domains = result.domains || [];
    const temporaryOverrides = result.temporaryOverrides || {};
    applyStoredFilterState(tabId, url, domains, temporaryOverrides);
  } catch (error) {
    console.error('Grayscale Filter: Error in checkAndApplyFilterWithOverrides:', error);
  }
}

// Apply a previously-read storage snapshot to one tab. Keeping this pure of
// storage reads lets a storage change update every open tab with one read.
function applyStoredFilterState(tabId, url, domains, temporaryOverrides) {
  const domain = extractDomain(url);
  if (!domain) return;

  const shouldApplyGrayscale = shouldApplyGrayscaleFilter(
    domain,
    domains,
    temporaryOverrides
  );

  safeSendMessage(tabId, {
    action: shouldApplyGrayscale ? 'apply' : 'remove',
    domain
  });
}

// Recompute every open tab from one authoritative storage snapshot.
export async function refreshAllTabsFromStorage() {
  const generation = ++refreshGeneration;
  const [result, tabs] = await Promise.all([
    chrome.storage.sync.get(['domains', 'temporaryOverrides']),
    chrome.tabs.query({})
  ]);
  // A newer storage change started while this snapshot was loading. Only
  // the newest refresh may publish tab state.
  if (generation !== refreshGeneration) return;
  const domains = result.domains || [];
  const temporaryOverrides = result.temporaryOverrides || {};

  tabs.forEach((tab) => {
    if (tab.id != null && tab.url) {
      beginTabUpdate(tab.id);
      applyStoredFilterState(tab.id, tab.url, domains, temporaryOverrides);
    }
  });
}

// Add/remove a permanent domain through the same serialized authority used
// by overrides. Returning the committed snapshot keeps the popup in sync.
export async function setDomainEnabled(domain, enabled) {
  return enqueueWrite(async () => {
    const result = await chrome.storage.sync.get(['domains']);
    const storedDomains = Array.isArray(result.domains) ? result.domains : [];
    const domains = [...new Set(storedDomains)];
    const isEnabled = domains.includes(domain);

    if (enabled === isEnabled && domains.length === storedDomains.length) {
      return domains;
    }

    let updatedDomains = domains;
    if (enabled && !isEnabled) {
      updatedDomains = [...domains, domain];
    } else if (!enabled && isEnabled) {
      updatedDomains = domains.filter((storedDomain) => storedDomain !== domain);
    }

    await chrome.storage.sync.set({ domains: updatedDomains });
    return updatedDomains;
  });
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
    refreshAllTabsFromStorage().catch((error) => {
      console.error('Grayscale Filter: Error refreshing tabs after storage change:', error);
    });
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setDomainEnabled') {
    setDomainEnabled(message.domain, message.enabled === true)
      .then((domains) => sendResponse({ success: true, domains }))
      .catch((error) => {
        console.error('Error updating domain:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

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
          success: true,
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
        sendResponse({ success: true, active: false });
      }
    }).catch((error) => {
      console.error('Error getting temporary override:', error);
      sendResponse({ success: false, active: false, error: error.message });
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
