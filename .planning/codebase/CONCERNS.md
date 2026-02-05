# Codebase Concerns

**Analysis Date:** 2026-02-05

## Tech Debt

**Monolithic popup.js file:**
- Issue: `popup/popup.js` contains 498 lines of mixed UI logic, event handling, messaging, and data operations
- Files: `popup/popup.js` (lines 1-498)
- Impact: Difficult to test, maintain, and extend; single responsibility violated; reduces code reusability
- Fix approach: Refactor into separate modules:
  - `popup/ui.js` - DOM manipulation and rendering (renderDomainList, updateUI, updateToggleButton)
  - `popup/storage.js` - Storage operations (loadDomains, loadCurrentTab, addDomain, removeDomain)
  - `popup/messaging.js` - Chrome message handling (temporary override operations)
  - `popup/domain.js` - Domain validation and normalization (isValidDomain, normalizeDomain, extractDomain)

**Duplicate domain extraction logic:**
- Issue: `extractDomain()` function implemented in three files with identical logic
- Files: `background.js` (lines 4-11), `content.js` (lines 6-13), `popup/popup.js` (lines 285-298)
- Impact: Code duplication makes maintenance harder; changes must be replicated across files; risk of inconsistent behavior
- Fix approach: Create shared utility module `utils/domain.js` and import in all three files

**Inconsistent error handling:**
- Issue: Some functions use try-catch with logging, others silently ignore errors (e.g., `popup.js` lines 269-273)
- Files: `popup/popup.js` (lines 269-274), `background.js` (lines 51-63), `content.js` (lines 59-74)
- Impact: Silent failures make debugging difficult; inconsistent error feedback to users
- Fix approach: Establish error handling strategy (log all errors, show user-friendly messages, use error boundaries)

**Inline cleanup logic:**
- Issue: Expired override cleanup happens in two places: inline (background.js lines 41-45) and periodic (cleanupExpiredOverrides function)
- Files: `background.js` (lines 41-45, lines 70-106)
- Impact: Potential race conditions; redundant logic; confusion about when cleanup actually occurs
- Fix approach: Consolidate to periodic cleanup only, ensure locks/atomic operations

## Known Bugs

**Timer display precision loss:**
- Symptoms: formatDuration() in popup.js rounds hours to integers (line 496: `hours === 1 ? '1 hour' : \`${hours} hours\``), losing fractional hours
- Files: `popup/popup.js` (lines 492-498)
- Trigger: Set override for 90 minutes and observe timer display shows "1 hours" instead of "1.5 hours"
- Workaround: Use 1 hour (60min) or 2 hours (120min) durations to avoid fractional values

**Storage race condition on rapid updates:**
- Symptoms: When multiple tabs trigger storage updates simultaneously, final state may be inconsistent
- Files: `background.js` (lines 120, 140), `popup/popup.js` (lines 220, 241)
- Trigger: Open multiple tabs, add/remove domain simultaneously from different tabs
- Workaround: Don't perform operations from multiple tabs within same millisecond (unlikely in practice)

**Missing content script injection on special pages:**
- Symptoms: Extension works on normal pages but fails silently on some protected sites (Google Docs, Gmail with certain configs)
- Files: `manifest.json` (lines 32-38), `content.js`
- Trigger: Open gmail.com, docs.google.com, or sandboxed iframes
- Workaround: Manual page reload after adding domain

## Security Considerations

**Overly broad host permissions:**
- Risk: `<all_urls>` permission in manifest allows extension to inject content script into ANY page including corporate intranets, banking sites, and admin panels
- Files: `manifest.json` (lines 13-14)
- Current mitigation: Extension only reads domain list and applies CSS filter (no sensitive data access), error handlers ignore failures on protected pages
- Recommendations:
  1. Document security model in README explicitly
  2. Consider implementing dynamic permission requests (chrome.permissions.request) per-domain
  3. Add warning to popup about security implications of adding sensitive domains
  4. Implement domain validation to prevent common mistakes (e.g., warn if user tries to add "google.com")

