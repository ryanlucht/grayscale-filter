# Technology Stack

**Analysis Date:** 2026-02-05

## Languages

**Primary:**
- JavaScript (ES6+) - All source code for extension logic and UI
- HTML5 - Extension popup UI structure
- CSS3 - Extension styling with CSS variables and animations

**Secondary:**
- PNG - Icon assets (16px, 48px, 128px variants)

## Runtime

**Environment:**
- Google Chrome (Manifest V3 compliant)
- Browser APIs only - no Node.js or server runtime

**Compatibility:**
- Works on Chrome and Chrome-based browsers (Edge, Brave, Opera, etc.)
- Requires Chrome 88+ for Manifest V3 support

## Frameworks & Libraries

**Core:**
- Chrome Extensions API (Manifest V3) - Extension framework
  - `chrome.storage.sync` - Persistent cross-device storage
  - `chrome.tabs` - Tab management and querying
  - `chrome.runtime` - Message passing between scripts
  - `chrome.alarms` - Periodic task scheduling
  - `chrome.scripting` - Content script injection

**No third-party frameworks or build dependencies**
- Vanilla JavaScript
- No React, Vue, Angular, or other frameworks
- No npm/yarn - purely file-based extension

## Architecture Components

**Service Worker (Background Script):**
- `background.js` - Chrome Extension service worker
- Manifest entry: `"background": { "service_worker": "background.js" }`
- Handles:
  - Tab lifecycle monitoring (`chrome.tabs.onUpdated`, `chrome.tabs.onActivated`)
  - Message passing from popup and content scripts
  - Periodic cleanup of expired temporary overrides via `chrome.alarms`
  - Storage synchronization across tabs

**Content Script:**
- `content.js` - Injected into all web pages
- Manifest entry: `"content_scripts": [{ "js": ["content.js"], "matches": ["<all_urls>"], "run_at": "document_start" }]`
- Handles:
  - CSS filter injection
  - Message reception from background script
  - Page visibility change detection

**Extension Popup (UI):**
- `popup/popup.html` - DOM structure
- `popup/popup.js` - Event handlers and state management
- `popup/popup.css` - Styling with custom properties and animations
- Popup dimensions: 350px width

## Storage & State Management

**Chrome Storage API:**
- `chrome.storage.sync` exclusively used
- Stored keys:
  - `domains` - Array of domain strings for permanent grayscale list
  - `temporaryOverrides` - Object mapping domain → `{ state, expiresAt, originallyInList }`
- Auto-syncs across all Chrome instances when logged in

**Local State (Runtime):**
- Popup: `currentDomain`, `domains`, `temporaryOverride`, `timerInterval`
- Background: No persistent local state beyond storage

## Configuration

**Manifest Configuration:**
- File: `manifest.json` (Manifest V3)
- Version: 1.1.0
- Permissions declared:
  - `storage` - Required for domain list persistence
  - `activeTab` - Required for current tab URL access
  - `tabs` - Required for querying all tabs
  - `scripting` - Required for content script messaging (though only used for messaging, not dynamic injection)
  - `alarms` - Required for periodic override cleanup

**Host Permissions:**
- `<all_urls>` - Content script runs on all websites to apply/remove filter

**Content Script Configuration:**
- Runs at document_start for early CSS injection
- all_frames: false (main frame only)
- No specific domain restrictions (matches all URLs)

## Build & Development

**Build Process:**
- No build step required
- Extension loaded directly via `chrome://extensions/` in developer mode
- Distribution: Manual folder loading or `.zip` package

**Code Organization:**
- File structure follows Chrome Extension best practices
- No bundling, minification, or transpilation
- Plain JavaScript files loaded sequentially

**Icon Assets:**
- `icons/icon16.png` - Toolbar icon (16×16)
- `icons/icon48.png` - Extensions page icon (48×48)
- `icons/icon128.png` - Webstore icon (128×128)
- PNG format with transparency

## Browser APIs Used

**Critical APIs:**
- `chrome.storage.sync.get()` - Retrieve configuration
- `chrome.storage.sync.set()` - Persist configuration
- `chrome.tabs.query()` - Get tab list
- `chrome.tabs.sendMessage()` - Send commands to content scripts
- `chrome.tabs.get()` - Get individual tab info
- `chrome.runtime.onMessage` - Receive messages from popup/content
- `chrome.runtime.id` - Check extension context validity
- `chrome.alarms.create()` - Schedule periodic cleanup
- `chrome.alarms.onAlarm` - Handle alarm triggers

**DOM/Web APIs:**
- `document.getElementById()`, `document.createElement()` - DOM manipulation
- `window.location.href` - Get current page URL
- `URL()` constructor - Parse URLs
- `EventListener` - Attach event handlers
- `setInterval()`, `setTimeout()` - Timer management
- `document.visibilityState` - Detect page visibility changes

## Platform Requirements

**Development:**
- Google Chrome (latest stable recommended)
- Text editor or IDE
- Developer mode enabled in Chrome

**Production:**
- Google Chrome 88+
- Chrome sync enabled for cross-device persistence (optional but recommended)
- No server or backend required

## Version Control

**Repository Type:**
- Git repository at `.git/`
- Latest version: v1.1.0
- Distribution package: `grayscale-filter-v1.1.0.zip`

---

*Stack analysis: 2026-02-05*
