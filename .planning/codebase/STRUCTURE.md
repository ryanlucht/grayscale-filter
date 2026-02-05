# Codebase Structure

**Analysis Date:** 2026-02-05

## Directory Layout

```
grayscale/
├── background.js               # Service worker (orchestration layer)
├── content.js                  # Content script (DOM manipulation)
├── manifest.json               # Extension configuration
├── popup/                      # Popup UI directory
│   ├── popup.html             # Popup structure
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styling
├── icons/                      # Extension icons
│   ├── icon16.png             # Taskbar icon
│   ├── icon48.png             # Options page icon
│   └── icon128.png            # Store icon
├── README.md                   # User documentation
├── PRIVACY_POLICY.md          # Privacy notice
├── TESTING.md                 # Testing documentation
├── HANDOFF.md                 # Development handoff notes
└── .planning/                 # Planning & analysis
    └── codebase/              # Codebase documentation
```

## Directory Purposes

**Root Directory:**
- Purpose: Extension entry point and Chrome-facing files
- Contains: Manifest, background worker, content script
- Key files: `manifest.json` (declares extension structure), `background.js` (orchestration), `content.js` (injection)

**popup/:**
- Purpose: User-facing popup interface
- Contains: HTML structure, JavaScript logic, CSS styling
- Key files: `popup.html` (DOM), `popup.js` (state and events), `popup.css` (visual design)

**icons/:**
- Purpose: Extension branding and UI assets
- Contains: PNG images at 16x16, 48x48, 128x128 resolution
- Key files: Referenced in manifest.json for extension icon, toolbar icon, store listing

**.planning/codebase/:**
- Purpose: Development documentation and architectural analysis
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
- Generated: Yes (created during development planning)

## Key File Locations

**Entry Points:**

- `manifest.json`: Extension configuration - declares permissions, service worker path, content script injection rules, popup location
- `background.js`: Service worker entry - initializes on browser startup, sets up all event listeners and storage sync
- `content.js`: Content script entry - injected into all pages, initializes DOM listener and performs initial filter check
- `popup/popup.html`: Popup entry - loaded when user clicks extension icon, references popup.js and popup.css

**Configuration:**

- `manifest.json`: Core configuration (manifest_version: 3, name, version, permissions, host_permissions)

**Core Logic:**

- `background.js`: Filter coordination (324 lines)
  - `extractDomain()` - URL to domain normalization
  - `shouldApplyGrayscaleFilter()` - State decision logic
  - `checkAndApplyFilterWithOverrides()` - Main filtering dispatcher
  - `cleanupExpiredOverrides()` - Temporary state cleanup
  - `handleTemporaryOverride()` - Temporary state creation
  - `clearTemporaryOverride()` - Temporary state removal
  - Event listeners: tabs.onUpdated, tabs.onActivated, storage.onChanged, alarms.onAlarm, runtime.onMessage

- `content.js`: DOM filter application (134 lines)
  - `applyGrayscale()` - Inject CSS filter
  - `removeGrayscale()` - Remove CSS filter
  - `isContextValid()` - Safety check for extension context
  - `checkAndApplyGrayscale()` - Determine and apply filter on page load

- `popup/popup.js`: UI coordination (499 lines)
  - State: currentDomain, domains, temporaryOverride, timerInterval
  - Domain management: `addDomain()`, `removeDomain()`, `loadDomains()`
  - Override management: `handleTemporaryOverride()`, `clearTemporaryOverride()`, `loadTemporaryOverride()`
  - UI rendering: `updateUI()`, `renderDomainList()`, `updateToggleButton()`
  - Utilities: `extractDomain()`, `normalizeDomain()`, `isValidDomain()`, `showError()`

**Testing:**

- `TESTING.md`: Test patterns and instructions for manual testing

**Documentation:**

- `README.md`: User-facing documentation and feature overview
- `PRIVACY_POLICY.md`: Privacy and data handling
- `HANDOFF.md`: Development context and implementation notes

## Naming Conventions

**Files:**

- Root scripts: `lowercase.js` (background.js, content.js)
- Folder structure: `lowercase/` (popup/, icons/)
- Config files: `lowercase.json` (manifest.json)
- Documentation: `UPPERCASE.md` (README.md, TESTING.md)

**Directories:**

