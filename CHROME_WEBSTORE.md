# Chrome Web Store Submission Guide

## Pre-Submission Checklist

### Required Items

- [ ] **Developer Account**: Register at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
  - One-time $5 registration fee

- [ ] **Extension Package**: ZIP file of extension directory
  - Exclude: `.DS_Store`, `.git`, `TESTING.md`, `CHROME_WEBSTORE.md`

- [ ] **Store Listing Assets**:
  - [ ] Icon 128x128 PNG (already have: `icons/icon128.png`)
  - [ ] At least 1 screenshot (1280x800 or 640x400)
  - [ ] Optional: Promotional images (440x280 small, 920x680 large, 1400x560 marquee)

- [ ] **Privacy Policy**: Required for extensions using certain permissions
  - Must be hosted at a public URL
  - See `PRIVACY_POLICY.md` template below

---

## Store Listing Content

### Extension Name
```
Grayscale Filter
```
*(16 characters - within 45 char limit)*

### Short Description (up to 132 characters)
```
Apply grayscale filter to specified websites. Reduce visual distractions and improve focus with one-click toggle.
```
*(111 characters)*

### Detailed Description
```
Grayscale Filter helps you reduce visual distractions by applying a grayscale filter to websites of your choice.

FEATURES:
- Quick Toggle: Add or remove grayscale from any site with one click
- Temporary Override: Temporarily enable/disable grayscale for 15min to 1 day
- Domain Management: Manually add domains and manage your list
- Cross-Device Sync: Your settings sync across all Chrome browsers
- Instant Apply: Changes take effect immediately, no refresh needed
- Clean UI: Modern, intuitive interface

HOW IT WORKS:
1. Click the extension icon on any website
2. Click "Add to Grayscale" to make it grayscale
3. Use "Quick Override" for temporary changes
4. Manage all your grayscaled sites in one place

PERFECT FOR:
- Reducing distractions on social media
- Creating a calmer browsing experience
- Digital wellness and focus improvement
- Accessibility preferences

PRIVACY:
- No tracking or analytics
- No external data collection
- Your domain list stays private (synced via Chrome only)
- Open source and transparent

Note: The extension requires access to all URLs to apply the grayscale filter, but only stores the domain names you explicitly add.
```

### Category
```
Productivity
```
*(Alternative: Accessibility)*

### Language
```
English
```

---

## Screenshots Needed

### Screenshot 1: Popup Overview
- Show popup with Quick Override section
- Show a few domains in the list
- Capture at 1280x800 or 640x400

### Screenshot 2: Grayscale Applied
- Side-by-side or before/after of a colorful website in grayscale
- Shows the effect clearly

### Screenshot 3: Temporary Override Active
- Show timer counting down
- Power button in active state

### Screenshot 4: Domain Management
- Show the domain list with several entries
- Show the manual add input field

**How to capture:**
```bash
# On Mac, use Cmd+Shift+4 then Space to capture window
# Resize popup window if needed for better screenshot
```

---

## Permissions Justification

The Chrome Web Store may ask why you need certain permissions:

| Permission | Justification |
|------------|---------------|
| `storage` | Store user's domain list and temporary override settings for persistence |
| `activeTab` | Get the URL of the current tab to enable quick toggle functionality |
| `tabs` | Query all tabs to apply/remove grayscale filter across multiple tabs of the same domain |
| `scripting` | Inject the content script that applies the CSS grayscale filter |
| `alarms` | Schedule automatic cleanup of expired temporary overrides |
| `<all_urls>` | Apply the grayscale CSS filter to any website the user chooses to add |

---

## Package the Extension

```bash
# Navigate to extension directory
cd ~/chrome-extensions/grayscale

# Create ZIP excluding unnecessary files
zip -r grayscale-filter-v1.0.0.zip . \
  -x "*.DS_Store" \
  -x ".git/*" \
  -x "TESTING.md" \
  -x "CHROME_WEBSTORE.md" \
  -x "PRIVACY_POLICY.md" \
  -x "*.zip"

# Verify contents
unzip -l grayscale-filter-v1.0.0.zip
```

Expected contents:
```
manifest.json
content.js
background.js
popup/popup.html
popup/popup.css
popup/popup.js
icons/icon16.png
icons/icon48.png
icons/icon128.png
README.md
```

---

## Submission Steps

1. **Go to Developer Dashboard**
   - https://chrome.google.com/webstore/devconsole

2. **Click "New Item"**

3. **Upload ZIP file**
   - Upload `grayscale-filter-v1.0.0.zip`

4. **Fill in Store Listing**
   - Name, descriptions, category (from above)
   - Upload screenshots
   - Set language

5. **Privacy Practices**
   - Select "This extension does not collect or use user data"
   - OR if prompted about permissions, explain data usage
   - Provide privacy policy URL

6. **Distribution**
   - Choose visibility (Public, Unlisted, or Private)
   - Select regions (typically "All regions")

7. **Submit for Review**
   - Review typically takes 1-3 business days
   - May take longer for new developers

---

## Common Rejection Reasons & Fixes

### 1. "Insufficient permissions justification"
**Fix:** Add clear explanations in the store listing about why each permission is needed

### 2. "Missing privacy policy"
**Fix:** Host privacy policy at a public URL and link it in the submission

### 3. "Misleading functionality"
**Fix:** Ensure description accurately matches what the extension does

### 4. "Poor quality screenshots"
**Fix:** Use high-resolution screenshots that clearly show the extension UI

### 5. "Broken functionality"
**Fix:** Test thoroughly using the TESTING.md checklist before submission

---

## Post-Submission

### If Approved
- Extension goes live within hours
- Share link: `https://chrome.google.com/webstore/detail/[extension-id]`
- Monitor reviews and respond to feedback

### If Rejected
- Read rejection email carefully
- Fix the specific issues mentioned
- Resubmit with corrections
- Reply to the rejection if clarification needed

---

## Version Updates

For future updates:
1. Update `version` in manifest.json (e.g., "1.0.1")
2. Create new ZIP package
3. Go to Developer Dashboard → Your extension → Package → Upload new package
4. Submit for review

---

## Support Links (Optional)

You may want to create:
- GitHub repository for issue tracking
- Support email
- FAQ page

These can be added to the store listing under "Additional Information"
