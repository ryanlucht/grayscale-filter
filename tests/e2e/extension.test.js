// tests/e2e/extension.test.js
import {
  launchBrowserWithExtension,
  openExtensionPopup,
  syncPopupToActiveTab,
  navigateAndWait,
  isGrayscaleApplied,
  clearExtensionStorage,
  closeBrowser,
  getStorageData,
  startTestServer,
  closeTestServer
} from './helpers/extension-loader.js';

describe('Grayscale Filter Extension E2E', () => {
  let browser;
  let page;
  let extensionId;
  let popupPage;
  let testPageUrl;
  let testDomain;

  beforeAll(async () => {
    testPageUrl = await startTestServer();
    testDomain = new URL(testPageUrl).hostname;
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
    await closeTestServer();
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
  // - #timerDisplay (line 36)
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
      expect(removeButton).toBeTruthy();
      await removeButton.click();
      await new Promise(r => setTimeout(r, 500));

      // Verify domain was removed
      const storage = await getStorageData(popupPage, ['domains']);
      expect(storage.domains || []).not.toContain('to-remove.com');
    }, 7000);
  });

  describe('Grayscale Filter Application', () => {
    test('grayscale style not applied to unlisted domain', async () => {
      // Navigate to a test page
      await navigateAndWait(page, testPageUrl);

      // Check that grayscale is NOT applied (domain not in list)
      const hasGrayscale = await isGrayscaleApplied(page);
      expect(hasGrayscale).toBe(false);
    }, 7000);

    test('grayscale style applied after domain is added', async () => {
      // Add the fixture domain to the list via storage
      await popupPage.evaluate((domain) => {
        return new Promise((resolve) => {
          chrome.storage.sync.set({ domains: [domain] }, resolve);
        });
      }, testDomain);

      await navigateAndWait(page, testPageUrl);

      // Give extension time to apply filter
      await new Promise(r => setTimeout(r, 1000));

      // Check that grayscale IS applied
      const hasGrayscale = await isGrayscaleApplied(page);
      expect(hasGrayscale).toBe(true);
    }, 7000);

    test('current-site toggle updates storage and the active page', async () => {
      await navigateAndWait(page, testPageUrl);
      await syncPopupToActiveTab(popupPage, page);

      const currentDomain = await popupPage.$eval('#currentDomain', (element) => element.textContent);
      expect(currentDomain).toBe(testDomain);

      await popupPage.$eval('#toggleButton', (element) => element.click());
      await page.waitForFunction(() =>
        document.getElementById('grayscale-filter-extension') !== null
      );
      await popupPage.waitForFunction(() =>
        document.getElementById('toggleText')?.textContent === 'Remove from grayscale'
      );
      expect((await getStorageData(popupPage, ['domains'])).domains).toContain(testDomain);

      await popupPage.$eval('#toggleButton', (element) => element.click());
      await page.waitForFunction(() =>
        document.getElementById('grayscale-filter-extension') === null
      );
      await popupPage.waitForFunction(() =>
        document.getElementById('toggleText')?.textContent === 'Add to grayscale'
      );
      expect((await getStorageData(popupPage, ['domains'])).domains || []).not.toContain(testDomain);
    }, 10000);
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
      // The re-skinned #addButton is disabled while the input is empty
      // (design: disabled={!draft.trim()}), so a click on it is a no-op.
      const isDisabled = await popupPage.$eval('#addButton', el => el.disabled);
      expect(isDisabled).toBe(true);

      // The Enter-key path isn't gated by the disabled button, and still
      // has to surface handleManualAdd's own empty-input guard.
      await popupPage.focus('#domainInput');
      await popupPage.keyboard.press('Enter');

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

      // Timer should be hidden (override banner contains timer)
      const bannerDisplay = await popupPage.$eval('#overrideBanner', el => el.style.display);
      expect(bannerDisplay).toBe('none');
    }, 5000);

    test('temporary override is set, rendered, applied, and cancelled through the popup', async () => {
      await navigateAndWait(page, testPageUrl);
      await syncPopupToActiveTab(popupPage, page);
      await popupPage.select('#durationSelect', '1800000');
      await popupPage.$eval('#powerButton', (element) => element.click());

      await page.waitForFunction(() =>
        document.getElementById('grayscale-filter-extension') !== null
      );
      await popupPage.waitForFunction(() =>
        document.getElementById('overrideBanner')?.style.display === 'flex'
      );
      expect(await isGrayscaleApplied(page)).toBe(true);

      const bannerDisplay = await popupPage.$eval('#overrideBanner', (element) => element.style.display);
      const timerText = await popupPage.$eval('#timerDisplay', (element) => element.textContent);
      expect(bannerDisplay).toBe('flex');
      expect(timerText).toMatch(/^\d{1,2}:\d{2}$/);

      const storage = await getStorageData(popupPage, ['temporaryOverrides']);
      expect(storage.temporaryOverrides[testDomain]).toEqual(
        expect.objectContaining({ state: 'grayscale', durationMs: 30 * 60 * 1000 })
      );

      const getResponse = await popupPage.evaluate((domain) => chrome.runtime.sendMessage({
        action: 'getTemporaryOverride',
        domain
      }), testDomain);
      expect(getResponse).toEqual(expect.objectContaining({
        success: true,
        active: true,
        state: 'grayscale',
        durationMs: 30 * 60 * 1000
      }));

      await popupPage.$eval('#cancelOverride', (element) => element.click());

      await page.waitForFunction(() =>
        document.getElementById('grayscale-filter-extension') === null
      );
      await popupPage.waitForFunction(() =>
        document.getElementById('overrideBanner')?.style.display === 'none'
      );
      expect(await popupPage.$eval('#overrideBanner', (element) => element.style.display)).toBe('none');
      const clearedStorage = await getStorageData(popupPage, ['temporaryOverrides']);
      expect(clearedStorage.temporaryOverrides || {}).not.toHaveProperty(testDomain);
    }, 10000);

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
