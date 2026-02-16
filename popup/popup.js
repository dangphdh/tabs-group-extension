// Global state
let currentGroups = {};
let allTabs = [];
let searchQuery = '';
let selectedCategory = 'all';

// Chrome color mapping for CSS
const colorMap = {
  'grey': 'var(--group-grey)',
  'blue': 'var(--group-blue)',
  'red': 'var(--group-red)',
  'yellow': 'var(--group-yellow)',
  'green': 'var(--group-green)',
  'pink': 'var(--group-pink)',
  'purple': 'var(--group-purple)',
  'cyan': 'var(--group-cyan)',
  'orange': 'var(--group-orange)'
};

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

// DOM Elements
const elements = {
  loading: document.getElementById('loading'),
  proposeSection: document.getElementById('propose-section'),
  manageSection: document.getElementById('manage-section'),
  proposeControls: document.getElementById('propose-controls'),
  groupsContainer: document.getElementById('groups-container'),
  activeGroupsContainer: document.getElementById('active-groups-container'),
  ungroupedTabsContainer: document.getElementById('ungrouped-tabs-container'),
  tabCount: document.getElementById('tab-count'),
  noTabsMessage: document.getElementById('no-tabs-message'),
  noActiveGroupsMessage: document.getElementById('no-active-groups-message'),
  refreshBtn: document.getElementById('refresh-btn'),
  editRulesBtn: document.getElementById('edit-rules-btn'),
  applyBtn: document.getElementById('apply-btn'),
  ungroupAllBtn: document.getElementById('ungroup-all-btn'),
  cleanBookmarksBtn: document.getElementById('clean-bookmarks-btn'),
  navPropose: document.getElementById('nav-propose'),
  navManage: document.getElementById('nav-manage'),
  groupingStrategy: document.getElementById('grouping-strategy'),
  autoCollapse: document.getElementById('auto-collapse'),
  statusMessage: document.getElementById('status-message'),
  searchInput: document.getElementById('search-input'),
  categoryFilter: document.getElementById('category-filter'),
  clearSearchBtn: document.getElementById('clear-search-btn')
};

// Initialize popup
document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
  // Load settings and custom rules
  await loadSettings();
  await applyCustomRules();

  // Set up event listeners
  elements.refreshBtn.addEventListener('click', () => {
    if (elements.navPropose.classList.contains('active')) {
      analyzeAndRender();
    } else {
      renderManagementView();
    }
  });
  elements.editRulesBtn.addEventListener('click', openOptionsPage);
  elements.applyBtn.addEventListener('click', applyGroups);
  elements.groupingStrategy.addEventListener('change', saveSettings);
  elements.autoCollapse.addEventListener('change', saveSettings);

  // Tab navigation
  elements.navPropose.addEventListener('click', () => switchTab('propose'));
  elements.navManage.addEventListener('click', () => switchTab('manage'));

  // Management actions
  elements.ungroupAllBtn.addEventListener('click', ungroupAll);
  if (elements.cleanBookmarksBtn) {
    elements.cleanBookmarksBtn.addEventListener('click', cleanBookmarksBarGroups);
  }

  // Search and filter event listeners
  elements.searchInput.addEventListener('input', handleSearch);
  elements.categoryFilter.addEventListener('change', handleCategoryFilter);
  elements.clearSearchBtn.addEventListener('click', clearSearch);

  // Initial analysis
  await analyzeAndRender();
}

/**
 * Switch between Propose and Manage tabs
 */
function switchTab(tabId) {
  if (tabId === 'propose') {
    elements.navPropose.classList.add('active');
    elements.navManage.classList.remove('active');
    elements.proposeSection.classList.remove('hidden');
    elements.proposeControls.classList.remove('hidden');
    elements.manageSection.classList.add('hidden');
    elements.applyBtn.classList.remove('hidden');
    elements.refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Refresh Analysis';
    analyzeAndRender();
  } else {
    elements.navPropose.classList.remove('active');
    elements.navManage.classList.add('active');
    elements.proposeSection.classList.add('hidden');
    elements.proposeControls.classList.add('hidden');
    elements.manageSection.classList.remove('hidden');
    elements.applyBtn.classList.add('hidden');
    elements.refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Refresh Active';
    renderManagementView();
  }
}

/**
 * Apply custom rules from storage to the classifiers
 */
async function applyCustomRules() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['customDomainRules', 'customKeywordRules', 'categoryColors'],
      (result) => {
        // Apply custom category colors
        if (result.categoryColors) {
          for (const [category, color] of Object.entries(result.categoryColors)) {
            if (typeof addCategory === 'function') {
              addCategory(category, color, 'more'); // Default icon
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
        resolve();
      }
    );
  });
}

