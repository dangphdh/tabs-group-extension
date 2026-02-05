// Global state
let customDomainRules = {};
let customKeywordRules = {};
let categoryColors = {};

// DOM Elements
const elements = {
  autoGroupNewTabs: document.getElementById('auto-group-new-tabs'),
  autoGroupDelay: document.getElementById('auto-group-delay'),
  domainInput: document.getElementById('domain-input'),
  domainCategorySelect: document.getElementById('domain-category-select'),
  addDomainRuleBtn: document.getElementById('add-domain-rule'),
  domainRulesList: document.getElementById('domain-rules-list'),
  keywordInput: document.getElementById('keyword-input'),
  keywordCategorySelect: document.getElementById('keyword-category-select'),
  addKeywordRuleBtn: document.getElementById('add-keyword-rule'),
  keywordRulesList: document.getElementById('keyword-rules-list'),
  categoryColorsList: document.getElementById('category-colors-list'),
  exportSettingsBtn: document.getElementById('export-settings'),
  importSettingsInput: document.getElementById('import-settings'),
  resetSettingsBtn: document.getElementById('reset-settings'),
  // Learning elements
  statTotal: document.getElementById('stat-total'),
  statMoves: document.getElementById('stat-moves'),
  statRenames: document.getElementById('stat-renames'),
  statRules: document.getElementById('stat-rules'),
  learningEnabled: document.getElementById('learning-enabled'),
  learnFromMoves: document.getElementById('learn-from-moves'),
  learnFromRenames: document.getElementById('learn-from-renames'),
  learnFromUngroups: document.getElementById('learn-from-ungroups'),
  minConfidence: document.getElementById('min-confidence'),
  learnedRulesList: document.getElementById('learned-rules-list'),
  refreshLearnedBtn: document.getElementById('refresh-learned'),
  resetLearningBtn: document.getElementById('reset-learning')
};

// Default category colors
const defaultCategoryColors = {
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

// Initialize options page
document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
  // Load all settings
  await loadSettings();

  // Load learning settings and stats
  await loadLearningSettings();
  await renderLearningStats();
  await renderLearnedRules();

  // Set up event listeners
  setupEventListeners();

  // Render all lists
  renderDomainRules();
  renderKeywordRules();
  renderCategoryColors();
}

/**
 * Load settings from chrome.storage
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [
        'autoGroupNewTabs',
        'autoGroupDelay',
        'customDomainRules',
        'customKeywordRules',
        'categoryColors'
      ],
      (result) => {
        elements.autoGroupNewTabs.checked = result.autoGroupNewTabs || false;
        elements.autoGroupDelay.value = result.autoGroupDelay || 5000;
        customDomainRules = result.customDomainRules || {};
        customKeywordRules = result.customKeywordRules || {};
        categoryColors = result.categoryColors || { ...defaultCategoryColors };
        resolve();
      }
    );
  });
}

/**
 * Save all settings to chrome.storage
 */
async function saveSettings() {
  const settings = {
    autoGroupNewTabs: elements.autoGroupNewTabs.checked,
    autoGroupDelay: parseInt(elements.autoGroupDelay.value) || 5000,
    customDomainRules,
    customKeywordRules,
    categoryColors
  };

  return new Promise((resolve) => {
    chrome.storage.local.set(settings, () => {
      resolve();
    });
  });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Auto-group settings
  elements.autoGroupNewTabs.addEventListener('change', () => {
    saveSettings();
  });

  elements.autoGroupDelay.addEventListener('change', () => {
    let value = parseInt(elements.autoGroupDelay.value);
    if (value < 1000) value = 1000;
    if (value > 30000) value = 30000;
    elements.autoGroupDelay.value = value;
    saveSettings();
  });

  // Add domain rule
  elements.addDomainRuleBtn.addEventListener('click', addDomainRule);
  elements.domainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addDomainRule();
  });

  // Add keyword rule
  elements.addKeywordRuleBtn.addEventListener('click', addKeywordRule);
  elements.keywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addKeywordRule();
  });

  // Import/Export
  elements.exportSettingsBtn.addEventListener('click', exportSettings);
  elements.importSettingsInput.addEventListener('change', importSettings);
  elements.resetSettingsBtn.addEventListener('click', resetSettings);

  // Learning settings
  elements.learningEnabled.addEventListener('change', saveLearningSettings);
  elements.learnFromMoves.addEventListener('change', saveLearningSettings);
  elements.learnFromRenames.addEventListener('change', saveLearningSettings);
  elements.learnFromUngroups.addEventListener('change', saveLearningSettings);
  elements.minConfidence.addEventListener('change', saveLearningSettings);
  elements.refreshLearnedBtn.addEventListener('click', refreshLearnedData);
  elements.resetLearningBtn.addEventListener('click', resetAllLearning);
}

