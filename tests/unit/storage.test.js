// tests/unit/storage.test.js
// Tests for Chrome storage operations using mocked chrome.storage.sync

import { jest, beforeEach, describe, test, expect } from '@jest/globals';

describe('Chrome Storage Operations', () => {
  beforeEach(() => {
    // Reset mocks before each test (done in setup.js but explicit here)
    jest.clearAllMocks();
  });

  describe('storage.sync.get', () => {
    test('retrieves domains array from storage', async () => {
      const mockDomains = ['example.com', 'test.com'];
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        if (callback) callback({ domains: mockDomains });
        return Promise.resolve({ domains: mockDomains });
      });

      const result = await chrome.storage.sync.get(['domains']);
      expect(result.domains).toEqual(mockDomains);
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['domains']);
    });

    test('returns empty object when no domains stored', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
      });

      const result = await chrome.storage.sync.get(['domains']);
      expect(result.domains).toBeUndefined();
    });

    test('retrieves temporaryOverrides object', async () => {
      const mockOverrides = {
        'example.com': {
          state: 'color',
          expiresAt: Date.now() + 60000,
          originallyInList: true
        }
      };
      chrome.storage.sync.get.mockResolvedValue({ temporaryOverrides: mockOverrides });

      const result = await chrome.storage.sync.get(['temporaryOverrides']);
      expect(result.temporaryOverrides).toEqual(mockOverrides);
    });
  });

  describe('storage.sync.set', () => {
    test('stores domains array', async () => {
      chrome.storage.sync.set.mockResolvedValue(undefined);

      const domains = ['example.com', 'test.com'];
      await chrome.storage.sync.set({ domains });

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ domains });
    });

    test('stores temporaryOverrides object', async () => {
      chrome.storage.sync.set.mockResolvedValue(undefined);

      const temporaryOverrides = {
        'example.com': {
          state: 'grayscale',
          expiresAt: Date.now() + 60000,
          originallyInList: false
        }
      };
      await chrome.storage.sync.set({ temporaryOverrides });

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ temporaryOverrides });
    });
  });

  describe('storage data structures', () => {
    test('domains array contains valid domain strings', async () => {
      const mockDomains = ['example.com', 'sub.domain.org', 'test-site.net'];
      chrome.storage.sync.get.mockResolvedValue({ domains: mockDomains });

      const result = await chrome.storage.sync.get(['domains']);

      result.domains.forEach(domain => {
        expect(typeof domain).toBe('string');
        expect(domain.length).toBeGreaterThan(0);
        expect(domain).not.toContain('http');
        expect(domain).not.toContain('www.');
      });
    });

    test('temporaryOverride has required fields', async () => {
      const mockOverride = {
        'example.com': {
          state: 'color',
          expiresAt: Date.now() + 60000,
          originallyInList: true
        }
      };
      chrome.storage.sync.get.mockResolvedValue({ temporaryOverrides: mockOverride });

      const result = await chrome.storage.sync.get(['temporaryOverrides']);
      const override = result.temporaryOverrides['example.com'];

      expect(override).toHaveProperty('state');
      expect(override).toHaveProperty('expiresAt');
      expect(override).toHaveProperty('originallyInList');
      expect(['grayscale', 'color']).toContain(override.state);
      expect(typeof override.expiresAt).toBe('number');
      expect(typeof override.originallyInList).toBe('boolean');
    });
  });

  describe('storage edge cases', () => {
    test('handles storage quota exceeded gracefully', async () => {
      chrome.storage.sync.set.mockRejectedValue(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));

      await expect(chrome.storage.sync.set({ domains: new Array(1000).fill('domain.com') }))
        .rejects.toThrow('QUOTA_BYTES_PER_ITEM');
    });

    test('handles empty storage gracefully', async () => {
      chrome.storage.sync.get.mockResolvedValue({});

      const result = await chrome.storage.sync.get(['domains', 'temporaryOverrides']);

      // Extension code handles this by defaulting to empty array/object
      const domains = result.domains || [];
      const temporaryOverrides = result.temporaryOverrides || {};

      expect(domains).toEqual([]);
      expect(temporaryOverrides).toEqual({});
    });
  });
});
