# External Integrations

**Analysis Date:** 2026-02-05

## APIs & External Services

**None**

This extension does not integrate with any external APIs or third-party services. All functionality is self-contained within the Chrome Extension sandbox.

## Data Storage

**Browser Storage:**
- Type: `chrome.storage.sync`
- Provider: Google Chrome (syncs via Chrome account)
- Data stored locally: Domain list and temporary override settings
- Sync scope: All Chrome instances when user is logged in
- No external database or server backend

**File Storage:**
- Exclusively local to the browser's extension storage
- No file uploads or cloud file storage
- No local filesystem access beyond extension sandbox

**Caching:**
- Runtime in-memory caching only in popup and background scripts
- No persistent cache beyond `chrome.storage.sync`

## Authentication & Identity

**Auth Provider:**
- None - Extension has no user accounts or authentication system
- No login, signup, or user management
- Data scope: Per-browser based on Chrome sync credentials
- Privacy: No external identity verification

**Chrome Sync:**
- Leverages existing Chrome account login for storage sync
- User data syncs when signed into Chrome
- No separate API authentication required

## Monitoring & Observability

**Error Tracking:**
- None - No external error reporting service
- Errors logged to browser console only
- Console logs at: `console.error()` calls in source files

**Logs:**
- Local browser console only
- Debug approach: Manual inspection via DevTools
- Background worker logs inspectable at: `chrome://extensions/` → Grayscale Filter → "Inspect views: service worker"
- Popup logs inspectable at: Right-click extension icon → "Inspect popup"
- Content script logs appear in page's regular DevTools console

**Metrics:**
- No analytics or usage tracking
- No external metric collection

## CI/CD & Deployment

**Hosting:**
- No server deployment required
- Distribution: Manual folder loading or `.zip` file distribution
- Users load extension via `chrome://extensions/` in developer mode
- Not published to Chrome Web Store

**CI Pipeline:**
- None - Manual versioning and release process
- Version controlled in Git
- Release artifact: `grayscale-filter-v1.1.0.zip`

**Deployment Model:**
- Direct user installation from folder or zip
- No automated deployment pipeline

## Environment Configuration

**Required Environment Variables:**
- None - No external configuration needed
- All settings stored in `chrome.storage.sync` (browser-managed)

**No External Dependencies:**
- No API keys needed
- No OAuth tokens
- No third-party service credentials

## Secrets Management

**Secrets Location:**
- Not applicable - No secrets used
- No API keys, passwords, or tokens
- `.gitignore` excludes: `.env`, `.vscode/`, `.idea/` directories (general IDE exclusions only)

## Webhooks & Callbacks

**Incoming Webhooks:**
- None - Extension does not expose any endpoints

**Outgoing Webhooks:**
- None - Extension does not call any external webhooks
- No external service notifications

## Message Passing (Internal only)

**Extension-to-Content Script:**
- One-way messaging from `background.js` to `content.js`
- Messages trigger filter application/removal
- Message structure: `{ action: 'apply'|'remove', domain: string }`

**Popup-to-Background:**
- Messages from `popup.js` to `background.js` via `chrome.runtime.sendMessage()`
- Handlers in `background.js` line 200-257:
  - `setTemporaryOverride` - Set time-limited override
  - `getTemporaryOverride` - Query active override
  - `clearTemporaryOverride` - Cancel override
  - `updateAllTabs` - Force refresh all tabs

**Background-to-Content Script:**
- Direct tab messaging via `chrome.tabs.sendMessage()`
- Used to apply or remove CSS filters

## Data Flow (No External Integration)

1. User opens popup UI (`popup/popup.html`)
2. Popup loads current domain and stored domain list from `chrome.storage.sync`
3. User clicks button to add/remove domain
4. Popup sends message to background worker
5. Background worker updates `chrome.storage.sync`
6. Storage change triggers listener in background worker (`line 186`)
7. Background worker queries all tabs and sends filter messages to content scripts
8. Content scripts inject or remove CSS style element
9. No external network calls at any step

## Privacy & Data Security

**Data Retention:**
- Domain list persists in `chrome.storage.sync` indefinitely until user removes
- Temporary overrides auto-expire after user-selected duration (15 min to 1 day)
- Expired overrides cleaned up periodically via `chrome.alarms` (every 1 minute)

**Data Transmission:**
- Domain list synced via Chrome's encrypted sync service only
- No third-party services receive user data
- No analytics or tracking

**Extension Permissions Scope:**
- `<all_urls>` host permission: Allows content script to run on all websites
- Minimal actual API usage (only injects CSS, no other operations)
- No access to page content, form data, or passwords

---

*Integration audit: 2026-02-05*
