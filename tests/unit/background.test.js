// tests/unit/background.test.js
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  checkAndApplyFilterWithOverrides,
  handleTemporaryOverride,
  clearTemporaryOverride,
  setDomainEnabled,
  refreshAllTabsFromStorage,
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

  test('ignores a stale tab check that finishes after a newer one', async () => {
    let resolveFirstRead;
    chrome.storage.sync.get
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirstRead = resolve;
      }))
      .mockResolvedValueOnce({ domains: ['example.com'], temporaryOverrides: {} });

    const staleCheck = checkAndApplyFilterWithOverrides(4, 'https://example.com/');
    const currentCheck = checkAndApplyFilterWithOverrides(4, 'https://example.com/');
    await currentCheck;
    resolveFirstRead({ domains: [], temporaryOverrides: {} });
    await staleCheck;

    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      4,
      { action: 'apply', domain: 'example.com' },
      expect.any(Function)
    );
  });
});

describe('background.js full-tab refresh ordering', () => {
  test('an older refresh cannot publish after a newer storage change', async () => {
    let resolveFirstRead;
    let resolveFirstTabs;
    chrome.storage.sync.get
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirstRead = resolve;
      }))
      .mockResolvedValueOnce({ domains: ['example.com'], temporaryOverrides: {} });
    chrome.tabs.query
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirstTabs = resolve;
      }))
      .mockResolvedValueOnce([{ id: 5, url: 'https://example.com/' }]);

    const staleRefresh = refreshAllTabsFromStorage();
    const currentRefresh = refreshAllTabsFromStorage();
    await currentRefresh;
    resolveFirstRead({ domains: [], temporaryOverrides: {} });
    resolveFirstTabs([{ id: 5, url: 'https://example.com/' }]);
    await staleRefresh;

    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      5,
      { action: 'apply', domain: 'example.com' },
      expect.any(Function)
    );
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

  test('storage.onChanged reads storage once and fans the snapshot out to all tabs', async () => {
    expect(onChangedListener).toBeInstanceOf(Function);

    chrome.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://example.com/' },
      { id: 2, url: 'https://other.com/' }
    ]);
    chrome.storage.sync.get.mockResolvedValue({
      domains: ['example.com'],
      temporaryOverrides: {}
    });

    onChangedListener({ temporaryOverrides: {} }, 'sync');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chrome.tabs.query).toHaveBeenCalledWith({});
    expect(chrome.storage.sync.get).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });
});

describe('background.js write serialization (C5 regression)', () => {
  function installDelayedStorage(initialStore = {}) {
    let store = { ...initialStore };
    chrome.storage.sync.get.mockImplementation((keys) => (
      new Promise((resolve) => {
        setTimeout(() => {
          const result = {};
          keys.forEach((key) => {
            if (store[key] !== undefined) result[key] = store[key];
          });
          resolve(result);
        }, 5);
      })
    ));
    chrome.storage.sync.set.mockImplementation((object) => (
      new Promise((resolve) => {
        setTimeout(() => {
          store = { ...store, ...object };
          resolve();
        }, 5);
      })
    ));
    return () => store;
  }

  test('concurrent handleTemporaryOverride calls for different domains do not clobber each other', async () => {
    const getStore = installDelayedStorage();

    // Fire both without awaiting the first - a lost-update bug would have
    // both read the same empty temporaryOverrides and the second write
    // would clobber the first.
    const p1 = handleTemporaryOverride('a.com', 'grayscale', 60000);
    const p2 = handleTemporaryOverride('b.com', 'color', 60000);
    await Promise.all([p1, p2]);

    expect(Object.keys(getStore().temporaryOverrides || {}).sort()).toEqual(['a.com', 'b.com']);
  });

  test('concurrent domain additions preserve both domains', async () => {
    const getStore = installDelayedStorage({ domains: [] });

    await Promise.all([
      setDomainEnabled('a.com', true),
      setDomainEnabled('b.com', true)
    ]);

    expect(getStore().domains).toEqual(['a.com', 'b.com']);
  });

  test('concurrent domain removals do not reintroduce either domain', async () => {
    const getStore = installDelayedStorage({ domains: ['a.com', 'b.com', 'keep.com'] });

    await Promise.all([
      setDomainEnabled('a.com', false),
      setDomainEnabled('b.com', false)
    ]);

    expect(getStore().domains).toEqual(['keep.com']);
  });

  test('an already-enabled domain is a no-op', async () => {
    chrome.storage.sync.get.mockResolvedValue({ domains: ['example.com'] });

    const domains = await setDomainEnabled('example.com', true);

    expect(domains).toEqual(['example.com']);
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });
});

describe('background.js durationMs on temporary overrides (popup progress-bar support)', () => {
  // The popup renders remaining/total as a tick-progress bar, so the stored
  // override record needs a "total" to divide by. Helper to let a
  // chrome.storage.sync.get().then()-based async handler run to completion.
  async function flushMicrotasks() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    chrome.storage.sync.get.mockResolvedValue({ domains: [], temporaryOverrides: {} });
    chrome.storage.sync.set.mockResolvedValue(undefined);
  });

  test('handleTemporaryOverride stores durationMs alongside the override', async () => {
    await handleTemporaryOverride('example.com', 'grayscale', 60000);

    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      temporaryOverrides: {
        'example.com': expect.objectContaining({ durationMs: 60000 })
      }
    });
  });

  test('getTemporaryOverride response includes durationMs when the stored record has it', async () => {
    const sendResponse = jest.fn();
    chrome.storage.sync.get.mockResolvedValue({
      temporaryOverrides: {
        'example.com': {
          state: 'grayscale',
          expiresAt: Date.now() + 60000,
          originallyInList: false,
          durationMs: 60000
        }
      }
    });

    const keepChannelOpen = onMessageListener(
      { action: 'getTemporaryOverride', domain: 'example.com' },
      {},
      sendResponse
    );
    expect(keepChannelOpen).toBe(true);

    await flushMicrotasks();

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, active: true, durationMs: 60000 })
    );
  });

  test('getTemporaryOverride response has an undefined durationMs for an override written before the field existed (upgrade path)', async () => {
    const sendResponse = jest.fn();
    // Simulates a record already sitting in chrome.storage.sync from a
    // previous version of the extension, before durationMs was added.
    chrome.storage.sync.get.mockResolvedValue({
      temporaryOverrides: {
        'example.com': {
          state: 'grayscale',
          expiresAt: Date.now() + 60000,
          originallyInList: false
        }
      }
    });

    onMessageListener(
      { action: 'getTemporaryOverride', domain: 'example.com' },
      {},
      sendResponse
    );

    await flushMicrotasks();

    expect(sendResponse).toHaveBeenCalledTimes(1);
    const response = sendResponse.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.active).toBe(true);
    expect(response.durationMs).toBeUndefined();
  });

  test('getTemporaryOverride reports a storage read failure explicitly', async () => {
    const sendResponse = jest.fn();
    chrome.storage.sync.get.mockRejectedValue(new Error('sync unavailable'));

    onMessageListener(
      { action: 'getTemporaryOverride', domain: 'example.com' },
      {},
      sendResponse
    );

    await flushMicrotasks();

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      active: false,
      error: 'sync unavailable'
    });
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
