// Category definitions with colors and icons
var categories = typeof categories !== 'undefined' ? categories : {
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

// Domain → Category mapping (one category can have multiple domains)
var domainRules = {
  // Development
  'github.com': 'Development',
  'stackoverflow.com': 'Development',
  'gitlab.com': 'Development',
  'dev.to': 'Development',
  'codesandbox.io': 'Development',
  'codepen.io': 'Development',
  'replit.com': 'Development',
  'npmjs.com': 'Development',
  'yarnpkg.com': 'Development',
  'mdn.io': 'Development',
  'developer.mozilla.org': 'Development',
  'typescriptlang.org': 'Development',
  'python.org': 'Development',
  'w3schools.com': 'Development',

  // Entertainment
  'youtube.com': 'Entertainment',
  'netflix.com': 'Entertainment',
  'twitch.tv': 'Entertainment',
  'hulu.com': 'Entertainment',
  'disney.com': 'Entertainment',
  'hbo.com': 'Entertainment',
  'spotify.com': 'Entertainment',
  'soundcloud.com': 'Entertainment',
  'nhaccuatui.com': 'Entertainment',
  'zingmp3.vn': 'Entertainment',
  'fptplay.vn': 'Entertainment',
  'vieon.vn': 'Entertainment',

  // Social
  'facebook.com': 'Social',
  'twitter.com': 'Social',
  'instagram.com': 'Social',
  'linkedin.com': 'Social',
  'tiktok.com': 'Social',
  'reddit.com': 'Social',
  'pinterest.com': 'Social',
  'snapchat.com': 'Social',
  'whatsapp.com': 'Social',
  'telegram.org': 'Social',
  'discord.com': 'Social',
  'zalo.me': 'Social',
  'gapo.vn': 'Social',
  'lotus.vn': 'Social',

  // News (many domains in same category)
  'cnn.com': 'News',
  'bbc.com': 'News',
  'nytimes.com': 'News',
  'washingtonpost.com': 'News',
  'theguardian.com': 'News',
  'wsj.com': 'News',
  'bloomberg.com': 'News',
  'reuters.com': 'News',
  'apnews.com': 'News',
  'vox.com': 'News',
  'vice.com': 'News',
  'theverge.com': 'News',
  'techcrunch.com': 'News',
  'arstechnica.com': 'News',

  // Vietnamese News
  'vnexpress.net': 'News',
  'tuoitre.vn': 'News',
  'thanhnien.vn': 'News',
  'vietnamnet.vn': 'News',
  'dantri.com.vn': 'News',
  'kinhtedothi.vn': 'News',
  'nld.com.vn': 'News',
  'kenh14.vn': 'News',
  'znews.vn': 'News',
  'zingnews.vn': 'News',
  '24h.com.vn': 'News',
  'vtv.vn': 'News',
  'laodong.vn': 'News',
  'soha.vn': 'News',
  'cafef.vn': 'News',
  'cafebiz.vn': 'News',

  // Finance
  'finance.yahoo.com': 'Finance',
  'investing.com': 'Finance',
  'marketwatch.com': 'Finance',
  'morningstar.com': 'Finance',
  'coinbase.com': 'Finance',
  'binance.com': 'Finance',
  'coinmarketcap.com': 'Finance',
  'tradingview.com': 'Finance',
  'seekingalpha.com': 'Finance',
  'yahoofinance.com': 'Finance',
  'momo.vn': 'Finance',
  'vnpay.vn': 'Finance',
  'zalopay.vn': 'Finance',
  'ssi.com.vn': 'Finance',
  'hsc.com.vn': 'Finance',

  // Sports
  'espn.com': 'Sports',
  'foxsports.com': 'Sports',
  'skysports.com': 'Sports',
  'nbcsports.com': 'Sports',
  'bleacherreport.com': 'Sports',
  'fifa.com': 'Sports',
  'nba.com': 'Sports',
  'nfl.com': 'Sports',
  'mlb.com': 'Sports',
  'nhl.com': 'Sports',
  'bongdaplus.vn': 'Sports',
  'thethao247.vn': 'Sports',
  'bongda.com.vn': 'Sports',

  // Shopping
  'amazon.com': 'Shopping',
  'amazon.com.au': 'Shopping',
  'amazon.co.uk': 'Shopping',
  'amazon.ca': 'Shopping',
  'ebay.com': 'Shopping',
  'etsy.com': 'Shopping',
  'walmart.com': 'Shopping',
  'target.com': 'Shopping',
  'bestbuy.com': 'Shopping',
  'aliexpress.com': 'Shopping',

  // Vietnamese Shopping
  'shopee.vn': 'Shopping',
  'lazada.vn': 'Shopping',
  'lazada.com.vn': 'Shopping',
  'tiki.vn': 'Shopping',
  'sendo.vn': 'Shopping',
  'thegioididong.com': 'Shopping',
  'fptshop.com.vn': 'Shopping',
  'dienmayxanh.com': 'Shopping',
  'cellphones.com.vn': 'Shopping',
  'bachhoaxanh.com': 'Shopping',
  'concung.com': 'Shopping',
  'kidsplaza.vn': 'Shopping',

  // Learning
  'coursera.org': 'Learning',
  'udemy.com': 'Learning',
  'khanacademy.org': 'Learning',
  'edx.org': 'Learning',
  'pluralsight.com': 'Learning',
  'skillshare.com': 'Learning',
  'codecademy.com': 'Learning',
  'freecodecamp.org': 'Learning',
  'duolingo.com': 'Learning',
  'brilliant.org': 'Learning',
  'hocmai.vn': 'Learning',
  'unica.vn': 'Learning',
  'edumall.vn': 'Learning',
  'tienganh123.com': 'Learning',

  // Email & Communication
  'gmail.com': 'Communication',
  'mail.google.com': 'Communication',
  'outlook.com': 'Communication',
  'outlook.office.com': 'Communication',
  'outlook.office365.com': 'Communication',
  'hotmail.com': 'Communication',
  'live.com': 'Communication',
  'yahoo.com': 'Communication',
  'mail.yahoo.com': 'Communication',
  'protonmail.com': 'Communication',
  'tutanota.com': 'Communication',
  'icloud.com': 'Communication',
  'aol.com': 'Communication',
  'mail.com': 'Communication',
  'zoho.com': 'Communication',
  'mailchimp.com': 'Communication',
  'sendgrid.com': 'Communication',
  'sparkpost.com': 'Communication',

  // Office & Productivity (Google Workspace, Microsoft 365, etc.)
  'docs.google.com': 'Work',
  'sheets.google.com': 'Work',
  'slides.google.com': 'Work',
  'drive.google.com': 'Work',
  'calendar.google.com': 'Work',
  'keep.google.com': 'Work',
  'notes.google.com': 'Work',
  'tasks.google.com': 'Work',
  'classroom.google.com': 'Work',
  'meet.google.com': 'Work',
  'forms.google.com': 'Work',

  'office.com': 'Work',
  'office365.com': 'Work',
  'onedrive.live.com': 'Work',
  'onedrive.com': 'Work',
  'sharepoint.com': 'Work',
  'microsoft365.com': 'Work',
  'teams.microsoft.com': 'Work',
  'powerbi.microsoft.com': 'Work',
  'powerautomate.microsoft.com': 'Work',
  'powerapps.microsoft.com': 'Work',
  'azure.microsoft.com': 'Work',
  'portal.azure.com': 'Work',
  'aws.amazon.com': 'Work',
  'console.aws.amazon.com': 'Work',
  'cloud.google.com': 'Work',
  'firebase.google.com': 'Work',
  'heroku.com': 'Work',
  'vercel.com': 'Work',
  'netlify.com': 'Work',

  // Project Management & Collaboration
  'trello.com': 'Work',
  'asana.com': 'Work',
  'monday.com': 'Work',
  'notion.so': 'Work',
  'notion.site': 'Work',
  'airtable.com': 'Work',
  'slack.com': 'Work',
  'zoom.us': 'Work',
  'teams.live.com': 'Work',
  'webex.com': 'Work',
  'jira.com': 'Work',
  'atlassian.com': 'Work',
  'confluence.com': 'Work',
  'bitbucket.org': 'Work',
  'basecamp.com': 'Work',
  'clickup.com': 'Work',
  'linear.app': 'Work',
  'figma.com': 'Work',
  'canva.com': 'Work',
  'miro.com': 'Work',
  'lucidchart.com': 'Work',
  'dropbox.com': 'Work',
  'box.com': 'Work'
};

/**
 * Classify a tab by its domain
 * @param {string} url - The tab URL
 * @returns {Object|null} - Category object with color and icon, or null if no match
 */
function classifyByDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check for exact domain match
    if (domainRules[hostname]) {
      const category = domainRules[hostname];
      return { category, ...categories[category] };
    }

    // Check for subdomain matches (e.g., www.github.com, mail.google.com)
    const parts = hostname.split('.');
    for (let i = 0; i < parts.length; i++) {
      const possibleDomain = parts.slice(i).join('.');
      if (domainRules[possibleDomain]) {
        const category = domainRules[possibleDomain];
        return { category, ...categories[category] };
      }
    }

    return null;
  } catch (e) {
    console.error('Error parsing URL:', url, e);
    return null;
  }
}

/**
 * Get all domain rules
 * @returns {Object} - Copy of domainRules object
 */
function getDomainRules() {
  return { ...domainRules };
}

/**
 * Add a custom domain rule
 * @param {string} domain - Domain to add
 * @param {string} category - Category to assign
 */
function addDomainRule(domain, category) {
  domainRules[domain] = category;
}

/**
 * Add a new category
 * @param {string} name - Category name
 * @param {string} color - Category color
 * @param {string} icon - Category icon name
 */
function addCategory(name, color, icon) {
  categories[name] = { color, icon };
}

/**
 * Remove a domain rule
 * @param {string} domain - Domain to remove
 */
function removeDomainRule(domain) {
  delete domainRules[domain];
}

/**
 * Get all categories
 * @returns {Object} - Copy of categories object
 */
function getCategories() {
  return { ...categories };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    classifyByDomain,
    getDomainRules,
    addDomainRule,
    removeDomainRule,
    addCategory,
    getCategories,
    categories,
    domainRules
  };
}
