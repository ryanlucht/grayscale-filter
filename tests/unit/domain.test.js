// tests/unit/domain.test.js
import { extractDomain, normalizeDomain, formatDuration } from '../helpers/extractors.js';

describe('extractDomain', () => {
  describe('valid HTTP/HTTPS URLs', () => {
    test('extracts domain from https URL', () => {
      expect(extractDomain('https://example.com')).toBe('example.com');
    });

    test('extracts domain from http URL', () => {
      expect(extractDomain('http://example.com')).toBe('example.com');
    });

    test('removes www. prefix', () => {
      expect(extractDomain('https://www.example.com')).toBe('example.com');
    });

    test('converts to lowercase', () => {
      expect(extractDomain('https://EXAMPLE.COM')).toBe('example.com');
      expect(extractDomain('https://Example.Com')).toBe('example.com');
    });

    test('handles subdomains', () => {
      expect(extractDomain('https://sub.example.com')).toBe('sub.example.com');
      expect(extractDomain('https://www.sub.example.com')).toBe('sub.example.com');
    });

    test('handles URLs with paths', () => {
      expect(extractDomain('https://example.com/path/to/page')).toBe('example.com');
    });

    test('handles URLs with query strings', () => {
      expect(extractDomain('https://example.com?query=value')).toBe('example.com');
    });

    test('handles URLs with ports', () => {
      expect(extractDomain('https://example.com:8080')).toBe('example.com');
    });

    test('handles URLs with authentication', () => {
      expect(extractDomain('https://user:pass@example.com')).toBe('example.com');
    });
  });

  describe('invalid or special URLs', () => {
    test('returns null for chrome:// URLs', () => {
      expect(extractDomain('chrome://extensions')).toBe(null);
    });

    test('returns null for edge:// URLs', () => {
      expect(extractDomain('edge://settings')).toBe(null);
    });

    test('returns null for about: URLs', () => {
      expect(extractDomain('about:blank')).toBe(null);
    });

    test('returns null for file:// URLs', () => {
      expect(extractDomain('file:///path/to/file.html')).toBe(null);
    });

    test('returns null for malformed URLs', () => {
      expect(extractDomain('not-a-url')).toBe(null);
      expect(extractDomain('')).toBe(null);
      expect(extractDomain('://missing-protocol.com')).toBe(null);
    });

    test('returns null for null/undefined input', () => {
      expect(extractDomain(null)).toBe(null);
      expect(extractDomain(undefined)).toBe(null);
    });
  });
});

describe('normalizeDomain', () => {
  test('removes https:// protocol', () => {
    expect(normalizeDomain('https://example.com')).toBe('example.com');
  });

  test('removes http:// protocol', () => {
    expect(normalizeDomain('http://example.com')).toBe('example.com');
  });

  test('removes www. prefix', () => {
    expect(normalizeDomain('www.example.com')).toBe('example.com');
  });

  test('removes protocol and www. together', () => {
    expect(normalizeDomain('https://www.example.com')).toBe('example.com');
  });

  test('removes trailing slash and path', () => {
    expect(normalizeDomain('example.com/')).toBe('example.com');
    expect(normalizeDomain('example.com/path/to/page')).toBe('example.com');
  });

  test('converts to lowercase', () => {
    expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
    expect(normalizeDomain('Example.Com')).toBe('example.com');
  });

  test('handles already normalized input', () => {
    expect(normalizeDomain('example.com')).toBe('example.com');
  });

  test('handles input with query string', () => {
    expect(normalizeDomain('example.com?query=value')).toBe('example.com?query=value');
    // Note: Current implementation doesn't strip query strings - this documents behavior
  });
});

describe('formatDuration', () => {
  test('formats minutes', () => {
    expect(formatDuration(15 * 60000)).toBe('15 minutes');
    expect(formatDuration(30 * 60000)).toBe('30 minutes');
  });

  test('formats single hour', () => {
    expect(formatDuration(60 * 60000)).toBe('1 hour');
  });

  test('formats multiple hours', () => {
    expect(formatDuration(2 * 60 * 60000)).toBe('2 hours');
    expect(formatDuration(4 * 60 * 60000)).toBe('4 hours');
  });

  test('formats day', () => {
    expect(formatDuration(24 * 60 * 60000)).toBe('1 day');
  });
});