/**
 * Add a domain rule
 */
async function addDomainRule() {
  const domain = elements.domainInput.value.trim();
  const category = elements.domainCategorySelect.value;

  if (!domain) {
    showToast('Please enter a domain', 'error');
    return;
  }

  if (!category) {
    showToast('Please select a category', 'error');
    return;
  }

  // Validate domain format
  try {
    new URL('https://' + domain);
  } catch (e) {
    showToast('Invalid domain format', 'error');
    return;
  }

  // Add rule
  customDomainRules[domain] = {
    category,
    color: categoryColors[category] || 'grey'
  };

  // Save and re-render
  await saveSettings();
  renderDomainRules();

  // Clear input
  elements.domainInput.value = '';
  elements.domainCategorySelect.value = '';

  showToast('Domain rule added successfully', 'success');
}

/**
 * Delete a domain rule
 */
async function deleteDomainRule(domain) {
  delete customDomainRules[domain];
  await saveSettings();
  renderDomainRules();
  showToast('Domain rule deleted', 'success');
}

/**
 * Render domain rules list
 */
function renderDomainRules() {
  const domains = Object.keys(customDomainRules).sort();

  if (domains.length === 0) {
    elements.domainRulesList.innerHTML = `
      <div class="empty-state">
        <p>No custom domain rules yet.</p>
        <p>Add a rule above to automatically categorize specific domains.</p>
      </div>
    `;
    return;
  }

  elements.domainRulesList.innerHTML = domains.map(domain => {
    const rule = customDomainRules[domain];
    const categoryClass = getCategoryClass(rule.category);

    return `
      <div class="rule-item">
        <span class="rule-domain">${domain}</span>
        <span class="rule-category ${categoryClass}">${rule.category}</span>
        <button class="delete-rule-btn" onclick="deleteDomainRule('${domain}')">×</button>
      </div>
    `;
  }).join('');
}

/**
 * Add a keyword rule
 */
async function addKeywordRule() {
  const keyword = elements.keywordInput.value.trim();
  const category = elements.keywordCategorySelect.value;

  if (!keyword) {
    showToast('Please enter a keyword', 'error');
    return;
  }

  if (!category) {
    showToast('Please select a category', 'error');
    return;
  }

  // Initialize category if not exists
  if (!customKeywordRules[category]) {
    customKeywordRules[category] = {
      keywords: [],
      color: categoryColors[category] || 'grey'
    };
  }

  // Check if keyword already exists
  if (customKeywordRules[category].keywords.includes(keyword)) {
    showToast('Keyword already exists for this category', 'error');
    return;
  }

  // Add keyword
  customKeywordRules[category].keywords.push(keyword);

  // Save and re-render
  await saveSettings();
  renderKeywordRules();

  // Clear input
  elements.keywordInput.value = '';

  showToast('Keyword added successfully', 'success');
}

/**
 * Delete a keyword rule
 */
async function deleteKeywordRule(category, keyword) {
  if (customKeywordRules[category]) {
    customKeywordRules[category].keywords = customKeywordRules[category].keywords.filter(k => k !== keyword);

    // Remove category if no keywords left
    if (customKeywordRules[category].keywords.length === 0) {
      delete customKeywordRules[category];
    }

    await saveSettings();
    renderKeywordRules();
    showToast('Keyword deleted', 'success');
  }
}

/**
 * Render keyword rules list
 */
function renderKeywordRules() {
  const categories = Object.keys(customKeywordRules).filter(
    cat => customKeywordRules[cat].keywords && customKeywordRules[cat].keywords.length > 0
  );

  if (categories.length === 0) {
    elements.keywordRulesList.innerHTML = `
      <div class="empty-state">
        <p>No custom keyword rules yet.</p>
        <p>Add keywords above to detect topics in page titles.</p>
      </div>
    `;
    return;
  }

  let html = '';
  categories.forEach(category => {
    const data = customKeywordRules[category];
    const categoryClass = getCategoryClass(category);

    data.keywords.forEach(keyword => {
      html += `
        <div class="rule-item">
          <span class="rule-keyword">${keyword}</span>
          <span class="rule-category ${categoryClass}">${category}</span>
          <button class="delete-rule-btn" onclick="deleteKeywordRule('${category}', '${keyword}')">×</button>
        </div>
      `;
    });
  });

  elements.keywordRulesList.innerHTML = html;
}

