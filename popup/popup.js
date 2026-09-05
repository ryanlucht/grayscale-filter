// popup.js - UI logic and Chrome API interactions
import { extractDomain, normalizeDomain, isValidDomain, formatDuration } from '../utils/domain.js';

// ============================================
// DOM ELEMENT REFERENCES
// ============================================
let currentDomainEl;
let toggleButton;
let toggleText;
let domainInput;
let addButton;
let domainList;
let emptyState;
let errorMessage;

// Override banner elements
let overrideBanner;
let overrideStatusText;
let powerButton;
let durationSelect;
let cancelOverride;
let timerDisplay;
let overrideProgress;

// Re-skin: dynamic section asides + title bar revision (not part of the
// original 14-id contract; harmless if absent, guarded at every call site).
let currentSiteAside;
let currentSiteDot;
let overrideAside;
let domainCountAside;
let revisionLabel;

// ============================================
// STATE VARIABLES
// ============================================
let currentDomain = null;
let domains = [];
let temporaryOverride = null;
let timerInterval = null;
let messageTimeout = null;

// ============================================
// TEST HOOKS
// ============================================
// Not used by the popup itself (popup.html only invokes the
// DOMContentLoaded handler below) - these exist so tests/unit/popup.test.js
// can inject DOM refs / state and inspect internal state without spinning
// up a full DOM. Harmless in production: nothing calls them there.
export const __testHooks = {
  setDomRefs(refs) {
    ({
      currentDomainEl, toggleButton, toggleText, domainInput, addButton,
      domainList, emptyState, errorMessage, overrideBanner, overrideStatusText,
      powerButton, durationSelect, cancelOverride, timerDisplay, overrideProgress,
      currentSiteAside, currentSiteDot, overrideAside, domainCountAside, revisionLabel
    } = refs);
  },
  setState(state) {
    if ('currentDomain' in state) currentDomain = state.currentDomain;
    if ('domains' in state) domains = state.domains;
    if ('temporaryOverride' in state) temporaryOverride = state.temporaryOverride;
  },
  getState() {
    return { currentDomain, domains, temporaryOverride, timerInterval, messageTimeout };
  }
};

// ============================================
// INITIALIZATION
// ============================================

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  currentDomainEl = document.getElementById('currentDomain');
  toggleButton = document.getElementById('toggleButton');
  toggleText = document.getElementById('toggleText');
  domainInput = document.getElementById('domainInput');
  addButton = document.getElementById('addButton');
  domainList = document.getElementById('domainList');
  emptyState = document.getElementById('emptyState');
  errorMessage = document.getElementById('errorMessage');

  // Override banner elements
  overrideBanner = document.getElementById('overrideBanner');
  overrideStatusText = document.getElementById('overrideStatusText');
  powerButton = document.getElementById('powerButton');
  durationSelect = document.getElementById('durationSelect');
  cancelOverride = document.getElementById('cancelOverride');
  timerDisplay = document.getElementById('timerDisplay');
  overrideProgress = document.getElementById('overrideProgress');

  // Re-skin: dynamic section asides + title bar revision
  currentSiteAside = document.getElementById('currentSiteAside');
  currentSiteDot = document.getElementById('currentSiteDot');
  overrideAside = document.getElementById('overrideAside');
  domainCountAside = document.getElementById('domainCountAside');
  revisionLabel = document.getElementById('revisionLabel');

  // Set up event listeners
  toggleButton.addEventListener('click', handleToggle);
  addButton.addEventListener('click', handleManualAdd);
  domainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleManualAdd();
    }
  });
  powerButton.addEventListener('click', handlePowerButton);
  cancelOverride.addEventListener('click', handleCancelOverride);

  // Clear error message when user types, and re-evaluate whether #addButton
  // should be enabled (disabled while the trimmed input is empty).
  domainInput.addEventListener('input', () => {
    clearMessage();
    updateAddButtonState();
  });
  chrome.storage.onChanged.addListener(handlePopupStorageChange);

  // The title bar shows the real running version, never an invented figure.
  if (revisionLabel) {
    revisionLabel.textContent = `Rev ${chrome.runtime.getManifest().version}`;
  }

  // Initialize
  updateAddButtonState();
  await loadCurrentTab();
  await loadDomains();
  await loadTemporaryOverride();
  updateUI();

  // Clean up timer interval when popup closes
  window.addEventListener('unload', () => {
    stopTimerUpdate();
    chrome.storage.onChanged.removeListener(handlePopupStorageChange);
  });
});

