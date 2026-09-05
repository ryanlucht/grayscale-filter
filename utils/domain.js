// utils/domain.js
// Shared domain utilities for the Grayscale Filter extension

/**
 * Extract domain from URL
 * @param {string} url - Full URL to extract domain from
 * @returns {string|null} - Domain without www. prefix, or null if invalid/non-http
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);

    // Skip non-http(s) URLs
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return null;
    }

    return urlObj.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Normalize domain input from user
 * @param {string} input - User input that may contain protocol, www, path
 * @returns {string} - Cleaned domain (lowercase, no protocol/www/path)
 */
export function normalizeDomain(input) {
  // Normalize case before stripping case-insensitive URL components.
  input = input.trim().toLowerCase();

  // Remove protocol if present
  input = input.replace(/^(https?:\/\/)?(www\.)?/, '');

  // Remove trailing slash and path
  input = input.split('/')[0];

  // Remove fragment
  input = input.split('#')[0];

  // Remove query string
  input = input.split('?')[0];

  // Remove port
  input = input.split(':')[0];

  return input;
}

/**
 * Validate domain format
 * @param {string} domain - Domain to validate
 * @returns {boolean} - True if valid domain format
 */
export function isValidDomain(domain) {
  if (typeof domain !== 'string' || domain.length === 0 || domain.length > 253) {
    return false;
  }

  const labels = domain.split('.');

  // Need at least two labels (e.g. "example" + "com")
  if (labels.length < 2) {
    return false;
  }

  // Each label: alphanumeric, may contain hyphens internally, no leading/trailing hyphen
  const labelRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
  for (const label of labels) {
    if (!labelRegex.test(label)) {
      return false;
    }
  }

  // Final label (TLD) must be alphabetic only and at least 2 characters
  const tld = labels[labels.length - 1];
  if (!/^[a-zA-Z]{2,}$/.test(tld)) {
    return false;
  }

  return true;
}

/**
 * Format duration for display
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Human readable duration (e.g., "15 minutes", "1 hour")
 */
export function formatDuration(ms) {
  const minutes = ms / 60000;
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  if (hours < 24) return hours === 1 ? '1 hour' : `${hours} hours`;
  return '1 day';
}
