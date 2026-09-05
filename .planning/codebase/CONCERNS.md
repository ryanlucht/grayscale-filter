# Codebase Concerns

**Analysis Date:** 2026-09-05

## Current Tradeoffs

### Broad page access

`manifest.json` registers the content script for `<all_urls>`. This is intentional: the extension must apply a saved filter automatically at page load, before the user clicks the action. The content script reads only extension storage, calculates the current hostname, and injects or removes a fixed CSS rule.

If Chrome Web Store policy or product requirements change, the alternative is optional per-site permissions plus dynamically registered content scripts, with an additional permission prompt for each domain.

### Sync-storage privacy

Permanent domains and temporary overrides use `chrome.storage.sync`. Chrome may sync these values through a signed-in Google account. The extension does not transmit them itself. A local-only preference would require a storage migration and clear UI explaining the sync choice.

### Rendering cost

The extension applies `filter: grayscale(100%)` to the root document element. Whole-page filters can increase compositing work on video- or animation-heavy pages. This is inherent to the feature; any future intensity controls should be profiled on representative media-heavy sites.

### Classic content script duplication

`content.js` intentionally duplicates the small domain/filter-priority calculation from `utils/`. It runs as a classic script at `document_start`; switching to an asynchronous module import could reintroduce a flash of unfiltered content. Keep the duplicated behavior covered by the shared unit cases whenever domain matching changes.

## Verification Baseline

- ESLint covers production and test JavaScript.
- Jest unit coverage has per-file thresholds for all production modules.
- Puppeteer E2E tests exercise manual entry, removal, current-site toggling, storage-driven filtering, and temporary overrides against a real Chrome extension session.
- GitHub Actions runs lint, unit coverage, and E2E tests for pushes and pull requests.
- Development dependencies are lockfile-pinned and `npm audit` is clean as of the analysis date.

## Resolved in the 2026-09-05 Maintenance Pass

- Permanent domain mutations are serialized in the service worker, preventing lost updates.
- Popup tab commands were removed; storage changes now have one authoritative fan-out path.
- Popup requests validate application-level success responses.
- A pending `document_start` style insertion can be cancelled safely.
- Mixed-case protocol and `www.` domain input normalizes correctly.
- Temporary-override E2E coverage uses the production storage key and worker path.
- E2E removal tests fail when the expected control is absent.
