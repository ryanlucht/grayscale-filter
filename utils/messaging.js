// utils/messaging.js
// Shared Chrome messaging helpers for the Grayscale Filter extension

/**
 * Send a message to a tab, silently swallowing the "no receiving end"
 * error that occurs when a tab has no content script listening yet
 * (e.g. chrome:// pages, or a tab whose content script hasn't loaded).
 * @param {number} tabId - Target tab id
 * @param {Object} message - Message payload
 */
export function safeSendMessage(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, () => {
    if (chrome.runtime.lastError) {
      // Intentionally ignored - tab may not have a content script listening.
    }
  });
}
