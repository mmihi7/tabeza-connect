/**
 * Property-Based Tests for DeepSeek Receipt Parser
 * Feature: revert-ec2-to-deepseek
 */

import fc from 'fast-check';
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

describe('Receipt Parser - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DEEPSEEK_API_KEY;
  });

  // Feature: revert-ec2-to-deepseek, Property 1: DeepSeek API Integration
  it('should call DeepSeek API for all receipts when configured', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 500 }), // Random receipt text
        fc.uuid(), // Random bar ID
        async (receiptText, barId) => {
          // Set API key
          process.env.DEEPSEEK_API_KEY = 'sk-test-key-123';

          // Mock API response
          mockOpenAI.chat.completions.create.mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  items: [{ name: 'Test Item', price: 100 }],
                  total: 100,
                  receiptNumber: 'TEST-123'
                })
              }
            }],
            usage: {
              total_tokens: 50
            }
          });

          // Parse receipt
          await parseReceipt(receiptText, barId);

          // Verify OpenAI was called with correct config
          expect(OpenAI).toHaveBeenCalledWith({
            apiKey: 'sk-test-key-123',
            baseURL: 'https://api.deepseek.com/v1'
          });

          // Verify API was called with correct parameters
          expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
            expect.objectContaining({
              model: 'deepseek-chat',
              response_format: { type: 'json_object' },
              messages: expect.arrayContaining([
                expect.objectContaining({ role: 'system' }),
                expect.objectContaining({ role: 'user', content: receiptText })
              ]),
              temperature: 0.1,
              max_tokens: 2000
            }),
            expect.objectContaining({
              signal: expect.any(AbortSignal)
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: revert-ec2-to-deepseek, Property 2: Comprehensive Error Fallback
  it('should fall back to regex for all error conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 500 }),
        fc.uuid(),
        fc.constantFrom('missing_key', 'invalid_key', 'timeout', 'network_error', 'invalid_json'),
        async (receiptText, barId, errorType) => {
          // Simulate different error conditions
          if (errorType === 'missing_key') {
            delete process.env.DEEPSEEK_API_KEY;
          } else {
            process.env.DEEPSEEK_API_KEY = 'sk-test-key';

            if (errorType === 'timeout') {
              const error: any = new Error('Timeout');
              error.name = 'AbortError';
              mockOpenAI.chat.completions.create.mockRejectedValue(error);
            } else if (errorType === 'network_error') {
              mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Network error'));
            } else if (errorType === 'invalid_json') {
              mockOpenAI.chat.completions.create.mockResolvedValue({
                choices: [{
                  message: {
                    content: 'not valid json'
                  }
                }],
                usage: { total_tokens: 10 }
              });
            } else if (errorType === 'invalid_key') {
              const error: any = new Error('Invalid API key');
              error.status = 401;
              mockOpenAI.chat.completions.create.mockRejectedValue(error);
            }
          }

          // Parse receipt - should not throw
          const result = await parseReceipt(receiptText, barId);

          // Verify result structure (regex fallback)
          expect(result).toBeDefined();
          expect(result).toHaveProperty('items');
          expect(Array.isArray(result.items)).toBe(true);
          expect(result).toHaveProperty('total');
          expect(typeof result.total).toBe('number');
          expect(result).toHaveProperty('rawText');
          expect(result.rawText).toBe(receiptText);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: revert-ec2-to-deepseek, Property 4: Output Structure Compliance
  it('should return valid ParsedReceipt for all successful parses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 500 }),
        fc.uuid(),
        fc.boolean(), // Whether to use DeepSeek or regex
        async (receiptText, barId, useDeepSeek) => {
          if (useDeepSeek) {
            process.env.DEEPSEEK_API_KEY = 'sk-test-key';

            mockOpenAI.chat.completions.create.mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify({
                    items: [
                      { name: 'Item 1', price: 50.5 },
                      { name: 'Item 2', price: 75.25 }
                    ],
                    total: 125.75,
                    receiptNumber: 'RCP-001'
                  })
                }
              }],
              usage: { total_tokens: 100 }
            });
          } else {
            delete process.env.DEEPSEEK_API_KEY;
          }

          const result = await parseReceipt(receiptText, barId);

          // Verify structure compliance
          expect(result).toBeDefined();
          expect(result).toHaveProperty('items');
          expect(Array.isArray(result.items)).toBe(true);
          expect(result).toHaveProperty('total');
          expect(typeof result.total).toBe('number');
          expect(result).toHaveProperty('rawText');
          expect(result.rawText).toBe(receiptText);

          // Verify items structure
          result.items.forEach(item => {
            expect(item).toHaveProperty('name');
            expect(item).toHaveProperty('price');
            expect(typeof item.name).toBe('string');
            expect(typeof item.price).toBe('number');
          });

          // Verify optional receiptNumber
          if (result.receiptNumber !== undefined) {
            expect(typeof result.receiptNumber).toBe('string');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
