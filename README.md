# Grayscale Filter - Chrome Extension

A simple and elegant Chrome extension that applies a grayscale filter to specified websites, helping reduce visual distractions and improve focus.

## Features

- **Quick Toggle**: Instantly add or remove the current site from your grayscale list with one click
- **Temporary Override**: Temporarily enable/disable grayscale for 15 minutes, 30 minutes, 1 hour, or 1 day
- **Manual Entry**: Add any domain manually using the input field
- **Domain List Management**: View and manage all grayscaled websites in one place
- **Persistent Storage**: Your domain list syncs across all your Chrome instances
- **Instant Apply**: All changes take effect immediately without page refresh
- **Clean UI**: Modern, intuitive interface with smooth animations

## Installation

### Load Unpacked Extension (Developer Mode)

1. **Download or clone this extension**
   - If you downloaded it, extract the files to a folder like `~/chrome-extensions/grayscale/`

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or click the three-dot menu → Extensions → Manage Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Navigate to and select the `chrome-extensions/grayscale/` folder
   - Click "Select" or "Open"

5. **Verify Installation**
   - The Grayscale Filter extension should now appear in your extensions list
   - You should see the extension icon in your Chrome toolbar

## How to Use

### Quick Toggle (Recommended)

1. Navigate to any website you want to grayscale
2. Click the Grayscale Filter icon in your Chrome toolbar
3. Click the "Add to Grayscale" button
4. The page will immediately turn grayscale
5. To remove, click the extension icon again and click "Remove from Grayscale"

### Manual Entry

1. Click the Grayscale Filter icon in your toolbar
2. Type a domain name in the input field (e.g., `twitter.com`, `facebook.com`)
3. Click "Add Domain"
4. Navigate to that website to see the grayscale effect

### Quick Override (Temporary Toggle)

The Quick Override feature lets you temporarily change a site's grayscale state:

1. Click the Grayscale Filter icon to open the popup
2. At the top, you'll see the orange "Quick Override" section
3. Select a duration from the dropdown (15 min, 30 min, 1 hour, or 1 day)
4. Click the power button

**How it works:**
- **If the site IS in your grayscale list**: Clicking override shows it in COLOR temporarily
- **If the site is NOT in your list**: Clicking override shows it in GRAYSCALE temporarily
- After the duration expires, the site automatically returns to its default state
- A countdown timer shows remaining time
- Click "Cancel" to end the override early

### Managing Your List

- All grayscaled domains appear in the scrollable list
- Click "Remove" next to any domain to remove it from the list
- Changes take effect immediately on all open tabs

## Domain Matching Rules

- **Simple domain matching**: Enter domains like `twitter.com` or `facebook.com`
- **www. handling**: `twitter.com` automatically matches both `twitter.com` and `www.twitter.com`
- **Subdomain exclusion**: `twitter.com` will NOT match `mobile.twitter.com` (by design for simplicity)
- **Case-insensitive**: `Twitter.com` is treated the same as `twitter.com`

## Examples

Valid domain entries:
- `twitter.com`
- `facebook.com`
- `reddit.com`
- `news.ycombinator.com`

Invalid entries:
- `https://twitter.com` (remove protocol)
- `twitter.com/home` (remove paths)
- `invalid..domain` (invalid format)

## Technical Details

### How It Works

1. **Content Script**: Injects a CSS style element that applies `filter: grayscale(100%)` to the `<html>` element
2. **Background Worker**: Monitors tab updates and applies/removes the filter based on domain matching
3. **Storage**: Uses `chrome.storage.sync` to persist your domain list across devices
4. **Manifest V3**: Built with the latest Chrome Extension standard for better performance and security

### File Structure

```
~/chrome-extensions/grayscale/
├── manifest.json          # Extension configuration
├── content.js             # CSS filter injection
├── background.js          # Service worker
├── popup/
│   ├── popup.html        # UI structure
│   ├── popup.css         # Styling
│   └── popup.js          # UI logic
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            # This file
```

### Permissions

This extension requires the following permissions:

- **storage**: Save your domain list and temporary override settings
- **activeTab**: Get the URL of the current tab for quick toggle
- **tabs**: Query all tabs to apply/remove filters
- **scripting**: Inject the content script
- **alarms**: Manage expiration of temporary overrides
- **host_permissions (<all_urls>)**: Run on all websites to apply the filter

### Privacy

- **No tracking**: This extension does not track your browsing activity
- **No external calls**: All data stays local or synced via Chrome
- **No analytics**: No usage statistics are collected
- **Minimal data**: Only stores domain names you explicitly add

## Troubleshooting

### Extension icon doesn't appear
- Make sure the extension is enabled in `chrome://extensions/`
- Try reloading the extension
- Restart Chrome

### Grayscale not applying
- Reload the page after adding a domain
- Check that you entered the correct domain name
- Make sure the domain appears in your list
- Try removing and re-adding the domain

### Popup doesn't open
- Check for JavaScript errors in the extension (right-click icon → Inspect popup)
- Try reloading the extension
- Make sure manifest.json is valid

### Filter doesn't persist
- Make sure Chrome storage permissions are enabled
- Check that you're signed into Chrome (for sync to work)
- Try using chrome.storage.local if sync is having issues

## Debugging

### View Console Logs

**Popup Console**:
- Right-click extension icon → "Inspect popup"
- Check the Console tab for errors

**Background Worker**:
- Go to `chrome://extensions/`
- Find Grayscale Filter
- Click "Inspect views: service worker"

**Content Script**:
- Open DevTools on any page (F12)
- Content script logs appear in the regular Console

## Future Enhancements

Potential features for future versions:

- Adjustable grayscale intensity (0-100%)
- Wildcard subdomain matching (*.twitter.com)
- Import/export domain lists
- Preset lists (social media, news sites, etc.)
- Keyboard shortcuts
- Schedule-based activation (e.g., grayscale during work hours)
- Additional filters (sepia, blur, invert, etc.)
- Per-site intensity settings

## Contributing

This is a personal project, but suggestions and improvements are welcome!

## License

This project is provided as-is for personal use.

## Version History

### v1.1.0
- NEW: Quick Override - temporary toggle for 15min to 1 day
- NEW: Power button with countdown timer
- Improved error handling for extension context
- Updated UI with orange Quick Override section

### v1.0.0 (Initial Release)
- Quick toggle for current site
- Manual domain entry
- Domain list management
- Persistent storage with sync
- Clean, modern UI
- Manifest V3 compliance

---

**Enjoy a more focused browsing experience!**
