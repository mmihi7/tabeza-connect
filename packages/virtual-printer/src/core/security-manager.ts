/**
 * Security & Integrity Layer
 * Handles receipt hashing, digital signing, and tamper detection
 * Ensures receipt authenticity and prevents fraud
 */

import { createHash, createHmac, randomBytes } from 'crypto';
import { CanonicalReceipt } from '../types/receipt';

export interface SecurityConfig {
  hashAlgorithm: 'sha256' | 'sha512';
  signatureAlgorithm: 'hmac-sha256' | 'hmac-sha512';
  secretKey: string;
  enableTimestampValidation: boolean;
  maxReceiptAge: number; // seconds
  enableIntegrityChecks: boolean;
}

export interface ReceiptSignature {
  hash: string;
  signature: string;
  timestamp: string;
  algorithm: string;
  version: string;
}

export interface SecurityAudit {
  receiptId: string;
  isValid: boolean;
  checks: {
    hashIntegrity: boolean;
    signatureValid: boolean;
    timestampValid: boolean;
    contentIntegrity: boolean;
  };
  errors: string[];
  auditedAt: string;
}

export class SecurityManager {
  private config: SecurityConfig;
  private readonly SIGNATURE_VERSION = '1.0';

  constructor(config: SecurityConfig) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * Generate secure hash for receipt
   */
  generateReceiptHash(receipt: CanonicalReceipt): string {
    // Create canonical representation for hashing
    const canonicalData = this.createCanonicalRepresentation(receipt);
    
    const hash = createHash(this.config.hashAlgorithm);
    hash.update(canonicalData);
    
    return hash.digest('hex');
  }

  /**
   * Sign receipt with HMAC
   */
  signReceipt(receipt: CanonicalReceipt): ReceiptSignature {
    const hash = this.generateReceiptHash(receipt);
    const timestamp = new Date().toISOString();
    
    // Create signature payload
    const signaturePayload = `${hash}|${timestamp}|${this.SIGNATURE_VERSION}`;
    
    const hmac = createHmac(
      this.config.signatureAlgorithm.replace('hmac-', ''),
      this.config.secretKey
    );
    hmac.update(signaturePayload);
    const signature = hmac.digest('hex');

    return {
      hash,
      signature,
      timestamp,
      algorithm: this.config.signatureAlgorithm,
      version: this.SIGNATURE_VERSION
    };
  }

