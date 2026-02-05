// tests/e2e/helpers/extension-loader.js
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the extension root (3 levels up from helpers folder)
const EXTENSION_PATH = path.resolve(__dirname, '../../..');

let browser = null;

/**
 * Launch Chrome with the extension loaded
 * @returns {Promise<{browser: Browser, page: Page, extensionId: string}>}
 */
export async function launchBrowserWithExtension() {
  browser = await puppeteer.launch({
    headless: 'new', // Use new headless mode
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  // Get a new page
  const page = await browser.newPage();

  // Wait a bit for extension to initialize
  await new Promise(r => setTimeout(r, 1000));

  // Get the extension ID by looking at service workers
  const targets = await browser.targets();
  const extensionTarget = targets.find(
    target => target.type() === 'service_worker' &&
              target.url().includes('chrome-extension://')
  );

  let extensionId = null;
  if (extensionTarget) {
    const url = extensionTarget.url();
    extensionId = url.split('/')[2];
  }

  return { browser, page, extensionId };
}

/**
 * Open the extension popup in a new page
 * @param {Browser} browser - Puppeteer browser instance
 * @param {string} extensionId - Extension ID
 * @returns {Promise<Page>} - Page with popup loaded
 */
export async function openExtensionPopup(browser, extensionId) {
  const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
  const popupPage = await browser.newPage();
  await popupPage.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  return popupPage;
}

/**
 * Navigate to a test page and wait for extension to initialize
 * @param {Page} page - Puppeteer page
 * @param {string} url - URL to navigate to
 */
export async function navigateAndWait(page, url) {
  await page.goto(url, { waitUntil: 'networkidle0' });
  // Give extension time to inject content script
  await new Promise(r => setTimeout(r, 500));
}

/**
 * Check if grayscale filter is applied to a page
 * @param {Page} page - Puppeteer page
 * @returns {Promise<boolean>}
 */
export async function isGrayscaleApplied(page) {
  return await page.evaluate(() => {
    const style = document.getElementById('grayscale-filter-extension');
    return style !== null;
  });
}

/**
 * Clear extension storage (for test isolation)
 * @param {Page} popupPage - Extension popup page
 */
export async function clearExtensionStorage(popupPage) {
  await popupPage.evaluate(() => {
    return new Promise((resolve) => {
      chrome.storage.sync.clear(() => resolve());
    });
  });
}

/**
 * Close the browser
 */
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Get extension storage data
 * @param {Page} popupPage - Extension popup page
 * @param {string[]} keys - Storage keys to retrieve
 * @returns {Promise<Object>}
 */
export async function getStorageData(popupPage, keys) {
  return await popupPage.evaluate((storageKeys) => {
    return new Promise((resolve) => {
      chrome.storage.sync.get(storageKeys, (result) => resolve(result));
    });
  }, keys);
}