/**
 * Load settings from chrome.storage
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['groupingStrategy', 'autoCollapse'],
      (result) => {
        if (result.groupingStrategy) {
          elements.groupingStrategy.value = result.groupingStrategy;
        }
        if (result.autoCollapse !== undefined) {
          elements.autoCollapse.checked = result.autoCollapse;
        }
        resolve();
      }
    );
  });
}

/**
 * Save settings to chrome.storage
 */
async function saveSettings() {
  const settings = {
    groupingStrategy: elements.groupingStrategy.value,
    autoCollapse: elements.autoCollapse.checked
  };

  return new Promise((resolve) => {
    chrome.storage.local.set(settings, () => {
      // Re-analyze with new settings
      analyzeAndRender();
      resolve();
    });
  });
}

/**
 * Analyze tabs and render groups
 */
async function analyzeAndRender() {
  showLoading(true);

  try {
    // Get all tabs in current window
    allTabs = await new Promise((resolve) => {
      chrome.tabs.query({ currentWindow: true }, resolve);
    });

    if (allTabs.length === 0) {
      showNoTabsMessage();
      return;
    }

    // Analyze tabs based on strategy
    const strategy = elements.groupingStrategy.value;
    currentGroups = await analyzeTabsByStrategy(allTabs, strategy);

    // Render groups
    renderGroups(currentGroups);

    // Update tab count
    elements.tabCount.textContent = `${allTabs.length} tabs`;

  } catch (error) {
    console.error('Error analyzing tabs:', error);
    showStatus('Error analyzing tabs', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Analyze tabs by selected strategy
 */
async function analyzeTabsByStrategy(tabs, strategy) {
  const groups = {};

  // Get learned rules for enhanced classification
  let learnedRules = {};
  try {
    learnedRules = await getLearnedDomainRules();
  } catch (error) {
    console.warn('Could not load learned rules:', error);
  }

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    // Skip special URLs
    if (tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')) {
      continue;
    }

    let classification;

    // Check learned rules first (highest priority)
    try {
      const domain = new URL(tab.url).hostname;
      if (learnedRules[domain]) {
        classification = {
          ...learnedRules[domain],
          method: 'learned'
        };
      }
    } catch (e) {
      // Invalid URL, continue to other methods
    }

    // If not found in learned rules, use regular strategy
    if (!classification) {
      if (strategy === 'domain') {
        classification = classifyByDomain(tab.url) || {
          category: 'Other',
          color: 'grey',
          icon: 'more',
          method: 'default'
        };
      } else if (strategy === 'keywords') {
        classification = classifyByTitle(tab.title) || classifyByURLPattern(tab.url) || {
          category: 'Other',
          color: 'grey',
          icon: 'more',
          method: 'default'
        };
      } else {
        classification = classifyTab(tab, classifyByDomain);
      }
    }

    const category = classification.category;

    // Validate color using helper function
    const validatedColor = validateColor(classification.color, category);

    if (!groups[category]) {
      groups[category] = {
        category,
        color: validatedColor,
        icon: classification.icon,
        tabs: []
      };
    }

    groups[category].tabs.push(tab);
  }

  return groups;
}

/**
 * Render groups to the DOM
 */
function renderGroups(groups) {
  elements.groupsContainer.innerHTML = '';

  const groupEntries = Object.entries(groups);

  if (groupEntries.length === 0) {
    showNoTabsMessage();
    return;
  }

  elements.noTabsMessage.classList.add('hidden');

  // Sort groups by tab count (descending)
  groupEntries.sort((a, b) => b[1].tabs.length - a[1].tabs.length);

  // Get all unique categories for filter
  const categories = groupEntries.map(([categoryName]) => categoryName);
  updateCategoryFilter(categories);

  groupEntries.forEach(([categoryName, group]) => {
    const groupCard = createGroupCard(categoryName, group);
    elements.groupsContainer.appendChild(groupCard);
  });
}

/**
 * Create a group card element
 */
function createGroupCard(categoryName, group) {
  const card = document.createElement('div');
  card.className = 'group-card';
  card.dataset.category = categoryName;

  // Apply auto-collapse if enabled
  if (elements.autoCollapse.checked && group.tabs.length < 3) {
    card.classList.add('collapsed');
  }

  const color = colorMap[group.color] || colorMap['grey'];

  card.innerHTML = `
    <div class="group-header">
      <div class="group-color-indicator" style="background: ${color}"></div>
      <div class="group-info">
        <div class="group-name">${categoryName}</div>
        <div class="group-count">${group.tabs.length} tab${group.tabs.length !== 1 ? 's' : ''}</div>
      </div>
      <span class="expand-icon">▼</span>
    </div>
    <div class="group-tabs">
    </div>
  `;

  const header = card.querySelector('.group-header');
  header.addEventListener('click', () => toggleGroup(header));

  const tabsContainer = card.querySelector('.group-tabs');
  group.tabs.forEach(tab => {
    tabsContainer.appendChild(createTabItem(tab));
  });

  // Make tabs draggable
  setupDragAndDrop(card);

  return card;
}

/**
 * Create a tab item element
 */
function createTabItem(tab) {
  let domain = 'Unknown';
  try {
    if (tab.url && tab.url.includes('://')) {
      domain = new URL(tab.url).hostname;
    } else if (tab.url) {
      domain = tab.url;
    }
  } catch (e) {
    domain = 'Invalid URL';
  }

  const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(tab.url || '')}&size=32`;

  const item = document.createElement('div');
  item.className = 'tab-item';
  item.draggable = true;
  item.dataset.tabId = tab.id;

  item.innerHTML = `
    <img class="tab-favicon" src="${faviconUrl}">
    <span class="tab-title" title="${tab.title}">${tab.title}</span>
    <span class="tab-domain">${domain}</span>
    <div class="tab-actions">
      <span class="tab-action-btn pin-btn" title="${tab.pinned ? 'Unpin' : 'Pin'} tab">${tab.pinned ? '📍' : '📌'}</span>
      <span class="tab-action-btn duplicate-btn" title="Duplicate tab">📄</span>
      <span class="tab-action-btn move-window-btn" title="Move to new window">🪟</span>
      <span class="tab-action-btn close-btn" title="Close tab">🗑️</span>
    </div>
  `;

  const img = item.querySelector('.tab-favicon');
  img.addEventListener('error', () => {
    img.classList.add('placeholder');
    img.src = '../icons/icon16.png'; // Fallback icon
  });

  // Add event handlers for tab actions
  item.querySelector('.pin-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePinTab(tab.id, tab.pinned);
  });

  item.querySelector('.duplicate-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    duplicateTab(tab.id);
  });

  item.querySelector('.move-window-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    moveTabToWindow(tab.id);
  });

  item.querySelector('.close-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tab.id);
  });

  return item;
}

/**
 * Toggle group collapse state
 */
function toggleGroup(header) {
  const card = header.parentElement;
  card.classList.toggle('collapsed');
}

/**
 * Setup drag and drop for tabs
 */
function setupDragAndDrop(groupCard) {
  const tabItems = groupCard.querySelectorAll('.tab-item');

  tabItems.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      item.classList.add('dragging');
      e.dataTransfer.setData('text/plain', item.dataset.tabId);
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = groupCard.querySelector('.dragging');
      if (dragging && dragging !== item) {
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
          item.parentNode.insertBefore(dragging, item);
        } else {
          item.parentNode.insertBefore(dragging, item.nextSibling);
        }
      }
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      // Handle tab reordering if needed
    });
  });
}

/**
 * Apply the proposed groups
 */
async function applyGroups() {
  try {
    showLoading(true);
    showStatus('Creating tab groups...', 'info');

    const groupIds = {};

    // Get existing groups in current window to avoid duplicates
    const existingGroups = await new Promise((resolve) => {
      chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, resolve);
    });

    // Create or update groups for each category
    for (const [categoryName, group] of Object.entries(currentGroups)) {
      if (group.tabs.length === 0) continue;

      const tabIds = group.tabs.map(tab => tab.id);
      const matchingGroup = existingGroups.find(g => g.title === categoryName);

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
        // Create a new group
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
    }

    showStatus(`Successfully created/updated ${Object.keys(groupIds).length} group(s)!`, 'success');

    // Close popup after short delay
    setTimeout(() => {
      window.close();
    }, 1500);

  } catch (error) {
    console.error('Error creating groups:', error);
    showStatus('Error creating groups: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Open options page
 */
function openOptionsPage() {
  chrome.runtime.openOptionsPage();
}

/**
 * Show loading state
 */
function showLoading(show) {
  if (show) {
    elements.loading.classList.remove('hidden');
    elements.proposeSection.classList.add('hidden');
    elements.proposeControls.classList.add('hidden');
    elements.manageSection.classList.add('hidden');
  } else {
    elements.loading.classList.add('hidden');
    if (elements.navPropose.classList.contains('active')) {
      elements.proposeSection.classList.remove('hidden');
      elements.proposeControls.classList.remove('hidden');
    } else {
      elements.manageSection.classList.remove('hidden');
    }
  }
}

/**
 * Show no tabs message
 */
function showNoTabsMessage() {
  elements.groupsContainer.innerHTML = '';
  elements.noTabsMessage.classList.remove('hidden');
  elements.tabCount.textContent = '0 tabs';
  elements.applyBtn.disabled = true;
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = 'status-message ' + type;
  elements.statusMessage.classList.remove('hidden');

  // Auto-hide after 3 seconds
  setTimeout(() => {
    elements.statusMessage.classList.add('hidden');
  }, 3000);
}

/**
 * Render management view for current active groups and tabs
 */
async function renderManagementView() {
  showLoading(true);

  try {
    const [tabs, groups] = await Promise.all([
      new Promise(resolve => chrome.tabs.query({ currentWindow: true }, resolve)),
      new Promise(resolve => chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, resolve))
    ]);

    renderActiveGroups(groups, tabs);
    renderUngroupedTabs(tabs);

  } catch (error) {
    console.error('Error loading management view:', error);
    showStatus('Error loading groups', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Render active tab groups
 */
function renderActiveGroups(groups, tabs) {
  elements.activeGroupsContainer.innerHTML = '';

  if (groups.length === 0) {
    elements.noActiveGroupsMessage.classList.remove('hidden');
    return;
  }

  elements.noActiveGroupsMessage.classList.add('hidden');

  // Get all unique group names for filter
  const categories = groups.map(g => g.title || 'Untitled Group').filter((title, i, arr) => arr.indexOf(title) === i);
  updateCategoryFilter(categories);

  groups.forEach(group => {
    const groupTabs = tabs.filter(t => t.groupId === group.id);
    const groupCard = createManageGroupCard(group, groupTabs);
    elements.activeGroupsContainer.appendChild(groupCard);
  });
}

/**
 * Create a group card for management view
 */
function createManageGroupCard(group, tabs) {
  const card = document.createElement('div');
  card.className = 'group-card';
  card.dataset.groupId = group.id;
  const color = colorMap[group.color] || colorMap['grey'];

  card.innerHTML = `
    <div class="group-header">
      <div class="group-color-indicator" style="background: ${color}"></div>
      <div class="group-info">
        <div class="group-name">${group.title || 'Untitled Group'}</div>
        <div class="group-count">${tabs.length} tabs</div>
      </div>
      <div class="group-header-actions">
        <span class="group-action-btn merge-btn" title="Merge with another group">🔗</span>
        <span class="group-action-btn move-window-btn" title="Move to new window">🪟</span>
        <span class="group-action-btn close-all-btn" title="Close all tabs in group">🗑️</span>
        <span class="action-icon rename-btn" title="Rename Group">✏️</span>
        <span class="action-icon color-btn" title="Change Color">🎨</span>
        <span class="action-icon ungroup-btn" title="Ungroup All">🔓</span>
        <span class="expand-icon">▼</span>
      </div>
    </div>
    <div class="group-tabs"></div>
  `;

  const tabsContainer = card.querySelector('.group-tabs');
  tabs.forEach(tab => {
    tabsContainer.appendChild(createManageTabItem(tab));
  });

  // Event Listeners
  card.querySelector('.group-header').addEventListener('click', (e) => {
    if (!e.target.closest('.action-icon') && !e.target.closest('.group-action-btn')) {
      card.classList.toggle('collapsed');
    }
  });

  card.querySelector('.merge-btn').addEventListener('click', () => openMergeDialog(group.id, group.title));
  card.querySelector('.move-window-btn').addEventListener('click', () => moveGroupToWindow(group.id));
  card.querySelector('.close-all-btn').addEventListener('click', () => closeAllTabsInGroup(group.id, group.title));
  card.querySelector('.rename-btn').addEventListener('click', () => renameGroup(group.id, group.title));
  card.querySelector('.color-btn').addEventListener('click', () => cycleGroupColor(group.id, group.color));
  card.querySelector('.ungroup-btn').addEventListener('click', () => ungroupGroup(group.id));

  return card;
}

/**
 * Create a tab item for management view
 */
function createManageTabItem(tab) {
  const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(tab.url)}&size=32`;

  const item = document.createElement('div');
  item.className = 'manage-tab-item';
  item.innerHTML = `
    <img class="tab-favicon" src="${faviconUrl}">
    <div class="tab-info" title="${tab.title}">${tab.title}</div>
    <div class="tab-actions">
      <span class="action-icon jump-btn" title="Switch to Tab">🎯</span>
      <span class="tab-action-btn pin-btn" title="${tab.pinned ? 'Unpin' : 'Pin'} tab">${tab.pinned ? '📍' : '📌'}</span>
      <span class="tab-action-btn duplicate-btn" title="Duplicate tab">📄</span>
      <span class="tab-action-btn move-window-btn" title="Move to new window">🪟</span>
      <span class="action-icon remove-btn" title="Ungroup Tab">🔓</span>
      <span class="tab-action-btn close-btn" title="Close tab">🗑️</span>
    </div>
  `;

  item.querySelector('.jump-btn').addEventListener('click', () => {
    chrome.tabs.update(tab.id, { active: true });
  });

  item.querySelector('.remove-btn').addEventListener('click', () => {
    chrome.tabs.ungroup(tab.id, () => renderManagementView());
  });

  item.querySelector('.pin-btn').addEventListener('click', () => {
    togglePinTab(tab.id, tab.pinned);
  });

  item.querySelector('.duplicate-btn').addEventListener('click', () => {
    duplicateTab(tab.id);
  });

  item.querySelector('.move-window-btn').addEventListener('click', () => {
    moveTabToWindow(tab.id);
  });

  item.querySelector('.close-btn').addEventListener('click', () => {
    closeTab(tab.id);
  });

  const img = item.querySelector('.tab-favicon');
  img.addEventListener('error', () => {
    img.classList.add('placeholder');
    img.src = '../icons/icon16.png';
  });

  return item;
}

/**
 * Render tabs not in any group
 */
function renderUngroupedTabs(tabs) {
  elements.ungroupedTabsContainer.innerHTML = '';
  const ungrouped = tabs.filter(t => t.groupId === -1 || t.groupId === undefined);

  if (ungrouped.length === 0) {
    elements.ungroupedTabsContainer.innerHTML = '<div class="no-tabs-message">All tabs are grouped</div>';
    return;
  }

  ungrouped.forEach(tab => {
    elements.ungroupedTabsContainer.appendChild(createManageTabItem(tab));
  });
}

/**
 * Ungroup all tabs in the window
 */
async function ungroupAll() {
  if (!confirm('Are you sure you want to ungroup all tabs in this window?')) return;

  try {
    const tabs = await new Promise(resolve => chrome.tabs.query({ currentWindow: true }, resolve));
    const groupedTabIds = tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined).map(t => t.id);

    if (groupedTabIds.length === 0) return;

    await new Promise(resolve => chrome.tabs.ungroup(groupedTabIds, resolve));
    renderManagementView();
    showStatus('All tabs ungrouped', 'success');
  } catch (error) {
    showStatus('Error ungrouping tabs', 'error');
  }
}

