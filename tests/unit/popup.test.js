// tests/unit/popup.test.js
// popup.js is an ES module, but its DOM-wiring runs inside a
// DOMContentLoaded handler and its internal state is module-private. We
// dynamically import it after stubbing minimal `document`/`window` globals
// (so importing it doesn't throw), then drive its exported functions
// directly via the `__testHooks` escape hatch it exposes for tests.
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

function createFakeElement() {
  const classes = new Set();
  const attrs = {};
  return {
    textContent: '',
    innerHTML: '',
    style: {},
    disabled: false,
    hidden: false,
    className: '',
    value: '',
    appendChild: () => {},
    addEventListener: () => {},
    setAttribute: (name, value) => { attrs[name] = value; },
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, force) => {
        const shouldHave = force === undefined ? !classes.has(c) : force;
        if (shouldHave) classes.add(c); else classes.delete(c);
        return shouldHave;
      },
      contains: (c) => classes.has(c),
    },
  };
}

function makeDomRefs() {
  return {
    currentDomainEl: createFakeElement(),
    toggleButton: createFakeElement(),
    toggleText: createFakeElement(),
    domainInput: createFakeElement(),
    addButton: createFakeElement(),
    domainList: createFakeElement(),
    emptyState: createFakeElement(),
    errorMessage: createFakeElement(),
    overrideBanner: createFakeElement(),
    overrideStatusText: createFakeElement(),
    powerButton: createFakeElement(),
    durationSelect: { value: '900000', disabled: false },
    cancelOverride: createFakeElement(),
    timerDisplay: createFakeElement(),
    overrideProgress: createFakeElement(),
    currentSiteAside: createFakeElement(),
    currentSiteDot: createFakeElement(),
    overrideAside: createFakeElement(),
    domainCountAside: createFakeElement(),
    revisionLabel: createFakeElement(),
  };
}

let popup;

beforeAll(async () => {
  // popup.js registers a DOMContentLoaded/unload listener at import time -
  // these stubs just need to exist, they're never invoked by these tests.
  global.document = { addEventListener: jest.fn(), createElement: () => createFakeElement() };
  global.window = { addEventListener: jest.fn() };
  popup = await import('../../popup/popup.js');
});

beforeEach(() => {
  jest.clearAllMocks();
  popup.stopTimerUpdate();
});

afterEach(() => {
  popup.stopTimerUpdate();
  // showMessage() arms a real 3s setTimeout in the describe blocks that don't
  // install fake timers; without this the handle outlives the run and Jest
  // warns that it "did not exit".
  try {
    popup.clearMessage();
  } catch {
    // #errorMessage ref not installed for this test - nothing pending.
  }
  jest.useRealTimers();
});

describe('popup.js timer lifecycle (C1 regression)', () => {
  let refs;

  beforeEach(() => {
    jest.useFakeTimers();
    refs = makeDomRefs();
    popup.__testHooks.setDomRefs(refs);
    popup.__testHooks.setState({
      currentDomain: 'example.com',
      domains: [],
      currentTabId: 1,
      temporaryOverride: null,
    });
  });

  test('updateTimerDisplay returns false and does not throw when there is no override', () => {
    expect(() => popup.updateTimerDisplay()).not.toThrow();
    expect(popup.updateTimerDisplay()).toBe(false);
  });

  test('interval tick after expiry does not throw (regression for null deref on temporaryOverride.expiresAt)', () => {
    global.chrome.runtime.sendMessage.mockResolvedValue({ active: false });
    popup.__testHooks.setState({
      temporaryOverride: { active: true, state: 'grayscale', expiresAt: Date.now() + 1000 },
    });

    popup.startTimerUpdate();

    // Old code: updateTimerDisplay() set temporaryOverride = null when
    // expired, then the interval callback immediately read
    // temporaryOverride.expiresAt -> TypeError, once per second forever.
    expect(() => {
      jest.advanceTimersByTime(1500);
    }).not.toThrow();
  });

  test('the interval stops once the override expires instead of ticking forever', async () => {
    global.chrome.runtime.sendMessage.mockResolvedValue({ active: false });
    popup.__testHooks.setState({
      temporaryOverride: { active: true, state: 'grayscale', expiresAt: Date.now() + 1000 },
    });

    popup.startTimerUpdate();
    expect(popup.__testHooks.getState().timerInterval).not.toBe(null);

    jest.advanceTimersByTime(1500);
    expect(popup.__testHooks.getState().timerInterval).toBe(null);
  });

  test('updateTemporaryUI does not start the interval when there is no active override', () => {
    popup.__testHooks.setState({ temporaryOverride: null });
    popup.updateTemporaryUI();
    expect(popup.__testHooks.getState().timerInterval).toBe(null);
  });

  test('updateTemporaryUI starts the interval when an override is active', () => {
    popup.__testHooks.setState({
      temporaryOverride: { active: true, state: 'color', expiresAt: Date.now() + 60000 },
    });
    popup.updateTemporaryUI();
    expect(popup.__testHooks.getState().timerInterval).not.toBe(null);
  });

  test('updateTemporaryUI stops a running interval once the override clears', () => {
    popup.__testHooks.setState({
      temporaryOverride: { active: true, state: 'color', expiresAt: Date.now() + 60000 },
    });
    popup.updateTemporaryUI();
    expect(popup.__testHooks.getState().timerInterval).not.toBe(null);

    popup.__testHooks.setState({ temporaryOverride: null });
    popup.updateTemporaryUI();
    expect(popup.__testHooks.getState().timerInterval).toBe(null);
  });
});

