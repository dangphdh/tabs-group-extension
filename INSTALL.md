# Installation & Testing Guide

## Quick Start

### Step 1: Create Icon Files

The extension needs PNG icon files. You have a few options:

**Option A: Use Online Converter (Easiest)**
1. Go to https://cloudconvert.com/svg-to-png
2. Upload `icons/icon.svg`
3. Download as PNG
4. Use an image editor or online tool to resize to:
   - 16x16 pixels → save as `icons/icon16.png`
   - 48x48 pixels → save as `icons/icon48.png`
   - 128x128 pixels → save as `icons/icon128.png`

**Option B: Use ImageMagick (if installed)**
```bash
cd icons
magick -background none icon.svg -resize 16x16 icon16.png
magick -background none icon.svg -resize 48x48 icon48.png
magick -background none icon.svg -resize 128x128 icon128.png
```

**Option C: Use Placeholder Icons (for testing)**
- Any 16x16, 48x48, and 128x128 PNG images will work
- Chrome will still load the extension with custom icons

### Step 2: Load Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Toggle "Developer mode" in the top-right corner
4. Click "Load unpacked" button
5. Select the `exts/` folder (the folder containing `manifest.json`)
6. The extension should appear in your extensions list!

### Step 3: Test the Extension

**Basic Test:**
1. Open these tabs in separate tabs:
   - https://github.com
   - https://stackoverflow.com
   - https://youtube.com
   - https://facebook.com
   - https://cnn.com

2. Click the Smart Tab Groups icon in your toolbar
3. You should see proposed groups:
   - Development (blue): GitHub, Stack Overflow
   - Entertainment (orange): YouTube
   - Social (pink): Facebook
   - News (gray): CNN

4. Click "Apply Groups"
5. Your tabs should now be grouped in the browser!

## Testing Checklist

### Basic Functionality
- [ ] Extension loads without errors
- [ ] Popup opens when clicking the extension icon
- [ ] Tabs are analyzed and grouped correctly
- [ ] "Apply Groups" creates actual Chrome tab groups
- [ ] Groups have correct titles and colors

### Popup UI
- [ ] Grouping strategy dropdown works
- [ ] Auto-collapse checkbox works
- [ ] Groups are collapsible/expandable
- [ ] Tab count is accurate
- [ ] Refresh button re-analyzes tabs

### Options Page
- [ ] "Edit Rules" button opens options page
- [ ] Can add custom domain rules
- [ ] Can add custom keyword rules
- [ ] Can change category colors
- [ ] Auto-group settings can be toggled
- [ ] Import/Export settings works
- [ ] Reset to defaults works

### Edge Cases
- [ ] Works with single tab (no grouping needed)
- [ ] Handles tabs already in groups
- [ ] Skips chrome:// URLs properly
- [ ] Handles invalid URLs gracefully
- [ ] Works with incognito mode (should not activate)

## Demo Scenario

Try this comprehensive test:

**Setup:**
Open these tabs:
1. https://github.com/torvalds/linux
2. https://stackoverflow.com/questions/12345
3. https://youtube.com/watch?v=example
4. https://netflix.com/browse
5. https://facebook.com
6. https://twitter.com
7. https://cnn.com/world
8. https://bbc.com/news
9. https://amazon.com/s?k=laptop
10. https://shopee.vn/search

**Expected Result:**
- **Development** (blue, 2 tabs): GitHub, Stack Overflow
- **Entertainment** (orange, 2 tabs): YouTube, Netflix
- **Social** (pink, 2 tabs): Facebook, Twitter
- **News** (gray, 2 tabs): CNN, BBC
- **Shopping** (cyan, 2 tabs): Amazon, Shopee

**Steps:**
1. Click extension icon
2. Review proposed groups
3. Click a group header to collapse/expand it
4. Click "Apply Groups"
5. Verify groups created in browser with correct colors and titles
6. Right-click a group header → "Ungroup" to reset

## Troubleshooting

**Extension won't load:**
- Check that all three icon files exist (icon16.png, icon48.png, icon128.png)
- Check Chrome console (F12) for errors
- Make sure manifest.json is valid JSON

**Groups not created:**
- Check that you have tabs open (not chrome:// pages)
- Try the "Mixed" grouping strategy
- Check Chrome console for error messages

**Icons missing:**
- The extension will still work with missing/broken icons
- Chrome will show a default puzzle piece icon
- Follow Step 1 above to create proper icons

**Auto-group not working:**
- Make sure auto-group is enabled in Settings
- Check the delay setting (default 5000ms = 5 seconds)
- Wait the full delay after opening a new tab
- Check that the tab URL is not a chrome:// URL

## Development Tips

### View Logs
1. Go to `chrome://extensions/`
2. Find "Smart Tab Groups"
3. Click "service worker" link to view background logs
4. Open popup and press F12 to view popup logs

### Reload Extension
After making code changes:
1. Go to `chrome://extensions/`
2. Click the reload icon 🔄 for Smart Tab Groups
3. Re-open the popup to test changes

### Debugging
- Add `console.log()` statements in code
- Use Chrome DevTools (F12) when popup is open
- Check background service worker logs for auto-group issues

## File Structure Reference

```
exts/
├── manifest.json              # ← Extension config (REQUIRED)
├── background.js              # ← Service worker (auto-group)
├── popup/
│   ├── popup.html             # ← Popup UI structure
│   ├── popup.css              # ← Popup styling
│   └── popup.js               # ← Popup logic
├── content/
│   ├── domainClassifier.js    # ← Domain → Category mapping
│   └── tabAnalyzer.js         # ← Keyword/URL classification
├── options/
│   ├── options.html           # ← Settings page UI
│   ├── options.css            # ← Settings styling
│   └── options.js             # ← Settings logic
└── icons/
    ├── icon16.png             # ← 16x16 icon (YOU CREATE THIS)
    ├── icon48.png             # ← 48x48 icon (YOU CREATE THIS)
    ├── icon128.png            # ← 128x128 icon (YOU CREATE THIS)
    └── icon.svg               # ← Source SVG file
```

## Next Steps

1. **Create the icon files** (required step)
2. **Load the extension** in Chrome
3. **Test with the demo scenario** above
4. **Customize rules** in the Options page
5. **Share with friends** by exporting your custom rules!

Enjoy your organized tabs! 🎉
