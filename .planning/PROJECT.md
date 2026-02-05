# Grayscale Filter Chrome Extension

## What This Is

A Chrome extension that helps users reduce digital distractions by rendering chosen websites in grayscale. Users maintain a persistent list of domains to filter, with a temporary override feature that lets them view sites in color for a configurable duration (15 minutes to 1 day) before automatically resuming grayscale.

## Core Value

Users can effortlessly control when websites display in grayscale without needing to remember to switch filters back on.

## Requirements

### Validated

These features are shipped and working in v1.1.0:

- ✓ User can add domains to permanent grayscale list — v1.0
- ✓ User can remove domains from grayscale list — v1.0
- ✓ User can quick-toggle current site on/off — v1.0
- ✓ User can manually enter domain to add — v1.0
- ✓ Domain list persists across browser sessions via chrome.storage.sync — v1.0
- ✓ Domain list syncs across Chrome instances when logged in — v1.0
- ✓ User can view all domains in their grayscale list — v1.0
- ✓ Grayscale filter applies immediately on page load — v1.0
- ✓ Grayscale filter applies when navigating to new URL — v1.0
- ✓ User can set temporary color override with configurable duration — v1.1
- ✓ User can see countdown timer for active override — v1.1
- ✓ User can cancel active override early — v1.1
- ✓ Expired overrides automatically clean up and restore grayscale — v1.1
- ✓ Override state syncs across tabs for same domain — v1.1

### Active

Building toward these for v1.2:

- [ ] Remove unused "scripting" permission to pass Chrome Web Store review
- [ ] Redesign popup UI with clean, calm e-reader aesthetic
- [ ] Improve UI hierarchy: override → current site → manual entry → domain list
- [ ] Reduce visual noise (fewer colors, more minimalist)
- [ ] Refactor popup.js into focused modules (UI, storage, messaging, domain utils)
- [ ] Extract duplicated domain extraction logic into shared utility
- [ ] Add automated tests for domain normalization
- [ ] Add automated tests for temporary override expiration
- [ ] Add automated tests for storage operations

### Out of Scope

- Real-time chat or collaboration features — single-user tool
- Cloud backup beyond Chrome sync — storage.sync is sufficient
- Mobile app version — web-first, defer mobile
- OAuth or third-party login — no accounts needed
- Analytics or usage tracking — privacy-focused, local-only

## Context

**Current State (v1.1.0):**
- Vanilla JavaScript Chrome Extension (Manifest V3)
- 3 core files: background.js (service worker), content.js (DOM manipulation), popup/ (UI)
- No build process or frameworks
- Chrome Storage API for persistence
- Manual testing only (60-test checklist in TESTING.md)

**Technical Debt:**
- popup/popup.js is 498 lines (mixed concerns: UI, storage, messaging, validation)
- extractDomain() duplicated in 3 files (background.js, content.js, popup.js)
- "scripting" permission declared but unused (only messaging, no dynamic injection)
- Timer interval in popup never cleared (memory leak)
- No automated tests

**Chrome Web Store Rejection:**
- Extension requests "scripting" permission
- Permission is declared in manifest.json but never actually used
- Only uses chrome.runtime.sendMessage() for messaging, not chrome.scripting APIs
- Must remove to pass review

**UI Issues:**
- Override switch lives above extension title (hierarchy confusion)
- Too many colors for a grayscale-focused tool (ironic)
- Feels like patchwork of features rather than cohesive design
- Current orange/green/gray color scheme feels "cheesy"

**Redesign Vision:**
- Clean, calm e-reader vibe (minimalist, professional)
- Hierarchy: override controls → current site toggle → manual entry → domain list
- Seamless flow rather than distinct sections
- Limited color palette matching the grayscale goal

## Constraints

- **Tech Stack**: Vanilla JavaScript, no frameworks — keep extension lightweight and fast
- **Manifest Version**: Must remain Manifest V3 compliant for Chrome Web Store
- **Browser Compatibility**: Chrome 88+ only (Manifest V3 requirement)
- **No Backend**: Extension must work entirely client-side with chrome.storage.sync
- **Permissions**: Minimize permissions to pass Web Store review (remove unused "scripting")
- **Design Tool**: Use Google Stitch MCP for UI redesign (requirement for this project)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Remove scripting permission | Chrome Web Store rejected v1.1 for unused permission; only messaging is used | — Pending |
| Redesign UI before refactoring code | UI redesign will naturally force popup.js restructure; avoid refactoring code twice | — Pending |
| Test after refactoring, not before | Writing tests for messy code that's about to be rewritten is wasteful | — Pending |
| Focus automated tests on critical paths | Domain extraction, override expiration, storage ops are highest risk areas per CONCERNS.md | — Pending |
| Use Google Stitch for redesign | Provides structured design workflow and generates production-ready code | — Pending |

---
*Last updated: 2026-02-05 after initialization*
