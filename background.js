// Background service worker for Smart Tab Groups

// Import learning engine and classification tools
importScripts('content/domainClassifier.js');
importScripts('content/tabAnalyzer.js');
importScripts('content/learningEngine.js');

// Listen for extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {

    // Set default settings
    chrome.storage.local.set({
      groupingStrategy: 'mixed',
      autoCollapse: true,
      autoGroupNewTabs: false,
      autoGroupDelay: 5000
    });

    // Initialize learning engine
    try {
      await initLearningEngine();

    } catch (error) {
      console.error('[Learning] Failed to initialize:', error);
    }

  } else if (details.reason === 'update') {

    // Initialize learning engine on update
    try {
      await initLearningEngine();

    } catch (error) {
      console.error('[Learning] Failed to initialize:', error);
    }
  }
});

// Also initialize on startup (for service worker restarts)
chrome.runtime.onStartup.addListener(async () => {
  try {
    await initLearningEngine();

  } catch (error) {
    console.error('[Learning] Failed to initialize:', error);
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'createGroups') {
    createTabGroups(request.groups)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'ungroupTabs') {
    ungroupTabs(request.tabIds)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'updateGroup') {
    updateTabGroup(request.groupId, request.updates)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Learning-related messages
  if (request.action === 'getLearnedRules') {
    getLearnedDomainRules()
      .then((rules) => sendResponse({ success: true, data: rules }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'addLearnedRule') {
    addLearnedRule(request.domain, request.category, request.confidence)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getLearningStats') {
    getLearningStats()
      .then((stats) => sendResponse({ success: true, data: stats }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'resetLearning') {
    resetLearning()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getLearningPreferences') {
    getUserPreferences()
      .then((prefs) => sendResponse({ success: true, data: prefs }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'updateLearningPreferences') {
    updateUserPreferences(request.preferences)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * Ensure color is valid for Chrome Tab Groups API
 * Always returns a valid color string
 */
function validateColor(color, category = 'Unknown') {
  const validColors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

  // Default fallback
  let result = 'grey';

  if (color && typeof color === 'string') {
    const lowerColor = color.toLowerCase().trim();
    if (validColors.includes(lowerColor)) {
      result = lowerColor;
    }
  }

  return result;
}

/**
 * Create tab groups from the proposed groups
 */
async function createTabGroups(groups) {
  const groupIds = {};

  for (const [categoryName, group] of Object.entries(groups)) {
    if (group.tabs.length === 0) continue;

    const tabIds = group.tabs.map(tab => tab.id);

    try {
      // Create the group
      const groupId = await new Promise((resolve, reject) => {
        chrome.tabs.group({ tabIds }, (createdGroupId) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(createdGroupId);
          }
        });
      });

      // Update group title and color
      await new Promise((resolve, reject) => {
        const validatedColor = validateColor(group.color, categoryName);

        chrome.tabGroups.update(groupId, {
          title: categoryName,
          color: validatedColor
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      groupIds[categoryName] = groupId;
    } catch (error) {
      console.error(`Error creating group "${categoryName}":`, error);
    }
  }

  return groupIds;
}

/**
 * Ungroup specific tabs
 */
async function ungroupTabs(tabIds) {
  return new Promise((resolve, reject) => {
    chrome.tabs.ungroup(tabIds, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Update a tab group
 */
async function updateTabGroup(groupId, updates) {
  return new Promise((resolve, reject) => {
    chrome.tabGroups.update(groupId, updates, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// Optional: Auto-group new tabs (if enabled)
let autoGroupTimeouts = new Map();

chrome.tabs.onCreated.addListener((tab) => {
  // Check if auto-group is enabled
  chrome.storage.local.get(['autoGroupNewTabs', 'autoGroupDelay'], (result) => {
    if (!result.autoGroupNewTabs) return;

    const delay = result.autoGroupDelay || 5000;

    // Clear any existing timeout for this tab
    if (autoGroupTimeouts.has(tab.id)) {
      clearTimeout(autoGroupTimeouts.get(tab.id));
    }

    // Set timeout to auto-group this tab
    const timeoutId = setTimeout(() => {
      autoGroupTab(tab);
      autoGroupTimeouts.delete(tab.id);
    }, delay);

    autoGroupTimeouts.set(tab.id, timeoutId);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process when URL changes
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.storage.local.get(['autoGroupNewTabs'], (result) => {
      if (!result.autoGroupNewTabs) return;

      // Clear existing timeout
      if (autoGroupTimeouts.has(tabId)) {
        clearTimeout(autoGroupTimeouts.get(tabId));
      }

      // Check if tab is already in a group
      if (tab.groupId !== -1 && tab.groupId !== undefined) {
        return; // Already grouped, skip
      }

      // Auto-group after delay
      chrome.storage.local.get(['autoGroupDelay'], (delayResult) => {
        const delay = delayResult.autoGroupDelay || 5000;

        const timeoutId = setTimeout(() => {
          autoGroupTab(tab);
          autoGroupTimeouts.delete(tabId);
        }, delay);

        autoGroupTimeouts.set(tabId, timeoutId);
      });
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up timeouts for removed tabs
  if (autoGroupTimeouts.has(tabId)) {
    clearTimeout(autoGroupTimeouts.get(tabId));
    autoGroupTimeouts.delete(tabId);
  }
});

/**
 * Auto-group a single tab
 */
async function autoGroupTab(tab) {
  // Skip special URLs
  if (tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:')) {
    return;
  }

  try {
    // Import classification functions
    // Note: In service worker, we need to use importScripts or inline the logic
    const classification = await classifyTabForAutoGroup(tab);

    if (!classification || classification.category === 'Other') {
      return; // Don't auto-group "Other" category
    }

    // Get all existing groups to find a match
    const existingGroups = await new Promise((resolve) => {
      chrome.tabGroups.query({ windowId: tab.windowId }, resolve);
    });

    // Find existing group with same category
    const matchingGroup = existingGroups.find(
      group => group.title === classification.category
    );

    if (matchingGroup) {
      // Add to existing group
      await new Promise((resolve, reject) => {
        chrome.tabs.group({ tabIds: tab.id, groupId: matchingGroup.id }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    } else {
      // Create new group
      const groupId = await new Promise((resolve, reject) => {
        chrome.tabs.group({ tabIds: tab.id }, (createdGroupId) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(createdGroupId);
          }
        });
      });

      // Update group metadata
      await new Promise((resolve, reject) => {
        const validatedColor = validateColor(classification.color, classification.category);

        chrome.tabGroups.update(groupId, {
          title: classification.category,
          color: validatedColor
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
  } catch (error) {
    console.error('Error auto-grouping tab:', error);
  }
}

/**
 * Classify a tab for auto-grouping
 * Improved version for background service worker that uses full classifiers and custom rules
 */
async function classifyTabForAutoGroup(tab) {
  // Use the full tabAnalyzer.js logic which we've imported
  if (typeof classifyTab === 'function') {
    // We need to apply custom rules to the global state first
    await applyCustomRulesToState();
    return classifyTab(tab, classifyByDomain);
  }

  // Fallback to simplified version if tabAnalyzer.js is not loaded correctly
  // (though it should be via importScripts)
  return classifyTabFallback(tab);
}

/**
 * Apply custom rules from storage to the classifiers' global state
 */
async function applyCustomRulesToState() {
  const result = await new Promise((resolve) => {
    chrome.storage.local.get(['customDomainRules', 'customKeywordRules', 'categoryColors'], resolve);
  });

  // Apply custom category colors
  if (result.categoryColors) {
    for (const [category, color] of Object.entries(result.categoryColors)) {
      if (typeof addCategory === 'function') {
        addCategory(category, color, 'more');
      }
    }
  }

  // Apply custom domain rules
  if (result.customDomainRules) {
    for (const [domain, rule] of Object.entries(result.customDomainRules)) {
      if (typeof addDomainRule === 'function') {
        addDomainRule(domain, rule.category);
      }
    }
  }

  // Apply custom keyword rules
  if (result.customKeywordRules) {
    for (const [category, keywords] of Object.entries(result.customKeywordRules)) {
      keywords.forEach(keyword => {
        if (typeof addKeywordRule === 'function') {
          addKeywordRule(category, keyword);
        }
      });
    }
  }
}

/**
 * Simplified fallback classification (subset of the full logic)
 */
async function classifyTabFallback(tab) {
  // Original simplified logic
  const result = await new Promise((resolve) => {
    chrome.storage.local.get(['customDomainRules', 'customKeywordRules'], resolve);
  });
  // ... continue with original logic

  // Default domain rules (simplified subset)
  const defaultDomainRules = {
    'github.com': { category: 'Development', color: 'blue' },
    'stackoverflow.com': { category: 'Development', color: 'blue' },
    'youtube.com': { category: 'Entertainment', color: 'orange' },
    'netflix.com': { category: 'Entertainment', color: 'orange' },
    'facebook.com': { category: 'Social', color: 'pink' },
    'twitter.com': { category: 'Social', color: 'pink' },
    'linkedin.com': { category: 'Social', color: 'pink' },
    'amazon.com': { category: 'Shopping', color: 'cyan' },
    'shopee.vn': { category: 'Shopping', color: 'cyan' },

    // Email & Communication
    'gmail.com': { category: 'Communication', color: 'red' },
    'mail.google.com': { category: 'Communication', color: 'red' },
    'outlook.com': { category: 'Communication', color: 'red' },
    'outlook.office.com': { category: 'Communication', color: 'red' },
    'hotmail.com': { category: 'Communication', color: 'red' },
    'yahoo.com': { category: 'Communication', color: 'red' },

    // Office & Productivity
    'docs.google.com': { category: 'Work', color: 'blue' },
    'sheets.google.com': { category: 'Work', color: 'blue' },
    'slides.google.com': { category: 'Work', color: 'blue' },
    'drive.google.com': { category: 'Work', color: 'blue' },
    'calendar.google.com': { category: 'Work', color: 'blue' },
    'office.com': { category: 'Work', color: 'blue' },
    'office365.com': { category: 'Work', color: 'blue' },
    'onedrive.com': { category: 'Work', color: 'blue' },
    'teams.microsoft.com': { category: 'Work', color: 'blue' },
    'notion.so': { category: 'Work', color: 'blue' },
    'trello.com': { category: 'Work', color: 'blue' },
    'slack.com': { category: 'Work', color: 'blue' },
    'zoom.us': { category: 'Work', color: 'blue' }
  };

  // Merge rules with priority: Learned > Custom > Default
  const allDomainRules = { ...defaultDomainRules, ...customDomainRules, ...learnedRules };

  // Try domain classification
  try {
    const url = new URL(tab.url);
    const hostname = url.hostname;

    // Check for exact match
    if (allDomainRules[hostname]) {
      return allDomainRules[hostname];
    }

    // Check for subdomain match
    const parts = hostname.split('.');
    for (let i = 0; i < parts.length; i++) {
      const possibleDomain = parts.slice(i).join('.');
      if (allDomainRules[possibleDomain]) {
        return allDomainRules[possibleDomain];
      }
    }
  } catch (e) {
    // Invalid URL, skip
  }

  // Try keyword classification
  if (tab.title) {
    const lower = tab.title.toLowerCase();

    for (const [category, data] of Object.entries(customKeywordRules)) {
      if (data.keywords && data.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        return { category, color: data.color || 'grey' };
      }
    }
  }

  return null;
}

// Clean up on extension unload
chrome.runtime.onSuspend.addListener(() => {
  // Clear all pending timeouts
  for (const timeoutId of autoGroupTimeouts.values()) {
    clearTimeout(timeoutId);
  }
  autoGroupTimeouts.clear();
});