/**
 * Ungroup a specific group
 */
async function ungroupGroup(groupId) {
  try {
    const tabs = await new Promise(resolve => chrome.tabs.query({ groupId }, resolve));
    const tabIds = tabs.map(t => t.id);
    await new Promise(resolve => chrome.tabs.ungroup(tabIds, resolve));
    renderManagementView();
    showStatus('Group dissolved', 'success');
  } catch (error) {
    showStatus('Error dissolving group', 'error');
  }
}

/**
 * Rename a group
 */
async function renameGroup(groupId, currentTitle) {
  const newTitle = prompt('Enter new group name:', currentTitle);
  if (newTitle === null) return;

  try {
    await chrome.tabGroups.update(groupId, { title: newTitle });
    renderManagementView();
  } catch (error) {
    showStatus('Error renaming group', 'error');
  }
}

/**
 * Cycle group color
 */
async function cycleGroupColor(groupId, currentColor) {
  const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  const currentIndex = colors.indexOf(currentColor);
  const nextColor = colors[(currentIndex + 1) % colors.length];

  try {
    await chrome.tabGroups.update(groupId, { color: nextColor });
    renderManagementView();
  } catch (error) {
    showStatus('Error changing color', 'error');
  }
}

/**
 * Toggle tab pin state
 */
