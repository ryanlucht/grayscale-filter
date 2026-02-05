# Architecture

**Analysis Date:** 2026-02-05

## Pattern Overview

**Overall:** Chrome Extension with Multi-Context Communication

**Key Characteristics:**
- Service worker-driven coordination (background process)
- Content script injection on all websites
- Event-driven messaging between contexts
- Priority-based state management (permanent list + temporary overrides)
- Chrome Storage API for persistent state synchronization

## Layers

**Background Service Worker (Orchestration):**
- Purpose: Central coordinator managing filter state across all tabs and contexts
- Location: `background.js`
- Contains: State management logic, event listeners, timer cleanup, message routing
- Depends on: Chrome API (storage, tabs, alarms, runtime), domain extraction utilities
- Used by: Content scripts, popup UI, Chrome browser events

**Content Script (DOM Manipulation):**
- Purpose: Apply/remove grayscale CSS filter to individual page documents
- Location: `content.js`
- Contains: CSS injection, DOM monitoring, message listener, context safety checks
- Depends on: Background service worker messages, Chrome API (limited context)
- Used by: Web pages being filtered

**Popup UI (User Interface):**
- Purpose: User control panel for managing domain list and temporary overrides
- Location: `popup/popup.html`, `popup/popup.js`, `popup/popup.css`
- Contains: DOM elements, event handlers, UI state, messaging to background worker
- Depends on: Background service worker, Chrome API (tabs, storage, runtime)
- Used by: User interactions

## Data Flow

**Adding a Domain (User to All Tabs):**

1. User enters domain in popup and clicks "Add Domain"
2. `popup.js` validates and normalizes input → calls `addDomain(domain)`
3. Domain added to `domains` array in sync storage
4. Storage change triggers `chrome.storage.onChanged` listener in `background.js`
5. Background worker queries all tabs and sends `apply` message to matching domains
6. Content scripts on matching tabs receive message → inject grayscale style
7. UI updates to reflect new state (button disabled, domain listed)

**Tab Navigation (Browser Event to Filter):**

1. User navigates to new URL
2. `chrome.tabs.onUpdated` fires in `background.js` with `status='loading'`
3. Background worker calls `checkAndApplyFilterWithOverrides()` with tab ID and URL
4. Function extracts domain, checks permanent list + temporary overrides
5. Determines if filter should apply using priority algorithm
6. Sends `apply` or `remove` message to content script on that tab
7. Content script applies or removes grayscale style element

**Temporary Override (Immediate Activation):**

1. User clicks power button in popup, selects duration
2. `popup.js` sends `setTemporaryOverride` message to background worker
3. Background worker stores override in sync storage with expiry timestamp
4. Override has higher priority than permanent list
5. Background worker broadcasts state to all matching tabs
6. Tabs update immediately based on override state
7. Timer updates display showing remaining time
8. Every 1 minute, background alarm triggers cleanup of expired overrides
9. Cleanup updates affected tabs to restore permanent list state

**State Management:**

- **Permanent State:** `domains` array in `chrome.storage.sync` - persists across sessions
- **Temporary State:** `temporaryOverrides` object with domain keys → {state, expiresAt, originallyInList}
- **Priority Algorithm:** Temporary override (if active) > permanent domain list
- **Synchronization:** All contexts notified via storage change listener + explicit tab messaging

## Key Abstractions

**Domain Extraction:**
- Purpose: Normalize URLs to comparable domains (remove www, protocol, path)
- Examples: `background.js` lines 3-11, `content.js` lines 5-13, `popup/popup.js` lines 284-298
- Pattern: Extract hostname from URL object, strip `www.` prefix, lowercase for case-insensitive comparison

**Filter Application Logic:**
- Purpose: Determine if grayscale should be applied based on domain and state
- Examples: `background.js` lines 14-24, `popup/popup.js` lines 171-183
- Pattern: Check temporary override first (highest priority), fall back to permanent list

**Context Safety:**
- Purpose: Handle Chrome API calls safely when extension context becomes invalid
- Examples: `content.js` lines 49-75
- Pattern: Wrap Chrome API calls in try-catch, check `chrome.runtime.id` validity before use
- Protects against: Content script execution after extension update/reload

**Message Protocol:**
- Purpose: Standardized communication between background, content, and popup
- Structure: `{action: string, domain?: string, state?: string, duration?: number}`
- Actions: `apply`, `remove`, `check`, `setTemporaryOverride`, `getTemporaryOverride`, `clearTemporaryOverride`, `updateAllTabs`

## Entry Points

**Manifest Registration (`manifest.json`):**
- Location: `manifest.json`
- Triggers: Browser startup, extension load/reload
- Responsibilities: Declares permissions, content script injection rules, popup UI, background worker

**Background Service Worker (`background.js`):**
- Location: `background.js`
- Triggers: On browser startup (service worker lifecycle)
- Responsibilities: Event listener setup, storage initialization, alarm scheduling, message routing, tab coordination

**Content Script Injection (`content.js`):**
- Location: `content.js`
- Triggers: Page load on all URLs (matches="<all_urls>" in manifest)
- Responsibilities: Initialize DOM listener, apply/remove filter based on messages, monitor visibility

**Popup Initialization (`popup/popup.js`):**
- Location: `popup/popup.js`
- Triggers: User clicks extension icon
- Responsibilities: Load current tab, load domain list, load override state, setup event listeners, render UI

## Error Handling

**Strategy:** Graceful degradation with error suppression for non-critical failures

**Patterns:**

- **Content Script Context Loss:** Try-catch around Chrome API calls; checks `chrome.runtime.id` before use (lines 49-75 in `content.js`)
- **Tab Messaging Failures:** Ignores `chrome.runtime.lastError` when content script not yet loaded (lines 56-62 in `background.js`)
- **Storage Access Failures:** Catches and logs errors; continues with default empty arrays (lines 92-99 in `popup/popup.js`)
- **Invalid URLs:** Gracefully handles non-http(s) URLs and malformed hosts with try-catch and null returns (lines 4-10 in `background.js`)
- **Domain Validation:** Regex validation with user-friendly error messages (lines 313-317 in `popup/popup.js`)

## Cross-Cutting Concerns

**Logging:** Console logging used for debugging; statements in `background.js` lines 259, 65, 104 and throughout error handlers

**Validation:**
- Domain format validation (regex pattern in `popup.js` line 315)
- URL parsing with fallback handling for chrome:// and about: URLs
- Input sanitization via `normalizeDomain()` function (removes protocol, www prefix)

**Authentication:** Not applicable - extension runs with user's browser privileges

**Permissions:** Declared in manifest.json - storage, activeTab, tabs, scripting, alarms, <all_urls> host permission

**Performance Considerations:**
- Alarm-based cleanup runs every 1 minute (line 155 in `background.js`) instead of immediate cleanup
- Tab query optimized with selector `{}` to get all tabs, filtered in-memory
- Storage operations batched (multiple keys set/get together)

---

*Architecture analysis: 2026-02-05*
