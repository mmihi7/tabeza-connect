/**
 * Unit Tests for Test Infrastructure
 * 
 * Tests the test infrastructure components including:
 * - Sample receipt loading from test-receipts directory
 * - Parsing statistics calculation
 * - Template validation script functionality
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

const fs = require('fs');
const path = require('path');
const { testMode, DEFAULT_TEMPLATE } = require('../receiptParser');
const { 
  loadReceiptFile, 
  loadAllSampleReceipts 
} = require('../../test-parser-mode');
const {
  loadTemplateFromFile,
  l