// ============================================
// DATA LOADING
// ============================================

// Load current tab information
async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      currentDomain = extractDomain(tab.url);

      if (currentDomain) {
        // The section head ("01 - Current site") already carries the label,
        // so the readout itself is just the domain.
        currentDomainEl.textContent = currentDomain;
        toggleButton.disabled = false;
      } else {
        currentDomainEl.textContent = 'Not a valid website';
        toggleButton.disabled = true;
      }
    } else {
      currentDomainEl.textContent = 'No active tab';
      toggleButton.disabled = true;
    }
  } catch (error) {
    console.error('Error loading current tab:', error);
    currentDomainEl.textContent = 'Error loading tab';
    toggleButton.disabled = true;
  }
}

// Load domains from storage
async function loadDomains() {
  try {
    const result = await chrome.storage.sync.get(['domains']);
    domains = result.domains || [];
  } catch (error) {
    console.error('Error loading domains:', error);
    domains = [];
  }
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

// Update UI based on current state
function updateUI() {
  // Update toggle button
  updateToggleButton();

  // Update domain list
  renderDomainList();

  // Update temporary toggle UI
  updateTemporaryUI();
}

// Update toggle button state and text
function updateToggleButton() {
  if (!currentDomain) {
    toggleButton.disabled = true;
    toggleText.textContent = 'No valid site';
    toggleButton.className = 'btn btn--graphite btn--block';
    if (currentSiteAside) currentSiteAside.textContent = 'in color';
    if (currentSiteDot) currentSiteDot.classList.remove('is-filtered');
    return;
  }

  const isActive = domains.includes(currentDomain);

  if (isActive) {
    // Domain is in grayscale list - button removes it
    toggleButton.className = 'btn btn--secondary btn--alert btn--block';
    toggleText.textContent = 'Remove from grayscale';
  } else {
    // Domain not in list - button adds it
    toggleButton.className = 'btn btn--graphite btn--block';
    toggleText.textContent = 'Add to grayscale';
  }

  if (currentSiteAside) currentSiteAside.textContent = isActive ? 'filtered' : 'in color';
  if (currentSiteDot) currentSiteDot.classList.toggle('is-filtered', isActive);
}

// Enable/disable #addButton based on whether there's non-whitespace input.
// The Enter-key path (handleManualAdd's own guard) stays reachable even
// while the button is disabled - only the click affordance is gated.
function updateAddButtonState() {
  addButton.disabled = domainInput.value.trim().length === 0;
}

// Render the domain list
function renderDomainList() {
  // Clear current list
  domainList.innerHTML = '';

  if (domainCountAside) {
    domainCountAside.textContent = `${domains.length} ${domains.length === 1 ? 'domain' : 'domains'}`;
  }

  if (domains.length === 0) {
    emptyState.classList.add('visible');
    return;
  }

  emptyState.classList.remove('visible');

  // Sort domains alphabetically
  const sortedDomains = [...domains].sort();

  // Create list items
  sortedDomains.forEach((domain) => {
    const item = document.createElement('div');
    item.className = 'domain-item';

    const nameEl = document.createElement('span');
    nameEl.className = 'domain-name';
    nameEl.textContent = domain;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.setAttribute('aria-label', `Remove ${domain}`);
    removeBtn.addEventListener('click', () => handleRemove(domain));

    item.appendChild(nameEl);
    item.appendChild(removeBtn);
    domainList.appendChild(item);
  });
}

// ============================================
// EVENT HANDLERS - Domain Management
// ============================================

// Handle toggle button click
async function handleToggle() {
  if (!currentDomain) return;

  const isActive = domains.includes(currentDomain);

  if (isActive) {
    // Remove from list
    await removeDomain(currentDomain);
  } else {
    // Add to list
    await addDomain(currentDomain);
  }
}

// Handle manual add button click
async function handleManualAdd() {
  const input = domainInput.value.trim();

  if (!input) {
    showError('Please enter a domain.');
    return;
  }

  const domain = normalizeDomain(input);

  if (!isValidDomain(domain)) {
    showError('Invalid domain format.');
    return;
  }

  if (domains.includes(domain)) {
    showError('Domain already in list.');
    return;
  }

  const added = await addDomain(domain);
  if (added) {
    domainInput.value = '';
    clearMessage();
    updateAddButtonState();
  }
}

// Handle remove button click
async function handleRemove(domain) {
  await removeDomain(domain);
}

// Add domain to list
export async function addDomain(domain) {
  try {
    const response = await sendBackgroundRequest({
      action: 'setDomainEnabled',
      domain,
      enabled: true
    });
    if (!Array.isArray(response.domains)) {
      throw new Error('Background returned an invalid domain snapshot.');
    }
    domains = response.domains;

    updateUI();
    return true;
  } catch (error) {
    console.error('Error adding domain:', error);
    showError('Failed to add domain.');
    return false;
  }
}

// Remove domain from list
export async function removeDomain(domain) {
  try {
    const response = await sendBackgroundRequest({
      action: 'setDomainEnabled',
      domain,
      enabled: false
    });
    if (!Array.isArray(response.domains)) {
      throw new Error('Background returned an invalid domain snapshot.');
    }
    domains = response.domains;

    updateUI();
    return true;
  } catch (error) {
    console.error('Error removing domain:', error);
    showError('Failed to remove domain.');
    return false;
  }
}

// ============================================
// CHROME API HELPERS
// ============================================

// Chrome resolves runtime.sendMessage for application-level failures when
// the receiver responds with { success: false }. Convert that response into
// a rejection so callers never display success for a failed storage write.
async function sendBackgroundRequest(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response || response.success !== true) {
    throw new Error(response?.error || 'Background request failed.');
  }
  return response;
}

