import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Debug Test Suite for Auto-Grouping Functionality
 *
 * This test systematically:
 * 1. Loads the Chrome extension
 * 2. Enables auto-grouping
 * 3. Opens test tabs
 * 4. Captures service worker logs
 * 5. Verifies group creation
 */

test.describe('Auto-Grouping Debug Tests', () => {
  let extensionId: string;
  let serviceWorkerContext: any;

  test.beforeAll(async ({ request }) => {
    // Note: We'll get extension ID from the first test
    console.log('Starting auto-grouping debug tests...');
  });

  test('setup - get extension ID and enable auto-grouping', async ({ page, context }) => {
    // Navigate to extensions page to get the extension ID
    await page.goto('chrome://extensions/');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Get all extension IDs
    const extensions = await page.evaluate(() => {
      const items = document.querySelectorAll('extensions-item');
      return Array.from(items).map(item => ({
        id: item.getAttribute('id'),
        name: item.querySelector('#name')?.textContent,
      }));
    });

    console.log('Installed extensions:', extensions);

    // Find our extension
    const smartTabGroups = extensions.find((ext: any) =>
      ext.name && ext.name.includes('Smart Tab Groups')
    );

    expect(smartTabGroups, 'Extension should be installed').toBeTruthy();
    extensionId = smartTabGroups.id.replace('extension-', '');

    console.log('Extension ID:', extensionId);

    // Enable developer mode and ensure extension is loaded
    await page.evaluate(() => {
      const devModeToggle = document.querySelector('cr-toggle#dev-mode') as any;
      if (!devModeToggle.checked) {
        devModeToggle.click();
      }
    });

    // Get service worker (background script)
    const targets = await context.serviceWorkers();
    console.log('Service workers found:', targets.length);

    if (targets.length > 0) {
      serviceWorkerContext = targets[0];
    }
  });

  test('open extension popup and enable auto-grouping', async ({ page }) => {
    // Open the extension popup
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    // Wait for popup to load
    await page.waitForTimeout(1000);

    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/popup-initial.png' });

    // Navigate to settings
    const settingsButton = page.locator('#edit-rules-btn');
    await settingsButton.click();
    await page.waitForTimeout(1000);

    // Enable auto-grouping if not already enabled
    await page.screenshot({ path: 'test-results/settings-page.png' });

    // Note: Auto-grouping settings might be in the options page
    // For now, let's try to set it via storage directly
  });

  test('set auto-grouping settings via storage API', async ({ context }) => {
    // Create a new page to interact with extension's storage
    const page = await context.newPage();

    // Navigate to extension page to access chrome.storage API
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    // Set auto-grouping settings
    await page.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.storage.local.set(
          {
            autoGroupNewTabs: true,
            autoGroupDelay: 2000, // 2 seconds for faster testing
            groupingStrategy: 'mixed',
          },
          () => resolve(true)
        );
      });
    });

    console.log('Auto-grouping enabled: 2 second delay');

    // Verify settings were saved
    const settings = await page.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.storage.local.get(
          ['autoGroupNewTabs', 'autoGroupDelay'],
          (result) => resolve(result)
        );
      });
    });

    console.log('Current settings:', settings);
    expect(settings.autoGroupNewTabs).toBe(true);
    expect(settings.autoGroupDelay).toBe(2000);

    await page.close();
  });

  test('open GitHub tab and wait for auto-grouping', async ({ context, page }) => {
    console.log('Test: Opening GitHub tab...');

    // Open GitHub
    await page.goto('https://github.com');
    await page.waitForLoadState('networkidle');

    console.log('GitHub loaded, waiting for auto-grouping (3 seconds)...');

    // Wait longer than autoGroupDelay
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({
      path: 'test-results/github-after-autogroup.png',
      fullPage: true
    });

    // Check if tab was grouped by evaluating the tab's groupId
    const tabInfo = await page.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            resolve({
              id: tabs[0].id,
              title: tabs[0].title,
              url: tabs[0].url,
              groupId: tabs[0].groupId,
            });
          }
        });
      });
    });

    console.log('Tab info after auto-grouping:', tabInfo);

    // Check if tab was grouped (groupId should not be -1)
    if (tabInfo.groupId && tabInfo.groupId !== -1) {
      console.log('✓ Tab was grouped! Group ID:', tabInfo.groupId);

      // Get group details
      const groupInfo = await page.evaluate(async (groupId) => {
        return new Promise((resolve) => {
          chrome.tabGroups.get(groupId, (group) => {
            resolve({
              id: group.id,
              title: group.title,
              color: group.color,
            });
          });
        });
      }, tabInfo.groupId);

      console.log('Group info:', groupInfo);

      // Check for unnamed group
      if (!groupInfo.title || groupInfo.title === '' || groupInfo.title === 'Untitled Group') {
        console.error('❌ BUG FOUND: Group has no title or is "Untitled Group"!');
        console.error('Group details:', groupInfo);
      } else {
        console.log('✓ Group has proper title:', groupInfo.title);
      }
    } else {
      console.warn('⚠️ Tab was not grouped (groupId is -1 or undefined)');
    }
  });

  test('check service worker logs for errors', async ({ context, page }) => {
    console.log('Test: Checking service worker logs...');

    // Navigate to service worker URL
    await page.goto('chrome://extensions/');

    // Click on service worker link to open DevTools
    // Note: This is tricky with Playwright, so we'll use an alternative approach

    // Create a test page that will capture console messages
    const testPage = await context.newPage();
    await testPage.goto(`chrome-extension://${extensionId}/test-capture-logs.html`);

    // The test page will try to communicate with the service worker
    const logs = await testPage.evaluate(async () => {
      // Send message to background to get recent logs
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'getDebugLogs' },
          (response) => {
            resolve(response || { error: 'No response' });
          }
        );
      });
    });

    console.log('Service worker logs:', logs);

    // Alternative: Check if we can access console through extensions page
    await page.goto('chrome://extensions/');

    const serviceWorkerLogs = await page.evaluate(() => {
      // Try to find and click service worker link
      const swLink = document.querySelector('a[href*="service-worker"]');
      if (swLink) {
        return { found: true, href: swLink.getAttribute('href') };
      }
      return { found: false };
    });

    console.log('Service worker link info:', serviceWorkerLogs);
  });

  test('open multiple tabs and test group assignment', async ({ context, page }) => {
    console.log('Test: Opening multiple tabs...');

    const testUrls = [
      { url: 'https://github.com', expectedCategory: 'Development' },
      { url: 'https://stackoverflow.com', expectedCategory: 'Development' },
      { url: 'https://youtube.com', expectedCategory: 'Entertainment' },
    ];

    const pages = [page];

    // Open additional tabs
    for (let i = 1; i < testUrls.length; i++) {
      const newPage = await context.newPage();
      await newPage.goto(testUrls[i].url);
      pages.push(newPage);
    }

    // Wait for auto-grouping to happen
    console.log('Waiting 3 seconds for auto-grouping...');
    await page.waitForTimeout(3000);

    // Check each tab's group
    for (let i = 0; i < pages.length; i++) {
      const tabInfo = await pages[i].evaluate(async () => {
        return new Promise((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              resolve({
                id: tabs[0].id,
                title: tabs[0].title,
                url: tabs[0].url,
                groupId: tabs[0].groupId,
              });
            }
          });
        });
      });

      console.log(`Tab ${i + 1} (${testUrls[i].url}):`, tabInfo);

      if (tabInfo.groupId && tabInfo.groupId !== -1) {
        const groupInfo = await pages[i].evaluate(async (groupId) => {
          return new Promise((resolve) => {
            chrome.tabGroups.get(groupId, (group) => {
              resolve({
                id: group.id,
                title: group.title,
                color: group.color,
              });
            });
          });
        }, tabInfo.groupId);

        console.log(`  → Group:`, groupInfo);
        console.log(`  → Expected: ${testUrls[i].expectedCategory}`);

        // Verify group title
        if (groupInfo.title === testUrls[i].expectedCategory) {
          console.log(`  ✓ PASS: Correct category`);
        } else if (!groupInfo.title || groupInfo.title === 'Untitled Group') {
          console.error(`  ❌ FAIL: Group is unnamed or has default title`);
        } else {
          console.warn(`  ⚠️ WARNING: Wrong category (expected "${testUrls[i].expectedCategory}", got "${groupInfo.title}")`);
        }
      } else {
        console.warn(`  ⚠️ Tab was not grouped`);
      }
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/multiple-tabs-final.png' });
  });

  test('manual group creation via popup', async ({ page }) => {
    console.log('Test: Manual group creation...');

    // Close all existing tabs first
    await page.goto('about:blank');

    // Open test tabs
    const testPage = await page.context().newPage();
    await testPage.goto('https://github.com');
    await page.waitForTimeout(1000);

    await testPage.goto('https://stackoverflow.com');
    await page.waitForTimeout(1000);

    // Open extension popup
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await page.waitForTimeout(1000);

    // Take screenshot of proposed groups
    await page.screenshot({ path: 'test-results/popup-proposed-groups.png' });

    // Click "Apply Proposals" button
    const applyButton = page.locator('#apply-btn');
    await applyButton.click();

    // Wait for groups to be created
    await page.waitForTimeout(2000);

    // Check if groups were created
    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, (groups) => {
          resolve({
            count: groups.length,
            groups: groups.map(g => ({
              id: g.id,
              title: g.title,
              color: g.color,
            })),
          });
        });
      });
    });

    console.log('Groups created manually:', result);

    // Verify no unnamed groups
    const unnamedGroups = result.groups.filter((g: any) =>
      !g.title || g.title === '' || g.title === 'Untitled Group'
    );

    if (unnamedGroups.length > 0) {
      console.error('❌ BUG FOUND: Unnamed groups created:', unnamedGroups);
    } else {
      console.log('✓ All groups have proper names');
    }

    await page.screenshot({ path: 'test-results/manual-groups-result.png' });
  });
});
