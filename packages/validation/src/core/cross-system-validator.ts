/**
 * TABEZA Validation Library - Cross-System Validator
 * Validates data compatibility between cloud and agent systems
 */

import type { 
  CrossSystemValidation, 
  CrossSystemValidationParams,
  SystemType,
  IssueSeverity 
} from '../types';
import { CLOUD_COMPATIBILITY_RULES, AGENT_COMPATIBILITY_RULES } from '../constants';

/**
 * Cross-System Validator Class
 * Handles validation of data compatibility across cloud and agent systems
 */
export class CrossSystemValidator {
  private strictMode: boolean = false;

  constructor(options: { strictMode?: boolean } = {}) {
    this.strictMode = options.strictMode || false;
  }

  /**
   * Validate cross-system compatibility
   */
  validate(params: CrossSystemValidationParams): CrossSystemValidation {
    const { data, targetSystems, strictMode = this.strictMode } = params;
    const issues = [];
    let consistencyScore = 100;
    let cloudCompatible = true;
    let agentCompatible = true;

    // Check cloud compatibility
    if (targetSystems.includes('CLOUD') || targetSystems.includes('BOTH')) {
      const cloudIssues = this.validateCloudCompatibility(data, strictMode);
      issues.push(...cloudIssues);
      
      if (cloudIssues.some(issue => issue.severity === 'BLOCKING')) {
        cloudCompatible = false;
        consistencyScore -= 30;
      } else if (cloudIssues.length > 0) {
        consistencyScore -= cloudIssues.length * 5;
      }
    }

    // Check agent compatibility
    if (targetSystems.includes('AGENT') || targetSystems.includes('BOTH')) {
      const agentIssues = this.validateAgentCompatibility(data, strictMode);
      issues.push(...agentIssues);
      
      if (agentIssues.some(issue => issue.severity === 'BLOCKING')) {
        agentCompatible = false;
        consistencyScore -= 30;
      } else if (agentIssues.length > 0) {
        consistencyScore -= agentIssues.length * 5;
      }
    }

    return {
      cloudCompatible,
      agentCompatible,
      consistencyScore: Math.max(0, consistencyScore),
      issues,
      validatedAt: new Date().toISOString()
    };
  }

  /**
   * Validate cloud system compatibility
   */
  private validateCloudCompatibility(data: any, strictMode: boolean): Array<{
    system: 'CLOUD';
    issue: string;
    severity: IssueSeverity;
    recommendation?: string;
  }> {
    const issues = [];

    // Check for binary data
    if (this.containsBinaryData(data)) {
      issues.push({
        system: 'CLOUD' as const,
        issue: 'Data contains binary content',
        severity: 'BLOCKING' as const,
        recommendation: 'Convert binary data to base64 or remove it'
      });
    }

    // Check for file system paths
    if (this.containsFilePaths(data)) {
      issues.push({
        system: 'CLOUD' as const,
        issue: 'Data contains file system paths',
        severity: 'WARNING' as const,
        recommendation: 'Use relative paths or URLs instead'
      });
    }

    // Check for OS-specific operations
    if (this.containsOSOperations(data)) {
      issues.push({
        system: 'CLOUD' as const,
        issue: 'Data references OS-specific operations',
        severity: 'BLOCKING' as const,
        recommendation: 'Remove OS-specific references'
      });
    }

    // Check data size for serverless limits
    const dataSize = this.getDataSize(data);
    if (dataSize > 6 * 1024 * 1024) { // 6MB Lambda limit
      issues.push({
        system: 'CLOUD' as const,
        issue: 'Data exceeds serverless function limits',
        severity: 'BLOCKING' as const,
        recommendation: 'Split data into smaller chunks or use streaming'
      });
    }

    // Check for non-serializable data
    if (!this.isSerializable(data)) {
      issues.push({
        system: 'CLOUD' as const,
        issue: 'Data contains non-serializable content',
        severity: 'BLOCKING' as const,
        recommendation: 'Ensure all data is JSON serializable'
      });
    }

    // Check for circular references
    if (this.hasCircularReferences(data)) {
      issues.push({
        system: 'CLOUD' as const,
        issue: 'Data contains circular references',
        severity: 'BLOCKING' as const,
        recommendation: 'Remove circular references from data structure'
      });
    }

    return issues;
  }

