// Global state
let currentGroups = {};
let allTabs = [];

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
  previewSection: document.getElementById('preview-section'),
  groupsContainer: document.getElementById('groups-container'),
  tabCount: document.getElementById('tab-count'),
  noTabsMessage: document.getElementById('no-tabs-message'),
  refreshBtn: document.getElementById('refresh-btn'),
  editRulesBtn: document.getElementById('edit-rules-btn'),
  applyBtn: document.getElementById('apply-btn'),
  groupingStrategy: document.getElementById('grouping-strategy'),
  autoCollapse: document.getElementById('auto-collapse'),
  statusMessage: document.getElementById('status-message')
};

// Initialize popup
document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
  // Load saved settings
  await loadSettings();

  // Set up event listeners
  elements.refreshBtn.addEventListener('click', analyzeAndRender);
  elements.editRulesBtn.addEventListener('click', openOptionsPage);
  elements.applyBtn.addEventListener('click', applyGroups);
  elements.groupingStrategy.addEventListener('change', saveSettings);
  elements.autoCollapse.addEventListener('change', saveSettings);

  // Initial analysis
  await analyzeAndRender();
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
  const domain = new URL(tab.url).hostname;
  const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(tab.url)}&size=32`;

  const item = document.createElement('div');
  item.className = 'tab-item';
  item.draggable = true;
  item.dataset.tabId = tab.id;

  item.innerHTML = `
    <img class="tab-favicon" src="${faviconUrl}">
    <span class="tab-title" title="${tab.title}">${tab.title}</span>
    <span class="tab-domain">${domain}</span>
  `;

  const img = item.querySelector('.tab-favicon');
  img.addEventListener('error', () => {
    img.classList.add('placeholder');
    img.src = '../icons/icon16.png'; // Fallback icon
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

    // Create groups for each category
    for (const [categoryName, group] of Object.entries(currentGroups)) {
      if (group.tabs.length === 0) continue;

      const tabIds = group.tabs.map(tab => tab.id);

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
    }

    showStatus(`Successfully created ${Object.keys(groupIds).length} group(s)!`, 'success');

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
    elements.previewSection.classList.add('hidden');
  } else {
    elements.loading.classList.add('hidden');
    elements.previewSection.classList.remove('hidden');
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
