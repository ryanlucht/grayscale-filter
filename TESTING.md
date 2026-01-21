# Grayscale Filter - End-to-End Testing Checklist

## Pre-Testing Setup

1. [ ] Extension loaded in Chrome (`chrome://extensions/` → Load unpacked)
2. [ ] Developer mode enabled
3. [ ] No errors shown on extension card
4. [ ] Service worker status shows "Active" (click to inspect if needed)

---

## Core Functionality Tests

### Test 1: Basic Grayscale Toggle (Domain NOT in list)

**Setup:** Navigate to a site NOT in your grayscale list (e.g., `example.com`)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1.1 | Open popup | Popup shows "Current site: example.com" | [ ] |
| 1.2 | Check toggle button | Button says "Add to Grayscale" (green) | [ ] |
| 1.3 | Click toggle button | Page turns grayscale immediately | [ ] |
| 1.4 | Check toggle button again | Button now says "Remove from Grayscale" (red) | [ ] |
| 1.5 | Verify domain list | "example.com" appears in list below | [ ] |
| 1.6 | Click toggle button | Page returns to color | [ ] |
| 1.7 | Verify removal | "example.com" removed from list | [ ] |

### Test 2: Manual Domain Entry

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 2.1 | Open popup | Input field visible | [ ] |
| 2.2 | Enter "reddit.com" | Text appears in input | [ ] |
| 2.3 | Click "Add Domain" | Domain added to list, input cleared | [ ] |
| 2.4 | Navigate to reddit.com | Page loads in grayscale | [ ] |
| 2.5 | Enter "reddit.com" again | Error: "Domain already in list" | [ ] |
| 2.6 | Enter "invalid..domain" | Error: "Invalid domain format" | [ ] |
| 2.7 | Enter "" (empty) | Error: "Please enter a domain" | [ ] |

### Test 3: Domain List Management

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 3.1 | Add 5+ domains | All appear in scrollable list | [ ] |
| 3.2 | Verify alphabetical sort | Domains sorted A-Z | [ ] |
| 3.3 | Click "Remove" on one | Domain removed, list updates | [ ] |
| 3.4 | Remove all domains | "No domains added yet" message appears | [ ] |

---

## Temporary Override Tests

### Test 4: Temporary Grayscale (Domain NOT in permanent list)

**Setup:** Navigate to a site NOT in your grayscale list (e.g., `github.com`)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 4.1 | Open popup | Quick Override section visible (orange) | [ ] |
| 4.2 | Check status text | Shows "Click to grayscale" | [ ] |
| 4.3 | Select "15 minutes" duration | Dropdown shows "15 minutes" | [ ] |
| 4.4 | Click power button | Page turns grayscale immediately | [ ] |
| 4.5 | Check power button | Green glow, pulsing animation | [ ] |
| 4.6 | Check status text | Shows "Grayscale Override" | [ ] |
| 4.7 | Check timer | Timer appears showing ~15:00 | [ ] |
| 4.8 | Wait 5 seconds | Timer counts down (14:55, etc.) | [ ] |

### Test 5: Temporary Color (Domain IN permanent list)

**Setup:** Add `twitter.com` to permanent list, then navigate to it

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 5.1 | Verify page is grayscale | Page loads grayscale (from permanent list) | [ ] |
| 5.2 | Open popup | Shows "Click to show in color" | [ ] |
| 5.3 | Select "30 minutes" duration | Dropdown shows "30 minutes" | [ ] |
| 5.4 | Click power button | Page turns to COLOR immediately | [ ] |
| 5.5 | Check status | Shows "Color Override" | [ ] |
| 5.6 | Check timer | Timer shows ~30:00 | [ ] |

### Test 6: Cancel Override

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 6.1 | Set any temporary override | Override active, timer visible | [ ] |
| 6.2 | Click "Cancel" button | Timer disappears | [ ] |
| 6.3 | Page state | Returns to default (based on permanent list) | [ ] |
| 6.4 | Power button | Returns to inactive state | [ ] |

### Test 7: Override Expiration

**Setup:** Set a very short test (use browser console to accelerate)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 7.1 | Set 15-minute override | Override active | [ ] |
| 7.2 | Wait for expiration* | Page returns to default state | [ ] |
| 7.3 | Reopen popup | Timer gone, power button inactive | [ ] |

*For faster testing, you can manually expire in DevTools:
```javascript
// In background service worker console:
chrome.storage.sync.get(['temporaryOverrides'], (r) => {
  const o = r.temporaryOverrides || {};
  for (let d in o) o[d].expiresAt = Date.now() - 1000;
  chrome.storage.sync.set({temporaryOverrides: o});
});
```

