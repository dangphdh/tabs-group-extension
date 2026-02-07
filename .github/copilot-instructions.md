# Smart Tab Groups Coding Guidelines

## Big Picture Architecture
This is a Chrome Extension (Manifest v3) for automatically organizing tabs into groups.
- **Background Service Worker ([background.js](background.js))**: The central hub that manages state, tab manipulation, and initializes logic.
- **Smart Learning ([content/learningEngine.js](content/learningEngine.js))**: Observes user behavior (`chrome.tabGroups.onUpdated`, `chrome.tabs.onMoved`) to automatically create new domain-to-category rules.
- **Classification Pipeline**: 
    1. **Learned Rules** (from `chrome.storage.local`)
    2. **Custom Rules** (user-defined in Options)
    3. **Default Rules** ([content/domainClassifier.js](content/domainClassifier.js))
    4. **Keyword Matching** ([content/tabAnalyzer.js](content/tabAnalyzer.js))
- **Messaging**: Popup and Options communicate with the Background worker via `chrome.runtime.sendMessage`.

## Key Patterns & Conventions
- **Categories**: Follow the schema `{ color: string, icon: string }`.
- **Colors**: MUST use valid Chrome Tab Group colors: `grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`, `orange`. Use `validateColor()` from [popup/popup.js](popup/popup.js#L23) when handling user input.
- **Logic Sharing**: Core logic is kept in the `content/` folder and imported into the service worker via `importScripts()`.
- **Vietnamese Support**: Keyword analysis includes many Vietnamese terms (see [content/tabAnalyzer.js](content/tabAnalyzer.js#L20)). Always consider adding Vietnamese equivalents for new keywords or categories.

## Critical Workflows
- **Extension Loading**: Load the root directory as an "unpacked extension" in `chrome://extensions/`.
- **Icons**: Icons are NOT provided in the repo. You MUST convert [icons/icon.svg](icons/icon.svg) to PNGs (16x16, 48x48, 128x128) and place them in `icons/` as `icon16.png`, etc., before the extension can be loaded without errors.
- **Testing Learning**: To test the learning engine, manually move a tab into a group or rename a group and check `chrome.storage.local.get('learnedDomainRules')`.

## Integration Points
- **Storage**: Uses `chrome.storage.local` for all persistence (rules, learning stats, settings).
- **Tab APIs**: Extensively uses `chrome.tabs.group()`, `chrome.tabGroups.update()`, and `chrome.tabs.query()`.

## Common Tasks
- **Adding a Domain Rule**: Add to `domainRules` in [content/domainClassifier.js](content/domainClassifier.js).
- **Adding a Keyword**: Add to `topicKeywords` in [content/tabAnalyzer.js](content/tabAnalyzer.js).
- **Extending Learning**: Add listeners to `setupLearningListeners()` in [content/learningEngine.js](content/learningEngine.js).
