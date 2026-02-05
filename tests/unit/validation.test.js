// tests/unit/validation.test.js
import { isValidDomain, shouldApplyGrayscaleFilter } from '../helpers/extractors.js';

describe('isValidDomain', () => {
  describe('valid domains', () => {
    test('accepts simple domain', () => {
      expect(isValidDomain('example.com')).toBe(true);
    });

    test('accepts domain with hyphen', () => {
      expect(isValidDomain('my-example.com')).toBe(true);
    });

    test('accepts subdomain', () => {
      expect(isValidDomain('sub.example.com')).toBe(true);
    });

    test('accepts multi-level TLD', () => {
      expect(isValidDomain('example.co.uk')).toBe(true);
    });

    test('accepts numeric domain', () => {
      expect(isValidDomain('123.example.com')).toBe(true);
    });

    test('accepts single character subdomain', () => {
      expect(isValidDomain('a.example.com')).toBe(true);
    });
  });

  describe('invalid domains', () => {
    test('rejects domain starting with hyphen', () => {
      expect(isValidDomain('-example.com')).toBe(false);
    });

    test('rejects domain with only TLD', () => {
      expect(isValidDomain('.com')).toBe(false);
    });

    test('rejects domain without TLD', () => {
      expect(isValidDomain('example')).toBe(false);
    });

    test('rejects domain with single letter TLD', () => {
      expect(isValidDomain('example.c')).toBe(false);
    });

    test('rejects empty string', () => {
      expect(isValidDomain('')).toBe(false);
    });

    test('rejects domain with spaces', () => {
      expect(isValidDomain('example .com')).toBe(false);
      expect(isValidDomain('exam ple.com')).toBe(false);
    });

    test('rejects domain with special characters', () => {
      expect(isValidDomain('example@.com')).toBe(false);
      expect(isValidDomain('example!.com')).toBe(false);
    });
  });
});

describe('shouldApplyGrayscaleFilter', () => {
  const futureTime = Date.now() + 60000; // 1 minute from now
  const pastTime = Date.now() - 60000; // 1 minute ago

  describe('with no overrides', () => {
    test('returns true if domain in permanent list', () => {
      expect(shouldApplyGrayscaleFilter(
        'example.com',
        ['example.com', 'other.com'],
        {}
      )).toBe(true);
    });

    test('returns false if domain not in permanent list', () => {
      expect(shouldApplyGrayscaleFilter(
        'example.com',
        ['other.com'],
        {}
      )).toBe(false);
    });

    test('returns false for empty permanent list', () => {
      expect(shouldApplyGrayscaleFilter(
        'example.com',
        [],
        {}
      )).toBe(false);
    });
  });

  describe('with active override', () => {
    test('grayscale override returns true even if not in permanent list', () => {
      expect(shouldApplyGrayscaleFilter(
        'example.com',
        [],
        { 'example.com': { state: 'grayscale', expiresAt: futureTime } }
      )).toBe(true);
    });

    test('color override returns false even if in permanent list', () => {
      expect(shouldApplyGrayscaleFilter(
        'example.com',
        ['example.com'],
        { 'example.com': { state: 'color', expiresAt: futureTime } }
      )).toBe(false);
    });
  });

  describe('with expired override', () => {
    test('expired grayscale override falls back to permanent list (not in list)', () => {
      expect(shouldApplyGrayscaleFilter(
        'example.com',
        [],
        { 'example.com': { state: 'grayscale', expiresAt: pastTime } }
      )).toBe(false);
    });

    test('expired color override falls back to permanent list (in list)', () => {
      expect(shouldApplyGrayscaleFilter(
        'example.com',
        ['example.com'],
        { 'example.com': { state: 'color', expiresAt: pastTime } }
      )).toBe(true);
    });
  });
});