  /**
   * Verify receipt signature and integrity
   */
  verifyReceipt(receipt: CanonicalReceipt, signature: ReceiptSignature): SecurityAudit {
    const audit: SecurityAudit = {
      receiptId: receipt.receipt_id,
      isValid: true,
      checks: {
        hashIntegrity: false,
        signatureValid: false,
        timestampValid: false,
        contentIntegrity: false
      },
      errors: [],
      auditedAt: new Date().toISOString()
    };

    try {
      // 1. Verify hash integrity
      const currentHash = this.generateReceiptHash(receipt);
      audit.checks.hashIntegrity = currentHash === signature.hash;
      if (!audit.checks.hashIntegrity) {
        audit.errors.push('Receipt hash mismatch - content may have been tampered with');
      }

      // 2. Verify signature
      const signaturePayload = `${signature.hash}|${signature.timestamp}|${signature.version}`;
      const expectedSignature = createHmac(
        signature.algorithm.replace('hmac-', ''),
        this.config.secretKey
      );
      expectedSignature.update(signaturePayload);
      const expectedSig = expectedSignature.digest('hex');
      
      audit.checks.signatureValid = expectedSig === signature.signature;
      if (!audit.checks.signatureValid) {
        audit.errors.push('Invalid signature - receipt authenticity cannot be verified');
      }

      // 3. Verify timestamp
      if (this.config.enableTimestampValidation) {
        const signatureTime = new Date(signature.timestamp).getTime();
        const currentTime = Date.now();
        const ageInSeconds = (currentTime - signatureTime) / 1000;
        
        audit.checks.timestampValid = ageInSeconds <= this.config.maxReceiptAge;
        if (!audit.checks.timestampValid) {
          audit.errors.push(`Receipt is too old (${Math.round(ageInSeconds)}s > ${this.config.maxReceiptAge}s)`);
        }
      } else {
        audit.checks.timestampValid = true;
      }

      // 4. Verify content integrity
      audit.checks.contentIntegrity = this.verifyContentIntegrity(receipt);
      if (!audit.checks.contentIntegrity) {
        audit.errors.push('Receipt content integrity check failed');
      }

      // Overall validity
      audit.isValid = Object.values(audit.checks).every(check => check);

    } catch (error) {
      audit.isValid = false;
      audit.errors.push(`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return audit;
  }

  /**
   * Create tamper-evident receipt ID
   */
  generateSecureReceiptId(merchantId: string, timestamp: string): string {
    const nonce = randomBytes(8).toString('hex');
    const payload = `${merchantId}|${timestamp}|${nonce}`;
    
    const hash = createHash('sha256');
    hash.update(payload);
    const hashHex = hash.digest('hex').substring(0, 16);
    
    return `tbr_${hashHex}_${nonce}`;
  }

  /**
   * Verify receipt ID authenticity
   */
  verifyReceiptId(receiptId: string, merchantId: string, timestamp: string): boolean {
    try {
      const parts = receiptId.split('_');
      if (parts.length !== 3 || parts[0] !== 'tbr') {
        return false;
      }

      const [, hashPart, nonce] = parts;
      const payload = `${merchantId}|${timestamp}|${nonce}`;
      
      const hash = createHash('sha256');
      hash.update(payload);
      const expectedHash = hash.digest('hex').substring(0, 16);
      
      return hashPart === expectedHash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate integrity checksum for receipt data
   */
  generateIntegrityChecksum(data: any): string {
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    const hash = createHash('sha256');
    hash.update(serialized);
    return hash.digest('hex');
  }

  /**
   * Detect potential tampering patterns
   */
  detectTampering(receipt: CanonicalReceipt): {
    suspicious: boolean;
    indicators: string[];
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const indicators: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for suspicious patterns
    
    // 1. Unusual total calculations
    const calculatedTotal = receipt.items.reduce((sum, item) => sum + item.total_price, 0);
    const declaredSubtotal = receipt.totals.subtotal;
    const tolerance = 0.01; // 1 cent tolerance for rounding
    
    if (Math.abs(calculatedTotal - declaredSubtotal) > tolerance) {
      indicators.push('Subtotal does not match sum of items');
      riskLevel = 'high';
    }

    // 2. Check total calculation
    const expectedTotal = receipt.totals.subtotal + receipt.totals.tax - receipt.totals.discount;
    if (Math.abs(expectedTotal - receipt.totals.total) > tolerance) {
      indicators.push('Total calculation appears incorrect');
      riskLevel = 'high';
    }

    // 3. Check for negative values where they shouldn't be
    if (receipt.totals.total < 0) {
      indicators.push('Negative total amount');
      riskLevel = 'high';
    }

    if (receipt.items.some(item => item.qty <= 0 || item.unit_price < 0)) {
      indicators.push('Invalid item quantities or prices');
      riskLevel = 'medium';
    }

    // 4. Check for suspicious timestamps
    const receiptTime = new Date(receipt.transaction.datetime).getTime();
    const createdTime = new Date(receipt.created_at).getTime();
    
    if (receiptTime > createdTime + 60000) { // More than 1 minute in future
      indicators.push('Receipt timestamp is in the future');
      riskLevel = 'medium';
    }

    // 5. Check for duplicate receipt numbers (would need external data)
    // This would be implemented with a database check in a real system

    // 6. Check for unusual patterns in receipt number
    if (!/^[A-Z0-9\-_]+$/i.test(receipt.transaction.receipt_no)) {
      indicators.push('Unusual characters in receipt number');
      riskLevel = 'low';
    }

    return {
      suspicious: indicators.length > 0,
      indicators,
      riskLevel
    };
  }

  /**
   * Generate fraud detection report
   */
  generateFraudReport(receipts: CanonicalReceipt[]): {
    totalReceipts: number;
    suspiciousReceipts: number;
    riskDistribution: { low: number; medium: number; high: number };
    commonIndicators: { indicator: string; count: number }[];
    recommendations: string[];
  } {
    const report = {
      totalReceipts: receipts.length,
      suspiciousReceipts: 0,
      riskDistribution: { low: 0, medium: 0, high: 0 },
      commonIndicators: [] as { indicator: string; count: number }[],
      recommendations: [] as string[]
    };

    const indicatorCounts = new Map<string, number>();

    for (const receipt of receipts) {
      const tamperingCheck = this.detectTampering(receipt);
      
      if (tamperingCheck.suspicious) {
        report.suspiciousReceipts++;
        report.riskDistribution[tamperingCheck.riskLevel]++;

        // Count indicators
        for (const indicator of tamperingCheck.indicators) {
          indicatorCounts.set(indicator, (indicatorCounts.get(indicator) || 0) + 1);
        }
      }
    }

    // Sort indicators by frequency
    report.commonIndicators = Array.from(indicatorCounts.entries())
      .map(([indicator, count]) => ({ indicator, count }))
      .sort((a, b) => b.count - a.count);

    // Generate recommendations
    if (report.suspiciousReceipts > 0) {
      const suspiciousRate = (report.suspiciousReceipts / report.totalReceipts) * 100;
      
      if (suspiciousRate > 10) {
        report.recommendations.push('High fraud rate detected - implement additional validation');
      }
      
      if (report.riskDistribution.high > 0) {
        report.recommendations.push('High-risk receipts found - manual review recommended');
      }
      
      if (report.commonIndicators.length > 0) {
        report.recommendations.push(`Most common issue: ${report.commonIndicators[0].indicator}`);
      }
    }

    return report;
  }

  /**
   * Create canonical representation for hashing
   */
  private createCanonicalRepresentation(receipt: CanonicalReceipt): string {
    // Create a deterministic string representation
    const canonical = {
      merchant: {
        id: receipt.merchant.id,
        name: receipt.merchant.name,
        kra_pin: receipt.merchant.kra_pin || ''
      },
      transaction: {
        receipt_no: receipt.transaction.receipt_no,
        datetime: receipt.transaction.datetime,
        currency: receipt.transaction.currency
      },
      items: receipt.items.map(item => ({
        name: item.name,
        qty: item.qty,
        unit_price: item.unit_price,
        total_price: item.total_price
      })).sort((a, b) => a.name.localeCompare(b.name)), // Sort for consistency
      totals: {
        subtotal: receipt.totals.subtotal,
        tax: receipt.totals.tax,
        discount: receipt.totals.discount,
        total: receipt.totals.total
      }
    };

    return JSON.stringify(canonical, Object.keys(canonical).sort());
  }

  /**
   * Verify content integrity
   */
  private verifyContentIntegrity(receipt: CanonicalReceipt): boolean {
    try {
      // Basic integrity checks
      if (!receipt.receipt_id || !receipt.merchant.id || !receipt.transaction.receipt_no) {
        return false;
      }

      if (receipt.items.length === 0) {
        return false;
      }

      if (receipt.totals.total <= 0) {
        return false;
      }

      // Check that all required fields are present and valid
      for (const item of receipt.items) {
        if (!item.name || item.qty <= 0 || item.unit_price < 0 || item.total_price < 0) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate security configuration
   */
  private validateConfig(): void {
    if (!this.config.secretKey || this.config.secretKey.length < 32) {
      throw new Error('Secret key must be at least 32 characters long');
    }

    if (!['sha256', 'sha512'].includes(this.config.hashAlgorithm)) {
      throw new Error('Invalid hash algorithm');
    }

    if (!['hmac-sha256', 'hmac-sha512'].includes(this.config.signatureAlgorithm)) {
      throw new Error('Invalid signature algorithm');
    }

    if (this.config.maxReceiptAge <= 0) {
      throw new Error('Max receipt age must be positive');
    }
  }

  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig();
    console.log('Security configuration updated');
  }

  /**
   * Get current configuration (without secret key)
   */
  getConfig(): Omit<SecurityConfig, 'secretKey'> {
    const { secretKey, ...safeConfig } = this.config;
    return safeConfig;
  }
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: Omit<SecurityConfig, 'secretKey'> = {
  hashAlgorithm: 'sha256',
  signatureAlgorithm: 'hmac-sha256',
  enableTimestampValidation: true,
  maxReceiptAge: 86400, // 24 hours
  enableIntegrityChecks: true
};