// Keep an open popup synchronized with storage changes made by another
// window or by the override-expiration alarm.
async function handlePopupStorageChange(changes, areaName) {
  if (areaName !== 'sync') return;

  if (changes.domains) {
    domains = Array.isArray(changes.domains.newValue)
      ? changes.domains.newValue
      : [];
  }

  if (changes.temporaryOverrides && currentDomain) {
    await loadTemporaryOverride();
  }

  updateUI();
}

// ============================================
// #errorMessage MESSAGING (shared by errors and success notices)
// ============================================

// Clear any pending message and reset #errorMessage to empty.
export function clearMessage() {
  if (messageTimeout) {
    clearTimeout(messageTimeout);
    messageTimeout = null;
  }
  errorMessage.textContent = '';
  errorMessage.style.color = '';
  errorMessage.classList.remove('success', 'error');
}

// Show a message in #errorMessage, auto-clearing after 3s.
// `#errorMessage` is shared between error and success notices; a single
// stored timeout handle (cleared before every new message) prevents one
// message's timer from blanking a different, later message early.
export function showMessage(text, kind) {
  if (messageTimeout) {
    clearTimeout(messageTimeout);
    messageTimeout = null;
  }

  errorMessage.textContent = text;
  errorMessage.classList.remove('success', 'error');
  errorMessage.classList.add(kind);

  messageTimeout = setTimeout(() => {
    clearMessage();
  }, 3000);
}

// Show error message
export function showError(message) {
  showMessage(message, 'error');
}

// ============================================
// TEMPORARY OVERRIDE FUNCTIONS
// ============================================

// Load temporary override status for current domain
async function loadTemporaryOverride() {
  if (!currentDomain) {
    temporaryOverride = null;
    return;
  }

  try {
    const response = await sendBackgroundRequest({
      action: 'getTemporaryOverride',
      domain: currentDomain
    });
    temporaryOverride = response.active ? response : null;
  } catch (error) {
    console.error('Error loading temporary override:', error);
    temporaryOverride = null;
  }
}

// Handle power button click
export async function handlePowerButton() {
  if (!currentDomain) return;

  // If override is active, clicking cancels it
  if (temporaryOverride) {
    await handleCancelOverride();
    return;
  }

  // Determine override state based on permanent list
  const isInPermanentList = domains.includes(currentDomain);
  const overrideState = isInPermanentList ? 'color' : 'grayscale';

  const durationMs = parseInt(durationSelect.value);

  try {
    await sendBackgroundRequest({
      action: 'setTemporaryOverride',
      domain: currentDomain,
      state: overrideState,
      duration: durationMs
    });

    await loadTemporaryOverride();
    updateTemporaryUI();
    showSuccessMessage(overrideState, durationMs);
  } catch (error) {
    console.error('Error setting temporary override:', error);
    showError('Failed to set temporary override.');
  }
}

// Handle cancel override button
export async function handleCancelOverride() {
  if (!currentDomain) return;

  try {
    await sendBackgroundRequest({
      action: 'clearTemporaryOverride',
      domain: currentDomain
    });

    temporaryOverride = null;
    updateTemporaryUI();
  } catch (error) {
    console.error('Error clearing temporary override:', error);
    showError('Failed to cancel override.');
  }
}

