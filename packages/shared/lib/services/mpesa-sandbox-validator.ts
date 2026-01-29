/**
 * M-Pesa Sandbox Configuration Validator
 * Validates sandbox configuration according to Safaricom requirements
 * Requirements: 3.1, 6.1
 */

import { MpesaConfig, getSandboxTestPhoneNumbers } from './mpesa-config';

export interface SandboxValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface SandboxValidationOptions {
  strictMode?: boolean; // If true, warnings become errors
  validateCallbackUrl?: boolean; // If true, validates callback URL accessibility
}

/**
 * Comprehensive sandbox configuration validation
 * Requirement 3.1: WHEN receiving a payment callback, THE Callback_Handler SHALL validate the request signature and origin
 * Requirement 6.1: WHEN payment errors occur, THE Error_Handler SHALL categorize errors by type and severity
 */
export function validateSandboxConfiguration(
  config: MpesaConfig,
  options: SandboxValidationOptions = {}
): SandboxValidationResult {
  const result: SandboxValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    recommendations: []
  };

  // Only validate if this is actually a sandbox configuration
  if (config.environment !== 'sandbox') {
    result.errors.push('Configuration is not for sandbox environment');
    result.isValid = false;
    return result;
  }

  // Validate business shortcode
  validateBusinessShortcode(config, result);

  // Validate consumer credentials
  validateConsumerCredentials(config, result);

  // Validate passkey
  validatePasskey(config, result);

  // Validate callback URL
  validateCallbackUrl(config, result, options.validateCallbackUrl || false);

  // Validate API URLs
  validateApiUrls(config, result);

  // Add recommendations
  addSandboxRecommendations(result);

  // Convert warnings to errors in strict mode
  if (options.strictMode && result.warnings.length > 0) {
    result.errors.push(...result.warnings);
    result.warnings = [];
  }

  // Set overall validity
  result.isValid = result.errors.length === 0;

  return result;
}

/**
 * Validate business shortcode for sandbox
 * Requirement: Ensure sandbox uses shortcode 174379
 */
function validateBusinessShortcode(config: MpesaConfig, result: SandboxValidationResult): void {
  const STANDARD_SANDBOX_SHORTCODE = '174379';

  if (!config.businessShortcode) {
    result.errors.push('Business shortcode is required for sandbox');
    return;
  }

  if (config.businessShortcode !== STANDARD_SANDBOX_SHORTCODE) {
    result.warnings.push(
      `Business shortcode "${config.businessShortcode}" is not the standard sandbox shortcode "${STANDARD_SANDBOX_SHORTCODE}". ` +
      `This may work if you have a custom sandbox app, but standard testing should use "${STANDARD_SANDBOX_SHORTCODE}".`
    );
  }

  // Validate format (5-7 digits)
  if (!/^\d{5,7}$/.test(config.businessShortcode)) {
    result.errors.push('Business shortcode must be 5-7 digits');
  }
}

/**
 * Validate consumer key and secret
 * Requirement: Verify consumer key/secret per app configuration
 */
function validateConsumerCredentials(config: MpesaConfig, result: SandboxValidationResult): void {
  // Validate consumer key
  if (!config.consumerKey) {
    result.errors.push('Consumer key is required');
  } else {
    if (config.consumerKey.length < 10) {
      result.errors.push('Consumer key must be at least 10 characters');
    }
    
    // Check for common test/placeholder values
    const testValues = ['test', 'demo', 'sample', 'placeholder', 'your_key_here'];
    if (testValues.some(test => config.consumerKey.toLowerCase().includes(test))) {
      result.errors.push('Consumer key appears to be a placeholder value. Use your actual key from Safaricom Developer Portal.');
    }

    // Validate format (should be alphanumeric)
    if (!/^[A-Za-z0-9_-]+$/.test(config.consumerKey)) {
      result.warnings.push('Consumer key contains unusual characters. Ensure it matches exactly what Safaricom provided.');
    }
  }

  // Validate consumer secret
  if (!config.consumerSecret) {
    result.errors.push('Consumer secret is required');
  } else {
    if (config.consumerSecret.length < 10) {
      result.errors.push('Consumer secret must be at least 10 characters');
    }

    // Check for common test/placeholder values
    const testValues = ['test', 'demo', 'sample', 'placeholder', 'your_secret_here'];
    if (testValues.some(test => config.consumerSecret.toLowerCase().includes(test))) {
      result.errors.push('Consumer secret appears to be a placeholder value. Use your actual secret from Safaricom Developer Portal.');
    }

    // Validate format (should be alphanumeric)
    if (!/^[A-Za-z0-9_-]+$/.test(config.consumerSecret)) {
      result.warnings.push('Consumer secret contains unusual characters. Ensure it matches exactly what Safaricom provided.');
    }
  }

  // Check if key and secret are the same (common mistake)
  if (config.consumerKey && config.consumerSecret && config.consumerKey === config.consumerSecret) {
    result.errors.push('Consumer key and consumer secret cannot be the same value');
  }
}

