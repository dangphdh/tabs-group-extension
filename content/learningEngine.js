/**
 * Learning Engine for Smart Tab Groups
 * Automatically learns from user activities and updates grouping rules
 */

// Storage keys
const STORAGE_KEYS = {
  LEARNED_DOMAIN_RULES: 'learnedDomainRules',
  LEARNED_KEYWORD_RULES: 'learnedKeywordRules',
  USER_PREFERENCES: 'userPreferences',
  LEARNING_STATS: 'learningStats'
};

// Default learning settings
const DEFAULT_SETTINGS = {
  learningEnabled: true,
  autoLearnFromMoves: true,
  autoLearnFromRenames: true,
  autoLearnFromUngroups: true,
  minConfidence: 2, // Minimum number of times to confirm a pattern
  maxLearnedRules: 100
};

/**
 * Initialize the learning engine
 */
async function initLearningEngine() {
  const stats = await getLearningStats();
  if (!stats) {
    // Create initial stats using chrome.storage directly
    await new Promise((resolve) => {
      chrome.storage.local.set({
        [STORAGE_KEYS.LEARNING_STATS]: {
          totalActions: 0,
          movesLearned: 0,
          renamesLearned: 0,
          ungroupsLearned: 0,
          lastUpdate: Date.now()
        }
      }, resolve);
    });
  }

  // Set up event listeners for learning
  setupLearningListeners();
}

/**
 * Set up event listeners to track user activities
 */
function setupLearningListeners() {
  // Listen for tab group updates (renames, color changes)
  if (chrome.tabGroups) {
    chrome.tabGroups.onUpdated.addListener((group, changeInfo) => {
      if (!changeInfo) return;
      if (!changeInfo.title && !changeInfo.color) return;

      chrome.storage.local.get([STORAGE_KEYS.USER_PREFERENCES], (result) => {
        const prefs = result.userPreferences || DEFAULT_SETTINGS;
        if (!prefs.learningEnabled || !prefs.autoLearnFromRenames) return;

        if (changeInfo.title) {
          learnFromGroupRename(group, changeInfo.title);
        }
      });
    });

    // Listen for tabs being moved between groups
    chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
      chrome.storage.local.get([STORAGE_KEYS.USER_PREFERENCES], (result) => {
        const prefs = result.userPreferences || DEFAULT_SETTINGS;
        if (!prefs.learningEnabled || !prefs.autoLearnFromMoves) return;

        chrome.tabs.get(tabId, (tab) => {
          if (tab && tab.url && tab.groupId !== undefined && tab.groupId !== -1) {
            learnFromTabMove(tab, moveInfo);
          }
        });
      });
    });

    // Listen for tabs being ungrouped
    chrome.tabs.onDetached.addListener((tabId) => {
      chrome.storage.local.get([STORAGE_KEYS.USER_PREFERENCES], (result) => {
        const prefs = result.userPreferences || DEFAULT_SETTINGS;
        if (!prefs.learningEnabled || !prefs.autoLearnFromUngroups) return;

        chrome.tabs.get(tabId, (tab) => {
          if (tab && tab.url) {
            learnFromTabUngroup(tab);
          }
        });
      });
    });
  }
}

/**
 * Learn when user renames a group
 */
async function learnFromGroupRename(group, newTitle) {
  try {
    // Get all tabs in this group
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ groupId: group.id }, resolve);
    });

    if (!tabs || tabs.length === 0) return;

    // Get learned domain rules
    const result = await new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.LEARNED_DOMAIN_RULES], resolve);
    });
    const learnedRules = result.learnedDomainRules || {};

    // Get the group's color (use current color or default to grey)
    const groupColor = group.color || 'grey';

    // Learn from each tab's domain
    for (const tab of tabs) {
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) continue;

      try {
        const domain = new URL(tab.url).hostname;

        // Initialize domain entry if not exists
        if (!learnedRules[domain]) {
          learnedRules[domain] = {
            category: newTitle,
            color: groupColor,  // Store the group's color!
            confidence: 0,
            lastSeen: Date.now(),
            sources: []
          };
        }

        // Update if the category matches
        if (learnedRules[domain].category === newTitle) {
          learnedRules[domain].confidence += 1;
          learnedRules[domain].lastSeen = Date.now();
          learnedRules[domain].color = groupColor;  // Update color in case it changed
          learnedRules[domain].sources.push('group-rename');
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }

    // Save updated rules
    await new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.LEARNED_DOMAIN_RULES]: learnedRules }, resolve);
    });

    // Cleanup if we have too many rules
    await cleanupOldRules();

    // Update stats
    await updateLearningStats('renamesLearned');
  } catch (error) {
    console.error('[Learning] Error learning from group rename:', error);
  }
}