async function togglePinTab(tabId, isPinned) {
  try {
    await chrome.tabs.update(tabId, { pinned: !isPinned });
    // Refresh current view
    if (elements.navPropose.classList.contains('active')) {
      await analyzeAndRender();
    } else {
      await renderManagementView();
    }
    showStatus(isPinned ? 'Tab unpinned' : 'Tab pinned', 'success');
  } catch (error) {
    showStatus('Error toggling pin', 'error');
  }
}

/**
 * Duplicate a tab
 */
async function duplicateTab(tabId) {
  try {
    await chrome.tabs.duplicate(tabId);
    showStatus('Tab duplicated', 'success');
    // Refresh after a short delay to let the duplicate create
    setTimeout(() => {
      if (elements.navPropose.classList.contains('active')) {
        analyzeAndRender();
      } else {
        renderManagementView();
      }
    }, 100);
  } catch (error) {
    showStatus('Error duplicating tab', 'error');
  }
}

/**
 * Move tab to new window
 */
async function moveTabToWindow(tabId) {
  try {
    await chrome.windows.create({ tabId: tabId });
    showStatus('Tab moved to new window', 'success');
    // Refresh after moving
    setTimeout(() => {
      if (elements.navPropose.classList.contains('active')) {
        analyzeAndRender();
      } else {
        renderManagementView();
      }
    }, 100);
  } catch (error) {
    showStatus('Error moving tab to window', 'error');
  }
}

