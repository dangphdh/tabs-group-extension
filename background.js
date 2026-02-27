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

// Listen for storage changes to handle setting updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.autoCollapse) {
    if (changes.autoCollapse.newValue) {
      // If enabled, trigger a collapse of current window's inactive groups
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          handleGroupAutoCollapse(tabs[0]);
        }
      });
    }
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

  if (request.action === 'mergeGroups') {
    mergeTabGroups(request.sourceGroupId, request.targetGroupId)
      .then((result) => sendResponse({ success: true, data: result }))
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

  if (request.action === 'fixUnnamedGroups') {
    fixUnnamedSavedGroups()
      .then((result) => sendResponse({ success: true, data: result }))
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

  // Get all existing tab groups to avoid duplicates
  const existingGroups = await new Promise((resolve) => {
    chrome.tabGroups.query({}, resolve);
  });

  for (const [categoryName, group] of Object.entries(groups)) {
    if (group.tabs.length === 0) continue;

    const tabIds = group.tabs.map(tab => tab.id);
    const windowId = group.tabs[0].windowId; // Assume all tabs in group are same window

    // Find existing group with same title in the same window
    const matchingGroup = existingGroups.find(g => g.title === categoryName && g.windowId === windowId);

    try {
      let groupId;
      if (matchingGroup) {
        groupId = matchingGroup.id;
        // Group tabs into existing group
        await new Promise((resolve, reject) => {
          chrome.tabs.group({ tabIds, groupId }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      } else {
        // Create the group
        groupId = await new Promise((resolve, reject) => {
          chrome.tabs.group({ tabIds }, (createdGroupId) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(createdGroupId);
            }
          });
        });
      }

      // Update group title and color
      const validatedColor = validateColor(group.color, categoryName);
      const title = ensureValidTitle(categoryName);

      // First: Set title and color
      await new Promise((resolve, reject) => {
        chrome.tabGroups.update(groupId, {
          title,
          color: validatedColor
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      // Force UI refresh by briefly collapsing then uncollapsing
      await new Promise(resolve => {
        chrome.tabGroups.update(groupId, { collapsed: true }, () => resolve());
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      await new Promise(resolve => {
        chrome.tabGroups.update(groupId, { collapsed: false }, () => resolve());
      });

      // Wait for Chrome to fully create the saved group before syncing
      // Increased delay to ensure saved group is ready (Chrome 122+)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Sync to saved groups with retry mechanism
      if (chrome.tabGroups && chrome.tabGroups.savedGroups) {
        try {
          await syncTabGroupMetadata(groupId, { title, color: validatedColor });
        } catch (e) {
          console.warn('[CreateGroups] Saved group sync failed:', e);

          // Retry once after a longer delay
          await new Promise(resolve => setTimeout(resolve, 300));
          try {
            await syncTabGroupMetadata(groupId, { title, color: validatedColor });
          } catch (retryError) {
            console.warn('[CreateGroups] Retry also failed:', retryError);
          }
        }
      }

      groupIds[categoryName] = groupId;
    } catch (error) {
      console.error(`Error creating/updating group "${categoryName}":`, error);
    }
  }

  // After creating all groups, handle auto-collapse for the active tab
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (activeTab) {
      handleGroupAutoCollapse(activeTab);
    }
  } catch (error) {
    // Ignore error
  }

  return groupIds;
}

/**
 * Ensure title is not empty (fallback to "Untitled Group")
 */
function ensureValidTitle(title) {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return 'Untitled Group';
  }
  return title.trim();
}

/**
 * Update group title and color, and sync to saved group if it exists
 */
async function syncTabGroupMetadata(groupId, metadata) {
  return new Promise((resolve) => {
    // Ensure title is not empty
    const safeMetadata = {
      ...metadata,
      title: ensureValidTitle(metadata.title)
    };

    // 1. Update the live group with explicit collapsed state to force UI refresh
    const updateData = {
      ...safeMetadata,
      collapsed: metadata.collapsed !== undefined ? metadata.collapsed : false
    };

    chrome.tabGroups.update(groupId, updateData, async () => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn('[Sync] Could not update live group:', error);
        resolve(false);
        return;
      }

      // Small delay to ensure Chrome UI has updated
      await new Promise(r => setTimeout(r, 50));

      // 2. Try to sync with saved groups (Chrome 122+)
      if (chrome.tabGroups && chrome.tabGroups.savedGroups) {
        try {
          // Wait a bit longer for saved group to be created
          await new Promise(r => setTimeout(r, 100));

          // Get the current group info for better matching
          const currentGroup = await new Promise((res) => {
            chrome.tabGroups.get(groupId, res);
          });

          // Try multiple times to find the saved group (it might be created asynchronously)
          let savedGroup = null;
          let retries = 3;

          for (let attempt = 0; attempt < retries && !savedGroup; attempt++) {
            const allSaved = await new Promise((res) => {
              chrome.tabGroups.savedGroups.getAll(res);
            });

            console.log(`[Sync] Attempt ${attempt + 1}/${retries}: Searching for saved group. Total saved groups: ${allSaved.length}`);

            // Strategy 1: Match by localGroupId (most reliable)
            savedGroup = allSaved.find(sg =>
              sg.localGroupId === groupId ||
              sg.groupId === groupId
            );

            if (savedGroup) {
              console.log(`[Sync] ✓ Matched by localGroupId: ${savedGroup.savedGuid || savedGroup.id}`);
              break;
            }

            // Strategy 2: Match by title (if current group has the title we set)
            if (currentGroup.title === safeMetadata.title) {
              savedGroup = allSaved.find(sg =>
                sg.title === currentGroup.title &&
                sg.color === currentGroup.color
              );
              if (savedGroup) {
                console.log(`[Sync] ✓ Matched by title & color: ${savedGroup.savedGuid || savedGroup.id}`);
                break;
              }
            }

            // Strategy 3: Match by color only (for recently created unnamed groups)
            if (!savedGroup && currentGroup.color) {
              // Find unnamed groups with matching color
              const unnamedGroups = allSaved.filter(sg =>
                !sg.title ||
                sg.title.trim() === '' ||
                sg.title === 'Untitled Group'
              );

              // If there's exactly one unnamed group with matching color, use it
              if (unnamedGroups.length === 1) {
                savedGroup = unnamedGroups.find(sg => sg.color === currentGroup.color);
                if (savedGroup) {
                  console.log(`[Sync] ✓ Matched unnamed group by color: ${savedGroup.savedGuid || savedGroup.id}`);
                  break;
                }
              }

              // If there are multiple unnamed groups, find the most recent one
              if (unnamedGroups.length > 1 && !savedGroup) {
                // Sort by creation time (most recent first) - use the first matching color
                savedGroup = unnamedGroups.find(sg => sg.color === currentGroup.color);
                if (savedGroup) {
                  console.log(`[Sync] ✓ Matched most recent unnamed group by color: ${savedGroup.savedGuid || savedGroup.id}`);
                  break;
                }
              }
            }

            // If not found and this isn't the last attempt, wait and retry
            if (!savedGroup && attempt < retries - 1) {
              console.log(`[Sync] Saved group not found, retrying in 300ms...`);
              await new Promise(r => setTimeout(r, 300));
            }
          }

          // Update the saved group if found
          if (savedGroup) {
            const savedId = savedGroup.savedGuid || savedGroup.id;
            if (savedId) {
              await new Promise((res, rej) => {
                chrome.tabGroups.savedGroups.update(savedId, {
                  title: safeMetadata.title,
                  color: safeMetadata.color
                }, () => {
                  if (chrome.runtime.lastError) {
                    rej(chrome.runtime.lastError);
                  } else {
                    res();
                  }
                });
              });
              console.log(`[Sync] ✓✓✓ SUCCESS: Updated saved group "${savedGroup.title || '(unnamed)'}" => "${safeMetadata.title}"`);
            }
          } else {
            console.warn(`[Sync] ⚠️ Could not find saved group for "${safeMetadata.title}" (live group ID: ${groupId})`);
            console.warn(`[Sync] The saved group may not have been created yet, or the matching failed.`);
          }
        } catch (e) {
          console.error('[Sync] ✗ ERROR: Saved group sync failed:', e);
        }
      }

      resolve(!error);
    });
  });
}

/**
 * Fix all unnamed saved groups by updating them with a default name
 * Useful for cleaning up groups that were saved without names
 */
async function fixUnnamedSavedGroups() {
  if (!chrome.tabGroups || !chrome.tabGroups.savedGroups) {
    console.log('[Fix] SavedGroups API not available');
    return { fixed: 0, message: 'API not available' };
  }

  try {
    const allSaved = await new Promise((resolve) => {
      chrome.tabGroups.savedGroups.getAll(resolve);
    });

    console.log(`[Fix] Scanning ${allSaved.length} saved groups...`);

    let fixedCount = 0;
    for (const savedGroup of allSaved) {
      if (!savedGroup.title || savedGroup.title.trim() === '') {
        const savedId = savedGroup.savedGuid || savedGroup.id;
        if (savedId) {
          const newTitle = `Group ${savedGroup.color || 'grey'}`;
          await new Promise((resolve) => {
            chrome.tabGroups.savedGroups.update(savedId, {
              title: newTitle
            }, resolve);
          });
          console.log(`[Fix] ✓ Fixed unnamed saved group => "${newTitle}" (color: ${savedGroup.color})`);
          fixedCount++;
        }
      }
    }

    return { 
      fixed: fixedCount, 
      total: allSaved.length,
      message: `Fixed ${fixedCount} unnamed group(s)` 
    };
  } catch (error) {
    console.error('[Fix] Error fixing unnamed groups:', error);
    return { fixed: 0, error: error.message };
  }
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
  return syncTabGroupMetadata(groupId, updates);
}

/**
 * Merge two tab groups
 * Combines all tabs from source group into target group
 */
async function mergeTabGroups(sourceGroupId, targetGroupId) {
  try {
    // Get all tabs from both groups
    const sourceTabs = await new Promise((resolve) => {
      chrome.tabs.query({ groupId: sourceGroupId }, resolve);
    });

    const targetTabs = await new Promise((resolve) => {
      chrome.tabs.query({ groupId: targetGroupId }, resolve);
    });

    if (sourceTabs.length === 0) {
      return { message: 'Source group has no tabs' };
    }

    // Get target group info
    const targetGroup = await new Promise((resolve) => {
      chrome.tabGroups.get(targetGroupId, resolve);
    });

    // Move all tabs from source group to target group
    const sourceTabIds = sourceTabs.map(tab => tab.id);

    await new Promise((resolve, reject) => {
      chrome.tabs.group({ tabIds: sourceTabIds, groupId: targetGroupId }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    return {
      message: 'Groups merged successfully',
      targetGroupName: targetGroup.title || 'Untitled Group',
      tabsMerged: sourceTabIds.length
    };
  } catch (error) {
    console.error('Error merging groups:', error);
    throw error;
  }
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

// Listener for tab activation to handle auto-collapse
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    handleGroupAutoCollapse(tab);
  } catch (error) {
    // Ignore error if tab is not found
  }
});

// Listener for window focus changes to handle auto-collapse
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId: windowId });
    if (tab) {
      handleGroupAutoCollapse(tab);
    }
  } catch (error) {
    // Ignore error
  }
});

