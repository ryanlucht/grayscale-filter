// tests/e2e/helpers/extension-loader.js
import puppeteer from 'puppeteer';
import http from 'node:http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the extension root (3 levels up from helpers folder)
const EXTENSION_PATH = path.resolve(__dirname, '../../..');

let browser = null;
let testServer = null;

/**
 * Start a deterministic local page for filter tests so E2E verification does
 * not depend on external DNS or network availability.
 * @returns {Promise<string>} Test page URL
 */
export async function startTestServer() {
  testServer = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><head><title>Filter fixture</title></head><body><main>Color fixture</main></body></html>');
  });

  await new Promise((resolve, reject) => {
    testServer.once('error', reject);
    testServer.listen(0, '127.0.0.1', resolve);
  });
  const address = testServer.address();
  return `http://127.0.0.1:${address.port}`;
}

/** Close the local E2E fixture server. */
export async function closeTestServer() {
  if (!testServer) return;
  await new Promise((resolve, reject) => {
    testServer.close((error) => error ? reject(error) : resolve());
  });
  testServer = null;
}

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
 * Reload the popup while a website tab is active. DevTools can keep the
 * popup document open as a test page while Chrome's active-tab query still
 * resolves to the target website, closely matching an action-popup open.
 * @param {Page} popupPage - Extension popup test page
 * @param {Page} targetPage - Website tab that should be considered active
 */
export async function syncPopupToActiveTab(popupPage, targetPage) {
  await targetPage.bringToFront();
  await popupPage.reload({ waitUntil: 'domcontentloaded' });
  await popupPage.waitForFunction(() => {
    const currentDomain = document.getElementById('currentDomain');
    return currentDomain && currentDomain.textContent !== 'Loading…';
  });
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