/**
 * Close a tab
 */
async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    showStatus('Tab closed', 'success');
    // Refresh the view after closing
    setTimeout(() => {
      if (elements.navPropose.classList.contains('active')) {
        analyzeAndRender();
      } else {
        renderManagementView();
      }
    }, 100);
  } catch (error) {
    showStatus('Error closing tab', 'error');
  }
}

/**
 * Open merge dialog for groups
 */
async function openMergeDialog(groupId, groupTitle) {
  try {
    // Get all groups except the current one
    const groups = await new Promise(resolve => chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, resolve));
    const otherGroups = groups.filter(g => g.id !== groupId);

    if (otherGroups.length === 0) {
      showStatus('No other groups to merge with', 'error');
      return;
    }

    // Create options string for prompt
    const options = otherGroups.map((g, i) => `${i + 1}. ${g.title || 'Untitled Group'}`).join('\n');
    const selection = prompt(`Merge "${groupTitle}" with:\n${options}\n\nEnter the number of the group to merge with:`);

    if (selection === null) return;

    const selectedIndex = parseInt(selection) - 1;
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= otherGroups.length) {
      showStatus('Invalid selection', 'error');
      return;
    }

    const targetGroup = otherGroups[selectedIndex];

    // Confirm merge
    if (!confirm(`Merge "${groupTitle}" into "${targetGroup.title || 'Untitled Group'}"?`)) {
      return;
    }

    // Send merge request to background
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'mergeGroups', sourceGroupId: groupId, targetGroupId: targetGroup.id },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });

    if (response && response.success) {
      showStatus('Groups merged successfully', 'success');
      renderManagementView();
    } else {
      showStatus('Error merging groups', 'error');
    }
  } catch (error) {
    console.error('Error merging groups:', error);
    showStatus('Error merging groups', 'error');
  }
}