  /**
   * Validate agent system compatibility
   */
  private validateAgentCompatibility(data: any, strictMode: boolean): Array<{
    system: 'AGENT';
    issue: string;
    severity: IssueSeverity;
    recommendation?: string;
  }> {
    const issues = [];

    // Check for very large data structures
    const dataSize = this.getDataSize(data);
    if (dataSize > 100 * 1024 * 1024) { // 100MB
      issues.push({
        system: 'AGENT' as const,
        issue: 'Data structure is very large',
        severity: 'WARNING' as const,
        recommendation: 'Consider splitting large data into smaller chunks'
      });
    }

    // Check for deeply nested structures
    const depth = this.getObjectDepth(data);
    if (depth > 20) {
      issues.push({
        system: 'AGENT' as const,
        issue: 'Data structure is deeply nested',
        severity: 'WARNING' as const,
        recommendation: 'Flatten data structure to improve performance'
      });
    }

    // Check for Windows path compatibility
    if (this.hasIncompatiblePaths(data)) {
      issues.push({
        system: 'AGENT' as const,
        issue: 'Data contains Windows-incompatible paths',
        severity: 'WARNING' as const,
        recommendation: 'Use Windows-compatible path formats'
      });
    }

    return issues;
  }

  /**
   * Check if data contains binary content
   */
  private containsBinaryData(obj: any): boolean {
    if (obj instanceof Buffer || obj instanceof ArrayBuffer || obj instanceof Uint8Array) {
      return true;
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        if (this.containsBinaryData(value)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if data contains file system paths
   */
  private containsFilePaths(obj: any): boolean {
    if (typeof obj === 'string') {
      // Check for common file path patterns
      return /^[A-Za-z]:\\|^\/|^\.\/|^\.\.\//.test(obj);
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        if (this.containsFilePaths(value)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if data contains OS-specific operations
   */
  private containsOSOperations(obj: any): boolean {
    if (typeof obj === 'string') {
      const osPatterns = [
        /process\./,
        /require\(/,
        /fs\./,
        /path\./,
        /os\./,
        /child_process/,
        /spawn|exec|fork/
      ];
      return osPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        if (this.containsOSOperations(value)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get approximate data size in bytes
   */
  private getDataSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Fallback for environments without Blob
      return JSON.stringify(data).length * 2; // Rough estimate
    }
  }

  /**
   * Check if data is JSON serializable
   */
  private isSerializable(data: any): boolean {
    try {
      JSON.stringify(data);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check for circular references
   */
  private hasCircularReferences(obj: any): boolean {
    const seen = new WeakSet();
    
    function detect(obj: any): boolean {
      if (obj !== null && typeof obj === 'object') {
        if (seen.has(obj)) {
          return true;
        }
        seen.add(obj);
        
        for (const value of Object.values(obj)) {
          if (detect(value)) {
            return true;
          }
        }
      }
      return false;
    }
    
    return detect(obj);
  }

  /**
   * Get object nesting depth
   */
  private getObjectDepth(obj: any): number {
    if (typeof obj !== 'object' || obj === null) {
      return 0;
    }
    
    let maxDepth = 0;
    for (const value of Object.values(obj)) {
      const depth = this.getObjectDepth(value);
      maxDepth = Math.max(maxDepth, depth);
    }
    
    return maxDepth + 1;
  }

  /**
   * Check for Windows-incompatible paths
   */
  private hasIncompatiblePaths(obj: any): boolean {
    if (typeof obj === 'string') {
      // Check for Unix-style paths that might not work on Windows
      return /^\/[^\\]*$/.test(obj) && obj.includes('/');
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        if (this.hasIncompatiblePaths(value)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get compatibility report
   */
  getCompatibilityReport(data: any, targetSystems: SystemType[]): {
    overall: 'COMPATIBLE' | 'PARTIALLY_COMPATIBLE' | 'INCOMPATIBLE';
    cloudScore: number;
    agentScore: number;
    recommendations: string[];
    blockers: string[];
  } {
    const validation = this.validate({ data, targetSystems });
    
    const blockers = validation.issues
      .filter(issue => issue.severity === 'BLOCKING')
      .map(issue => issue.issue);
    
    const recommendations = validation.issues
      .filter(issue => issue.recommendation)
      .map(issue => issue.recommendation!);

    let overall: 'COMPATIBLE' | 'PARTIALLY_COMPATIBLE' | 'INCOMPATIBLE';
    if (blockers.length > 0) {
      overall = 'INCOMPATIBLE';
    } else if (validation.issues.length > 0) {
      overall = 'PARTIALLY_COMPATIBLE';
    } else {
      overall = 'COMPATIBLE';
    }

    return {
      overall,
      cloudScore: validation.cloudCompatible ? 100 : 0,
      agentScore: validation.agentCompatible ? 100 : 0,
      recommendations,
      blockers
    };
  }

  /**
   * Set strict mode
   */
  setStrictMode(strict: boolean): void {
    this.strictMode = strict;
  }

  /**
   * Get strict mode status
   */
  isStrictMode(): boolean {
    return this.strictMode;
  }
}