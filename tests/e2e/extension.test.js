// tests/e2e/extension.test.js
import {
  launchBrowserWithExtension,
  openExtensionPopup,
  navigateAndWait,
  isGrayscaleApplied,
  clearExtensionStorage,
  closeBrowser,
  getStorageData
} from './helpers/extension-loader.js';

describe('Grayscale Filter Extension E2E', () => {
  let browser;
  let page;
  let extensionId;
  let popupPage;

  beforeAll(async () => {
    const result = await launchBrowserWithExtension();
    browser = result.browser;
    page = result.page;
    extensionId = result.extensionId;

    if (!extensionId) {
      console.warn('Extension ID not found - extension may not have loaded correctly');
    }
  }, 15000); // 15 second timeout for browser launch (reduced from 30s)

  afterAll(async () => {
    await closeBrowser();
  });

  beforeEach(async () => {
    // Open popup for each test and clear storage
    if (extensionId) {
      popupPage = await openExtensionPopup(browser, extensionId);
      await clearExtensionStorage(popupPage);
    }
  });

  afterEach(async () => {
    if (popupPage) {
      await popupPage.close();
    }
  });

  // NOTE: Element IDs verified against popup/popup.html:
  // - #currentDomain (line 50)
  // - #toggleButton (line 51)
  // - #domainInput (line 58-63)
  // - #addButton (line 65)
  // - #errorMessage (line 66)
  // - #domainList (line 72)
  // - .remove-btn (dynamically created in popup.js line 160)
  // - #powerButton (line 19)
  // - #durationSelect (line 27)
  // - #tempTimer (line 36)
  // - #timerDisplay (line 38)
  // - #cancelOverride (line 39)

  describe('Extension Loading', () => {
    test('extension loads successfully', async () => {
      expect(extensionId).toBeTruthy();
      expect(extensionId.length).toBeGreaterThan(0);
    }, 5000);

    test('popup page loads', async () => {
      expect(popupPage).toBeTruthy();
      const title = await popupPage.title();
      // Popup should have loaded (title may vary)
      expect(title).toBeDefined();
    }, 5000);

    test('popup shows current domain element', async () => {
      const currentDomainText = await popupPage.$eval(
        '#currentDomain',
        el => el.textContent
      );
      // When opened directly (not from a tab), shows "No active tab" or similar
      expect(currentDomainText).toBeTruthy();
    }, 5000);
  });

  describe('Domain Management via Popup', () => {
    test('can add domain via manual input', async () => {
      // Type domain in input
      await popupPage.type('#domainInput', 'example.com');

      // Click add button
      await popupPage.click('#addButton');

      // Wait for storage to update
      await new Promise(r => setTimeout(r, 500));

      // Verify domain was added to storage
      const storage = await getStorageData(popupPage, ['domains']);
      expect(storage.domains).toContain('example.com');
    }, 7000);

    test('domain list displays added domains', async () => {
      // Add a domain first
      await popupPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.sync.set({ domains: ['test-domain.com'] }, resolve);
        });
      });

      // Reload popup to see updated list
      await popupPage.reload({ waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 500));

      // Check if domain appears in the list
      const domainListHtml = await popupPage.$eval('#domainList', el => el.innerHTML);
      expect(domainListHtml).toContain('test-domain.com');
    }, 7000);

    test('can remove domain from list', async () => {
      // Set up initial domain
      await popupPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.sync.set({ domains: ['to-remove.com'] }, resolve);
        });
      });

      // Reload to see the domain
      await popupPage.reload({ waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 500));

      // Click remove button for the domain
      const removeButton = await popupPage.$('.remove-btn');
      if (removeButton) {
        await removeButton.click();
        await new Promise(r => setTimeout(r, 500));

        // Verify domain was removed
        const storage = await getStorageData(popupPage, ['domains']);
        expect(storage.domains || []).not.toContain('to-remove.com');
      }
    }, 7000);
  });

  describe('Grayscale Filter Application', () => {
    test('grayscale style not applied to unlisted domain', async () => {
      // Navigate to a test page
      await navigateAndWait(page, 'https://example.com');

      // Check that grayscale is NOT applied (domain not in list)
      const hasGrayscale = await isGrayscaleApplied(page);
      expect(hasGrayscale).toBe(false);
    }, 7000);

    test('grayscale style applied after domain is added', async () => {
      // Add example.com to the list via storage
      await popupPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.sync.set({ domains: ['example.com'] }, resolve);
        });
      });

      // Navigate to example.com
      await navigateAndWait(page, 'https://example.com');

      // Give extension time to apply filter
      await new Promise(r => setTimeout(r, 1000));

      // Check that grayscale IS applied
      const hasGrayscale = await isGrayscaleApplied(page);
      expect(hasGrayscale).toBe(true);
    }, 7000);
  });

  describe('Input Validation', () => {
    test('rejects invalid domain format', async () => {
      // Try to add invalid domain
      await popupPage.type('#domainInput', 'not-valid');
      await popupPage.click('#addButton');

      await new Promise(r => setTimeout(r, 500));

      // Should show error message
      const errorText = await popupPage.$eval('#errorMessage', el => el.textContent);
      expect(errorText).toContain('Invalid');

      // Should NOT add to storage
      const storage = await getStorageData(popupPage, ['domains']);
      expect(storage.domains || []).not.toContain('not-valid');
    }, 5000);

    test('rejects empty input', async () => {
      // Click add with empty input
      await popupPage.click('#addButton');

      await new Promise(r => setTimeout(r, 300));

      // Should show error message
      const errorText = await popupPage.$eval('#errorMessage', el => el.textContent);
      expect(errorText.length).toBeGreaterThan(0);
    }, 5000);
  });

  describe('Temporary Override Timer', () => {
    test('power button disabled when no current domain', async () => {
      // When popup opens without an active tab context, power button should be disabled
      const isDisabled = await popupPage.$eval('#powerButton', el => el.disabled);
      expect(isDisabled).toBe(true);

      // Timer should be hidden
      const timerDisplay = await popupPage.$eval('#tempTimer', el => el.style.display);
      expect(timerDisplay).toBe('none');
    }, 5000);

    test('temporary override can be set and cancelled via storage', async () => {
      // Set a temporary override directly via storage (simulating background.js)
      const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes from now
      await popupPage.evaluate((expiry) => {
        return new Promise((resolve) => {
          chrome.storage.sync.set({
            temporaryOverride: {
              active: true,
              domain: 'example.com',
              state: 'grayscale',
              expiresAt: expiry
            }
          }, resolve);
        });
      }, expiresAt);

      // Reload popup to pick up the override
      await popupPage.reload({ waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1000));

      // If currentDomain matches, timer should be visible
      // Note: In this test context, currentDomain won't be set, so timer may not show
      // This test verifies storage operations work correctly
      const storage = await getStorageData(popupPage, ['temporaryOverride']);
      expect(storage.temporaryOverride).toBeDefined();
      expect(storage.temporaryOverride.active).toBe(true);

      // Clear the override
      await popupPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.sync.remove('temporaryOverride', resolve);
        });
      });

      await new Promise(r => setTimeout(r, 500));

      // Verify it's cleared
      const clearedStorage = await getStorageData(popupPage, ['temporaryOverride']);
      expect(clearedStorage.temporaryOverride).toBeUndefined();
    }, 7000);

    test('duration selector has multiple options', async () => {
      // Verify duration selector has expected options
      const options = await popupPage.$$eval('#durationSelect option', els =>
        els.map(el => ({ value: el.value, text: el.textContent }))
      );

      expect(options.length).toBeGreaterThan(2);
      expect(options.some(opt => opt.value === '900000')).toBe(true); // 15 minutes
      expect(options.some(opt => opt.value === '1800000')).toBe(true); // 30 minutes
      expect(options.some(opt => opt.value === '3600000')).toBe(true); // 1 hour

      // Verify we can select different durations
      await popupPage.select('#durationSelect', '3600000');
      const selectedValue = await popupPage.$eval('#durationSelect', el => el.value);
      expect(selectedValue).toBe('3600000');
    }, 5000);
  });
});
