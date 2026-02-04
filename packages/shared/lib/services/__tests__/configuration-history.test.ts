/**
 * Configuration History Service Tests
 * Tests for Task 10.2: Add configuration history display
 * Requirements: 7.5
 */

import { 
  ConfigurationHistoryService,
  getConfigurationHistoryService,
  getVenueConfigurationHistory,
  getRecentConfigurationChanges,
  getConfigurationTimestamps,
  type ConfigurationHistoryEntry,
  type FormattedHistoryEntry,
  type HistoryQueryOptions
} from '../configuration-history';

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        in: jest.fn(() => ({
          order: jest.fn(() => ({
            range: jest.fn(() => ({
              gte: jest.fn(() => ({
                lte: jest.fn(() => ({
                  eq: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 }))
                }))
              }))
            }))
          }))
        }))
      }))
    }))
  }))
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('ConfigurationHistoryService', () => {
  let service: ConfigurationHistoryService;
  const mockBarId = 'test-bar-123';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConfigurationHistoryService('test-url', 'test-key');
  });

  describe('getConfigurationHistory', () => {
    it('should fetch configuration history with default options', async () => {
      const mockData: ConfigurationHistoryEntry[] = [
        {
          id: 'entry-1',
          action: 'onboarding_completed',
          bar_id: mockBarId,
          staff_id: 'user-123',
          created_at: '2024-01-15T10:00:00Z',
          details: {
            venue_mode: 'venue',
            authority_mode: 'tabeza',
            pos_integration_enabled: false,
            printer_required: false,
            completion_timestamp: '2024-01-15T10:00:00Z'
          }
        }
      ];

      // Mock the chain of Supabase calls
      const mockQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => ({
                range: jest.fn(() => Promise.resolve({ 
                  data: mockData, 
                  error: null, 
                  count: 1 
                }))
              }))
            }))
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const options: HistoryQueryOptions = {
        barId: mockBarId,
        limit: 50
      };

      const result = await service.getConfigurationHistory(options);

      expect(result.entries).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.entries[0].title).toBe('Onboarding Completed');
      expect(result.entries[0].severity).toBe('success');
    });

    it('should apply event type filters', async () => {
      const mockQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn((field: string, values: string[]) => {
              expect(field).toBe('action');
              expect(values).toEqual(['configuration_changed']);
              return {
                order: jest.fn(() => ({
                  range: jest.fn(() => Promise.resolve({ 
                    data: [], 
                    error: null, 
                    count: 0 
                  }))
                }))
              };
            })
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const options: HistoryQueryOptions = {
        barId: mockBarId,
        eventTypes: ['configuration_changed']
      };

      await service.getConfigurationHistory(options);

      expect(mockQuery.select).toHaveBeenCalledWith('*', { count: 'exact' });
    });

    it('should apply date range filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => ({
                range: jest.fn(() => ({
                  gte: jest.fn((field: string, value: string) => {
                    expect(field).toBe('created_at');
                    expect(value).toBe(startDate.toISOString());
                    return {
                      lte: jest.fn((field: string, value: string) => {
                        expect(field).toBe('created_at');
                        expect(value).toBe(endDate.toISOString());
                        return Promise.resolve({ data: [], error: null, count: 0 });
                      })
                    };
                  })
                }))
              }))
            }))
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const options: HistoryQueryOptions = {
        barId: mockBarId,
        startDate,
        endDate
      };

      await service.getConfigurationHistory(options);
    });

    it('should handle database errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      
      const mockQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => ({
                range: jest.fn(() => Promise.resolve({ 
                  data: null, 
                  error: mockError, 
                  count: 0 
                }))
              }))
            }))
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const options: HistoryQueryOptions = {
        barId: mockBarId
      };

      await expect(service.getConfigurationHistory(options))
        .rejects.toThrow('Failed to fetch configuration history: Database connection failed');
    });
  });

  describe('getConfigurationTimestamps', () => {
    it('should extract configuration timestamps from history', async () => {
      const mockData: ConfigurationHistoryEntry[] = [
        {
          id: 'entry-1',
          action: 'configuration_changed',
          bar_id: mockBarId,
          created_at: '2024-01-20T15:30:00Z',
          details: {}
        },
        {
          id: 'entry-2',
          action: 'onboarding_completed',
          bar_id: mockBarId,
          created_at: '2024-01-15T10:00:00Z',
          details: {}
        },
        {
          id: 'entry-3',
          action: 'configuration_validation_failed',
          bar_id: mockBarId,
          created_at: '2024-01-18T12:00:00Z',
          details: {}
        }
      ];

      const mockQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => ({
                range: jest.fn(() => Promise.resolve({ 
                  data: mockData, 
                  error: null, 
                  count: 3 
                }))
              }))
            }))
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const timestamps = await service.getConfigurationTimestamps(mockBarId);

      expect(timestamps.onboardingCompletedAt).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(timestamps.authorityConfiguredAt).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(timestamps.modeLastChangedAt).toEqual(new Date('2024-01-20T15:30:00Z'));
      expect(timestamps.lastValidationFailure).toEqual(new Date('2024-01-18T12:00:00Z'));
    });

    it('should handle empty history gracefully', async () => {
      const mockQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => ({
                range: jest.fn(() => Promise.resolve({ 
                  data: [], 
                  error: null, 
                  count: 0 
                }))
              }))
            }))
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const timestamps = await service.getConfigurationTimestamps(mockBarId);

      expect(timestamps).toEqual({});
    });
  });

  describe('getRecentConfigurationChanges', () => {
    it('should fetch recent changes from last 7 days', async () => {
      const mockData: ConfigurationHistoryEntry[] = [
        {
          id: 'entry-1',
          action: 'configuration_changed',
          bar_id: mockBarId,
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          details: {
            change_summary: 'Changed from Basic to Venue mode'
          }
        }
      ];

      const mockQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => ({
                range: jest.fn(() => ({
                  gte: jest.fn(() => Promise.resolve({ 
                    data: mockData, 
                    error: null, 
                    count: 1 
                  }))
                }))
              }))
            }))
          }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const recentChanges = await service.getRecentConfigurationChanges(mockBarId);

      expect(recentChanges).toHaveLength(1);
      expect(recentChanges[0].title).toBe('Configuration Changed');
    });
  });

  describe('formatHistoryEntry', () => {
    it('should format onboarding completion entry correctly', () => {
      const entry: ConfigurationHistoryEntry = {
        id: 'entry-1',
        action: 'onboarding_completed',
        bar_id: mockBarId,
        staff_id: 'user-123',
        created_at: '2024-01-15T10:00:00Z',
        details: {
          venue_mode: 'venue',
          authority_mode: 'tabeza',
          completion_timestamp: '2024-01-15T10:00:00Z'
        }
      };

      const formatted = (service as any).formatHistoryEntry(entry);

      expect(formatted.title).toBe('Onboarding Completed');
      expect(formatted.description).toBe('Venue configured as venue mode with tabeza authority');
      expect(formatted.severity).toBe('success');
      expect(formatted.icon).toBe('✅');
      expect(formatted.user?.id).toBe('user-123');
    });

    it('should format configuration change entry correctly', () => {
      const entry: ConfigurationHistoryEntry = {
        id: 'entry-1',
        action: 'configuration_changed',
        bar_id: mockBarId,
        created_at: '2024-01-15T10:00:00Z',
        details: {
          change_summary: 'Changed from Basic to Venue mode',
          previous_config: {
            venue_mode: 'basic',
            authority_mode: 'pos'
          },
          new_config: {
            venue_mode: 'venue',
            authority_mode: 'tabeza'
          },
          change_reason: 'User upgrade to full service'
        }
      };

      const formatted = (service as any).formatHistoryEntry(entry);

      expect(formatted.title).toBe('Configuration Changed');
      expect(formatted.description).toBe('Changed from Basic to Venue mode');
      expect(formatted.severity).toBe('info');
      expect(formatted.details.configurationBefore).toContain('Mode: Tabeza Basic');
      expect(formatted.details.configurationAfter).toContain('Mode: Tabeza Venue');
      expect(formatted.details.changeReason).toBe('User upgrade to full service');
    });

    it('should format validation failure entry correctly', () => {
      const entry: ConfigurationHistoryEntry = {
        id: 'entry-1',
        action: 'configuration_validation_failed',
        bar_id: mockBarId,
        created_at: '2024-01-15T10:00:00Z',
        details: {
          validation_errors: [
            'Basic mode requires POS authority',
            'Invalid configuration combination'
          ],
          error_message: 'Configuration validation failed'
        }
      };

      const formatted = (service as any).formatHistoryEntry(entry);

      expect(formatted.title).toBe('Validation Failed');
      expect(formatted.description).toBe('Basic mode requires POS authority, Invalid configuration combination');
      expect(formatted.severity).toBe('error');
      expect(formatted.icon).toBe('❌');
      expect(formatted.details.errorDetails).toContain('Basic mode requires POS authority');
    });
  });

  describe('formatConfiguration', () => {
    it('should format configuration object correctly', () => {
      const config = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false
      };

      const formatted = (service as any).formatConfiguration(config);

      expect(formatted).toBe('Mode: Tabeza Venue, Authority: Tabeza, POS Integration: Disabled, Printer: Optional');
    });

    it('should handle partial configuration objects', () => {
      const config = {
        venue_mode: 'basic'
      };

      const formatted = (service as any).formatConfiguration(config);

      expect(formatted).toBe('Mode: Tabeza Basic');
    });

    it('should handle empty configuration objects', () => {
      const config = {};

      const formatted = (service as any).formatConfiguration(config);

      expect(formatted).toBe('Configuration details not available');
    });
  });

  describe('formatUserAgent', () => {
    it('should extract browser and OS information', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

      const formatted = (service as any).formatUserAgent(userAgent);

      expect(formatted).toBe('Chrome on Windows');
    });

    it('should handle unknown user agents', () => {
      const userAgent = 'Unknown/1.0';

      const formatted = (service as any).formatUserAgent(userAgent);

      expect(formatted).toBe('Unknown Browser on Unknown OS');
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getVenueConfigurationHistory', () => {
    it('should call service method with correct parameters', async () => {
      const mockService = {
        getConfigurationHistory: jest.fn().mockResolvedValue({
          entries: [],
          totalCount: 0,
          hasMore: false
        })
      };

      // Mock the singleton
      jest.doMock('../configuration-history', () => ({
        ...jest.requireActual('../configuration-history'),
        getConfigurationHistoryService: () => mockService
      }));

      const { getVenueConfigurationHistory } = require('../configuration-history');

      const options = {
        barId: 'test-bar',
        limit: 25
      };

      await getVenueConfigurationHistory('test-bar', { limit: 25 });

      expect(mockService.getConfigurationHistory).toHaveBeenCalledWith({
        barId: 'test-bar',
        limit: 25
      });
    });
  });

  describe('getRecentConfigurationChanges', () => {
    it('should call service method with correct bar ID', async () => {
      const mockService = {
        getRecentConfigurationChanges: jest.fn().mockResolvedValue([])
      };

      jest.doMock('../configuration-history', () => ({
        ...jest.requireActual('../configuration-history'),
        getConfigurationHistoryService: () => mockService
      }));

      const { getRecentConfigurationChanges } = require('../configuration-history');

      await getRecentConfigurationChanges('test-bar');

      expect(mockService.getRecentConfigurationChanges).toHaveBeenCalledWith('test-bar');
    });
  });

  describe('getConfigurationTimestamps', () => {
    it('should call service method with correct bar ID', async () => {
      const mockService = {
        getConfigurationTimestamps: jest.fn().mockResolvedValue({})
      };

      jest.doMock('../configuration-history', () => ({
        ...jest.requireActual('../configuration-history'),
        getConfigurationHistoryService: () => mockService
      }));

      const { getConfigurationTimestamps } = require('../configuration-history');

      await getConfigurationTimestamps('test-bar');

      expect(mockService.getConfigurationTimestamps).toHaveBeenCalledWith('test-bar');
    });
  });
});

describe('Singleton Pattern', () => {
  it('should return the same instance on multiple calls', () => {
    const instance1 = getConfigurationHistoryService();
    const instance2 = getConfigurationHistoryService();

    expect(instance1).toBe(instance2);
  });
});