describe('popup.js #errorMessage messaging (C7 regression)', () => {
  let refs;

  beforeEach(() => {
    jest.useFakeTimers();
    refs = makeDomRefs();
    popup.__testHooks.setDomRefs(refs);
  });

  test('a later error is not blanked early by an earlier success message timeout', () => {
    popup.showSuccessMessage('grayscale', 900000);
    jest.advanceTimersByTime(1000);

    popup.showError('Invalid domain format');
    // Total 3.5s since the success message started (would have auto-cleared
    // at 3s under the old two-independent-timeouts code).
    jest.advanceTimersByTime(2500);

    expect(refs.errorMessage.textContent).toBe('Invalid domain format');
  });

  test('clearMessage cancels a pending timeout so it never fires later', () => {
    popup.showError('Please enter a domain');
    popup.clearMessage();
    expect(refs.errorMessage.textContent).toBe('');

    jest.advanceTimersByTime(5000);
    expect(refs.errorMessage.textContent).toBe('');
  });

  test('showSuccessMessage applies the .success class (popup.css owns the color, not an inline style)', () => {
    popup.showSuccessMessage('color', 1800000);
    expect(refs.errorMessage.classList.contains('success')).toBe(true);
    expect(refs.errorMessage.classList.contains('error')).toBe(false);
    expect(refs.errorMessage.textContent).toContain('Color override active');
  });

  test('showError applies the .error class, not .success', () => {
    popup.showError('Invalid domain format');
    expect(refs.errorMessage.classList.contains('error')).toBe(true);
    expect(refs.errorMessage.classList.contains('success')).toBe(false);
  });

  test('message auto-clears after 3 seconds', () => {
    popup.showError('Please enter a domain');
    jest.advanceTimersByTime(3000);
    expect(refs.errorMessage.textContent).toBe('');
  });
});

describe('popup.js addDomain/removeDomain (C8 regression)', () => {
  let refs;

  beforeEach(() => {
    refs = makeDomRefs();
    popup.__testHooks.setDomRefs(refs);
    popup.__testHooks.setState({
      currentDomain: null,
      domains: [],
      currentTabId: null,
      temporaryOverride: null,
    });
    global.chrome.tabs.query.mockResolvedValue([]);
  });

  test('addDomain leaves the in-memory list untouched when storage.set rejects', async () => {
    global.chrome.storage.sync.set.mockRejectedValue(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));

    await popup.addDomain('example.com');

    expect(popup.__testHooks.getState().domains).toEqual([]);
  });

  test('addDomain adds the domain only after storage.set resolves', async () => {
    global.chrome.storage.sync.set.mockResolvedValue(undefined);

    await popup.addDomain('example.com');

    expect(popup.__testHooks.getState().domains).toEqual(['example.com']);
  });

  test('removeDomain leaves the in-memory list untouched when storage.set rejects', async () => {
    popup.__testHooks.setState({ domains: ['example.com'] });
    global.chrome.storage.sync.set.mockRejectedValue(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));

    await popup.removeDomain('example.com');

    expect(popup.__testHooks.getState().domains).toEqual(['example.com']);
  });

  test('removeDomain removes the domain only after storage.set resolves', async () => {
    popup.__testHooks.setState({ domains: ['example.com'] });
    global.chrome.storage.sync.set.mockResolvedValue(undefined);

    await popup.removeDomain('example.com');

    expect(popup.__testHooks.getState().domains).toEqual([]);
  });
});
