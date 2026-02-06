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
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return null;
    }

    return urlObj.hostname.replace(/^www\./, '').toLowerCase();
  } catch (error) {
    return null;
  }
}

/**
 * Normalize domain input from user
 * @param {string} input - User input that may contain protocol, www, path
 * @returns {string} - Cleaned domain (lowercase, no protocol/www/path)
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
 * Validate domain format
 * @param {string} domain - Domain to validate
 * @returns {boolean} - True if valid domain format
 */
export function isValidDomain(domain) {
  // Basic domain validation regex
  const regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
  return regex.test(domain);
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
