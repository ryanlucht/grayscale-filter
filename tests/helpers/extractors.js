// tests/helpers/extractors.js
// Pure functions COPIED from popup.js and background.js for unit testing
// NOTE: This duplication is intentional - Phase 4 will extract shared utilities

/**
 * Extract domain from URL (COPIED from popup.js lines 285-298)
 * @param {string} url - Full URL to extract domain from
 * @returns {string|null} - Domain without www. prefix, or null if invalid
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);

    // Skip non-http(s) URLs (from popup.js line 290-291)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return null;
    }

    return urlObj.hostname.replace(/^www\./, '').toLowerCase();
  } catch (error) {
    return null;
  }
}

/**
 * Normalize domain input (COPIED from popup.js lines 301-310)
 * @param {string} input - User input that may contain protocol, www, path
 * @returns {string} - Cleaned domain
 */
export function normalizeDomain(input) {
  // Remove protocol if present
  input = input.replace(/^(https?:\/\/)?(www\.)?/, '');

  // Remove trailing slash and path
  input = input.split('/')[0];

  // Convert to lowercase
  return input.toLowerCase();
}

/**
 * Validate domain format (COPIED from popup.js lines 313-317)
 * @param {string} domain - Domain to validate
 * @returns {boolean} - True if valid domain format
 */
export function isValidDomain(domain) {
  // Basic domain validation regex
  const regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
  return regex.test(domain);
}

/**
 * Determine if grayscale should be applied (from background.js lines 14-24)
 * @param {string} domain - Domain to check
 * @param {string[]} permanentDomains - Array of domains in permanent list
 * @param {Object} temporaryOverrides - Object of domain -> override data
 * @returns {boolean} - True if grayscale should be applied
 */
export function shouldApplyGrayscaleFilter(domain, permanentDomains, temporaryOverrides) {
  const override = temporaryOverrides[domain];

  // Check for active temporary override (highest priority)
  if (override && override.expiresAt > Date.now()) {
    return override.state === 'grayscale';
  }

  // Fall back to permanent list
  return permanentDomains.includes(domain);
}

/**
 * Format duration for display (COPIED from popup.js lines 492-498)
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Human readable duration
 */
export function formatDuration(ms) {
  const minutes = ms / 60000;
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  if (hours < 24) return hours === 1 ? '1 hour' : `${hours} hours`;
  return '1 day';
}
