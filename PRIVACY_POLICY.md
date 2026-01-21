# Privacy Policy for Grayscale Filter

**Last Updated:** January 2025

## Overview

Grayscale Filter is a Chrome browser extension that applies a grayscale CSS filter to websites specified by the user. This privacy policy explains what data the extension collects, how it's used, and your rights regarding that data.

## Data Collection

### What We Collect

The Grayscale Filter extension collects and stores **only** the following data:

1. **Domain Names**: Website domain names (e.g., "twitter.com", "facebook.com") that you explicitly add to your grayscale list
2. **Temporary Override Settings**: When you use the Quick Override feature, we store which domains have active overrides and when they expire

### What We Do NOT Collect

- Browsing history
- Personal information
- Cookies or tracking data
- Analytics or usage statistics
- Any data from the websites you visit
- Login credentials
- Financial information

## Data Storage

### Local and Sync Storage

All data is stored using Chrome's built-in storage APIs:

- **chrome.storage.sync**: Your domain list syncs across your Chrome browsers when signed into Chrome
- Data is stored locally on your device and optionally synced through your Google account
- We do not operate any external servers or databases

### Data Retention

- Data persists until you remove it manually
- Temporary overrides automatically expire after the selected duration (15 minutes to 1 day)
- Uninstalling the extension removes all stored data

## Data Sharing

**We do not share any data with third parties.**

- No data is transmitted to external servers
- No analytics services are used
- No advertising networks are involved
- Your domain list stays entirely within Chrome's storage system

## Permissions Explanation

The extension requests the following permissions:

| Permission | Purpose |
|------------|---------|
| `storage` | Save your domain list and settings |
| `activeTab` | Read the current tab's URL to enable quick toggle |
| `tabs` | Apply grayscale across multiple tabs of the same domain |
| `scripting` | Inject the CSS filter into web pages |
| `alarms` | Manage expiration of temporary overrides |
| `<all_urls>` | Apply grayscale filter to any website you choose |

**Note:** The `<all_urls>` permission is required to apply the CSS filter to websites, but the extension only activates on domains you explicitly add to your list.

## Your Rights

You have the right to:

- **View** your stored domains at any time through the extension popup
- **Delete** any domain from your list
- **Export** your data (the domain list is visible in the popup)
- **Remove all data** by uninstalling the extension

## Children's Privacy

This extension is not directed at children under 13. We do not knowingly collect any personal information from children.

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last Updated" date above. Significant changes will be noted in the extension's changelog.

## Open Source

This extension's source code is available for review. You can verify exactly what data is collected and how it's used by examining the code.

## Contact

If you have questions about this privacy policy or the extension's data practices, please open an issue on the project's GitHub repository or contact the developer.

---

## Summary

**In plain terms:** Grayscale Filter only stores the website names you tell it to grayscale. Nothing else. No tracking, no analytics, no external servers. Your data stays on your device (and syncs through Chrome if you're signed in).
