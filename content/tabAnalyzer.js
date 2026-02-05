// Keyword-based classification (SECONDARY METHOD)
const topicKeywords = {
  'Development': [
    'code', 'bug', 'api', 'commit', 'pr', 'repo', 'documentation',
    'programming', 'tutorial', 'stack overflow', 'github', 'gitlab',
    'function', 'class', 'method', 'variable', 'debug', 'compile',
    'framework', 'library', 'npm', 'yarn', 'python', 'javascript',
    'typescript', 'java', 'react', 'vue', 'angular', 'node'
  ],
  'Shopping': [
    'buy', 'cart', 'price', 'order', 'checkout', 'deal', 'discount',
    'sale', 'shop', 'store', 'purchase', 'product', 'add to cart',
    'shipping', 'delivery', 'coupon', 'promo', 'offer'
  ],
  'News': [
    'news', 'article', 'breaking', 'update', 'report', 'latest',
    'headline', 'story', 'press', 'announcement', 'wire'
  ],
  'Learning': [
    'tutorial', 'course', 'guide', 'how to', 'learn', 'lesson',
    'education', 'training', 'study', 'class', 'lecture', 'workshop'
  ],
  'Social': [
    'profile', 'post', 'message', 'friend', 'share', 'comment',
    'like', 'follow', 'subscribe', 'feed', 'timeline', 'notification'
  ],
  'Entertainment': [
    'watch', 'video', 'movie', 'tv', 'show', 'stream', 'play',
    'game', 'music', 'song', 'album', 'podcast', 'entertainment'
  ],
  'Finance': [
    'stock', 'market', 'trading', 'investment', 'portfolio', 'finance',
    'bank', 'credit', 'loan', 'crypto', 'bitcoin', 'currency'
  ],
  'Sports': [
    'score', 'game', 'match', 'team', 'player', 'football', 'basketball',
    'soccer', 'tennis', 'baseball', 'hockey', 'sport', 'championship'
  ]
};

/**
 * Classify a tab by its title using keyword matching
 * @param {string} title - The tab title
 * @returns {Object|null} - Category object or null if no match
 */
function classifyByTitle(title) {
  if (!title) return null;

  const lower = title.toLowerCase();

  // Count keyword matches for each category
  const scores = {};
  for (const [category, keywords] of Object.entries(topicKeywords)) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      scores[category] = matchCount;
    }
  }

  // Return category with most matches
  if (Object.keys(scores).length > 0) {
    const bestCategory = Object.entries(scores).reduce((a, b) =>
      a[1] > b[1] ? a : b
    )[0];
    return getCategoryInfo(bestCategory);
  }

  return null;
}

/**
 * Classify by URL patterns (fallback method)
 * @param {string} url - The tab URL
 * @returns {Object|null} - Category object or null if no match
 */
function classifyByURLPattern(url) {
  if (!url) return null;

  const lower = url.toLowerCase();

  // Common URL patterns
  const patterns = {
    'Development': [
      '/docs/', '/api/', '/reference', '/developer',
      '/repos/', '/pull/', '/issues/', '/commit',
      '.git', '/blob/', '/tree/', '/src/'
    ],
    'Shopping': [
      '/product/', '/buy/', '/shop/', '/cart',
      '/checkout', '/order/', '/item/', '/category'
    ],
    'Social': [
      '/profile/', '/user/', '/post/', '/status',
      '/tweet/', '/p/', '/pin/', '/video/'
    ],
    'Entertainment': [
      '/watch', '/video', '/play', '/stream',
      '/movie', '/show', '/episode'
    ],
    'Learning': [
      '/course/', '/lesson/', '/tutorial/', '/learn',
      '/lecture/', '/quiz/', '/exercise'
    ]
  };

  // Check pattern matches
  for (const [category, patternList] of Object.entries(patterns)) {
    for (const pattern of patternList) {
      if (lower.includes(pattern)) {
        return getCategoryInfo(category);
      }
    }
  }

  return null;
}

/**
 * Get category info (color and icon)
 * @param {string} category - Category name
 * @returns {Object} - Category object with color and icon
 */
function getCategoryInfo(category) {
  const categories = {
    'Development': { color: 'blue', icon: 'code' },
    'Entertainment': { color: 'orange', icon: 'play' },
    'Social': { color: 'pink', icon: 'people' },
    'News': { color: 'grey', icon: 'newspaper' },
    'Finance': { color: 'green', icon: 'trending' },
    'Sports': { color: 'purple', icon: 'sport' },
    'Shopping': { color: 'cyan', icon: 'cart' },
    'Learning': { color: 'yellow', icon: 'school' },
    'Communication': { color: 'red', icon: 'email' },
    'Work': { color: 'blue', icon: 'briefcase' },
    'Other': { color: 'grey', icon: 'more' }
  };

  return categories[category] || categories['Other'];
}

/**
 * Combined classification strategy
 * Priority: Domain → Title Keywords → URL Pattern → Other
 * @param {Object} tab - Chrome tab object
 * @param {Function} domainClassifier - classifyByDomain function
 * @returns {Object} - Classification result with category, color, icon
 */
function classifyTab(tab, domainClassifier) {
  // 1. Try domain first (fastest, most accurate)
  let result = domainClassifier(tab.url);
  if (result) {
    return { ...result, method: 'domain' };
  }

  // 2. Try title keywords (fallback)
  result = classifyByTitle(tab.title);
  if (result) {
    return { ...result, method: 'title' };
  }

  // 3. URL pattern matching (last resort)
  result = classifyByURLPattern(tab.url);
  if (result) {
    return { ...result, method: 'url-pattern' };
  }

  // 4. Default to Other
  return {
    category: 'Other',
    color: 'grey',
    icon: 'more',
    method: 'default'
  };
}

/**
 * Analyze all tabs and group them by category
 * @param {Array} tabs - Array of Chrome tab objects
 * @param {Function} domainClassifier - classifyByDomain function
 * @returns {Object} - Groups object with category as key and array of tabs as value
 */
function analyzeTabs(tabs, domainClassifier) {
  const groups = {};

  for (const tab of tabs) {
    // Skip chrome:// URLs and other special pages
    if (tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')) {
      continue;
    }

    const classification = classifyTab(tab, domainClassifier);
    const category = classification.category;

    if (!groups[category]) {
      groups[category] = {
        category,
        color: classification.color,
        icon: classification.icon,
        tabs: []
      };
    }

    groups[category].tabs.push({
      ...tab,
      classification
    });
  }

  return groups;
}

/**
 * Add custom keyword rule
 * @param {string} category - Category to add keyword to
 * @param {string} keyword - Keyword to add
 */
function addKeywordRule(category, keyword) {
  if (!topicKeywords[category]) {
    topicKeywords[category] = [];
  }
  if (!topicKeywords[category].includes(keyword)) {
    topicKeywords[category].push(keyword);
  }
}

/**
 * Remove keyword rule
 * @param {string} category - Category to remove keyword from
 * @param {string} keyword - Keyword to remove
 */
function removeKeywordRule(category, keyword) {
  if (topicKeywords[category]) {
    topicKeywords[category] = topicKeywords[category].filter(k => k !== keyword);
  }
}

/**
 * Get all keyword rules
 * @returns {Object} - Copy of topicKeywords object
 */
function getKeywordRules() {
  return JSON.parse(JSON.stringify(topicKeywords));
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    classifyByTitle,
    classifyByURLPattern,
    classifyTab,
    analyzeTabs,
    addKeywordRule,
    removeKeywordRule,
    getKeywordRules,
    topicKeywords
  };
}