/**
 * Cleanup old rules if we exceed the limit
 */
async function cleanupOldRules() {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.LEARNED_DOMAIN_RULES, STORAGE_KEYS.USER_PREFERENCES], resolve);
    });

    const learnedRules = result.learnedDomainRules || {};
    const prefs = result.userPreferences || DEFAULT_SETTINGS;
    const maxRules = prefs.maxLearnedRules || DEFAULT_SETTINGS.maxLearnedRules;

    const domains = Object.keys(learnedRules);
    if (domains.length <= maxRules) return;

    // Sort by lastSeen (ascending) and confidence (ascending)
    // We want to keep the most recent and most confident rules
    domains.sort((a, b) => {
      const ruleA = learnedRules[a];
      const ruleB = learnedRules[b];
      
      // Primary: Confidence
      if (ruleA.confidence !== ruleB.confidence) {
        return ruleA.confidence - ruleB.confidence;
      }
      
      // Secondary: Last seen
      return ruleA.lastSeen - ruleB.lastSeen;
    });

    // Remove oldest/least confident rules
    const rulesToRemove = domains.length - maxRules;
    for (let i = 0; i < rulesToRemove; i++) {
      delete learnedRules[domains[i]];
    }

    await new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.LEARNED_DOMAIN_RULES]: learnedRules }, resolve);
    });
  } catch (error) {
    console.error('[Learning] Error cleaning up old rules:', error);
  }
}

/**
 * Learn when user moves a tab to a different group
 */
async function learnFromTabMove(tab, moveInfo) {
  try {
    // Get the group info
    const group = await new Promise((resolve) => {
      chrome.tabGroups.get(tab.groupId, resolve);
    });

    if (!group || !group.title) return;

    // Get learned domain rules
    const result = await new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.LEARNED_DOMAIN_RULES], resolve);
    });
    const learnedRules = result.learnedDomainRules || {};

    // Get the group's color (use current color or default to grey)
    const groupColor = group.color || 'grey';

    try {
      const domain = new URL(tab.url).hostname;

      // Initialize domain entry if not exists
      if (!learnedRules[domain]) {
        learnedRules[domain] = {
          category: group.title,
          color: groupColor,  // Store the group's color!
          confidence: 0,
          lastSeen: Date.now(),
          sources: []
        };
      }

      // Update confidence
      if (learnedRules[domain].category === group.title) {
        learnedRules[domain].confidence += 1;
        learnedRules[domain].lastSeen = Date.now();
        learnedRules[domain].color = groupColor;  // Update color
        learnedRules[domain].sources.push('tab-move');

        // Save updated rules
        await new Promise((resolve) => {
          chrome.storage.local.set({ [STORAGE_KEYS.LEARNED_DOMAIN_RULES]: learnedRules }, resolve);
        });

        // Cleanup if we have too many rules
        await cleanupOldRules();

        // Update stats
        await updateLearningStats('movesLearned');
      }
    } catch (e) {
      // Invalid URL, skip
    }
  } catch (error) {
    console.error('[Learning] Error learning from tab move:', error);
  }
}

/**
 * Learn when user explicitly ungroups a tab (might not want it in that category)
 */
async function learnFromTabUngroup(tab) {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.LEARNED_DOMAIN_RULES], resolve);
    });
    const learnedRules = result.learnedDomainRules || {};

    try {
      const domain = new URL(tab.url).hostname;

      if (learnedRules[domain]) {
        // Decrease confidence when user ungroups
        learnedRules[domain].confidence = Math.max(0, learnedRules[domain].confidence - 1);
        learnedRules[domain].lastSeen = Date.now();

        // Remove rule if confidence drops too low
        const prefs = await getUserPreferences();
        if (learnedRules[domain].confidence < prefs.minConfidence) {
          delete learnedRules[domain];

        }

        // Save updated rules
        await new Promise((resolve) => {
          chrome.storage.local.set({ [STORAGE_KEYS.LEARNED_DOMAIN_RULES]: learnedRules }, resolve);
        });

        // Update stats
        await updateLearningStats('ungroupsLearned');
      }
    } catch (e) {
      // Invalid URL, skip
    }
  } catch (error) {
    console.error('[Learning] Error learning from tab ungroup:', error);
  }
}

