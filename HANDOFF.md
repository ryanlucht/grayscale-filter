# Grayscale Filter - Project Handoff

**Updated:** September 5, 2026

**Version:** 1.2.1

**Status:** Core functionality and automated verification are complete

## Current State

Grayscale Filter is a Manifest V3 Chrome extension that applies an exact-domain grayscale filter, supports permanent domain settings, and provides temporary color/grayscale overrides.

The service worker is the single authority for storage mutations. Permanent-domain and override writes are serialized, and `storage.onChanged` recalculates all open tabs from one storage snapshot. The popup never sends competing filter commands directly.

## Verification

Run before packaging or publishing:

```bash
npm ci
npm run lint
npm run test:coverage
npm run test:e2e
npm audit
```

GitHub Actions runs lint, coverage, and Chrome E2E tests on pushes to `main` and on pull requests.

## Storage Schema

```javascript
{
  domains: ["twitter.com", "reddit.com"],
  temporaryOverrides: {
    "example.com": {
      state: "color" | "grayscale",
      expiresAt: 1788631200000,
      originallyInList: false,
      durationMs: 1800000
    }
  }
}
```

Filter priority is: active temporary override, permanent domain list, then no filter.

## Chrome Web Store Notes

- The extension intentionally uses `<all_urls>` so configured sites can be filtered automatically at page load.
- Fonts and icons are bundled locally; the extension makes no external application requests.
- The public privacy policy is `PRIVACY_POLICY.md`.
- Run `npm run package:extension` to create a fresh, versioned ZIP in `releases/`.

## Remaining Product Tradeoffs

- Domain matching is exact after removing a leading `www.`; parent domains do not include subdomains.
- Settings use `chrome.storage.sync`, so a signed-in Chrome profile may sync the domain list through the user's Google account.
- Whole-page CSS filtering can add rendering cost on media-heavy sites.
