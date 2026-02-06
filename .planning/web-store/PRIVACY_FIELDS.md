# Chrome Web Store Privacy Field Documentation

This document contains all privacy-related information needed for Chrome Web Store submission.

## Permission Justifications (for Web Store privacy fields)

### storage
- **Justification**: "Store user's domain list and sync across devices. Also stores temporary override state (domain, expiration time)."
- **Data stored**: Domain names user explicitly adds, override expiration timestamps
- **No personal data collected**

### activeTab
- **Justification**: "Detect current site URL for quick toggle feature. Allows user to add/remove current site from grayscale list with one click."
- **Access**: Read-only URL of active tab when user clicks extension icon
- **No browsing history tracked**

### tabs
- **Justification**: "Query all open tabs to apply/remove grayscale filter when user modifies their domain list. Ensures changes take effect immediately across all tabs."
- **Access**: Tab URLs to match against user's domain list
- **No browsing data stored**

### alarms
- **Justification**: "Clean up expired temporary overrides. When user sets a 15min/30min/1hr/1day override, an alarm fires at expiration to restore normal state."
- **Purpose**: Timer management for temporary feature
- **No external communication**

### content_scripts matches `<all_urls>`
- **Justification**: "Apply CSS grayscale filter to user-specified domains. Content script runs on all URLs to check if current domain matches user's list."
- **Purpose**: Core extension functionality
- **Read-only DOM access (injects CSS only)**

## Data Usage Declaration

**Data collected:** NONE

**Data transmitted externally:** NONE

**Analytics/tracking:** NONE

**Data stored locally:**
- User-specified domain list (synced via Chrome if user is signed in)
- Temporary override state: current override domain, expiration timestamp
- Current tab URL: read-only, used to detect domain for quick toggle

## Single Purpose Statement

"Apply grayscale filter to specified websites"

This extension has ONE purpose: let users apply a grayscale CSS filter to websites they choose. No other functionality, no data collection, no external communication.

## Privacy Policy Text (if required)

This extension does not collect, store, or transmit any personal information. The extension only stores:
1. Domain names that you explicitly add to your grayscale list
2. Temporary override settings (which domain, when it expires)

All data is stored locally in Chrome's storage and synced via your Chrome account if you are signed in. No data is sent to external servers.

## Store Listing Copy

### Short Description (132 characters max)
Apply grayscale filter to websites you choose. Reduce distractions, improve focus. No tracking, no data collection.

### Detailed Description
Grayscale Filter is a simple Chrome extension that applies a grayscale CSS filter to websites you specify, helping you reduce visual distractions and stay focused.

**Features:**
- Quick toggle for current site
- Temporary overrides (15min to 1 day)
- Manual domain entry
- Clean, distraction-free UI

**Privacy:**
- No tracking or analytics
- No external data transmission
- Only stores domains YOU add
- All data stays local/synced via Chrome

Perfect for productivity, focus, or reducing social media distractions.