/**
 * Collapse groups that don't contain the active tab
 */
async function handleGroupAutoCollapse(activeTab) {
  if (!activeTab) return;

  const result = await new Promise((resolve) => {
    chrome.storage.local.get(['autoCollapse'], resolve);
  });

  if (!result.autoCollapse) return;

  const activeGroupId = activeTab.groupId;

  try {
    // Get all groups in the current window
    const groups = await new Promise((resolve) => {
      chrome.tabGroups.query({ windowId: activeTab.windowId }, resolve);
    });

    for (const group of groups) {
      // If active tab is in a group, only that group should be expanded.
      // If active tab is NOT in a group, ALL groups should be collapsed.
      const shouldBeCollapsed = group.id !== activeGroupId;

      // Only update if the state needs to change to avoid unnecessary API calls
      if (group.id !== -1 && group.collapsed !== shouldBeCollapsed) {
        await new Promise((resolve) => {
          chrome.tabGroups.update(group.id, { collapsed: shouldBeCollapsed }, () => {
            if (chrome.runtime.lastError) {
              // Ignore error (group might be gone)
            }
            resolve();
          });
        });
      }
    }
  } catch (error) {
    console.error('[AutoCollapse] Error:', error);
  }
}

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

  // Skip tabs in non-normal windows (popups, devtools, etc.)
  try {
    const window = await new Promise((resolve, reject) => {
      chrome.windows.get(tab.windowId, (win) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(win);
        }
      });
    });

    if (!window || window.type !== 'normal') {
      console.log('[AutoGroup] Skipping tab in non-normal window type:', window.type || 'unknown');
      console.log('[AutoGroup] Tab title:', tab.title, 'URL:', tab.url);
      return;
    }
  } catch (error) {
    console.warn('[AutoGroup] Could not get window info for tab:', tab.title, 'Error:', error.message);
    // If we can't get window info, play it safe and skip
    return;
  }

  try {
    // Import classification functions
    // Note: In service worker, we need to use importScripts or inline the logic
    const classification = await classifyTabForAutoGroup(tab);

    console.log('[AutoGroup] Tab:', tab.title, 'URL:', tab.url);
    console.log('[AutoGroup] Classification:', classification);

    if (!classification || !classification.category) {
      console.warn('[AutoGroup] No valid classification for tab:', tab.title);
      return; // Skip if no valid classification
    }

    if (classification.category === 'Other') {
      console.log('[AutoGroup] Skipping "Other" category for:', tab.title);
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

      // Update group metadata IMMEDIATELY
      const title = ensureValidTitle(classification.category);
      const validatedColor = validateColor(classification.color, title);

      console.log('[AutoGroup] Creating group with title:', title, 'color:', validatedColor);

      // First update: Set title and color
      await new Promise((resolve) => {
        chrome.tabGroups.update(groupId, {
          title,
          color: validatedColor
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('[AutoGroup] Could not set title:', chrome.runtime.lastError);
          } else {
            console.log('[AutoGroup] ✓ Title set successfully:', title);
          }
          resolve();
        });
      });

      // Force UI refresh by toggling collapse state
      // Collapse first
      await new Promise((resolve) => {
        chrome.tabGroups.update(groupId, { collapsed: true }, () => {
          resolve();
        });
      });

      // Longer delay for UI to update
      await new Promise(resolve => setTimeout(resolve, 50));

      // Then immediately uncollapse to show the name
      await new Promise((resolve) => {
        chrome.tabGroups.update(groupId, { collapsed: false }, () => {
          resolve();
        });
      });

      // Wait for Chrome to fully create the saved group before syncing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Sync to saved groups with retry mechanism
      // Only attempt if saved groups API is available
      const hasSavedGroupsAPI = chrome.tabGroups &&
                             chrome.tabGroups.savedGroups &&
                             typeof chrome.tabGroups.savedGroups === 'object';

      if (hasSavedGroupsAPI) {
        try {
          await syncTabGroupMetadata(groupId, { title, color: validatedColor });
        } catch (e) {
          console.warn('[AutoGroup] Saved group sync failed:', e);

          // Retry once after a longer delay
          await new Promise(resolve => setTimeout(resolve, 300));
          try {
            await syncTabGroupMetadata(groupId, { title, color: validatedColor });
          } catch (retryError) {
            console.warn('[AutoGroup] Retry also failed:', retryError);
          }
        }
      } else {
        console.log('[AutoGroup] ℹ️  Saved Groups API not available - skipping bookmark sync');
        console.log('[AutoGroup] ℹ️  Tab groups will work in tab strip only');
      }
    }

    // After grouping, handle auto-collapse if this is the active tab
    try {
      const currentTab = await chrome.tabs.get(tab.id);
      if (currentTab.active) {
        handleGroupAutoCollapse(currentTab);
      }
    } catch (e) {
      // Tab might be gone
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
      // Handle both old format (array) and new format (object with keywords property)
      let keywordList = [];
      if (Array.isArray(keywords)) {
        keywordList = keywords;
      } else if (keywords && Array.isArray(keywords.keywords)) {
        keywordList = keywords.keywords;
      }

      keywordList.forEach(keyword => {
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
  // Get custom rules and learned rules from storage
  const result = await new Promise((resolve) => {
    chrome.storage.local.get(['customDomainRules', 'customKeywordRules'], resolve);
  });

  const customDomainRules = result.customDomainRules || {};
  const customKeywordRules = result.customKeywordRules || {};

  // Get learned rules
  let learnedRules = {};
  try {
    learnedRules = await getLearnedDomainRules();
  } catch (e) {
    // Ignore if learning engine is not available
  }

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
