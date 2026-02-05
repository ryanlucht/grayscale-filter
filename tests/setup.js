// Mock Chrome Extension APIs for testing
// This file runs before each test file

import { jest, beforeEach } from '@jest/globals';

// Create mock chrome object structure
const chromeMock = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn()
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  runtime: {
    id: 'test-extension-id',
    lastError: null,
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    get: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    },
    onActivated: {
      addListener: jest.fn()
    }
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  }
};

// Install mock globally
global.chrome = chromeMock;

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  // Reset lastError
  chromeMock.runtime.lastError = null;
});
