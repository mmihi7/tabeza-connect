/**
 * Template Cache Manager Tests
 * 
 * Comprehensive unit tests for the Template Cache Manager module.
 * Tests all core functionality including download, caching, validation,
 * scheduling, and offline fallback.
 * 
 * Requirements: Requirement 5 (Template Caching and Updates)
 * Design: Component 6 (Template Cache Manager)
 * 
 * @module template-cache-manager.test
 */

const fs = require('fs').promises;
const path = require('path');
const TemplateCacheManager = require('../template-cache-manager');

// Mock https module
jest.mock('https');
const https = require('https');

// Test fixtures
const VALID_TEMPLATE = {
  version: '1.2',
  posSystem: 'TestPOS',
  patterns: {
    item_line: '^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$',
    total_line: '^TOTAL\\s+([0-9,]+\\.\\d{2})$',
    receipt_number: '^Receipt\\s*#?:\\s*(\\S+)$',
  },
  confidence_threshold: 0.85,
  lastUpdated: '2026-03-08T00:00:00.000Z',
};

const UPDATED_TEMPLATE = {
  ...VALID_TEMPLATE,
  version: '1.3',
  lastUpdated: '2026-03-09T00:00:00.000Z',
};

const INVALID_TEMPLATE_NO_VERSION = {
  posSystem: 'TestPOS',
  patterns: {
    item_line: '^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$',
  },
};

const INVALID_TEMPLATE_NO_PATTERNS = {
  version: '1.0',
  posSystem: 'TestPOS',
};

const INVALID_TEMPLATE_BAD_REGEX = {
  version: '1.0',
  posSystem: 'TestPOS',
  patterns: {
    item_line: '[invalid(regex',
    total_line: '^TOTAL\\s+([0-9,]+\\.\\d{2})$',
    receipt_number: '^Receipt\\s*#?:\\s*(\\S+)$',
  },
};

// Test directory
const TEST_DIR = path.join(__dirname, 'test-templates');
const TEST_TEMPLATE_PATH = path.join(TEST_DIR, 'template.json');

