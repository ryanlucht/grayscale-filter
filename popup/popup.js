// popup.js - UI logic and Chrome API interactions

// DOM elements
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

// State
let currentDomain = null;
let domains = [];
let currentTabId = null;
let temporaryOverride = null;
let timerInterval = null;

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

  // Clear error message when user types
  domainInput.addEventListener('input', () => {
    errorMessage.textContent = '';
  });

  // Initialize
  await loadCurrentTab();
  await loadDomains();
  await loadTemporaryOverride();
  updateUI();
  startTimerUpdate();
});

// Load current tab information
async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      currentTabId = tab.id;
      currentDomain = extractDomain(tab.url);

      if (currentDomain) {
        currentDomainEl.textContent = `Current site: ${currentDomain}`;
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
    toggleButton.className = 'btn-primary';
    return;
  }

  const isActive = domains.includes(currentDomain);

  if (isActive) {
    // Domain is in grayscale list - button removes it
    toggleButton.className = 'btn-primary active';
    toggleText.textContent = 'Remove from Grayscale';
  } else {
    // Domain not in list - button adds it
    toggleButton.className = 'btn-primary';
    toggleText.textContent = 'Add to Grayscale';
  }
}

// Render the domain list
function renderDomainList() {
  // Clear current list
  domainList.innerHTML = '';

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
    removeBtn.addEventListener('click', () => handleRemove(domain));

    item.appendChild(nameEl);
    item.appendChild(removeBtn);
    domainList.appendChild(item);
  });
}

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
    showError('Please enter a domain');
    return;
  }

  const domain = normalizeDomain(input);

  if (!isValidDomain(domain)) {
    showError('Invalid domain format');
    return;
  }

  if (domains.includes(domain)) {
    showError('Domain already in list');
    return;
  }

  await addDomain(domain);
  domainInput.value = '';
  errorMessage.textContent = '';
}

// Handle remove button click
async function handleRemove(domain) {
  await removeDomain(domain);
}

// Add domain to list
async function addDomain(domain) {
  try {
    domains.push(domain);
    await chrome.storage.sync.set({ domains });

    // Send message to apply grayscale to all matching tabs
    await sendMessageToAllTabs('apply', domain);

    // If this is the current tab, send message directly
    if (domain === currentDomain && currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { action: 'apply', domain });
    }

    updateUI();
  } catch (error) {
    console.error('Error adding domain:', error);
    showError('Failed to add domain');
  }
}

// Remove domain from list
async function removeDomain(domain) {
  try {
    domains = domains.filter((d) => d !== domain);
    await chrome.storage.sync.set({ domains });

    // Send message to remove grayscale from all matching tabs
    await sendMessageToAllTabs('remove', domain);

    // If this is the current tab, send message directly
    if (domain === currentDomain && currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { action: 'remove', domain });
    }

    updateUI();
  } catch (error) {
    console.error('Error removing domain:', error);
    showError('Failed to remove domain');
  }
}

// Send message to all tabs with matching domain
async function sendMessageToAllTabs(action, domain) {
  try {
    const tabs = await chrome.tabs.query({});
    tabs.forEach((tab) => {
      if (tab.url) {
        const tabDomain = extractDomain(tab.url);
        if (tabDomain === domain) {
          chrome.tabs.sendMessage(
            tab.id,
            { action, domain },
            () => {
              // Ignore errors (tab may not have content script)
              if (chrome.runtime.lastError) {
                // Silently ignore
              }
            }
          );
        }
      }
    });
  } catch (error) {
    console.error('Error sending message to tabs:', error);
  }
}

// Extract domain from URL
function extractDomain(url) {
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

// Normalize domain input
function normalizeDomain(input) {
  // Remove protocol if present
  input = input.replace(/^(https?:\/\/)?(www\.)?/, '');

  // Remove trailing slash and path
  input = input.split('/')[0];

  // Convert to lowercase
  return input.toLowerCase();
}

// Validate domain format
function isValidDomain(domain) {
  // Basic domain validation regex
  const regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
  return regex.test(domain);
}

// Show error message
function showError(message) {
  errorMessage.textContent = message;
  setTimeout(() => {
    errorMessage.textContent = '';
  }, 3000);
}

// ===== TEMPORARY OVERRIDE FUNCTIONS =====

// Load temporary override status for current domain
async function loadTemporaryOverride() {
  if (!currentDomain) {
    temporaryOverride = null;
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
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
async function handlePowerButton() {
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
    await chrome.runtime.sendMessage({
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
    showError('Failed to set temporary override');
  }
}

// Handle cancel override button
async function handleCancelOverride() {
  if (!currentDomain) return;

  try {
    await chrome.runtime.sendMessage({
      action: 'clearTemporaryOverride',
      domain: currentDomain
    });

    temporaryOverride = null;
    updateTemporaryUI();
  } catch (error) {
    console.error('Error clearing temporary override:', error);
    showError('Failed to cancel override');
  }
}

// Update temporary toggle UI
function updateTemporaryUI() {
  if (!currentDomain) {
    // No valid domain - hide banner, disable power button
    overrideBanner.style.display = 'none';
    if (powerButton) powerButton.disabled = true;
    return;
  }

  if (powerButton) powerButton.disabled = false;

  if (temporaryOverride && temporaryOverride.active) {
    // Override is active - SHOW banner
    overrideBanner.style.display = 'flex';

    const stateText = temporaryOverride.state === 'grayscale'
      ? 'Grayscale Override Active'
      : 'Color Override Active';
    overrideStatusText.textContent = stateText;

    // Update timer
    updateTimerDisplay();

    // Mark power button as active
    if (powerButton) powerButton.classList.add('active');
  } else {
    // No active override - HIDE banner
    overrideBanner.style.display = 'none';

    // Reset power button state
    if (powerButton) powerButton.classList.remove('active');
  }
}

// Update timer display
function updateTimerDisplay() {
  if (!temporaryOverride || !temporaryOverride.active) return;

  const remainingMs = temporaryOverride.expiresAt - Date.now();
  if (remainingMs <= 0) {
    temporaryOverride = null;
    updateTemporaryUI();
    return;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const timeString = hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;

  timerDisplay.textContent = timeString;
}

// Start timer update interval
function startTimerUpdate() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (temporaryOverride && temporaryOverride.active) {
      updateTimerDisplay();

      if (temporaryOverride.expiresAt <= Date.now()) {
        loadTemporaryOverride().then(() => {
          updateTemporaryUI();
        });
      }
    }
  }, 1000);
}

// Show success message
function showSuccessMessage(state, durationMs) {
  const durationText = formatDuration(durationMs);
  const stateText = state === 'grayscale' ? 'Grayscale' : 'Color';
  const message = `${stateText} override active for ${durationText}`;

  errorMessage.style.color = '#10b981';
  errorMessage.textContent = message;
  setTimeout(() => {
    errorMessage.textContent = '';
    errorMessage.style.color = '';
  }, 3000);
}

// Format duration for display
function formatDuration(ms) {
  const minutes = ms / 60000;
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  if (hours < 24) return hours === 1 ? '1 hour' : `${hours} hours`;
  return '1 day';
}
