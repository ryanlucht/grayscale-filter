# Coding Conventions

**Analysis Date:** 2026-02-05

## Naming Patterns

**Files:**
- Lowercase with `.js` extension: `background.js`, `content.js`, `popup.js`
- CSS files: `popup.css`
- HTML files: `popup.html`

**Functions:**
- camelCase: `extractDomain()`, `shouldApplyGrayscaleFilter()`, `checkAndApplyFilterWithOverrides()`
- Descriptive names indicating action/purpose: `loadCurrentTab()`, `renderDomainList()`, `handleToggle()`
- Async functions clearly marked: `async function loadCurrentTab()`

**Variables:**
- camelCase for all variables: `currentDomain`, `temporaryOverrides`, `timerInterval`
- Constants in UPPER_SNAKE_CASE: `STYLE_ID = 'grayscale-filter-extension'`
- Boolean variables prefixed with `is` or use verb form: `isContextValid()`, `isActive`, `hasChanges`
- DOM element references suffixed with `El`: `currentDomainEl`, `toggleButton` (sometimes abbreviated)

**Types/Objects:**
- Plain object properties use camelCase: `expiresAt`, `originallyInList`, `remainingMs`
- Object keys match property naming: `domain`, `state`, `duration`

## Code Style

**Formatting:**
- No linter configured (ESLint/Prettier not present)
- Manual formatting follows consistent style:
  - 2-space indentation throughout
  - Opening braces on same line
  - Single space after keywords (`if (`, `for (`, `catch (`)
  - Consistent spacing around operators

**Linting:**
- Not detected - No ESLint, Prettier, or Biome configuration

**Structure:**
- One primary function per logical operation
- Async/await preferred over callbacks for Promise handling
- Some callbacks used for Chrome API listeners (onMessage, onUpdated)

## Import Organization

**Not applicable** - This is a vanilla JavaScript Chrome extension without module imports or ES6 module syntax. Uses global functions and direct file references.

**Script Loading:**
- Background: `"service_worker": "background.js"` (Manifest v3)
- Content: `"js": ["content.js"]` in manifest
- Popup: `<script src="popup.js"></script>` in HTML

## Error Handling

**Patterns:**
- Try-catch blocks wrap Chrome API calls: `try { ... } catch (error) { console.error(...) }`
- Errors logged with prefixed context: `'Grayscale Filter: Error in checkAndApplyFilterWithOverrides:'`
- Chrome runtime errors checked but ignored when expected: `if (chrome.runtime.lastError) { // Content script may not be injected yet }`
- Context invalidation handled gracefully in content script:

```javascript
function isContextValid() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}
```

- Error responses returned to callers:

```javascript
.catch((error) => {
  console.error('Error message:', error);
  sendResponse({ success: false, error: error.message });
});
```

## Logging

**Framework:** `console.error()` and `console.log()` (no dedicated logging library)

**Patterns:**
- Errors logged with descriptive context prefix: `console.error('Grayscale Filter: Error cleaning expired overrides:', error)`
- Initialization logged once: `console.log('Grayscale Filter: Background service worker initialized with temporary override support')`
- Popups use console.error for caught exceptions, not general diagnostics
- No log levels (info, warn, debug) - only errors and initialization

**When to Log:**
- Error conditions in async operations (storage, messaging)
- Extension initialization state
- Do NOT log routine operations (domain matching, filter application)

## Comments

**When to Comment:**
- Function headers explain purpose and behavior:

```javascript
// Determine if grayscale should be applied based on permanent list and temporary overrides
function shouldApplyGrayscaleFilter(domain, permanentDomains, temporaryOverrides) {
```

- Inline comments explain WHY, not WHAT:

```javascript
// Skip chrome://, edge://, about:, and other special URLs
if (!url.startsWith('http://') && !url.startsWith('https://')) {
  return;
}
```

- Comments for non-obvious Chrome API behavior:

```javascript
return true; // Keep channel open for async response
```

**JSDoc/TSDoc:**
- Not used - No TypeScript or formal JSDoc present

## Function Design

**Size:**
- Functions kept focused on single responsibility
- Longest functions: `popup.js` functions (20-50 lines) handle initialization and UI updates
- Shorter utility functions: `extractDomain()` (5 lines), `getCurrentDomain()` (8 lines)

**Parameters:**
- Positional parameters for primary data: `function shouldApplyGrayscaleFilter(domain, permanentDomains, temporaryOverrides)`
- DOM elements passed explicitly to functions needing them: `updateTemporaryUI(powerButton, tempStatus, tempTimer, timerDisplay)`
- Message objects passed whole: `{ action: 'apply', domain: domain }`

**Return Values:**
- Null returns for parse failures: `extractDomain()` returns `null` on error
- Boolean returns for checks: `isContextValid()` returns true/false
- Async functions return nothing or data: `async function loadCurrentTab()` returns undefined
- Promise-based where Chrome APIs used: `chrome.storage.sync.get()` returns Promise

**Async Patterns:**
- Prefer `async/await`: `async function loadDomains() { const result = await chrome.storage.sync.get(...) }`
- Promise `.then().catch()` also used: `chrome.runtime.sendMessage({...}).then(()=> {...}).catch(...)`
- Return `true` in message listeners to keep channel open for async responses:

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setTemporaryOverride') {
    handleTemporaryOverride(...)
      .then(() => sendResponse({ success: true }))
      .catch(...)
    return true;
  }
});
```

## Module Design

**Exports:**
- No ES6 module exports - Entire files are loaded as scripts
- Functions are globally scoped within each context (background, content, popup)
- Each script is isolated: background.js, content.js, popup.js operate independently

**Scope Isolation:**
- `background.js`: Service worker context, handles Chrome API coordination
- `content.js`: Page context, applies/removes visual filter
- `popup.js`: Popup context, manages UI state and user interactions
- Functions scoped to prevent naming collisions across scripts

**State Management:**
- Global variables within each script: `let currentDomain`, `let domains`, `let timerInterval`
- State persisted via `chrome.storage.sync` (not in-memory)
- Storage accessed via async Chrome API calls
- State updated after async operations complete

---

*Convention analysis: 2026-02-05*