describe('TemplateCacheManager', () => {
  let manager;
  
  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    // Create manager instance
    manager = new TemplateCacheManager({
      templatePath: TEST_TEMPLATE_PATH,
      apiUrl: 'https://test.tabeza.co.ke',
      barId: 'test-bar-123',
    });
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  afterEach(async () => {
    // Stop manager
    if (manager) {
      manager.stop();
    }
    
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Constructor', () => {
    test('should create instance with default options', () => {
      const defaultManager = new TemplateCacheManager();
      
      expect(defaultManager.templatePath).toContain('template.json');
      expect(defaultManager.apiUrl).toBe('https://tabeza.co.ke');
      expect(defaultManager.barId).toBeNull();
      expect(defaultManager.cachedTemplate).toBeNull();
      expect(defaultManager.isInitialized).toBe(false);
    });
    
    test('should create instance with custom options', () => {
      expect(manager.templatePath).toBe(TEST_TEMPLATE_PATH);
      expect(manager.apiUrl).toBe('https://test.tabeza.co.ke');
      expect(manager.barId).toBe('test-bar-123');
    });
    
    test('should initialize statistics', () => {
      const stats = manager.getStats();
      
      expect(stats.downloadsAttempted).toBe(0);
      expect(stats.downloadsSucceeded).toBe(0);
      expect(stats.downloadsFailed).toBe(0);
      expect(stats.validationsPassed).toBe(0);
      expect(stats.validationsFailed).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });
  });
  
  describe('initialize()', () => {
    test('should initialize successfully with no cached template', async () => {
      // Mock successful download
      mockHttpRequest(VALID_TEMPLATE);
      
      const result = await manager.initialize();
      
      expect(result.success).toBe(true);
      expect(result.hasCachedTemplate).toBe(true);
      expect(manager.isInitialized).toBe(true);
    });
    
    test('should initialize successfully with existing cached template', async () => {
      // Create cached template file
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(VALID_TEMPLATE), 'utf8');
      
      const result = await manager.initialize();
      
      expect(result.success).toBe(true);
      expect(result.hasCachedTemplate).toBe(true);
      expect(manager.cachedTemplate).toEqual(VALID_TEMPLATE);
    });
    
    test('should not re-initialize if already initialized', async () => {
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(VALID_TEMPLATE), 'utf8');
      
      await manager.initialize();
      const result = await manager.initialize();
      
      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
    });
    
    test('should emit initialized event', async () => {
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(VALID_TEMPLATE), 'utf8');
      
      const eventPromise = new Promise(resolve => {
        manager.once('initialized', resolve);
      });
      
      await manager.initialize();
      const event = await eventPromise;
      
      expect(event.success).toBe(true);
      expect(event.hasCachedTemplate).toBe(true);
    });
  });
  
  describe('loadTemplate()', () => {
    test('should return cached template if available', async () => {
      manager.cachedTemplate = VALID_TEMPLATE;
      
      const template = await manager.loadTemplate();
      
      expect(template).toEqual(VALID_TEMPLATE);
      expect(manager.stats.cacheHits).toBe(1);
    });
    
    test('should load from disk if not in memory', async () => {
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(VALID_TEMPLATE), 'utf8');
      
      const template = await manager.loadTemplate();
      
      expect(template).toEqual(VALID_TEMPLATE);
      expect(manager.cachedTemplate).toEqual(VALID_TEMPLATE);
    });
    
    test('should download if no cache available', async () => {
      mockHttpRequest(VALID_TEMPLATE);
      
      const template = await manager.loadTemplate();
      
      expect(template).toEqual(VALID_TEMPLATE);
      expect(manager.stats.downloadsAttempted).toBe(1);
      expect(manager.stats.downloadsSucceeded).toBe(1);
    });
    
    test('should throw error if no cache and download fails', async () => {
      mockHttpRequestError('Network error');
      
      await expect(manager.loadTemplate()).rejects.toThrow('No template available');
      expect(manager.stats.downloadsFailed).toBeGreaterThan(0);
    });
  });
  
  describe('downloadTemplate()', () => {
    test('should download template successfully', async () => {
      mockHttpRequest(VALID_TEMPLATE);
      
      const result = await manager.downloadTemplate();
      
      expect(result.success).toBe(true);
      expect(result.template).toEqual(VALID_TEMPLATE);
      expect(manager.stats.downloadsSucceeded).toBe(1);
    });
    
    test('should retry on failure with exponential backoff', async () => {
      // First two attempts fail, third succeeds
      let attemptCount = 0;
      mockHttpRequestWithCallback(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return VALID_TEMPLATE;
      });
      
      const result = await manager.downloadTemplate();
      
      expect(result.success).toBe(true);
      expect(manager.stats.downloadsAttempted).toBe(3);
      expect(manager.stats.downloadsSucceeded).toBe(1);
    });
    
    test('should fail after all retries exhausted', async () => {
      mockHttpRequestError('Network error');
      
      const result = await manager.downloadTemplate();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(manager.stats.downloadsFailed).toBeGreaterThan(0);
    });
    
    test('should emit template-downloaded event on success', async () => {
      mockHttpRequest(VALID_TEMPLATE);
      
      const eventPromise = new Promise(resolve => {
        manager.once('template-downloaded', resolve);
      });
      
      await manager.downloadTemplate();
      const event = await eventPromise;
      
      expect(event.version).toBe(VALID_TEMPLATE.version);
      expect(event.posSystem).toBe(VALID_TEMPLATE.posSystem);
    });
    
    test('should emit download-failed event on failure', async () => {
      mockHttpRequestError('Network error');
      
      const eventPromise = new Promise(resolve => {
        manager.once('download-failed', resolve);
      });
      
      await manager.downloadTemplate();
      const event = await eventPromise;
      
      expect(event.error).toContain('Network error');
    });
    
    test('should throw error if barId not set', async () => {
      manager.barId = null;
      
      await expect(manager.downloadTemplate()).rejects.toThrow('Bar ID is required');
    });
  });
  
  describe('updateTemplate()', () => {
    test('should update template when new version available', async () => {
      manager.cachedTemplate = VALID_TEMPLATE;
      mockHttpRequest(UPDATED_TEMPLATE);
      
      const result = await manager.updateTemplate();
      
      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.newVersion).toBe('1.3');
      expect(manager.cachedTemplate.version).toBe('1.3');
    });
    
    test('should not update if version is same', async () => {
      manager.cachedTemplate = VALID_TEMPLATE;
      mockHttpRequest(VALID_TEMPLATE);
      
      const result = await manager.updateTemplate();
      
      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.version).toBe(VALID_TEMPLATE.version);
    });
    
    test('should save updated template to cache file', async () => {
      manager.cachedTemplate = VALID_TEMPLATE;
      mockHttpRequest(UPDATED_TEMPLATE);
      
      await manager.updateTemplate();
      
      const savedData = await fs.readFile(TEST_TEMPLATE_PATH, 'utf8');
      const savedTemplate = JSON.parse(savedData);
      
      expect(savedTemplate.version).toBe('1.3');
    });
    
    test('should emit template-updated event', async () => {
      manager.cachedTemplate = VALID_TEMPLATE;
      mockHttpRequest(UPDATED_TEMPLATE);
      
      const eventPromise = new Promise(resolve => {
        manager.once('template-updated', resolve);
      });
      
      await manager.updateTemplate();
      const event = await eventPromise;
      
      expect(event.oldVersion).toBe('1.2');
      expect(event.newVersion).toBe('1.3');
    });
    
    test('should handle download failure gracefully', async () => {
      manager.cachedTemplate = VALID_TEMPLATE;
      mockHttpRequestError('Network error');
      
      const result = await manager.updateTemplate();
      
      expect(result.success).toBe(false);
      expect(result.usingCache).toBe(true);
      expect(manager.cachedTemplate).toEqual(VALID_TEMPLATE); // Still has old template
    });
  });
  
  describe('Template Validation', () => {
    test('should validate correct template', async () => {
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(VALID_TEMPLATE), 'utf8');
      
      await manager.initialize();
      
      expect(manager.stats.validationsPassed).toBe(1);
      expect(manager.stats.validationsFailed).toBe(0);
    });
    
    test('should reject template without version', async () => {
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(INVALID_TEMPLATE_NO_VERSION), 'utf8');
      
      await manager.initialize();
      
      expect(manager.cachedTemplate).toBeNull();
    });
    
    test('should reject template without patterns', async () => {
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(INVALID_TEMPLATE_NO_PATTERNS), 'utf8');
      
      await manager.initialize();
      
      expect(manager.cachedTemplate).toBeNull();
    });
    
    test('should reject template with invalid regex', async () => {
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(INVALID_TEMPLATE_BAD_REGEX), 'utf8');
      
      await manager.initialize();
      
      expect(manager.cachedTemplate).toBeNull();
    });
    
    test('should validate required patterns', async () => {
      const templateMissingPattern = {
        ...VALID_TEMPLATE,
        patterns: {
          item_line: '^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$',
          // Missing total_line and receipt_number
        },
      };
      
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(templateMissingPattern), 'utf8');
      
      await manager.initialize();
      
      expect(manager.cachedTemplate).toBeNull();
    });
    
    test('should validate confidence threshold range', async () => {
      const templateBadThreshold = {
        ...VALID_TEMPLATE,
        confidence_threshold: 1.5, // Invalid: > 1.0
      };
      
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(templateBadThreshold), 'utf8');
      
      await manager.initialize();
      
      expect(manager.cachedTemplate).toBeNull();
    });
  });
  
  describe('getTemplateInfo()', () => {
    test('should return info when template exists', () => {
      manager.cachedTemplate = VALID_TEMPLATE;
      
      const info = manager.getTemplateInfo();
      
      expect(info.exists).toBe(true);
      expect(info.version).toBe('1.2');
      expect(info.posSystem).toBe('TestPOS');
      expect(info.patternsCount).toBe(3);
      expect(info.confidenceThreshold).toBe(0.85);
    });
    
    test('should return empty info when no template', () => {
      const info = manager.getTemplateInfo();
      
      expect(info.exists).toBe(false);
      expect(info.version).toBeNull();
      expect(info.posSystem).toBeNull();
    });
  });
  
  describe('Caching Behavior', () => {
    test('should use atomic write for cache file', async () => {
      mockHttpRequest(VALID_TEMPLATE);
      
      await manager.updateTemplate();
      
      // Verify temp file was cleaned up
      const tempPath = `${TEST_TEMPLATE_PATH}.tmp`;
      await expect(fs.access(tempPath)).rejects.toThrow();
      
      // Verify final file exists
      await expect(fs.access(TEST_TEMPLATE_PATH)).resolves.not.toThrow();
    });
    
    test('should track cache hits', async () => {
      manager.cachedTemplate = VALID_TEMPLATE;
      
      await manager.loadTemplate();
      await manager.loadTemplate();
      await manager.loadTemplate();
      
      expect(manager.stats.cacheHits).toBe(3);
    });
    
    test('should track cache misses', async () => {
      mockHttpRequest(VALID_TEMPLATE);
      
      await manager.loadTemplate();
      
      expect(manager.stats.cacheMisses).toBe(1);
    });
  });
  
  describe('Offline Fallback', () => {
    test('should use cached template when download fails', async () => {
      // Set up cached template
      manager.cachedTemplate = VALID_TEMPLATE;
      
      // Mock download failure
      mockHttpRequestError('Network error');
      
      // Try to update
      const result = await manager.updateTemplate();
      
      expect(result.success).toBe(false);
      expect(result.usingCache).toBe(true);
      expect(manager.cachedTemplate).toEqual(VALID_TEMPLATE);
    });
    
    test('should load from disk cache when offline', async () => {
      // Create cached file
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(VALID_TEMPLATE), 'utf8');
      
      // Mock download failure
      mockHttpRequestError('Network error');
      
      // Load template
      const template = await manager.loadTemplate();
      
      expect(template).toEqual(VALID_TEMPLATE);
    });
  });
  
  describe('Update Scheduling', () => {
    test('should schedule update checks on initialization', async () => {
      jest.useFakeTimers();
      
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(VALID_TEMPLATE), 'utf8');
      await manager.initialize();
      
      expect(manager.updateCheckTimer).not.toBeNull();
      
      jest.useRealTimers();
    });
    
    test('should clear timer on stop', async () => {
      jest.useFakeTimers();
      
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(VALID_TEMPLATE), 'utf8');
      await manager.initialize();
      
      manager.stop();
      
      expect(manager.updateCheckTimer).toBeNull();
      expect(manager.isInitialized).toBe(false);
      
      jest.useRealTimers();
    });
  });
  
  describe('Statistics', () => {
    test('should track download statistics', async () => {
      mockHttpRequest(VALID_TEMPLATE);
      
      await manager.downloadTemplate();
      
      const stats = manager.getStats();
      
      expect(stats.downloadsAttempted).toBe(1);
      expect(stats.downloadsSucceeded).toBe(1);
      expect(stats.downloadsFailed).toBe(0);
      expect(stats.downloadSuccessRate).toBe(100);
    });
    
    test('should track validation statistics', async () => {
      await fs.writeFile(TEST_TEMPLATE_PATH, JSON.stringify(VALID_TEMPLATE), 'utf8');
      
      await manager.initialize();
      
      const stats = manager.getStats();
      
      expect(stats.validationsPassed).toBe(1);
      expect(stats.validationsFailed).toBe(0);
      expect(stats.validationSuccessRate).toBe(100);
    });
    
    test('should calculate success rates correctly', async () => {
      // One success, one failure
      mockHttpRequest(VALID_TEMPLATE);
      await manager.downloadTemplate();
      
      mockHttpRequestError('Network error');
      await manager.downloadTemplate();
      
      const stats = manager.getStats();
      
      expect(stats.downloadSuccessRate).toBe(50);
    });
  });
  
  describe('setBarId()', () => {
    test('should update barId', () => {
      manager.setBarId('new-bar-456');
      
      expect(manager.barId).toBe('new-bar-456');
    });
  });
  
  describe('hasTemplate()', () => {
    test('should return true when template exists', () => {
      manager.cachedTemplate = VALID_TEMPLATE;
      
      expect(manager.hasTemplate()).toBe(true);
    });
    
    test('should return false when no template', () => {
      expect(manager.hasTemplate()).toBe(false);
    });
  });
  
  describe('getCachedTemplate()', () => {
    test('should return cached template', () => {
      manager.cachedTemplate = VALID_TEMPLATE;
      
      expect(manager.getCachedTemplate()).toEqual(VALID_TEMPLATE);
    });
    
    test('should return null when no template', () => {
      expect(manager.getCachedTemplate()).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mockHttpRequest(responseData) {
  const mockRequest = {
    on: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    setTimeout: jest.fn(),
    destroy: jest.fn(),
  };
  
  https.request.mockImplementation((url, options, callback) => {
    // Simulate successful response
    setImmediate(() => {
      const mockResponse = {
        statusCode: 200,
        statusMessage: 'OK',
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify(responseData));
          } else if (event === 'end') {
            handler();
          }
        }),
      };
      
      callback(mockResponse);
    });
    
    return mockRequest;
  });
}

function mockHttpRequestError(errorMessage) {
  const mockRequest = {
    on: jest.fn((event, handler) => {
      if (event === 'error') {
        setImmediate(() => handler(new Error(errorMessage)));
      }
    }),
    write: jest.fn(),
    end: jest.fn(),
    setTimeout: jest.fn(),
    destroy: jest.fn(),
  };
  
  https.request.mockImplementation(() => mockRequest);
}

function mockHttpRequestWithCallback(callback) {
  const mockRequest = {
    on: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    setTimeout: jest.fn(),
    destroy: jest.fn(),
  };
  
  https.request.mockImplementation((url, options, responseCallback) => {
    setImmediate(() => {
      try {
        const responseData = callback();
        
        const mockResponse = {
          statusCode: 200,
          statusMessage: 'OK',
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify(responseData));
            } else if (event === 'end') {
              handler();
            }
          }),
        };
        
        responseCallback(mockResponse);
      } catch (error) {
        mockRequest.on.mock.calls.forEach(([event, handler]) => {
          if (event === 'error') {
            handler(error);
          }
        });
      }
    });
    
    return mockRequest;
  });
}
