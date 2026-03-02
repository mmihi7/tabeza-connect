/**
 * Unit Tests for Registry Reader
 * 
 * Tests configuration loading with priority cascade and error handling
 */

const RegistryReader = require('../registry-reader');
const { execSync } = require('child_process');
const fs = require('fs');

// Mock child_process and fs modules
jest.mock('child_process');
jest.mock('fs');

describe('RegistryReader', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Clear environment variables
    delete process.env.TABEZA_BAR_ID;
    delete process.env.TABEZA_API_URL;
    delete process.env.TABEZA_WATCH_FOLDER;
    delete process.env.TABEZA_HTTP_PORT;
    
    // Mock console methods to avoid cluttering test output
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    console.warn.mockRestore();
    console.error.mockRestore();
  });

  describe('readRegistryKey', () => {
    it('should read existing registry key successfully', () => {
      // Mock successful registry read
      execSync.mockReturnValue('test-bar-id-123\n');

      const result = RegistryReader.readRegistryKey('BarID');

      expect(result).toBe('test-bar-id-123');
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('Get-ItemProperty'),
        expect.any(Object)
      );
    });

    it('should return null for missing registry key', () => {
      // Mock empty result
      execSync.mockReturnValue('');

      const result = RegistryReader.readRegistryKey('BarID');

      expect(result).toBeNull();
    });

    it('should return null when registry read throws error', () => {
      // Mock registry read failure
      execSync.mockImplementation(() => {
        throw new Error('Registry key not found');
      });

      const result = RegistryReader.readRegistryKey('BarID');

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read registry key BarID')
      );
    });

    it('should trim whitespace from registry values', () => {
      execSync.mockReturnValue('  test-value  \n');

      const result = RegistryReader.readRegistryKey('APIUrl');

      expect(result).toBe('test-value');
    });

    it('should return null for "null" string value', () => {
      execSync.mockReturnValue('null');

      const result = RegistryReader.readRegistryKey('BarID');

      expect(result).toBeNull();
    });
  });

  describe('readConfigFile', () => {
    it('should read and parse valid config.json', () => {
      const mockConfig = {
        barId: 'file-bar-id',
        apiUrl: 'https://test.example.com',
        watchFolder: 'C:\\Test\\Folder',
        httpPort: 9000
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = RegistryReader.readConfigFile();

      expect(result).toEqual(mockConfig);
      expect(fs.existsSync).toHaveBeenCalledWith('C:\\ProgramData\\Tabeza\\config.json');
    });

    it('should return null when config.json does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = RegistryReader.readConfigFile();

      expect(result).toBeNull();
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('should return null and log warning for malformed JSON', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ invalid json }');

      const result = RegistryReader.readConfigFile();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Malformed config.json')
      );
    });

    it('should return null and log warning when file read fails', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = RegistryReader.readConfigFile();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read config.json')
      );
    });
  });

  describe('loadConfig - Priority Cascade', () => {
    it('should prioritize environment variables over all other sources', () => {
      // Set environment variables
      process.env.TABEZA_BAR_ID = 'env-bar-id';
      process.env.TABEZA_API_URL = 'https://env.example.com';
      process.env.TABEZA_WATCH_FOLDER = 'C:\\Env\\Folder';
      process.env.TABEZA_HTTP_PORT = '7777';

      // Mock registry to return different values
      execSync.mockImplementation((command) => {
        if (command.includes('BarID')) return 'registry-bar-id';
        if (command.includes('APIUrl')) return 'https://registry.example.com';
        if (command.includes('WatchFolder')) return 'C:\\Registry\\Folder';
        return '';
      });

      // Mock config file to return different values
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        barId: 'file-bar-id',
        apiUrl: 'https://file.example.com',
        watchFolder: 'C:\\File\\Folder',
        httpPort: 8888
      }));

      const config = RegistryReader.loadConfig();

      expect(config.barId).toBe('env-bar-id');
      expect(config.apiUrl).toBe('https://env.example.com');
      expect(config.watchFolder).toBe('C:\\Env\\Folder');
      expect(config.httpPort).toBe(7777);
      expect(config.source).toBe('env');
    });

    it('should fall back to registry when environment variables are missing', () => {
      // No environment variables set
      
      // Mock registry values
      execSync.mockImplementation((command) => {
        if (command.includes('BarID')) return 'registry-bar-id';
        if (command.includes('APIUrl')) return 'https://registry.example.com';
        if (command.includes('WatchFolder')) return 'C:\\Registry\\Folder';
        return '';
      });

      // Mock config file
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        barId: 'file-bar-id',
        apiUrl: 'https://file.example.com'
      }));

      const config = RegistryReader.loadConfig();

      expect(config.barId).toBe('registry-bar-id');
      expect(config.apiUrl).toBe('https://registry.example.com');
      expect(config.watchFolder).toBe('C:\\Registry\\Folder');
      expect(config.source).toBe('registry');
    });

    it('should fall back to config file when registry is missing', () => {
      // No environment variables
      // Mock registry to return null
      execSync.mockReturnValue('');

      // Mock config file
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        barId: 'file-bar-id',
        apiUrl: 'https://file.example.com',
        watchFolder: 'C:\\File\\Folder',
        httpPort: 9999
      }));

      const config = RegistryReader.loadConfig();

      expect(config.barId).toBe('file-bar-id');
      expect(config.apiUrl).toBe('https://file.example.com');
      expect(config.watchFolder).toBe('C:\\File\\Folder');
      expect(config.httpPort).toBe(9999);
      expect(config.source).toBe('config');
    });

    it('should use defaults when all sources are missing', () => {
      // No environment variables
      // Mock registry to return null
      execSync.mockReturnValue('');
      
      // Mock config file missing
      fs.existsSync.mockReturnValue(false);

      const config = RegistryReader.loadConfig();

      expect(config.barId).toBeNull();
      expect(config.apiUrl).toBe('https://tabeza.co.ke');
      expect(config.watchFolder).toBe('C:\\ProgramData\\Tabeza\\TabezaPrints');
      expect(config.httpPort).toBe(8765);
      expect(config.source).toBe('default');
    });

    it('should mix values from different sources based on priority', () => {
      // Set only Bar ID in environment
      process.env.TABEZA_BAR_ID = 'env-bar-id';

      // Mock registry with API URL
      execSync.mockImplementation((command) => {
        if (command.includes('APIUrl')) return 'https://registry.example.com';
        return '';
      });

      // Mock config file with watch folder
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        watchFolder: 'C:\\File\\Folder',
        httpPort: 9000
      }));

      const config = RegistryReader.loadConfig();

      expect(config.barId).toBe('env-bar-id'); // From env
      expect(config.apiUrl).toBe('https://registry.example.com'); // From registry
      expect(config.watchFolder).toBe('C:\\File\\Folder'); // From file
      expect(config.httpPort).toBe(9000); // From file
      expect(config.source).toBe('env'); // Source tracks Bar ID source
    });
  });

  describe('loadConfig - Error Handling', () => {
    it('should continue when registry read fails', () => {
      // Mock registry to throw error
      execSync.mockImplementation(() => {
        throw new Error('Registry access denied');
      });

      // Mock config file with values
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        barId: 'file-bar-id',
        apiUrl: 'https://file.example.com'
      }));

      const config = RegistryReader.loadConfig();

      // Should fall back to config file
      expect(config.barId).toBe('file-bar-id');
      expect(config.apiUrl).toBe('https://file.example.com');
      expect(config.source).toBe('config');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should continue when config file is malformed', () => {
      // Mock registry with values
      execSync.mockImplementation((command) => {
        if (command.includes('BarID')) return 'registry-bar-id';
        if (command.includes('APIUrl')) return 'https://registry.example.com';
        return '';
      });

      // Mock malformed config file
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ invalid }');

      const config = RegistryReader.loadConfig();

      // Should use registry values
      expect(config.barId).toBe('registry-bar-id');
      expect(config.apiUrl).toBe('https://registry.example.com');
      expect(config.source).toBe('registry');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Malformed config.json')
      );
    });

    it('should log error when Bar ID is missing from all sources', () => {
      // No environment variables
      // Mock registry to return null
      execSync.mockReturnValue('');
      
      // Mock config file missing
      fs.existsSync.mockReturnValue(false);

      const config = RegistryReader.loadConfig();

      expect(config.barId).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Bar ID not found')
      );
    });

    it('should not throw exceptions even when all sources fail', () => {
      // Mock all sources to fail
      execSync.mockImplementation(() => {
        throw new Error('Registry error');
      });
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File error');
      });

      // Should not throw
      expect(() => {
        const config = RegistryReader.loadConfig();
        expect(config).toBeDefined();
        expect(config.apiUrl).toBe('https://tabeza.co.ke'); // Defaults
      }).not.toThrow();
    });
  });

  describe('loadConfig - HTTP Port Parsing', () => {
    it('should parse HTTP port from environment variable as integer', () => {
      process.env.TABEZA_HTTP_PORT = '9999';

      const config = RegistryReader.loadConfig();

      expect(config.httpPort).toBe(9999);
      expect(typeof config.httpPort).toBe('number');
    });

    it('should handle invalid HTTP port in environment variable', () => {
      process.env.TABEZA_HTTP_PORT = 'invalid';

      const config = RegistryReader.loadConfig();

      // Should fall back to default
      expect(config.httpPort).toBe(8765);
    });
  });
});