// Number of discrete blocks in the override banner's tick-progress bar
// (DESIGN-RULES.md: "progress is discrete blocks ... it ticks, it never
// glides"). Matches the composition's <TickProgress blocks={16} deep />.
const TICK_BLOCKS = 16;

// Render the override banner's tick-progress bar from the current
// temporaryOverride. Gap: a temporaryOverride written by a previous version
// of this extension (already sitting in chrome.storage.sync) has no
// durationMs, so there's no "total" to divide by - hide the bar rather
// than render NaN/garbage blocks.
function renderProgressBar() {
  if (!overrideProgress) return;

  if (!temporaryOverride || !temporaryOverride.active || !temporaryOverride.durationMs) {
    overrideProgress.hidden = true;
    overrideProgress.innerHTML = '';
    return;
  }

  const remainingMs = Math.max(0, temporaryOverride.expiresAt - Date.now());
  const ratio = Math.min(1, remainingMs / temporaryOverride.durationMs);
  const filled = Math.round(ratio * TICK_BLOCKS);

  overrideProgress.hidden = false;
  overrideProgress.innerHTML = '';
  for (let i = 0; i < TICK_BLOCKS; i++) {
    const block = document.createElement('span');
    block.className = i < filled ? 'tick-block tick-block--filled' : 'tick-block';
    overrideProgress.appendChild(block);
  }
}

// Update temporary toggle UI
export function updateTemporaryUI() {
  if (!currentDomain) {
    // No valid domain - hide banner, disable power button
    overrideBanner.style.display = 'none';
    if (powerButton) powerButton.disabled = true;
    if (durationSelect) durationSelect.disabled = false;
    if (overrideAside) overrideAside.textContent = 'idle';
    renderProgressBar();
    stopTimerUpdate();
    return;
  }

  if (powerButton) powerButton.disabled = false;

  if (temporaryOverride && temporaryOverride.active) {
    // Override is active - SHOW banner
    overrideBanner.style.display = 'flex';

    const stateText = temporaryOverride.state === 'grayscale'
      ? 'Grayscale override active'
      : 'Color override active';
    overrideStatusText.textContent = stateText;

    // Update timer + progress bar
    updateTimerDisplay();
    startTimerUpdate();

    // Mark power button as active; the duration can't be changed mid-run.
    if (powerButton) {
      powerButton.classList.add('active');
      powerButton.setAttribute('aria-label', 'Cancel override');
    }
    if (durationSelect) durationSelect.disabled = true;
    if (overrideAside) overrideAside.textContent = 'running';
  } else {
    // No active override - HIDE banner
    overrideBanner.style.display = 'none';

    // Reset power button state
    if (powerButton) {
      powerButton.classList.remove('active');
      powerButton.setAttribute('aria-label', 'Start override');
    }
    if (durationSelect) durationSelect.disabled = false;
    if (overrideAside) overrideAside.textContent = 'idle';
    renderProgressBar();

    // Nothing to count down - don't run the interval while idle.
    stopTimerUpdate();
  }
}

// Update timer display.
// Returns true if the override is still live (and the display was updated),
// false if it has expired (caller is responsible for re-syncing state -
// this function only renders, it never mutates `temporaryOverride`).
export function updateTimerDisplay() {
  if (!temporaryOverride || !temporaryOverride.active) return false;

  const remainingMs = temporaryOverride.expiresAt - Date.now();
  if (remainingMs <= 0) return false;

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const timeString = hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;

  timerDisplay.textContent = timeString;
  renderProgressBar();
  return true;
}

// Start the 1s timer update interval. Only runs while an override is
// active; a no-op if already running.
export function startTimerUpdate() {
  if (timerInterval) return;

  timerInterval = setInterval(() => {
    const stillActive = updateTimerDisplay();

    if (!stillActive) {
      // Override expired (or was cleared out from under us) - stop
      // ticking and re-sync from the source of truth rather than
      // dereferencing the now-stale `temporaryOverride`.
      stopTimerUpdate();
      loadTemporaryOverride().then(() => {
        updateTemporaryUI();
      });
    }
  }, 1000);
}

// Stop the timer update interval, if running.
export function stopTimerUpdate() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Show success message
export function showSuccessMessage(state, durationMs) {
  const durationText = formatDuration(durationMs);
  const stateText = state === 'grayscale' ? 'Grayscale' : 'Color';
  showMessage(`${stateText} override active for ${durationText}.`, 'success');
}