/**
 * Validate passkey for sandbox
 */
function validatePasskey(config: MpesaConfig, result: SandboxValidationResult): void {
  const STANDARD_SANDBOX_PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';

  if (!config.passkey) {
    result.errors.push('Passkey is required for sandbox');
    return;
  }

  if (config.passkey !== STANDARD_SANDBOX_PASSKEY) {
    result.warnings.push(
      'Passkey is not the standard sandbox passkey. This may work if you have a custom sandbox app, ' +
      'but standard testing should use the default sandbox passkey.'
    );
  }

  // Validate format (should be hex string)
  if (!/^[a-f0-9]{64}$/.test(config.passkey)) {
    result.errors.push('Passkey must be a 64-character hexadecimal string');
  }
}

/**
 * Validate callback URL
 * Requirement: Validate HTTPS callback URL requirement
 */
function validateCallbackUrl(config: MpesaConfig, result: SandboxValidationResult, checkAccessibility: boolean): void {
  if (!config.callbackUrl) {
    result.errors.push('Callback URL is required');
    return;
  }

  let url: URL;
  try {
    url = new URL(config.callbackUrl);
  } catch {
    result.errors.push('Callback URL must be a valid URL');
    return;
  }

  // HTTPS requirement
  if (url.protocol !== 'https:') {
    result.errors.push('Callback URL must use HTTPS protocol');
  }

  // Check for localhost (not accessible to Safaricom)
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    result.errors.push('Callback URL cannot be localhost - Safaricom cannot reach local URLs');
  }

  // Check for private IP ranges
  if (isPrivateIP(url.hostname)) {
    result.errors.push('Callback URL cannot use private IP addresses - Safaricom cannot reach private networks');
  }

  // Validate path structure
  if (!url.pathname.includes('/api/') && !url.pathname.includes('/webhook')) {
    result.warnings.push('Callback URL should typically point to an API endpoint (e.g., /api/mpesa/callback)');
  }

  // Check for common development domains
  const devDomains = ['ngrok.io', 'localtunnel.me', 'localhost.run'];
  if (devDomains.some(domain => url.hostname.includes(domain))) {
    result.warnings.push(
      `Callback URL uses development domain (${url.hostname}). ` +
      'This is fine for testing but ensure the tunnel is active during testing.'
    );
  }

  // Optional accessibility check (would require actual HTTP request)
  if (checkAccessibility) {
    result.recommendations.push(
      'Consider testing callback URL accessibility by making a test POST request to ensure Safaricom can reach it.'
    );
  }
}

/**
 * Validate API URLs for sandbox
 */
function validateApiUrls(config: MpesaConfig, result: SandboxValidationResult): void {
  const expectedSandboxBase = 'https://sandbox.safaricom.co.ke';

  // Check OAuth URL
  if (!config.oauthUrl.startsWith(expectedSandboxBase)) {
    result.errors.push(`OAuth URL must use sandbox base URL: ${expectedSandboxBase}`);
  }

  // Check STK Push URL
  if (!config.stkPushUrl.startsWith(expectedSandboxBase)) {
    result.errors.push(`STK Push URL must use sandbox base URL: ${expectedSandboxBase}`);
  }

  // Check STK Query URL
  if (!config.stkQueryUrl.startsWith(expectedSandboxBase)) {
    result.errors.push(`STK Query URL must use sandbox base URL: ${expectedSandboxBase}`);
  }

  // Validate specific endpoints
  if (!config.oauthUrl.includes('/oauth/v1/generate')) {
    result.errors.push('OAuth URL must point to /oauth/v1/generate endpoint');
  }

  if (!config.stkPushUrl.includes('/mpesa/stkpush/v1/processrequest')) {
    result.errors.push('STK Push URL must point to /mpesa/stkpush/v1/processrequest endpoint');
  }

  if (!config.stkQueryUrl.includes('/mpesa/stkpushquery/v1/query')) {
    result.errors.push('STK Query URL must point to /mpesa/stkpushquery/v1/query endpoint');
  }
}

