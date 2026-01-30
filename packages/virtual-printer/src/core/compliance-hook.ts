/**
 * Compliance Hook
 * Metadata-only compliance flags for receipt processing
 * NO LOGIC. NO SUBMISSIONS. NO REGULATORY KNOWLEDGE.
 * 
 * The printer captures truth. The server decides compliance.
 */

export interface ComplianceHint {
  jurisdiction?: 'KE' | 'UG' | 'TZ' | 'RW';
  receipt_type?: 'SALE' | 'REFUND' | 'VOID' | 'ADJUSTMENT';
  business_category?: 'RESTAURANT' | 'RETAIL' | 'SERVICE' | 'OTHER';
  requires_tax_submission?: boolean;
  customer_type?: 'B2B' | 'B2C';
}

export interface ComplianceMetadata {
  hints?: ComplianceHint;
  captured_at: string;
  capture_source: 'PRINTER' | 'MANUAL' | 'API';
  processing_flags?: {
    requires_review?: boolean;
    high_value?: boolean;
    cross_border?: boolean;
  };
}

/**
 * Attach compliance hints to receipt (metadata only)
 */
export function attachComplianceHints(
  receipt: any, 
  hints: ComplianceHint
): any {
  return {
    ...receipt,
    _compliance: {
      hints,
      captured_at: new Date().toISOString(),
      capture_source: 'PRINTER' as const,
      processing_flags: {
        requires_review: hints.requires_tax_submission || false,
        high_value: receipt.totals?.total > 100000, // KES 100k+
        cross_border: false // Edge layer doesn't know this
      }
    } as ComplianceMetadata
  };
}

/**
 * Extract compliance metadata from receipt
 */
export function getComplianceMetadata(receipt: any): ComplianceMetadata | undefined {
  return receipt._compliance;
}

/**
 * Check if receipt has compliance hints
 */
export function hasComplianceHints(receipt: any): boolean {
  return !!(receipt._compliance?.hints);
}

/**
 * Create default compliance hints based on receipt data
 */
export function createDefaultHints(receipt: any): ComplianceHint {
  const hints: ComplianceHint = {
    receipt_type: 'SALE', // Default assumption
    customer_type: 'B2C'  // Default assumption
  };

  // Infer business category from merchant name (simple heuristics)
  const merchantName = receipt.merchant?.name?.toLowerCase() || '';
  if (merchantName.includes('restaurant') || merchantName.includes('cafe') || merchantName.includes('hotel')) {
    hints.business_category = 'RESTAURANT';
  } else if (merchantName.includes('shop') || merchantName.includes('store') || merchantName.includes('mart')) {
    hints.business_category = 'RETAIL';
  } else {
    hints.business_category = 'OTHER';
  }

  // Infer jurisdiction from merchant location (if available)
  const location = receipt.merchant?.location?.toLowerCase() || '';
  if (location.includes('kenya') || location.includes('nairobi') || location.includes('mombasa')) {
    hints.jurisdiction = 'KE';
  } else if (location.includes('uganda') || location.includes('kampala')) {
    hints.jurisdiction = 'UG';
  } else if (location.includes('tanzania') || location.includes('dar es salaam')) {
    hints.jurisdiction = 'TZ';
  } else if (location.includes('rwanda') || location.includes('kigali')) {
    hints.jurisdiction = 'RW';
  }

  // Flag for potential tax submission requirement (heuristic only)
  hints.requires_tax_submission = !!(receipt.merchant?.kra_pin || receipt.totals?.total > 10000);

  return hints;
}

/**
 * Sanitize compliance metadata for transmission
 */
export function sanitizeComplianceMetadata(metadata: ComplianceMetadata): ComplianceMetadata {
  return {
    hints: metadata.hints,
    captured_at: metadata.captured_at,
    capture_source: metadata.capture_source,
    processing_flags: metadata.processing_flags
  };
}