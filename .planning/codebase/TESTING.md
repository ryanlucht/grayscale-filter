# Testing Patterns

**Analysis Date:** 2026-02-05

## Test Framework

**Runner:**
- Not detected - No automated test framework configured (no Jest, Vitest, Mocha, etc.)

**Test Execution:**
- Manual end-to-end testing approach
- Testing performed via Chrome browser extension loader
- DevTools inspection for validation

**Run Commands:**
- No automated test commands available
- Extension loaded manually: `chrome://extensions/` → Load unpacked

## Test File Organization

**Location:**
- No automated test files present
- Existing manual test checklist: `/Users/ryan.lucht/chrome-extensions/grayscale/TESTING.md`

**Naming:**
- Not applicable for automated tests
- Manual test document follows checklist format with sections and test cases

**Structure:**
```
Project Root/
├── TESTING.md              # Manual testing checklist (60 test cases)
├── background.js           # Service worker (no tests)
├── content.js              # Content script (no tests)
├── popup/
│   ├── popup.js            # Popup logic (no tests)
│   ├── popup.html
│   └── popup.css
```

## Test Coverage Approach

**Current State:**
- Manual end-to-end testing only
- No unit test framework configured
- Testing relies on browser extension manual validation

**Test Categories (Manual):**
1. Core Functionality - 7 tests (domain toggle, persistence)
2. Temporary Override - 16 tests (grayscale override, color override, expiration)
3. Cross-Tab & Persistence - 11 tests (multiple tabs, browser restart)
4. Edge Cases - 13 tests (special URLs, domain variations, rapid interactions)
5. Error Handling - 6 tests (console errors, storage limits)
6. Performance - 7 tests (UI responsiveness, page performance)

**Total Manual Tests:** 60 test cases documented in TESTING.md

## Test Structure

**Manual Test Format:**
Tests structured as step-by-step checklists with expected results:

```
### Test 1: Basic Grayscale Toggle (Domain NOT in list)

**Setup:** Navigate to a site NOT in your grayscale list (e.g., `example.com`)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1.1 | Open popup | Popup shows "Current site: example.com" | [ ] |
| 1.2 | Check toggle button | Button says "Add to Grayscale" (green) | [ ] |
```

**Test Organization:**
- Setup instructions provided when needed
- Clear action-result pairs
- Pass/Fail checkboxes for manual validation
- Test results tracking at end of document

**Testing DevTools Integration:**
Manual tests include DevTools console commands for faster testing:

```javascript
// In background service worker console to accelerate expiration testing:
chrome.storage.sync.get(['temporaryOverrides'], (r) => {
  const o = r.temporaryOverrides || {};
  for (let d in o) o[d].expiresAt = Date.now() - 1000;
  chrome.storage.sync.set({temporaryOverrides: o});
});
```

## Error Handling in Code

**Error Patterns Used:**

1. **Storage API Errors** (`background.js`):
```javascript
try {
  const result = await chrome.storage.sync.get(['domains', 'temporaryOverrides']);
  const domains = result.domains || [];
} catch (error) {
  console.error('Grayscale Filter: Error in checkAndApplyFilterWithOverrides:', error);
}
```

2. **Message Listener Errors** (`background.js`):
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setTemporaryOverride') {
    handleTemporaryOverride(message.domain, message.state, message.duration)
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error('Error setting temporary override:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});
```

3. **Context Invalidation** (`content.js`):
```javascript
function isContextValid() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

function safeStorageGet(keys, callback) {
  if (!isContextValid()) return;
  try {
    chrome.storage.sync.get(keys, (result) => {
      try {
        if (chrome.runtime.lastError) return;
        callback(result);
      } catch (e) {
        // Context invalidated during callback - ignore
      }
    });
  } catch (e) {
    // Context invalidated - ignore
  }
}
```

4. **Silent Error Handling** (`popup.js`):
```javascript
chrome.tabs.sendMessage(tab.id, { action, domain }, () => {
  if (chrome.runtime.lastError) {
    // Silently ignore - tab may not have content script
  }
});
```

## Testing Coverage Gaps

**Areas Without Automated Tests:**
- `background.js` - All functions untested:
  - `extractDomain()` edge cases (malformed URLs)
  - `shouldApplyGrayscaleFilter()` priority logic
  - `cleanupExpiredOverrides()` expiration handling
  - Message handlers for all action types
  - Tab update listeners and their interactions

- `content.js` - No unit tests:
  - `applyGrayscale()` style injection
  - `removeGrayscale()` style removal
  - `isContextValid()` context detection
  - Message listener response handling
  - Visibility change detection

- `popup.js` - No component tests:
  - `loadCurrentTab()` domain extraction
  - `loadDomains()` storage retrieval
  - `updateUI()` and rendering logic
  - `addDomain()` and `removeDomain()` state mutations
  - Input validation (`isValidDomain()`, `normalizeDomain()`)
  - Timer countdown logic
  - Duration formatting

**Risk Assessment:**
- High-risk untested areas: Domain extraction (`extractDomain`), temporary override logic, context invalidation handling
- Medium-risk: Storage operations, message passing reliability
- Lower-risk: UI rendering (covered by manual testing)

## Manual Test Execution Instructions

**Pre-Testing Setup:**
1. Load extension in Chrome: `chrome://extensions/` → Load unpacked
2. Enable Developer mode
3. Verify service worker shows "Active" status

**Running Tests:**
1. Open manual test document: `TESTING.md`
2. Follow each test section sequentially
3. Check Pass/Fail checkbox for each step
4. Note any failures in summary section
5. Final checklist: 60 total tests, target 100% pass rate

**Performance Testing:**
- UI responsiveness: <100ms feel for popup and toggles
- Page performance: No noticeable slowdown with grayscale applied
- Video playback: Smooth in grayscale on grayscaled pages

## Storage & Persistence Testing

**Data Structures Tested:**
- `domains` array - Permanent grayscale list
- `temporaryOverrides` object - Active temporary overrides with expiry

**Persistence Validation:**
- Test 10: Browser restart - Domains and active overrides survive reload
- Test 8-9: Cross-tab synchronization via `chrome.storage.sync`

---

*Testing analysis: 2026-02-05*
