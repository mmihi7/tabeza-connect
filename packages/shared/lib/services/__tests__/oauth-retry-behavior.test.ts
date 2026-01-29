/**
 * Test to verify OAuth errors are not retried in STK Push service
 * This validates the task requirement: "Fail payment immediately if OAuth fails (no retries yet)"
 */

import { sendSTKPush, STKPushError } from '../mpesa-stk-push';
import { MpesaOAuthError } from '../mpesa-oauth';
import { type MpesaConfig } from '../mpesa-config';

// Mock the OAuth service
jest.mock('../mpesa-oauth');
const mockGetOAuthToken = require('../mpesa-oauth').getOAuthToken as jest.MockedFunction<any>;

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const testConfig: MpesaConfig = {
  environment: 'sandbox',
  consumerKey: 'test_consumer_key',
  consumerSecret: 'test_consumer_secret',
  businessShortcode: '174379',
  passkey: 'test_passkey',
  callbackUrl: 'https://example.com/callback',
  oauthUrl: 'https://sandbox.safaricom.co.ke/oauth/v1/generate',
  stkPushUrl: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
  stkQueryUrl: 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
};

const validRequest = {
  phoneNumber: '254708374149',
  amount: 100,
  accountReference: 'TEST123',
  transactionDesc: 'Test Payment',
};

describe('OAuth Error Retry Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  it('should not retry when OAuth fails', async () => {
    // Mock OAuth to fail
    const oauthError = new MpesaOAuthError('OAuth failed: Invalid credentials', 401);
    mockGetOAuthToken.mockRejectedValue(oauthError);

    // Attempt STK Push
    await expect(sendSTKPush(validRequest, testConfig)).rejects.toThrow(STKPushError);
    await expect(sendSTKPush(validRequest, testConfig)).rejects.toThrow('Authentication failed');

    // Verify OAuth was only called once (no retries)
    expect(mockGetOAuthToken).toHaveBeenCalledTimes(2); // Called twice because we called sendSTKPush twice
    
    // Verify fetch was never called since OAuth failed
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should fail immediately on OAuth error without retries', async () => {
    // Mock OAuth to fail
    const oauthError = new MpesaOAuthError('Network error while requesting OAuth token');
    mockGetOAuthToken.mockRejectedValue(oauthError);

    const startTime = Date.now();
    
    // Attempt STK Push - should fail immediately
    await expect(sendSTKPush(validRequest, testConfig)).rejects.toThrow(STKPushError);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should fail quickly (less than 1 second) since no retries
    expect(duration).toBeLessThan(1000);
    
    // Verify OAuth was only called once
    expect(mockGetOAuthToken).toHaveBeenCalledTimes(1);
  });
});