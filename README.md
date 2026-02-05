# Smart Tab Groups - Chrome Extension

A Chrome extension that automatically groups your browser tabs by domain and topic with smart classification.

## Features

- **Semi-automatic Mode**: Extension proposes groups, you can adjust before applying
- **Manual Mode**: Click the popup icon to trigger grouping by existing rules
- **Smart Classification**:
  - Primary: Domain-based matching (instant, no processing needed)
  - Secondary: Keyword matching from page titles
  - Fallback: URL pattern matching
- **Customizable Rules**: Add your own domain and keyword rules
- **Auto-group New Tabs**: Optional automatic grouping of new tabs

## Installation

### Development Mode

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the `exts/` directory containing this extension

### Creating Icons

Before installing, you need to create PNG icons:
1. Use the `icon.svg` file in the `icons/` directory
2. Convert it to PNG at three sizes: 16x16, 48x48, 128x128
3. Save them as `icon16.png`, `icon48.png`, `icon128.png`
4. Or use any PNG images as placeholders for testing

See `icons/README.md` for conversion instructions.

## Usage

### Basic Usage

1. Open multiple tabs from different domains (e.g., GitHub, YouTube, Facebook)
2. Click the Smart Tab Groups extension icon in the toolbar
3. Review the proposed groups in the popup
4. Click "Apply Groups" to create the tab groups

### Customizing Rules

1. Click the extension icon
2. Click "Edit Rules" button
3. In the settings page:
   - Add custom domain rules
   - Add custom keyword rules
   - Adjust category colors
   - Configure auto-group settings

### Grouping Strategies

- **Mixed** (default): Uses domain matching first, then keywords, then URL patterns
- **By Domain Only**: Only uses domain-based classification
- **By Keywords Only**: Only uses keyword and URL pattern matching

## Project Structure

```
exts/
├── manifest.json           # Extension configuration
├── background.js            # Service worker (auto-group logic)
├── popup/
│   ├── popup.html          # Popup UI
│   ├── popup.css           # Popup styles
│   └── popup.js            # Popup logic
├── content/
│   ├── domainClassifier.js # Domain-based classification
│   └── tabAnalyzer.js      # Keyword & URL pattern classification
├── options/
│   ├── options.html        # Settings page UI
│   ├── options.css         # Settings styles
│   └── options.js          # Settings logic
└── icons/
    ├── icon.svg            # Source icon file
    └── README.md           # Icon conversion instructions
```

## Chrome APIs Used

- `chrome.tabs` - Query, group, and manipulate tabs
- `chrome.tabGroups` - Create and update tab groups
- `chrome.storage` - Persist user settings and custom rules

## Default Categories

| Category | Color | Example Domains |
|----------|-------|-----------------|
| Development | Blue | github.com, stackoverflow.com |
| Entertainment | Orange | youtube.com, netflix.com |
| Social | Pink | facebook.com, twitter.com |
| News | Gray | cnn.com, bbc.com |
| Finance | Green | finance.yahoo.com |
| Sports | Purple | espn.com |
| Shopping | Cyan | amazon.com, shopee.vn |
| Learning | Yellow | coursera.org, khanacademy.org |

## Testing Checklist

- [ ] Install extension successfully
- [ ] Open multiple tabs from different domains
- [ ] Click extension icon and see proposed groups
- [ ] Test drag-and-drop tabs between groups in popup
- [ ] Click "Apply" and verify groups created correctly
- [ ] Test custom rules in options page
- [ ] Test import/export settings
- [ ] Test with edge cases (single tab, already grouped tabs)

## Development Notes

### Manifest V3

This extension uses Manifest V3, the latest Chrome extension standard. The main differences from V2:
- Service workers instead of background pages
- Updated permissions declaration
- Improved security and performance

### Auto-group Feature

The auto-group feature is disabled by default. When enabled:
- New tabs are automatically grouped after a configurable delay (default 5 seconds)
- Tabs are added to existing groups if a matching group exists
- New groups are created if no matching group exists
- Special URLs (chrome://, about:) are never auto-grouped

## License

MIT License - feel free to use and modify as needed.