/**
 * Add sandbox-specific recommendations
 */
function addSandboxRecommendations(result: SandboxValidationResult): void {
  const testPhoneNumbers = getSandboxTestPhoneNumbers();
  
  result.recommendations.push(
    'Use Safaricom test phone numbers for testing: ' + testPhoneNumbers.join(', ')
  );

  result.recommendations.push(
    'Test with small amounts (1-1000 KES) to avoid unnecessary charges in sandbox'
  );

  result.recommendations.push(
    'Monitor callback logs during testing as sandbox callbacks may be delayed'
  );

  result.recommendations.push(
    'Ensure your Safaricom Developer Portal app has M-Pesa permissions enabled'
  );

  result.recommendations.push(
    'Test OAuth token generation before attempting payments to validate credentials'
  );
}

/**
 * Check if hostname is a private IP address
 */
function isPrivateIP(hostname: string): boolean {
  // IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  
  if (!match) return false;
  
  const [, a, b, c, d] = match.map(Number);
  
  // Check if it's a valid IP first
  if (a > 255 || b > 255 || c > 255 || d > 255) return false;
  
  // Check private ranges
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  
  return false;
}

/**
 * Validate phone number for sandbox testing
 * Requirement: Ensure sandbox uses Safaricom test MSISDNs
 */
export function validateSandboxPhoneNumber(phoneNumber: string): {
  isValid: boolean;
  error?: string;
  recommendation?: string;
} {
  if (!phoneNumber) {
    return {
      isValid: false,
      error: 'Phone number is required'
    };
  }

  // Normalize phone number (remove spaces, dashes, plus signs)
  const normalized = phoneNumber.replace(/[\s\-\+]/g, '');

  // Check format (should be 12 digits starting with 254)
  if (!/^254\d{9}$/.test(normalized)) {
    return {
      isValid: false,
      error: 'Phone number must be in format 254XXXXXXXXX (12 digits total)',
      recommendation: 'Use format: 254708374149 or 254711040400'
    };
  }

  // Check if it's a known test number
  const testNumbers = getSandboxTestPhoneNumbers();
  if (!testNumbers.includes(normalized)) {
    return {
      isValid: false,
      error: 'Phone number is not a valid Safaricom test number for sandbox',
      recommendation: `Use one of these test numbers: ${testNumbers.join(', ')}`
    };
  }

  return { isValid: true };
}

/**
 * Get sandbox configuration summary for display
 */
export function getSandboxConfigurationSummary(config: MpesaConfig): {
  environment: string;
  businessShortcode: string;
  isStandardShortcode: boolean;
  hasValidCredentials: boolean;
  callbackProtocol: string;
  testPhoneNumbers: string[];
  configurationStatus: 'complete' | 'partial' | 'invalid';
} {
  const validation = validateSandboxConfiguration(config);
  const testNumbers = getSandboxTestPhoneNumbers();
  
  let configStatus: 'complete' | 'partial' | 'invalid' = 'invalid';
  if (validation.isValid) {
    configStatus = 'complete';
  } else if (validation.errors.length === 0 && validation.warnings.length > 0) {
    configStatus = 'partial';
  }

  return {
    environment: config.environment,
    businessShortcode: config.businessShortcode,
    isStandardShortcode: config.businessShortcode === '174379',
    hasValidCredentials: !!(config.consumerKey && config.consumerSecret && 
                           config.consumerKey.length >= 10 && config.consumerSecret.length >= 10),
    callbackProtocol: config.callbackUrl ? new URL(config.callbackUrl).protocol : 'unknown',
    testPhoneNumbers: testNumbers,
    configurationStatus: configStatus
  };
}