**No CSP meta tags in popup.html:**
- Risk: Popup HTML inline scripts and styles vulnerable to XSS if domain input is ever improperly escaped
- Files: `popup/popup.html` (if used; not provided in codebase)
- Current mitigation: All DOM mutations use textContent (not innerHTML) - XSS unlikely but not enforced
- Recommendations: Add strict CSP meta tag to popup.html, enforce no inline scripts/styles

**Storage data is plaintext:**
- Risk: Chrome sync storage is not encrypted end-to-end; user domain list exposed if Google account compromised
- Files: `background.js` (all chrome.storage.sync calls), `popup/popup.js` (all chrome.storage.sync calls)
- Current mitigation: None - inherent to Chrome storage API choice
- Recommendations:
  1. Document that domain list syncs via Google account
  2. Implement local-only storage option if privacy-critical
  3. Add encryption layer if user data becomes sensitive

## Performance Bottlenecks

**Inefficient tab query on every storage change:**
- Problem: `chrome.tabs.query({})` retrieves ALL tabs and iterates them on every domain list change (background.js lines 189-195)
- Files: `background.js` (lines 189-195, 123, 143)
- Cause: Linear scan through all tabs; unnecessary for extensions with <10 domains
- Improvement path:
  1. Query only tabs matching affected domain initially
  2. Implement tab caching with efficient domain lookup (Set or Map)
  3. Batch updates if multiple domains change rapidly

**Timer interval runs every second even when popup closed:**
- Problem: `setInterval` in popup.js (line 464) never cleared when popup closes
- Files: `popup/popup.js` (lines 461-475)
- Cause: Memory leak; interval keeps running indefinitely even after popup destroyed
- Improvement path: Attach cleanup to popup unload/visibility events, or use requestAnimationFrame instead

**Domain validation regex processed on every manual add:**
- Problem: `isValidDomain()` regex test (popup.js line 315) is not optimized for repeated calls
- Files: `popup/popup.js` (lines 313-317)
- Cause: No caching; regex compiled fresh each time
- Improvement path: Precompile regex at module level instead of in function

## Fragile Areas

**Temporary override expiration logic:**
- Files: `background.js` (lines 14-24, 42-45, 70-106), `popup/popup.js` (lines 329-346, 435-445)
- Why fragile:
  1. Cleanup happens in two async paths (inline + periodic) - race conditions possible
  2. If periodic cleanup fails silently, expired overrides may persist
  3. Client-side timer in popup can desync from server state
  4. No atomic transactions across storage updates
- Safe modification:
  1. Add logging to track cleanup execution
  2. Implement mutation observer pattern to react to storage changes
  3. Always query fresh expiration time before rendering timer
  4. Add integration tests for expiration boundary conditions

**Domain normalization edge cases:**
- Files: `popup/popup.js` (lines 300-310), `background.js` (lines 4-11), `content.js` (lines 6-13)
- Why fragile:
  1. Regex assumes standard domain format; subdomains like `sub.domain.co.uk` not fully handled
  2. IDN domains (international characters) not normalized
  3. Port numbers in URLs stripped without warning
  4. No validation that normalized domain matches original intent
- Safe modification:
  1. Use URL parsing API consistently across all three implementations
  2. Add test cases for edge cases (subdomains, IDN, ports, paths)
  3. Warn user if normalization changes their input significantly
  4. Document domain matching behavior clearly

**Cross-tab state synchronization:**
- Files: `background.js` (lines 164-197), `popup/popup.js` (entire flow)
- Why fragile:
  1. No transactional consistency; multiple tabs can apply conflicting updates
  2. `chrome.storage.onChanged` fires asynchronously; UI may render stale data
  3. Popup UI can become out-of-sync if storage changes from different tab
  4. No version/timestamp on stored data to detect stale reads
- Safe modification:
  1. Implement optimistic locking or transaction mechanism
  2. Reload fresh state from storage before making critical decisions
  3. Add storage version/checksum to detect mid-operation changes
  4. Implement request deduplication to prevent duplicate updates

