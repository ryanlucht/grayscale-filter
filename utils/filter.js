// utils/filter.js
// Grayscale filter state determination logic

/**
 * Determine if grayscale should be applied to a domain
 * @param {string} domain - Domain to check
 * @param {string[]} permanentDomains - Array of domains in permanent list
 * @param {Object} temporaryOverrides - Object mapping domain -> override data {state, expiresAt}
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