/**
 * Render category colors
 */
function renderCategoryColors() {
  const colorOptions = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

  elements.categoryColorsList.innerHTML = Object.entries(defaultCategoryColors).map(([category, defaultColor]) => {
    const currentColor = categoryColors[category] || defaultColor;

    return `
      <div class="category-color-item">
        <span class="category-name">${category}</span>
        <select class="category-color-select" onchange="updateCategoryColor('${category}', this.value)">
          ${colorOptions.map(color => `
            <option value="${color}" ${currentColor === color ? 'selected' : ''}>
              ${color.charAt(0).toUpperCase() + color.slice(1)}
            </option>
          `).join('')}
        </select>
      </div>
    `;
  }).join('');
}

/**
 * Update category color
 */
async function updateCategoryColor(category, color) {
  categoryColors[category] = color;
  await saveSettings();
  renderDomainRules();
  renderKeywordRules();
  showToast(`${category} color updated`, 'success');
}

/**
 * Export settings to JSON file
 */
function exportSettings() {
  const settings = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    settings: {
      autoGroupNewTabs: elements.autoGroupNewTabs.checked,
      autoGroupDelay: parseInt(elements.autoGroupDelay.value)
    },
    customDomainRules,
    customKeywordRules,
    categoryColors
  };

  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smart-tab-groups-settings-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Settings exported successfully', 'success');
}

/**
 * Import settings from JSON file
 */
function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const settings = JSON.parse(e.target.result);

      // Validate settings structure
      if (!settings.customDomainRules && !settings.customKeywordRules) {
        throw new Error('Invalid settings file');
      }

      // Import settings
      if (settings.settings) {
        elements.autoGroupNewTabs.checked = settings.settings.autoGroupNewTabs || false;
        elements.autoGroupDelay.value = settings.settings.autoGroupDelay || 5000;
      }

      if (settings.customDomainRules) {
        customDomainRules = settings.customDomainRules;
      }

      if (settings.customKeywordRules) {
        customKeywordRules = settings.customKeywordRules;
      }

      if (settings.categoryColors) {
        categoryColors = { ...defaultCategoryColors, ...settings.categoryColors };
      }

      // Save and re-render
      await saveSettings();
      renderDomainRules();
      renderKeywordRules();
      renderCategoryColors();

      showToast('Settings imported successfully', 'success');
    } catch (error) {
      console.error('Import error:', error);
      showToast('Error importing settings: Invalid file format', 'error');
    }
  };

  reader.readAsText(file);
  event.target.value = ''; // Reset file input
}

/**
 * Reset all settings to defaults
 */
async function resetSettings() {
  if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
    return;
  }

  elements.autoGroupNewTabs.checked = false;
  elements.autoGroupDelay.value = 5000;
  customDomainRules = {};
  customKeywordRules = {};
  categoryColors = { ...defaultCategoryColors };

  await saveSettings();
  renderDomainRules();
  renderKeywordRules();
  renderCategoryColors();

  showToast('Settings reset to defaults', 'success');
}

/**
 * Get category CSS class
 */
function getCategoryClass(category) {
  const classMap = {
    'Development': 'dev',
    'Entertainment': 'entertainment',
    'Social': 'social',
    'News': 'news',
    'Finance': 'finance',
    'Sports': 'sports',
    'Shopping': 'shopping',
    'Learning': 'learning',
    'Communication': 'communication',
    'Work': 'work',
    'Other': 'other'
  };
  return classMap[category] || 'other';
}

/**
 * Load learning settings from storage or background
 */