## Scaling Limits

**Storage quota for domain list:**
- Current capacity: Chrome sync storage limit is ~100KB per extension; realistic domain limit ~500-1000 entries
- Limit: UI becomes sluggish with >100 domains in list; sync may fail silently if quota exceeded
- Scaling path:
  1. Implement pagination or virtual scrolling in domain list
  2. Add domain count warning when approaching quota
  3. Implement local storage fallback if sync unavailable
  4. Add export/import functionality for domain backup

**Temporary override storage growth:**
- Current capacity: Each override ~100 bytes; ~100KB limit allows ~1000 concurrent overrides
- Limit: If user has many tabs with different domains and overrides, storage grows until quota hit
- Scaling path:
  1. Implement aggressive cleanup of past-expiration overrides
  2. Add storage quota monitoring
  3. Implement LRU eviction if quota exceeded
  4. Add warning when cleanup may have removed overrides

## Dependencies at Risk

**Chrome Manifest V3 stability:**
- Risk: Manifest V3 is relatively new; Chrome may change APIs or permissions model in future updates
- Impact: Extension could break if Chrome deprecates features like `chrome.alarms`, `chrome.storage.sync`
- Migration plan:
  1. Monitor Chrome release notes for deprecations
  2. Implement feature detection for new API versions
  3. Keep fallback mechanisms for older Chrome versions
  4. Test with new Chrome beta releases before stable release

**Chrome Web Store review criteria:**
- Risk: Extension submission rejected for `<all_urls>` permission or other policy violations
- Impact: Users cannot install from Web Store; must use unpacked extension (manual install only)
- Migration plan: Implement dynamic permissions approach if rejected:
  - Use `chrome.permissions.request()` per domain
  - Use `chrome.scripting.registerContentScripts()` dynamically
  - Accept friction of permission popup per domain (user experience tradeoff)

## Test Coverage Gaps

**No unit tests for domain normalization:**
- What's not tested: Edge cases in domain extraction and normalization
- Files: `background.js` (lines 4-11), `content.js` (lines 6-13), `popup/popup.js` (lines 300-317)
- Risk: IDN domains, domains with ports, subdomains, and malformed URLs may produce unexpected behavior
- Priority: High - domain handling is critical to core feature

**No unit tests for storage operations:**
- What's not tested: Concurrent read/write operations, storage quota exceeded, sync failures
- Files: `background.js` (all chrome.storage.sync calls), `popup/popup.js` (all chrome.storage.sync calls)
- Risk: Silent failures when storage quota exceeded or network unavailable
- Priority: High - data persistence is critical to user experience

**No unit tests for override expiration logic:**
- What's not tested: Expiration boundary conditions, cleanup race conditions, timer accuracy
- Files: `background.js` (lines 14-24, 42-45, 70-106), `popup/popup.js` (lines 435-458)
- Risk: Overrides may not expire correctly; stale overrides persist; timer displays wrong time
- Priority: High - temporary override is core feature

**Manual testing only:**
- What's not tested: No automated E2E tests; entire test suite is 60-point manual checklist (TESTING.md)
- Files: All JavaScript files
- Risk: Regression not caught until testing phase; difficult to verify fixes without manual clicks
- Priority: Medium - manual testing sufficient for MVP but limits agility

**No error scenario tests:**
- What's not tested: Chrome API failures, storage quota exceeded, network disconnection during sync
- Files: `background.js` (error handlers), `popup/popup.js` (error handlers), `content.js` (error handlers)
- Risk: Error handling code never executed in testing; silent failures in production possible
- Priority: Medium - error paths tested indirectly through manual testing

**No CSP/XSS tests:**
- What's not tested: DOM injection safety, CSP compliance, potential XSS vectors
- Files: `popup/popup.js` (DOM manipulation), `content.js` (style injection)
- Risk: Future refactoring could introduce XSS vulnerabilities
- Priority: Low - current code uses safe patterns (textContent, createElement) but not enforced

---

*Concerns audit: 2026-02-05*