- Feature directories: `lowercase/` matching purpose (popup/, icons/)
- Planning directory: `.planning/` with subdirectories (codebase/)

**JavaScript Functions:**

- Utility/pure functions: `camelCase` (extractDomain, normalizeDomain, isValidDomain)
- Event handlers: `handleXxx` (handleToggle, handleManualAdd, handleTemporaryOverride)
- State loaders: `loadXxx` (loadCurrentTab, loadDomains, loadTemporaryOverride)
- UI updaters: `updateXxx` (updateUI, updateToggleButton, updateTemporaryUI)
- Renderers: `renderXxx` (renderDomainList)
- Cleanup/removal: `removeXxx` or `clearXxx` (removeGrayscale, clearTemporaryOverride)
- Setup: `setupXxx` (setupMessageListener)

**DOM Element IDs:**

- Action buttons: `toggleButton`, `addButton`, `powerButton`, `cancelOverride`
- Input fields: `domainInput`, `durationSelect`
- Display elements: `currentDomain`, `domainList`, `tempStatus`, `timerDisplay`
- Containers: `container`, `tempTimer`, `errorMessage`

**CSS Classes:**

- State variants: `.active`, `.inactive`, `.visible`
- Component sections: `.temp-toggle-section`, `.quick-toggle`, `.add-section`, `.domain-list-section`
- Button styles: `.toggle-btn`, `.add-btn`, `.remove-btn`, `.cancel-btn`, `.power-button`
- Layout elements: `.container`, `.header`, `.domain-item`
- Status/message: `.error-message`, `.temp-status`, `.timer-label`

## Where to Add New Code

**New Feature (e.g., exclude lists, scheduling):**
- Primary logic: Extend `background.js` with new state variables and event handlers
- Content updates: Extend `content.js` message listener for new filter types
- UI controls: Add new sections to `popup/popup.html`, corresponding handlers in `popup/popup.js`
- Tests: Add test cases to `TESTING.md` with manual testing steps

**New Helper Function:**
- Shared utilities used in multiple scripts: `background.js` (duplicated in each context due to isolation)
- Domain/validation utilities: Keep in each file that uses them (content.js, popup.js, background.js)
- Example pattern: `extractDomain()` is defined in background.js, content.js, AND popup.js (service worker isolation)

**New UI Component in Popup:**
- HTML structure: `popup/popup.html`
- Event handlers: Add to `document.addEventListener('DOMContentLoaded')` block in `popup/popup.js`
- Styling: Add to `.temp-toggle-section` or `.domain-list-section` patterns in `popup/popup.css`
- State variables: Add to state section at top of `popup/popup.js` (lines 3-18)

**New Storage Key:**
- Add to `chrome.storage.sync.get()` and `.set()` calls in all three contexts
- Document in background.js where priority algorithm is defined
- Add test case to TESTING.md

**New Icon Size (e.g., 192x192):**
- Add PNG file to `icons/` directory
- Register in `manifest.json` under "icons" object
- Add to action defaultIcon if needed

## Special Directories

**icons/:**
- Purpose: Extension branding assets
- Generated: No (manually created)
- Committed: Yes

**.planning/codebase/:**
- Purpose: Development documentation
- Generated: Yes (created during GSD analysis)
- Committed: Yes (tracked in version control)

**node_modules/ (if added):**
- Purpose: Would hold npm dependencies
- Generated: Yes (via npm install)
- Committed: No (excluded via .gitignore)

## File Modification Patterns

**When adding a new filter state:**
1. Add state variable to `temporaryOverrides` or `domains` in background.js storage schema
2. Update `shouldApplyGrayscaleFilter()` logic in background.js
3. Add message action handler in background.js `chrome.runtime.onMessage.addListener()`
4. Add corresponding message handler in content.js `chrome.runtime.onMessage.addListener()`
5. Add UI control in popup.html
6. Add event handler in popup.js with corresponding message sender
7. Update TESTING.md with new test cases

**When modifying domain extraction logic:**
- Update in all three files: background.js, content.js, popup/popup.js
- Ensure consistency across contexts (service worker isolation prevents code sharing)
- Test with special domains (subdomains, IDN, localhost, etc.)

**When adding new permissions:**
- Update manifest.json "permissions" array
- Document required behavior in README.md
- Add error handling in affected files

---

*Structure analysis: 2026-02-05*