---

## Cross-Tab & Persistence Tests

### Test 8: Multiple Tabs Same Domain

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 8.1 | Open 3 tabs of twitter.com | All tabs load normally | [ ] |
| 8.2 | Add twitter.com from Tab 1 | All 3 tabs turn grayscale | [ ] |
| 8.3 | Remove from Tab 2 | All 3 tabs return to color | [ ] |

### Test 9: Temporary Override Cross-Tab

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 9.1 | Open 2 tabs of same domain | Both in same state | [ ] |
| 9.2 | Set temp override from Tab 1 | Both tabs change immediately | [ ] |
| 9.3 | Open popup from Tab 2 | Shows active override with timer | [ ] |
| 9.4 | Cancel from Tab 2 | Both tabs revert to default | [ ] |

### Test 10: Persistence (Browser Restart)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 10.1 | Add domains to list | Domains saved | [ ] |
| 10.2 | Set temporary override (1 hour) | Override active | [ ] |
| 10.3 | Close and reopen Chrome | Extension reloads | [ ] |
| 10.4 | Open popup | Domains still in list | [ ] |
| 10.5 | Check temporary override | Still active with correct time remaining | [ ] |
| 10.6 | Navigate to override domain | Correct state applied | [ ] |

---

## Edge Case Tests

### Test 11: Special URLs

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 11.1 | Open chrome://extensions | Toggle button disabled, "Not a valid website" | [ ] |
| 11.2 | Open chrome://settings | Same as above | [ ] |
| 11.3 | Open about:blank | Same as above | [ ] |
| 11.4 | Open a file:// URL | Same as above | [ ] |

### Test 12: Domain Variations

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 12.1 | Add "example.com" | Added successfully | [ ] |
| 12.2 | Visit www.example.com | Grayscale applied (www. stripped) | [ ] |
| 12.3 | Visit EXAMPLE.COM | Grayscale applied (case insensitive) | [ ] |
| 12.4 | Visit sub.example.com | NOT grayscale (subdomain not matched) | [ ] |

### Test 13: Rapid Interactions

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 13.1 | Click toggle button rapidly 5x | No errors, final state correct | [ ] |
| 13.2 | Click power button rapidly 5x | No errors, proper toggle behavior | [ ] |
| 13.3 | Add/remove same domain rapidly | No duplicates, list stays clean | [ ] |

---

## Error Handling Tests

### Test 14: Console Errors

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 14.1 | Open DevTools Console on page | No extension errors on load | [ ] |
| 14.2 | Toggle grayscale on/off | No errors in console | [ ] |
| 14.3 | Check background worker console | No errors (view at chrome://extensions) | [ ] |
| 14.4 | Reload extension with tabs open | "Extension context invalidated" handled gracefully | [ ] |

### Test 15: Storage Limits

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 15.1 | Add 50+ domains | All stored successfully | [ ] |
| 15.2 | Set overrides on 10 domains | All stored successfully | [ ] |
| 15.3 | Verify sync still works | Data persists across restart | [ ] |

---

## Performance Tests

### Test 16: UI Responsiveness

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 16.1 | Open popup | Opens instantly (<100ms feel) | [ ] |
| 16.2 | Toggle grayscale | Applies instantly (<100ms) | [ ] |
| 16.3 | Timer countdown | Updates smoothly every second | [ ] |
| 16.4 | Scroll domain list (50+ items) | Smooth scrolling | [ ] |

### Test 17: Page Performance

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 17.1 | Load heavy page with grayscale | No noticeable slowdown | [ ] |
| 17.2 | Scroll on grayscaled page | Smooth scrolling | [ ] |
| 17.3 | Play video on grayscaled page | Video plays smoothly (in grayscale) | [ ] |

---

## Final Checklist Before Submission

- [ ] All tests above pass
- [ ] No console errors in any context
- [ ] Extension icon displays correctly in toolbar
- [ ] Popup opens without issues
- [ ] All features work as documented
- [ ] README.md is up to date
- [ ] Privacy policy created
- [ ] Screenshots taken for Web Store listing

---

## Test Results Summary

| Category | Passed | Failed | Notes |
|----------|--------|--------|-------|
| Core Functionality | /7 | | |
| Temporary Override | /16 | | |
| Cross-Tab/Persistence | /11 | | |
| Edge Cases | /13 | | |
| Error Handling | /6 | | |
| Performance | /7 | | |
| **TOTAL** | **/60** | | |

**Tester:** _________________ **Date:** _____________

**Overall Status:** [ ] PASS [ ] FAIL

**Notes:**
