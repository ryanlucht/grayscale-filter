// tests/unit/background.test.js
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  checkAndApplyFilterWithOverrides,
  handleTemporaryOverride,
  clearTemporaryOverride,
} from '../../background.js';

// Grab the listener callbacks background.js registered at import time,
// BEFORE tests/setup.js's beforeEach (jest.clearAllMocks()) wipes
// `mock.calls` on the very first test. These have to be captured once,
// at module-evaluation time, not inside a test/beforeEach.
function getListener(mockFn, matchArgsIndex = 0) {
  const call = mockFn.mock.calls[matchArgsIndex];
  return call ? call[0] : undefined;
}

const onInstalledListener = getListener(chrome.runtime.onInstalled.addListener);
const onStartupListener = getListener(chrome.runtime.onStartup.addListener);
const onUpdatedListener = getListener(chrome.tabs.onUpdated.addListener);
const onChangedListener = getListener(chrome.storage.onChanged.addListener);
const onMessageListener = getListener(chrome.runtime.onMessage.addListener);

describe('background.js alarm setup (C3 regression)', () => {
  test('does not create the cleanup alarm at module load time', () => {
    // background.js was already imported above (module top level ran once);
    // chrome.alarms.create must not have been called as a side effect of
    // that import - only onInstalled/onStartup should trigger it. This
    // guards against calling chrome.alarms.create() on every service-worker
    // wake, which would keep resetting the alarm's countdown.
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });

  test('creates the cleanup alarm when onInstalled fires', () => {
    expect(onInstalledListener).toBeInstanceOf(Function);

    onInstalledListener();

    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'cleanupExpiredOverrides',
      { periodInMinutes: 1 }
    );
  });

  test('creates the cleanup alarm when onStartup fires', () => {
    expect(onStartupListener).toBeInstanceOf(Function);

    onStartupListener();

    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'cleanupExpiredOverrides',
      { periodInMinutes: 1 }
    );
  });
});

describe('background.js checkAndApplyFilterWithOverrides (C4 regression)', () => {
  test('never writes to storage, even when it finds an expired override', async () => {
    chrome.storage.sync.get.mockResolvedValue({
      domains: [],
      temporaryOverrides: {
        'example.com': { state: 'grayscale', expiresAt: Date.now() - 1000 },
      },
    });

    await checkAndApplyFilterWithOverrides(1, 'https://example.com/');

    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    // Expired override falls back to the (empty) permanent list -> remove.
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      1,
      { action: 'remove', domain: 'example.com' },
      expect.any(Function)
    );
  });

  test('applies grayscale for a domain in the permanent list with no override', async () => {
    chrome.storage.sync.get.mockResolvedValue({
      domains: ['example.com'],
      temporaryOverrides: {},
    });

    await checkAndApplyFilterWithOverrides(2, 'https://example.com/');

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      2,
      { action: 'apply', domain: 'example.com' },
      expect.any(Function)
    );
  });

  test('ignores non-http(s) URLs', async () => {
    await checkAndApplyFilterWithOverrides(3, 'chrome://extensions/');
    expect(chrome.storage.sync.get).not.toHaveBeenCalled();
  });
});

describe('background.js tabs.onUpdated (C4 write-quota regression)', () => {
  test('only reacts to the "loading" status, not "complete"', () => {
    expect(onUpdatedListener).toBeInstanceOf(Function);

    chrome.storage.sync.get.mockResolvedValue({ domains: [], temporaryOverrides: {} });
    chrome.storage.sync.get.mockClear();

    onUpdatedListener(1, { status: 'complete' }, { url: 'https://example.com/' });
    expect(chrome.storage.sync.get).not.toHaveBeenCalled();

    onUpdatedListener(1, { status: 'loading' }, { url: 'https://example.com/' });
    expect(chrome.storage.sync.get).toHaveBeenCalled();
  });
});

describe('background.js handleTemporaryOverride / clearTemporaryOverride (C4 regression)', () => {
  beforeEach(() => {
    chrome.storage.sync.get.mockResolvedValue({ domains: [], temporaryOverrides: {} });
    chrome.storage.sync.set.mockResolvedValue(undefined);
  });

  test('handleTemporaryOverride does not manually loop over tabs (relies on storage.onChanged)', async () => {
    await handleTemporaryOverride('example.com', 'grayscale', 60000);
    expect(chrome.tabs.query).not.toHaveBeenCalled();
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1);
  });

  test('clearTemporaryOverride does not manually loop over tabs (relies on storage.onChanged)', async () => {
    await clearTemporaryOverride('example.com');
    expect(chrome.tabs.query).not.toHaveBeenCalled();
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1);
  });

  test('storage.onChanged listener fans a domains/temporaryOverrides change out to all tabs', () => {
    expect(onChangedListener).toBeInstanceOf(Function);

    chrome.tabs.query.mockImplementation((query, callback) => callback([{ id: 1, url: 'https://example.com/' }]));
    chrome.storage.sync.get.mockResolvedValue({ domains: [], temporaryOverrides: {} });

    onChangedListener({ temporaryOverrides: {} }, 'sync');

    expect(chrome.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
  });
});

describe('background.js write serialization (C5 regression)', () => {
  test('concurrent handleTemporaryOverride calls for different domains do not clobber each other', async () => {
    // Simulate a real (slightly delayed) storage backend so two
    // non-awaited calls can genuinely interleave if not serialized.
    let store = {};
    chrome.storage.sync.get.mockImplementation((keys) => (
      new Promise((resolve) => {
        setTimeout(() => {
          const result = {};
          keys.forEach((k) => {
            if (store[k] !== undefined) result[k] = store[k];
          });
          resolve(result);
        }, 5);
      })
    ));
    chrome.storage.sync.set.mockImplementation((obj) => (
      new Promise((resolve) => {
        setTimeout(() => {
          store = { ...store, ...obj };
          resolve();
        }, 5);
      })
    ));

    // Fire both without awaiting the first - a lost-update bug would have
    // both read the same empty temporaryOverrides and the second write
    // would clobber the first.
    const p1 = handleTemporaryOverride('a.com', 'grayscale', 60000);
    const p2 = handleTemporaryOverride('b.com', 'color', 60000);
    await Promise.all([p1, p2]);

    expect(Object.keys(store.temporaryOverrides || {}).sort()).toEqual(['a.com', 'b.com']);
  });
});

describe('background.js message handling cleanup', () => {
  test('the dead "updateAllTabs" action is no longer handled', () => {
    const sendResponse = jest.fn();

    const keepChannelOpen = onMessageListener({ action: 'updateAllTabs' }, {}, sendResponse);

    expect(keepChannelOpen).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
    expect(chrome.tabs.query).not.toHaveBeenCalled();
  });

  test('an unrecognized message action returns false instead of holding the port open', () => {
    const sendResponse = jest.fn();

    const keepChannelOpen = onMessageListener({ action: 'somethingUnknown' }, {}, sendResponse);

    expect(keepChannelOpen).toBe(false);
  });
});