/**
 * Move group to new window
 */
async function moveGroupToWindow(groupId) {
  try {
    const tabs = await new Promise(resolve => chrome.tabs.query({ groupId }, resolve));

    if (tabs.length === 0) {
      showStatus('No tabs in group', 'error');
      return;
    }

    // Create new window with group tabs
    const tabIds = tabs.map(t => t.id);
    await new Promise((resolve, reject) => {
      chrome.windows.create({ tabId: tabIds[0] }, (window) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          // Move remaining tabs to the new window
          if (tabIds.length > 1) {
            chrome.tabs.move(tabIds.slice(1), { windowId: window.id, index: -1 }, () => {
              resolve(window);
            });
          } else {
            resolve(window);
          }
        }
      });
    });

    showStatus('Group moved to new window', 'success');
    renderManagementView();
  } catch (error) {
    console.error('Error moving group to window:', error);
    showStatus('Error moving group to window', 'error');
  }
}

/**
 * Close all tabs in a group
 */
async function closeAllTabsInGroup(groupId, groupTitle) {
  // Check for pinned tabs
  const tabs = await new Promise(resolve => chrome.tabs.query({ groupId }, resolve));
  const pinnedTabs = tabs.filter(t => t.pinned);

  let confirmMessage = `Close all ${tabs.length} tab(s) in "${groupTitle}"?`;
  if (pinnedTabs.length > 0) {
    confirmMessage += `\n\nWarning: ${pinnedTabs.length} pinned tab(s) will also be closed!`;
  }

  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    const tabIds = tabs.map(t => t.id);
    await chrome.tabs.remove(tabIds);
    showStatus(`Closed ${tabIds.length} tab(s)`, 'success');
    renderManagementView();
  } catch (error) {
    console.error('Error closing tabs:', error);
    showStatus('Error closing tabs', 'error');
  }
}

/**
 * Handle search input
 */
function handleSearch(e) {
  searchQuery = e.target.value.toLowerCase().trim();

  // Show/hide clear button
  if (searchQuery) {
    elements.clearSearchBtn.classList.remove('hidden');
  } else {
    elements.clearSearchBtn.classList.add('hidden');
  }

  applyFilters();
}

/**
 * Handle category filter change
 */
function handleCategoryFilter(e) {
  selectedCategory = e.target.value;
  applyFilters();
}

/**
 * Clear search
 */
