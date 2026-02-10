/**
 * Unit Tests for DeepSeek Receipt Parser
 * Feature: revert-ec2-to-deepseek
 * 
 * Tests specific examples, edge cases, and error conditions
 */

import OpenAI from 'openai';

// Mock OpenAI module
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
};

jest.mock('openai', () => {
  return jest.fn(() => mockOpenAI);
});

// Import after mocking
import { parseReceipt } from '../receiptParser';

describe('Receipt Parser - DeepSeek Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DEEPSEEK_API_KEY;
  });

  describe('Configuration', () => {
    it('should use DEEPSEEK_API_KEY from environment', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key-123';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [{ name: 'Test Item', price: 100 }],
              total: 100
            })
          }
        }],
        usage: { total_tokens: 50 }
      });

      await parseReceipt('Test receipt', 'bar-123');

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test-key-123',
        baseURL: 'https://api.deepseek.com/v1'
      });
    });

    it('should use DeepSeek endpoint', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [],
              total: 0
            })
          }
        }],
        usage: { total_tokens: 10 }
      });

      await parseReceipt('Test', 'bar-123');

      expect(OpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.deepseek.com/v1'
        })
      );
    });

    it('should use deepseek-chat model', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [],
              total: 0
            })
          }
        }],
        usage: { total_tokens: 10 }
      });

      await parseReceipt('Test', 'bar-123');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'deepseek-chat'
        }),
        expect.any(Object)
      );
    });

    it('should enforce JSON response format', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [],
              total: 0
            })
          }
        }],
        usage: { total_tokens: 10 }
      });

      await parseReceipt('Test', 'bar-123');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: 'json_object' }
        }),
        expect.any(Object)
      );
    });
  });

  describe('Successful Parsing', () => {
    beforeEach(() => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';
    });

    it('should parse simple receipt', async () => {
      const receiptText = `
        Receipt #123
        Item 1    10.00
        Item 2    20.00
        Total:    30.00
      `;

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [
                { name: 'Item 1', price: 10.00 },
                { name: 'Item 2', price: 20.00 }
              ],
              total: 30.00,
              receiptNumber: '123'
            })
          }
        }],
        usage: { total_tokens: 100 }
      });

      const result = await parseReceipt(receiptText, 'bar-123');

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(30.00);
      expect(result.receiptNumber).toBe('123');
      expect(result.rawText).toBe(receiptText);
    });

    it('should parse complex receipt with multiple items', async () => {
      const receiptText = `
        Bar Receipt
        2    Tusker Lager 500ml       500.00
        1    Nyama Choma              800.00
        3    Chips                    450.00
        Total:                      1750.00
      `;

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [
                { name: '2x Tusker Lager 500ml', price: 500.00 },
                { name: '1x Nyama Choma', price: 800.00 },
                { name: '3x Chips', price: 450.00 }
              ],
              total: 1750.00
            })
          }
        }],
        usage: { total_tokens: 150 }
      });

      const result = await parseReceipt(receiptText, 'bar-123');

      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(1750.00);
    });

    it('should extract receipt number when present', async () => {
      const receiptText = 'Receipt: RCP-456\nTotal: 100.00';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [],
              total: 100.00,
              receiptNumber: 'RCP-456'
            })
          }
        }],
        usage: { total_tokens: 50 }
      });

      const result = await parseReceipt(receiptText, 'bar-123');

      expect(result.receiptNumber).toBe('RCP-456');
    });

    it('should return ParsedReceipt structure', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [{ name: 'Test', price: 50 }],
              total: 50
            })
          }
        }],
        usage: { total_tokens: 50 }
      });

      const result = await parseReceipt('Test', 'bar-123');

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('rawText');
      expect(Array.isArray(result.items)).toBe(true);
      expect(typeof result.total).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should fall back to regex when API key missing', async () => {
      delete process.env.DEEPSEEK_API_KEY;

      const receiptText = 'Item 1    10.00\nTotal:    10.00';
      const result = await parseReceipt(receiptText, 'bar-123');

      expect(result).toBeDefined();
      expect(result.rawText).toBe(receiptText);
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should fall back to regex on network error', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('Network error')
      );

      const receiptText = 'Item 1    10.00\nTotal:    10.00';
      const result = await parseReceipt(receiptText, 'bar-123');

      expect(result).toBeDefined();
      expect(result.rawText).toBe(receiptText);
    });

    it('should fall back to regex on timeout', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      const timeoutError: any = new Error('Timeout');
      timeoutError.name = 'AbortError';
      mockOpenAI.chat.completions.create.mockRejectedValue(timeoutError);

      const receiptText = 'Item 1    10.00\nTotal:    10.00';
      const result = await parseReceipt(receiptText, 'bar-123');

      expect(result).toBeDefined();
      expect(result.rawText).toBe(receiptText);
    });

    it('should fall back to regex on invalid JSON', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'not valid json'
          }
        }],
        usage: { total_tokens: 10 }
      });

      const receiptText = 'Item 1    10.00\nTotal:    10.00';
      const result = await parseReceipt(receiptText, 'bar-123');

      expect(result).toBeDefined();
      expect(result.rawText).toBe(receiptText);
    });

    it('should fall back to regex on API error', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      const apiError: any = new Error('Invalid API key');
      apiError.status = 401;
      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

      const receiptText = 'Item 1    10.00\nTotal:    10.00';
      const result = await parseReceipt(receiptText, 'bar-123');

      expect(result).toBeDefined();
      expect(result.rawText).toBe(receiptText);
    });

    it('should not throw errors on any failure', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('Unexpected error')
      );

      await expect(
        parseReceipt('Test', 'bar-123')
      ).resolves.toBeDefined();
    });
  });

  describe('Cleanup Verification', () => {
    it('should not reference EC2_PARSER_URL', () => {
      const receiptParserSource = require('fs').readFileSync(
        require.resolve('../receiptParser'),
        'utf-8'
      );

      expect(receiptParserSource).not.toContain('EC2_PARSER_URL');
    });

    it('should not have parseWithEC2 function', () => {
      const receiptParserSource = require('fs').readFileSync(
        require.resolve('../receiptParser'),
        'utf-8'
      );

      expect(receiptParserSource).not.toContain('parseWithEC2');
    });

    it('should not have EC2-related comments', () => {
      const receiptParserSource = require('fs').readFileSync(
        require.resolve('../receiptParser'),
        'utf-8'
      );

      expect(receiptParserSource).not.toContain('EC2 parser');
      expect(receiptParserSource).not.toContain('ec2-receipt-parser');
    });
  });

  describe('Timeout Handling', () => {
    it('should implement 10-second timeout', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [],
              total: 0
            })
          }
        }],
        usage: { total_tokens: 10 }
      });

      await parseReceipt('Test', 'bar-123');

      // Verify signal was passed for timeout
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });
  });

  describe('OpenAI Client Initialization', () => {
    it('should initialize OpenAI client with correct parameters', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-custom-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [],
              total: 0
            })
          }
        }],
        usage: { total_tokens: 10 }
      });

      await parseReceipt('Test', 'bar-123');

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-custom-key',
        baseURL: 'https://api.deepseek.com/v1'
      });
    });

    it('should pass correct message structure', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [],
              total: 0
            })
          }
        }],
        usage: { total_tokens: 10 }
      });

      const receiptText = 'Test receipt content';
      await parseReceipt(receiptText, 'bar-123');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ 
              role: 'user', 
              content: receiptText 
            })
          ])
        }),
        expect.any(Object)
      );
    });

    it('should set temperature to 0.1', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [],
              total: 0
            })
          }
        }],
        usage: { total_tokens: 10 }
      });

      await parseReceipt('Test', 'bar-123');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.1
        }),
        expect.any(Object)
      );
    });

    it('should set max_tokens to 2000', async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [],
              total: 0
            })
          }
        }],
        usage: { total_tokens: 10 }
      });

      await parseReceipt('Test', 'bar-123');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2000
        }),
        expect.any(Object)
      );
    });
  });
});
