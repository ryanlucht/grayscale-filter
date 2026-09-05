// tests/unit/content.test.js
// content.js is a classic (non-module) script, so it can't be `import`ed
// like the other production files. We load its source into a Node `vm`
// context with minimal DOM/chrome stubs, which lets top-level `function`
// declarations (getCurrentDomain, shouldApplyGrayscaleFilter,
// checkAndApplyGrayscale, ...) attach to the sandbox as callable globals.
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_JS_PATH = path.resolve(__dirname, '../../content.js');
const CONTENT_JS_SOURCE = fs.readFileSync(CONTENT_JS_PATH, 'utf8');

function createFakeStyleElement() {
  return {
    tagName: 'STYLE',
    id: '',
    textContent: '',
  };
}

function createFakeDocument() {
  const elementsById = new Map();
  let removed = null;

  return {
    getElementById: (id) => elementsById.get(id) || null,
    createElement: () => {
      const el = createFakeStyleElement();
      el.remove = () => {
        elementsById.delete(el.id);
        removed = el.id;
      };
      return el;
    },
    head: {
      appendChild: (el) => {
        elementsById.set(el.id, el);
      },
    },
    addEventListener: () => {},
    _elementsById: elementsById,
    _wasRemoved: () => removed,
  };
}

function createSandbox({ href = 'https://example.com/', storageResult = {} } = {}) {
  const sandbox = {
    URL,
    window: {
      location: { href },
    },
    document: createFakeDocument(),
    chrome: {
      runtime: {
        id: 'test-extension-id',
        lastError: null,
        onMessage: { addListener: jest.fn() },
      },
      storage: {
        sync: {
          get: jest.fn((keys, callback) => callback(storageResult)),
        },
      },
    },
    console,
  };
  sandbox.globalThis = sandbox;
  return sandbox;
}

function loadContentScript(options) {
  const sandbox = createSandbox(options);
  const context = vm.createContext(sandbox);
  // Pass `filename` so V8's coverage provider attributes executed lines
  // back to the real content.js file instead of reporting 0% coverage for
  // an anonymous vm script.
  const script = new vm.Script(CONTENT_JS_SOURCE, { filename: CONTENT_JS_PATH });
  script.runInContext(context);
  return { sandbox, context };
}

describe('content.js getCurrentDomain', () => {
  test('extracts and normalizes the domain from window.location', () => {
    const { sandbox } = loadContentScript({ href: 'https://www.Example.COM/page' });
    expect(sandbox.getCurrentDomain()).toBe('example.com');
  });

  test('returns null for non-http(s) URLs (matches utils/domain.js:extractDomain)', () => {
    const { sandbox } = loadContentScript({ href: 'chrome://extensions/' });
    expect(sandbox.getCurrentDomain()).toBe(null);
  });

  test('returns null for a malformed URL', () => {
    const { sandbox } = loadContentScript({ href: 'not-a-url' });
    expect(sandbox.getCurrentDomain()).toBe(null);
  });
});

describe('content.js shouldApplyGrayscaleFilter (inlined copy of utils/filter.js)', () => {
  let sandbox;
  beforeEach(() => {
    ({ sandbox } = loadContentScript());
  });

  test('applies when domain is in the permanent list and no override exists', () => {
    expect(sandbox.shouldApplyGrayscaleFilter('example.com', ['example.com'], {})).toBe(true);
  });

  test('does not apply when domain is absent and no override exists', () => {
    expect(sandbox.shouldApplyGrayscaleFilter('example.com', [], {})).toBe(false);
  });

  test('an active grayscale override applies even when not in the permanent list', () => {
    const overrides = { 'example.com': { state: 'grayscale', expiresAt: Date.now() + 60000 } };
    expect(sandbox.shouldApplyGrayscaleFilter('example.com', [], overrides)).toBe(true);
  });

  test('an active color override suppresses grayscale even when in the permanent list', () => {
    const overrides = { 'example.com': { state: 'color', expiresAt: Date.now() + 60000 } };
    expect(sandbox.shouldApplyGrayscaleFilter('example.com', ['example.com'], overrides)).toBe(false);
  });

  test('an expired override falls back to the permanent list', () => {
    const overrides = { 'example.com': { state: 'color', expiresAt: Date.now() - 1000 } };
    expect(sandbox.shouldApplyGrayscaleFilter('example.com', ['example.com'], overrides)).toBe(true);
  });
});

describe('content.js checkAndApplyGrayscale (C2 regression)', () => {
  test('an active color override on a listed domain is respected (previously ignored)', () => {
    // Regression for C2: checkAndApplyGrayscale used to read only `domains`,
    // so re-running it (e.g. on visibilitychange) would re-apply grayscale
    // to a listed domain even while a "color" override was active.
    const overrides = { 'example.com': { state: 'color', expiresAt: Date.now() + 60000 } };
    const { sandbox } = loadContentScript({
      href: 'https://example.com/',
      storageResult: { domains: ['example.com'], temporaryOverrides: overrides },
    });

    sandbox.checkAndApplyGrayscale();

    expect(sandbox.document.getElementById('grayscale-filter-extension')).toBe(null);
  });

  test('an active grayscale override on an unlisted domain is respected', () => {
    const overrides = { 'other.com': { state: 'grayscale', expiresAt: Date.now() + 60000 } };
    const { sandbox } = loadContentScript({
      href: 'https://other.com/',
      storageResult: { domains: [], temporaryOverrides: overrides },
    });

    sandbox.checkAndApplyGrayscale();

    expect(sandbox.document.getElementById('grayscale-filter-extension')).not.toBe(null);
  });

  test('falls back to the permanent list when there is no override', () => {
    const { sandbox } = loadContentScript({
      href: 'https://example.com/',
      storageResult: { domains: ['example.com'], temporaryOverrides: {} },
    });

    sandbox.checkAndApplyGrayscale();

    expect(sandbox.document.getElementById('grayscale-filter-extension')).not.toBe(null);
  });

  test('removes an existing filter when the domain is no longer covered', () => {
    const { sandbox } = loadContentScript({
      href: 'https://example.com/',
      storageResult: { domains: ['example.com'], temporaryOverrides: {} },
    });

    // Apply once, then simulate the domain being removed from the list.
    sandbox.checkAndApplyGrayscale();
    expect(sandbox.document.getElementById('grayscale-filter-extension')).not.toBe(null);

    sandbox.chrome.storage.sync.get = jest.fn((keys, callback) =>
      callback({ domains: [], temporaryOverrides: {} })
    );
    sandbox.checkAndApplyGrayscale();

    expect(sandbox.document.getElementById('grayscale-filter-extension')).toBe(null);
  });
});