function clearSearch() {
  searchQuery = '';
  elements.searchInput.value = '';
  elements.clearSearchBtn.classList.add('hidden');
  applyFilters();
}

/**
 * Apply search and category filters
 */
function applyFilters() {
  const isProposeView = elements.navPropose.classList.contains('active');

  if (isProposeView) {
    filterProposeView();
  } else {
    filterManageView();
  }
}

/**
 * Filter tabs in propose view
 */
function filterProposeView() {
  const groupCards = elements.groupsContainer.querySelectorAll('.group-card');
  let visibleTabCount = 0;
  let visibleGroupCount = 0;

  groupCards.forEach(card => {
    const categoryName = card.dataset.category || '';
    const tabItems = card.querySelectorAll('.tab-item');
    let visibleCount = 0;

    // Check category filter
    const categoryMatch = selectedCategory === 'all' || categoryName === selectedCategory;

    tabItems.forEach(item => {
      const tabTitle = item.querySelector('.tab-title')?.textContent.toLowerCase() || '';
      const tabDomain = item.querySelector('.tab-domain')?.textContent.toLowerCase() || '';

      // Check search filter
      const searchMatch = !searchQuery || tabTitle.includes(searchQuery) || tabDomain.includes(searchQuery);

      if (categoryMatch && searchMatch) {
        item.classList.remove('hidden');
        visibleCount++;
        visibleTabCount++;
        // Highlight matching text
        highlightText(item.querySelector('.tab-title'), searchQuery);
        highlightText(item.querySelector('.tab-domain'), searchQuery);
      } else {
        item.classList.add('hidden');
        removeHighlight(item.querySelector('.tab-title'));
        removeHighlight(item.querySelector('.tab-domain'));
      }
    });

    // Show/hide group based on whether it has visible tabs
    if (visibleCount > 0) {
      card.classList.remove('hidden');
      visibleGroupCount++;
    } else {
      card.classList.add('hidden');
    }
  });

  updateTabCount(visibleTabCount);
  showNoResultsMessage(visibleTabCount, visibleGroupCount);
}

/**
 * Filter tabs in manage view
 */
function filterManageView() {
  const groupCards = elements.activeGroupsContainer.querySelectorAll('.group-card');
  const ungroupedTabs = elements.ungroupedTabsContainer.querySelectorAll('.manage-tab-item');
  let visibleTabCount = 0;

  // Filter grouped tabs
  groupCards.forEach(card => {
    const groupName = card.querySelector('.group-name')?.textContent.toLowerCase() || '';
    const tabItems = card.querySelectorAll('.manage-tab-item');
    let visibleCount = 0;

    // Check category filter
    const categoryMatch = selectedCategory === 'all' || groupName.includes(selectedCategory.toLowerCase());

    tabItems.forEach(item => {
      const tabInfo = item.querySelector('.tab-info')?.textContent.toLowerCase() || '';

      // Check search filter
      const searchMatch = !searchQuery || tabInfo.includes(searchQuery);

      if (categoryMatch && searchMatch) {
        item.classList.remove('hidden');
        visibleCount++;
        visibleTabCount++;
        highlightText(item.querySelector('.tab-info'), searchQuery);
      } else {
        item.classList.add('hidden');
        removeHighlight(item.querySelector('.tab-info'));
      }
    });

    // Show/hide group based on whether it has visible tabs
    if (visibleCount > 0) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });

  // Filter ungrouped tabs
  let ungroupedVisibleCount = 0;
  ungroupedTabs.forEach(item => {
    const tabInfo = item.querySelector('.tab-info')?.textContent.toLowerCase() || '';

    // Ungrouped tabs only apply search filter (no category)
    const searchMatch = !searchQuery || tabInfo.includes(searchQuery);

    if (searchMatch) {
      item.classList.remove('hidden');
      ungroupedVisibleCount++;
      highlightText(item.querySelector('.tab-info'), searchQuery);
    } else {
      item.classList.add('hidden');
      removeHighlight(item.querySelector('.tab-info'));
    }
  });

  // Show/hide ungrouped section
  const ungroupedSection = document.querySelector('.ungrouped-section');
  if (ungroupedSection) {
    if (ungroupedVisibleCount > 0) {
      ungroupedSection.classList.remove('hidden');
    } else if (searchQuery || selectedCategory !== 'all') {
      ungroupedSection.classList.add('hidden');
    }
  }

  showNoResultsMessage(visibleTabCount, groupCards.length - [...groupCards].filter(c => c.classList.contains('hidden')).length);
}

/**
 * Highlight matching text in element
 */
function highlightText(element, query) {
  if (!query || !element) {
    return;
  }

  removeHighlight(element);
  const text = element.textContent;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  element.innerHTML = text.replace(regex, '<span class="search-highlight">$1</span>');
}