/**
 * Get learned domain rules for classification
 */
async function getLearnedDomainRules() {
  const result = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.LEARNED_DOMAIN_RULES], resolve);
  });
  const learnedRules = result.learnedDomainRules || {};
  const prefs = await getUserPreferences();

  // Filter by minimum confidence
  const filteredRules = {};
  const validColors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

  for (const [domain, rule] of Object.entries(learnedRules)) {
    if (rule.confidence >= prefs.minConfidence) {
      // Use stored color if available, otherwise get category color
      const storedColor = rule.color;
      const fallbackColor = getCategoryColor(rule.category);
      const color = storedColor || fallbackColor;

      // Validate color
      let validatedColor = 'grey';
      if (color && typeof color === 'string' && validColors.includes(color.toLowerCase())) {
        validatedColor = color.toLowerCase();
      }

      filteredRules[domain] = {
        category: rule.category,
        color: validatedColor,
        confidence: rule.confidence
      };
    }
  }

  return filteredRules;
}

/**
 * Get learned keyword rules
 */
async function getLearnedKeywordRules() {
  const result = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.LEARNED_KEYWORD_RULES], resolve);
  });
  return result.learnedKeywordRules || {};
}

/**
 * Manually add a learned rule (higher confidence)
 */
async function addLearnedRule(domain, category, confidence = 5) {
  const result = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.LEARNED_DOMAIN_RULES], resolve);
  });
  const learnedRules = result.learnedDomainRules || {};

  // Get the color for this category
  const color = getCategoryColor(category);

  learnedRules[domain] = {
    category,
    color,
    confidence,
    lastSeen: Date.now(),
    sources: ['manual']
  };

  await new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.LEARNED_DOMAIN_RULES]: learnedRules }, resolve);
  });
}

/**
 * Get user preferences for learning
 */
async function getUserPreferences() {
  const result = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.USER_PREFERENCES], resolve);
  });
  return { ...DEFAULT_SETTINGS, ...result.userPreferences };
}

/**
 * Update user preferences
 */
async function updateUserPreferences(newPrefs) {
  const currentPrefs = await getUserPreferences();
  const updatedPrefs = { ...currentPrefs, ...newPrefs };

  await new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.USER_PREFERENCES]: updatedPrefs }, resolve);
  });
}

/**
 * Get learning statistics
 */
async function getLearningStats() {
  const result = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.LEARNING_STATS], resolve);
  });
  return result.learningStats;
}

/**
 * Update learning statistics
 */
async function updateLearningStats(actionType) {
  const stats = await getLearningStats();

  if (stats) {
    stats.totalActions += 1;
    stats[actionType] = (stats[actionType] || 0) + 1;
    stats.lastUpdate = Date.now();

    await new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.LEARNING_STATS]: stats }, resolve);
    });
  }
}

/**
 * Reset all learned data
 */
async function resetLearning() {
  await new Promise((resolve) => {
    chrome.storage.local.set({
      [STORAGE_KEYS.LEARNED_DOMAIN_RULES]: {},
      [STORAGE_KEYS.LEARNED_KEYWORD_RULES]: {},
      [STORAGE_KEYS.LEARNING_STATS]: {
        totalActions: 0,
        movesLearned: 0,
        renamesLearned: 0,
        ungroupsLearned: 0,
        lastUpdate: Date.now()
      }
    }, resolve);
  });
}

/**
 * Get category color (helper function)
 */
function getCategoryColor(category) {
  const colors = {
    'Development': 'blue',
    'Entertainment': 'orange',
    'Social': 'pink',
    'News': 'grey',
    'Finance': 'green',
    'Sports': 'purple',
    'Shopping': 'cyan',
    'Learning': 'yellow',
    'Communication': 'red',
    'Work': 'blue',
    'Other': 'grey'
  };
  return colors[category] || 'grey';
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initLearningEngine,
    getLearnedDomainRules,
    getLearnedKeywordRules,
    addLearnedRule,
    getUserPreferences,
    updateUserPreferences,
    getLearningStats,
    resetLearning
  };
}
