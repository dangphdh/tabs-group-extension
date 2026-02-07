# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome Extension (Manifest V3) that automatically organizes browser tabs into groups using smart classification with domain-based rules, keyword matching, and machine learning from user behavior.

## Installation & Testing

### Loading the Extension
1. Open Chrome to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the project root directory (containing `manifest.json`)

### Required: Icon Files
The extension requires PNG icon files that are NOT included in the repo:
- `icons/icon16.png` (16x16)
- `icons/icon48.png` (48x48)
- `icons/icon128.png` (128x128)

Convert `icons/icon.svg` to these PNG files using:
- Online: https://cloudconvert.com/svg-to-png
- ImageMagick: `magick -background none icon.svg -resize 16x16 icon16.png`

### Development Workflow
- **Reload after changes**: Go to `chrome://extensions/` and click the reload icon 🔄
- **View logs**:
  - Background: Click "service worker" link at `chrome://extensions/`
  - Popup: Open DevTools (F12) when popup is open
- **Test auto-group**: Enable in Options, wait for delay (default 5000ms), check background logs

## Architecture

### Background Service Worker (`background.js`)
The central hub that manages all tab operations and state. Uses `importScripts()` to load:
- `content/domainClassifier.js` - Domain → Category mappings
- `content/tabAnalyzer.js` - Keyword/URL pattern classification
- `content/learningEngine.js` - Machine learning from user behavior

### Classification Pipeline (Priority Order)
1. **Learned Rules** - From `chrome.storage.local.learnedDomainRules` (highest priority)
2. **Custom Rules** - User-defined in Options page
3. **Default Rules** - Built-in mappings in `domainClassifier.js`
4. **Keyword Detection** - From page titles via `tabAnalyzer.js`
5. **URL Patterns** - Fallback pattern matching

### Smart Learning Engine (`content/learningEngine.js`)
Observes user actions to automatically create domain rules:
- Listens to `chrome.tabGroups.onUpdated` (group renames)
- Listens to `chrome.tabs.onMoved` (tab moves between groups)
- Stores learned rules with confidence scores in `chrome.storage.local`
- Configurable confidence threshold (default: 2 confirmations)

### Messaging Pattern
Popup and Options communicate with Background via `chrome.runtime.sendMessage`:
- `createGroups` - Create tab groups from proposals
- `updateGroup` / `ungroupTabs` - Manipulate existing groups
- `getLearnedRules` / `resetLearning` - Learning engine operations
- `updateLearningPreferences` - Configure learning behavior

### Storage Schema (`chrome.storage.local`)
```javascript
{
  // Custom user rules
  customDomainRules: { 'example.com': { category: 'Work' } },
  customKeywordRules: { 'Work': { keywords: ['api', 'dev'], color: 'blue' } },
  categoryColors: { 'Work': 'blue' },

  // Learning data
  learnedDomainRules: { 'github.com': { category: 'Backend', confidence: 3 } },
  userPreferences: {
    learningEnabled: true,
    autoLearnFromMoves: true,
    autoLearnFromRenames: true,
    minConfidence: 2
  },
  learningStats: { totalActions: 15, movesLearned: 8, ... },

  // Settings
  groupingStrategy: 'mixed', // 'mixed' | 'domain' | 'keywords'
  autoCollapse: true,
  autoGroupNewTabs: false,
  autoGroupDelay: 5000
}
```

## Code Conventions

### Valid Chrome Tab Group Colors
MUST use one of: `grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`, `orange`
- Always validate user input with `validateColor()` from `background.js:135`

### Adding Domain Rules
Add to `domainRules` in `content/domainClassifier.js`:
```javascript
'domain.com': { category: 'CategoryName', color: 'blue' }
```

### Adding Keywords
Add to `topicKeywords` in `content/tabAnalyzer.js`. **Vietnamese keywords are supported** - always add Vietnamese equivalents for new categories.

### Category Schema
Follow the pattern: `{ color: string, icon: string }`

## Key Files

| File | Purpose |
|------|---------|
| `background.js` | Service worker, tab grouping, auto-group, message handler |
| `content/domainClassifier.js` | Default domain → category mappings |
| `content/tabAnalyzer.js` | Keyword/URL classification, `classifyTab()` function |
| `content/learningEngine.js` | ML engine, learning listeners, rule storage |
| `popup/popup.js` | UI for proposing/applying groups, drag-and-drop |
| `options/options.js` | Settings page, custom rules management, import/export |