/**
 * Remove highlight from element
 */
function removeHighlight(element) {
  if (!element) return;
  element.innerHTML = element.textContent;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Show no results message
 */
function showNoResultsMessage(tabCount, groupCount) {
  const hasFilters = searchQuery || selectedCategory !== 'all';
  const existingMessage = document.querySelector('.no-results-message');

  // Remove existing message
  if (existingMessage) {
    existingMessage.remove();
  }

  // Show message only if filtering and no results
  if (hasFilters && tabCount === 0) {
    const message = document.createElement('div');
    message.className = 'no-results-message';
    message.innerHTML = `
      <div class="emoji">🔍</div>
      <div class="text">No tabs found matching your criteria</div>
    `;

    if (elements.navPropose.classList.contains('active')) {
      elements.groupsContainer.appendChild(message);
    } else {
      elements.activeGroupsContainer.appendChild(message);
    }
  }
}

/**
 * Update category filter options with available categories
 */
function updateCategoryFilter(categories) {
  // Save current selection
  const currentValue = elements.categoryFilter.value;

  // Clear existing options except "All Categories"
  elements.categoryFilter.innerHTML = '<option value="all">All Categories</option>';

  // Add new options
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    elements.categoryFilter.appendChild(option);
  });

  // Restore selection if it still exists
  if (categories.includes(currentValue) || currentValue === 'all') {
    elements.categoryFilter.value = currentValue;
  } else {
    elements.categoryFilter.value = 'all';
    selectedCategory = 'all';
  }
}

/**
 * Clean up tab groups from the bookmarks bar
 */
async function cleanBookmarksBarGroups() {
  if (!confirm('Are you sure you want to remove grouped tab bookmarks from your bookmarks bar? This will only remove bookmarks likely created by tab grouping.')) {
    return;
  }

  showStatus('Cleaning bookmarks...', 'info');
  let removedCount = 0;

  try {
    // 1. Try to use chrome.tabGroups.savedGroups if available (Chrome 122+)
    if (chrome.tabGroups && chrome.tabGroups.savedGroups) {
      try {
        const savedGroups = await new Promise((resolve) => {
          chrome.tabGroups.savedGroups.getAll(resolve);
        });
        
        console.log('[Clean] Found saved groups:', savedGroups);

        if (savedGroups && savedGroups.length > 0) {
          for (const group of savedGroups) {
            // Chrome API uses savedGuid, but we'll check for both id and savedGuid
            const idToRemove = group.savedGuid || group.id;
            if (idToRemove) {
              await new Promise((resolve) => {
                chrome.tabGroups.savedGroups.remove(idToRemove, resolve);
              });
              removedCount++;
            }
          }
        }
      } catch (e) {
        console.warn('SavedTabGroups API check failed:', e);
      }
    }

    // 2. Search bookmarks tree for any folders matching category names
    if (!chrome.bookmarks) {
      throw new Error('Bookmarks permission not granted. Please reload the extension in chrome://extensions');
    }

    const tree = await new Promise((resolve) => {
      chrome.bookmarks.getTree(resolve);
    });

    if (tree && tree.length > 0) {
      // Common categories + custom ones
      const defaultCategories = [
        'Development', 'Entertainment', 'Social', 'News', 'Finance', 
        'Sports', 'Shopping', 'Learning', 'Communication', 'Work', 'Other',
        'Saved Tab Groups' // Also search for the internal folder name
      ];
      
      const storage = await new Promise(r => chrome.storage.local.get(['categoryColors'], r));
      const customCategories = Object.keys(storage.categoryColors || {});
      const allCategories = [...new Set([...defaultCategories, ...customCategories])].map(c => c.toLowerCase());

      // Helper to recursively search and delete
      const processNodes = async (nodes) => {
        for (const node of nodes) {
          if (node.children) {
            // It's a folder
            if (allCategories.includes(node.title.toLowerCase())) {
              await new Promise((resolve) => {
                chrome.bookmarks.removeTree(node.id, resolve);
              });
              removedCount++;
            } else {
              // Recurse into subfolders
              await processNodes(node.children);
            }
          }
        }
      };

      await processNodes(tree);
    }

    showStatus(`Cleaned ${removedCount} items from bookmarks bar!`, 'success');
  } catch (error) {
    console.error('Error cleaning bookmarks:', error);
    showStatus('Error cleaning bookmarks: ' + error.message, 'error');
  }
}

/**
 * Update tab count display
 */
function updateTabCount(count) {
  if (elements.tabCount) {
    elements.tabCount.textContent = `${count} tab${count !== 1 ? 's' : ''}`;
  }
}
