/**
 * Property-Based Tests for Registry Reader
 * 
 * Tests universal properties across all input combinations
 * Uses fast-check for property-based testing
 */

const fc = require('fast-check');
const RegistryReader = require('../registry-reader');
const { execSync } = require('child_process');
const fs = require('fs');

// Mock modules
jest.mock('child_process');
jest.mock('fs');

describe('RegistryReader - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear environment variables
    delete process.env.TABEZA_BAR_ID;
    delete process.env.TABEZA_API_URL;
    delete process.env.TABEZA_WATCH_FOLDER;
    delete process.env.TABEZA_HTTP_PORT;
    
    // Mock console to avoid cluttering output
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
    console.error.mockRestore();
  });

  /**
   * Property 1: Configuration Priority Cascade
   * 
   * Feature: management-ui-and-missing-features, Property 1: Configuration Priority Cascade
   * 
   * For any combination of configuration sources (environment variables, registry, 
   * config.json, defaults), the Registry Reader should select the value from the 
   * highest priority source that contains a non-null value, following the priority 
   * order: environment variables → registry → config.json → defaults.
   * 
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4
   */
  describe('Property 1: Configuration Priority Cascade', () => {
    it('should always select value from highest priority non-null source', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary configuration sources
          fc.record({
            env: fc.option(fc.string({ minLength: 1 })),
            registry: fc.option(fc.string({ minLength: 1 })),
            config: fc.option(fc.string({ minLength: 1 }))
          }),
          (sources) => {
            // Set up environment variable if provided
            if (sources.env !== null) {
              process.env.TABEZA_BAR_ID = sources.env;
            } else {
              delete process.env.TABEZA_BAR_ID;
            }

            // Mock registry to return registry value if provided
            execSync.mockImplementation((command) => {
              if (command.includes('BarID')) {
                return sources.registry !== null ? sources.registry : '';
              }
              return '';
            });

            // Mock config file to return config value if provided
            if (sources.config !== null) {
              fs.existsSync.mockReturnValue(true);
              fs.readFileSync.mockReturnValue(JSON.stringify({
                barId: sources.config
              }));
            } else {
              fs.existsSync.mockReturnValue(false);
            }

            // Load configuration
            const config = RegistryReader.loadConfig();

            // Determine expected value based on priority cascade
            const expected = sources.env ?? sources.registry ?? sources.config ?? null;

            // Verify the result matches expected priority
            return config.barId === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track source correctly for each configuration field', () => {
      fc.assert(
        fc.property(
          fc.record({
            envBarId: fc.option(fc.string({ minLength: 1 })),
            registryBarId: fc.option(fc.string({ minLength: 1 })),
            configBarId: fc.option(fc.string({ minLength: 1 }))
          }),
          (sources) => {
            // Set up sources
            if (sources.envBarId !== null) {
              process.env.TABEZA_BAR_ID = sources.envBarId;
            } else {
              delete process.env.TABEZA_BAR_ID;
            }

            execSync.mockImplementation((command) => {
              if (command.includes('BarID')) {
                return sources.registryBarId !== null ? sources.registryBarId : '';
              }
              return '';
            });

            if (sources.configBarId !== null) {
              fs.existsSync.mockReturnValue(true);
              fs.readFileSync.mockReturnValue(JSON.stringify({
                barId: sources.configBarId
              }));
            } else {
              fs.existsSync.mockReturnValue(false);
            }

            const config = RegistryReader.loadConfig();

            // Determine expected source
            let expectedSource;
            if (sources.envBarId !== null) {
              expectedSource = 'env';
            } else if (sources.registryBarId !== null) {
              expectedSource = 'registry';
            } else if (sources.configBarId !== null) {
              expectedSource = 'config';
            } else {
              expectedSource = 'default';
            }

            return config.source === expectedSource;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply priority cascade independently for each config field', () => {
      fc.assert(
        fc.property(
          fc.record({
            envApiUrl: fc.option(fc.webUrl()),
            registryApiUrl: fc.option(fc.webUrl()),
            configApiUrl: fc.option(fc.webUrl())
          }),
          (sources) => {
            // Clear Bar ID to isolate API URL testing
            delete process.env.TABEZA_BAR_ID;

            // Set up API URL sources
            if (sources.envApiUrl !== null) {
              process.env.TABEZA_API_URL = sources.envApiUrl;
            } else {
              delete process.env.TABEZA_API_URL;
            }

            execSync.mockImplementation((command) => {
              if (command.includes('APIUrl')) {
                return sources.registryApiUrl !== null ? sources.registryApiUrl : '';
              }
              return '';
            });

            if (sources.configApiUrl !== null) {
              fs.existsSync.mockReturnValue(true);
              fs.readFileSync.mockReturnValue(JSON.stringify({
                apiUrl: sources.configApiUrl
              }));
            } else {
              fs.existsSync.mockReturnValue(false);
            }

            const config = RegistryReader.loadConfig();

            // Expected value with fallback to default
            const expected = sources.envApiUrl ?? sources.registryApiUrl ?? sources.configApiUrl ?? 'https://tabeza.co.ke';

            return config.apiUrl === expected;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Configuration Fallback Resilience
   * 
   * Feature: management-ui-and-missing-features, Property 2: Configuration Fallback Resilience
   * 
   * For any configuration source that fails to read (registry error, missing config file), 
   * the Registry Reader should log a warning and continue to the next priority source 
   * without throwing an exception.
   * 
   * Validates: Requirements 1.5
   */
  describe('Property 2: Configuration Fallback Resilience', () => {
    it('should never throw exception regardless of source failures', () => {
      fc.assert(
        fc.property(
          fc.record({
            registryFails: fc.boolean(),
            configFileMissing: fc.boolean(),
            configFileMalformed: fc.boolean()
          }),
          (failures) => {
            // Clear environment variables
            delete process.env.TABEZA_BAR_ID;
            delete process.env.TABEZA_API_URL;
            delete process.env.TABEZA_WATCH_FOLDER;

            // Mock registry to fail if specified
            if (failures.registryFails) {
              execSync.mockImplementation(() => {
                throw new Error('Registry access denied');
              });
            } else {
              execSync.mockReturnValue('');
            }

            // Mock config file based on failure scenarios
            if (failures.configFileMissing) {
              fs.existsSync.mockReturnValue(false);
            } else if (failures.configFileMalformed) {
              fs.existsSync.mockReturnValue(true);
              fs.readFileSync.mockReturnValue('{ invalid json }');
            } else {
              fs.existsSync.mockReturnValue(true);
              fs.readFileSync.mockReturnValue(JSON.stringify({
                barId: 'test-bar-id'
              }));
            }

            // Should not throw exception
            try {
              const config = RegistryReader.loadConfig();
              
              // Config should always be defined with at least defaults
              return config !== undefined && 
                     config.apiUrl === 'https://tabeza.co.ke' &&
                     config.watchFolder === 'C:\\ProgramData\\Tabeza\\TabezaPrints' &&
                     config.httpPort === 8765;
            } catch (error) {
              // If exception is thrown, property fails
              return false;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log warnings when sources fail but continue execution', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (shouldFail) => {
            delete process.env.TABEZA_BAR_ID;

            if (shouldFail) {
              // Mock registry to fail
              execSync.mockImplementation(() => {
                throw new Error('Test registry error');
              });
            } else {
              execSync.mockReturnValue('test-value');
            }

            fs.existsSync.mockReturnValue(false);

            // Clear previous console.warn calls
            console.warn.mockClear();

            const config = RegistryReader.loadConfig();

            // If registry failed, warning should be logged
            if (shouldFail) {
              return console.warn.mock.calls.length > 0;
            }
            
            // Config should still be returned
            return config !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should successfully fall back through all priority levels on failures', () => {
      fc.assert(
        fc.property(
          fc.record({
            registryValue: fc.option(fc.string({ minLength: 1 })),
            configValue: fc.option(fc.string({ minLength: 1 })),
            registryThrows: fc.boolean()
          }),
          (scenario) => {
            // No environment variables
            delete process.env.TABEZA_BAR_ID;

            // Mock registry
            if (scenario.registryThrows) {
              execSync.mockImplementation(() => {
                throw new Error('Registry error');
              });
            } else {
              execSync.mockImplementation((command) => {
                if (command.includes('BarID')) {
                  return scenario.registryValue !== null ? scenario.registryValue : '';
                }
                return '';
              });
            }

            // Mock config file
            if (scenario.configValue !== null) {
              fs.existsSync.mockReturnValue(true);
              fs.readFileSync.mockReturnValue(JSON.stringify({
                barId: scenario.configValue
              }));
            } else {
              fs.existsSync.mockReturnValue(false);
            }

            const config = RegistryReader.loadConfig();

            // Determine expected value
            let expected;
            if (!scenario.registryThrows && scenario.registryValue !== null) {
              expected = scenario.registryValue;
            } else if (scenario.configValue !== null) {
              expected = scenario.configValue;
            } else {
              expected = null;
            }

            return config.barId === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle mixed success and failure across different config fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            barIdFails: fc.boolean(),
            apiUrlFails: fc.boolean(),
            watchFolderFails: fc.boolean()
          }),
          (failures) => {
            delete process.env.TABEZA_BAR_ID;
            delete process.env.TABEZA_API_URL;
            delete process.env.TABEZA_WATCH_FOLDER;

            // Mock registry with selective failures
            execSync.mockImplementation((command) => {
              if (command.includes('BarID') && failures.barIdFails) {
                throw new Error('BarID read failed');
              }
              if (command.includes('APIUrl') && failures.apiUrlFails) {
                throw new Error('APIUrl read failed');
              }
              if (command.includes('WatchFolder') && failures.watchFolderFails) {
                throw new Error('WatchFolder read failed');
              }
              
              // Return test values for non-failing keys
              if (command.includes('BarID')) return 'test-bar-id';
              if (command.includes('APIUrl')) return 'https://test.example.com';
              if (command.includes('WatchFolder')) return 'C:\\Test\\Folder';
              return '';
            });

            fs.existsSync.mockReturnValue(false);

            const config = RegistryReader.loadConfig();

            // Verify config is valid with defaults for failed fields
            const isValid = 
              config !== undefined &&
              (failures.barIdFails ? config.barId === null : config.barId === 'test-bar-id') &&
              (failures.apiUrlFails ? config.apiUrl === 'https://tabeza.co.ke' : config.apiUrl === 'https://test.example.com') &&
              (failures.watchFolderFails ? config.watchFolder === 'C:\\ProgramData\\Tabeza\\TabezaPrints' : config.watchFolder === 'C:\\Test\\Folder');

            return isValid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
