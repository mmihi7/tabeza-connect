/**
 * M-Pesa Sandbox Validator Tests
 * Tests sandbox configuration validation logic
 */

import {
  validateSandboxConfiguration,
  validateSandboxPhoneNumber,
  getSandboxConfigurationSummary,
  type SandboxValidationResult
} from '../mpesa-sandbox-validator';
import { MpesaConfig } from '../mpesa-config';

describe('M-Pesa Sandbox Validator', () => {
  const validSandboxConfig: MpesaConfig = {
    environment: 'sandbox',
    consumerKey: 'valid_consumer_key_123',
    consumerSecret: 'valid_consumer_secret_456',
    businessShortcode: '174379',
    passkey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
    callbackUrl: 'https://api.example.com/api/mpesa/callback',
    oauthUrl: 'https://sandbox.safaricom.co.ke/oauth/v1/generate',
    stkPushUrl: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    stkQueryUrl: 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query'
  };

  describe('validateSandboxConfiguration', () => {
    it('should validate a correct sandbox configuration', () => {
      const result = validateSandboxConfiguration(validSandboxConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should reject non-sandbox environment', () => {
      const config = { ...validSandboxConfig, environment: 'production' as const };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuration is not for sandbox environment');
    });

    it('should warn about non-standard business shortcode', () => {
      const config = { ...validSandboxConfig, businessShortcode: '123456' };
      const result = validateSandboxConfiguration(config);
      
      expect(result.warnings.some(w => w.includes('not the standard sandbox shortcode'))).toBe(true);
    });

    it('should reject invalid business shortcode format', () => {
      const config = { ...validSandboxConfig, businessShortcode: 'abc123' };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Business shortcode must be 5-7 digits');
    });

    it('should reject missing consumer key', () => {
      const config = { ...validSandboxConfig, consumerKey: '' };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Consumer key is required');
    });

    it('should reject short consumer key', () => {
      const config = { ...validSandboxConfig, consumerKey: 'short' };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Consumer key must be at least 10 characters');
    });

    it('should reject placeholder consumer key', () => {
      const config = { ...validSandboxConfig, consumerKey: 'test_key_placeholder' };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('placeholder value'))).toBe(true);
    });

    it('should reject missing consumer secret', () => {
      const config = { ...validSandboxConfig, consumerSecret: '' };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Consumer secret is required');
    });

    it('should reject identical key and secret', () => {
      const config = { 
        ...validSandboxConfig, 
        consumerKey: 'same_value_123',
        consumerSecret: 'same_value_123'
      };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Consumer key and consumer secret cannot be the same value');
    });

    it('should warn about non-standard passkey', () => {
      const config = { ...validSandboxConfig, passkey: 'a'.repeat(64) };
      const result = validateSandboxConfiguration(config);
      
      expect(result.warnings.some(w => w.includes('not the standard sandbox passkey'))).toBe(true);
    });

    it('should reject invalid passkey format', () => {
      const config = { ...validSandboxConfig, passkey: 'invalid_passkey' };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Passkey must be a 64-character hexadecimal string');
    });

    it('should reject HTTP callback URL', () => {
      const config = { ...validSandboxConfig, callbackUrl: 'http://api.example.com/callback' };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Callback URL must use HTTPS protocol');
    });

    it('should reject localhost callback URL', () => {
      const config = { ...validSandboxConfig, callbackUrl: 'https://localhost:3000/callback' };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Callback URL cannot be localhost - Safaricom cannot reach local URLs');
    });

    it('should reject private IP callback URL', () => {
      const config = { ...validSandboxConfig, callbackUrl: 'https://192.168.1.100/callback' };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Callback URL cannot use private IP addresses - Safaricom cannot reach private networks');
    });

    it('should warn about development domains', () => {
      const config = { ...validSandboxConfig, callbackUrl: 'https://abc123.ngrok.io/callback' };
      const result = validateSandboxConfiguration(config);
      
      expect(result.warnings.some(w => w.includes('development domain'))).toBe(true);
    });

    it('should reject non-sandbox API URLs', () => {
      const config = { 
        ...validSandboxConfig, 
        oauthUrl: 'https://api.safaricom.co.ke/oauth/v1/generate'
      };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('must use sandbox base URL'))).toBe(true);
    });

    it('should reject incorrect API endpoints', () => {
      const config = { 
        ...validSandboxConfig, 
        oauthUrl: 'https://sandbox.safaricom.co.ke/wrong/endpoint'
      };
      const result = validateSandboxConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('OAuth URL must point to /oauth/v1/generate endpoint');
    });

    it('should convert warnings to errors in strict mode', () => {
      const config = { ...validSandboxConfig, businessShortcode: '123456' };
      const result = validateSandboxConfiguration(config, { strictMode: true });
      
      expect(result.isValid).toBe(false);
      expect(result.warnings).toHaveLength(0);
      expect(result.errors.some(e => e.includes('not the standard sandbox shortcode'))).toBe(true);
    });
  });

  describe('validateSandboxPhoneNumber', () => {
    it('should validate correct test phone number', () => {
      const result = validateSandboxPhoneNumber('254708374149');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty phone number', () => {
      const result = validateSandboxPhoneNumber('');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Phone number is required');
    });

    it('should reject invalid format', () => {
      const result = validateSandboxPhoneNumber('0708374149');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Phone number must be in format 254XXXXXXXXX (12 digits total)');
      expect(result.recommendation).toContain('254708374149');
    });

    it('should reject non-test numbers', () => {
      const result = validateSandboxPhoneNumber('254700000000');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Phone number is not a valid Safaricom test number for sandbox');
      expect(result.recommendation).toContain('254708374149');
    });

    it('should handle phone number with formatting', () => {
      const result = validateSandboxPhoneNumber('+254 708 374 149');
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('getSandboxConfigurationSummary', () => {
    it('should return complete status for valid config', () => {
      const summary = getSandboxConfigurationSummary(validSandboxConfig);
      
      expect(summary.environment).toBe('sandbox');
      expect(summary.businessShortcode).toBe('174379');
      expect(summary.isStandardShortcode).toBe(true);
      expect(summary.hasValidCredentials).toBe(true);
      expect(summary.callbackProtocol).toBe('https:');
      expect(summary.configurationStatus).toBe('complete');
      expect(summary.testPhoneNumbers.length).toBeGreaterThan(0);
    });

    it('should return invalid status for invalid config', () => {
      const config = { ...validSandboxConfig, consumerKey: '' };
      const summary = getSandboxConfigurationSummary(config);
      
      expect(summary.configurationStatus).toBe('invalid');
      expect(summary.hasValidCredentials).toBe(false);
    });

    it('should detect non-standard shortcode', () => {
      const config = { ...validSandboxConfig, businessShortcode: '123456' };
      const summary = getSandboxConfigurationSummary(config);
      
      expect(summary.isStandardShortcode).toBe(false);
      expect(summary.businessShortcode).toBe('123456');
    });
  });
});