async function loadLearningSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLearningPreferences' });
    if (response.success) {
      const prefs = response.data;
      elements.learningEnabled.checked = prefs.learningEnabled !== undefined ? prefs.learningEnabled : true;
      elements.learnFromMoves.checked = prefs.autoLearnFromMoves !== undefined ? prefs.autoLearnFromMoves : true;
      elements.learnFromRenames.checked = prefs.autoLearnFromRenames !== undefined ? prefs.autoLearnFromRenames : true;
      elements.learnFromUngroups.checked = prefs.autoLearnFromUngroups !== undefined ? prefs.autoLearnFromUngroups : true;
      elements.minConfidence.value = prefs.minConfidence !== undefined ? prefs.minConfidence : 2;
    }
  } catch (error) {
    console.error('Failed to load learning settings:', error);
  }
}

/**
 * Save learning settings
 */
async function saveLearningSettings() {
  try {
    const preferences = {
      learningEnabled: elements.learningEnabled.checked,
      autoLearnFromMoves: elements.learnFromMoves.checked,
      autoLearnFromRenames: elements.learnFromRenames.checked,
      autoLearnFromUngroups: elements.learnFromUngroups.checked,
      minConfidence: parseInt(elements.minConfidence.value) || 2
    };

    const response = await chrome.runtime.sendMessage({
      action: 'updateLearningPreferences',
      preferences
    });

    if (response.success) {
      showToast('Learning settings saved', 'success');
    }
  } catch (error) {
    console.error('Failed to save learning settings:', error);
    showToast('Failed to save learning settings', 'error');
  }
}

/**
 * Render learning statistics
 */
async function renderLearningStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLearningStats' });
    if (response.success && response.data) {
      const stats = response.data;
      elements.statTotal.textContent = stats.totalActions || 0;
      elements.statMoves.textContent = stats.movesLearned || 0;
      elements.statRenames.textContent = stats.renamesLearned || 0;

      // Get learned rules count
      const rulesResponse = await chrome.runtime.sendMessage({ action: 'getLearnedRules' });
      if (rulesResponse.success && rulesResponse.data) {
        elements.statRules.textContent = Object.keys(rulesResponse.data).length || 0;
      }
    }
  } catch (error) {
    console.error('Failed to load learning stats:', error);
  }
}

/**
 * Render learned rules
 */
async function renderLearnedRules() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLearnedRules' });
    if (response.success && response.data) {
      const rules = response.data;
      const domains = Object.keys(rules).sort();

      if (domains.length === 0) {
        elements.learnedRulesList.innerHTML = `
          <div class="empty-state">
            <p>No learned rules yet.</p>
            <p>The extension will automatically learn from your tab organizing actions.</p>
          </div>
        `;
        return;
      }

      elements.learnedRulesList.innerHTML = domains.map(domain => {
        const rule = rules[domain];
        const categoryClass = getCategoryClass(rule.category);

        return `
          <div class="rule-item">
            <span class="rule-domain">${domain}</span>
            <span class="rule-category ${categoryClass}">${rule.category}</span>
            <span class="learned-confidence">Confidence: <strong>${rule.confidence}</strong></span>
            <button class="delete-rule-btn" onclick="deleteLearnedRule('${domain}')">×</button>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Failed to load learned rules:', error);
  }
}

/**
 * Delete a learned rule
 */
async function deleteLearnedRule(domain) {
  if (!confirm(`Remove learned rule for "${domain}"?`)) {
    return;
  }

  // This would need to be implemented in the learning engine
  // For now, we'll reset all learning as a workaround
  if (confirm('Note: Individual rule deletion not yet implemented. Would you like to reset all learned rules instead?')) {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'resetLearning' });
      if (response.success) {
        showToast('All learned rules have been reset', 'success');
        await renderLearningStats();
        await renderLearnedRules();
      }
    } catch (error) {
      console.error('Failed to reset learning:', error);
      showToast('Failed to reset learning', 'error');
    }
  }
}

// Make function globally accessible for onclick
window.deleteLearnedRule = deleteLearnedRule;

/**
 * Refresh learned data
 */
async function refreshLearnedData() {
  await renderLearningStats();
  await renderLearnedRules();
  showToast('Learning data refreshed', 'success');
}

/**
 * Reset all learning
 */
async function resetAllLearning() {
  if (!confirm('Are you sure you want to reset all learned data? This will remove all patterns the extension has learned from your usage.')) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({ action: 'resetLearning' });
    if (response.success) {
      showToast('All learning data has been reset', 'success');
      await renderLearningStats();
      await renderLearnedRules();
    }
  } catch (error) {
    console.error('Failed to reset learning:', error);
    showToast('Failed to reset learning', 'error');
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `status-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
