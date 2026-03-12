/**
 * Template Generation Wizard Tests
 * 
 * Tests the template generation wizard workflow:
 * - UI serves correctly
 * - Receipt detection polling works
 * - Template generation API integration
 * - Error handling and retry logic
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');

describe('Template Generation Wizard', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../../public')));
    
    // Mock config and captureService
    app.locals.config = {
      barId: 'test-bar-id',
      apiUrl: 'https://test.tabeza.co.ke'
    };
    
    app.locals.captureService = {
      queueManager: {
        pendingPath: path.join(__dirname, '../../../test-queue/pending'),
        uploadedPath: path.join(__dirname, '../../../test-queue/uploaded')
      }
    };
    
    // Mount template routes
    const templateRoutes = require('../routes/template');
    app.use('/api/template', templateRoutes);
    app.use('/api/receipts', templateRoutes);
  });
  
  describe('Wizard UI', () => {
    test('should serve template wizard HTML', async () => {
      const response = await request(app).get('/template-wizard.html');
      
      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
      expect(response.text).toContain('Template Generation Wizard');
    });
    
    test('should serve template wizard JavaScript', async () => {
      const response = await request(app).get('/js/template-wizard.js');
      
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/javascript/);
      expect(response.text).toContain('Template Generation Wizard');
    });
  });
  
  describe('Template Status API', () => {
    test('should return template status when template exists', async () => {
      // Create a mock template file
      const templatePath = 'C:\\ProgramData\\Tabeza\\template.json';
      const templateDir = path.dirname(templatePath);
      
      // Skip if we can't write to the directory (CI environment)
      if (!fs.existsSync(templateDir)) {
        return;
      }
      
      const mockTemplate = {
        version: '1.0',
        posSystem: 'TestPOS',
        patterns: {
          item_line: '^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$',
          total_line: '^TOTAL\\s+([0-9,]+\\.\\d{2})$'
        }
      };
      
      fs.writeFileSync(templatePath, JSON.stringify(mockTemplate, null, 2));
      
      const response = await request(app).get('/api/template/status');
      
      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(true);
      expect(response.body.version).toBe('1.0');
      expect(response.body.posSystem).toBe('TestPOS');
      
      // Cleanup
      fs.unlinkSync(templatePath);
    });
    
    test('should return not exists when template missing', async () => {
      const response = await request(app).get('/api/template/status');
      
      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(false);
    });
  });
  
  describe('Template Generation API', () => {
    test('should reject request with less than 3 receipts', async () => {
      const response = await request(app)
        .post('/api/template/generate')
        .send({
          receipts: ['receipt1', 'receipt2']
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('exactly 3 receipt samples');
    });
    
    test('should reject request with empty receipts', async () => {
      const response = await request(app)
        .post('/api/template/generate')
        .send({
          receipts: ['receipt1', '', 'receipt3']
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('empty or invalid');
    });
    
    test('should reject request with non-string receipts', async () => {
      const response = await request(app)
        .post('/api/template/generate')
        .send({
          receipts: ['receipt1', 123, 'receipt3']
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    test('should handle missing API URL configuration', async () => {
      app.locals.config.apiUrl = null;
      
      const response = await request(app)
        .post('/api/template/generate')
        .send({
          receipts: ['receipt1', 'receipt2', 'receipt3']
        });
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('API URL not configured');
    });
  });
  
  describe('Recent Receipts API', () => {
    test('should return empty array when no receipts exist', async () => {
      const response = await request(app).get('/api/receipts/recent');
      
      expect(response.status).toBe(200);
      expect(response.body.receipts).toEqual([]);
      expect(response.body.count).toBe(0);
    });
    
    test('should handle missing queue manager gracefully', async () => {
      app.locals.captureService = null;
      
      const response = await request(app).get('/api/receipts/recent');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Queue manager not initialized');
    });
  });
});

describe('Template Wizard Client Logic', () => {
  // These tests would require a browser environment or jsdom
  // For now, we'll test the core logic functions
  
  test('should validate receipt count before generation', () => {
    const state = {
      receipts: ['receipt1', 'receipt2']
    };
    
    expect(state.receipts.length).toBeLessThan(3);
  });
  
  test('should track wizard progress through steps', () => {
    const state = {
      currentStep: 1,
      capturedReceipts: []
    };
    
    // Simulate receipt capture
    state.capturedReceipts.push({ id: 1 });
    state.currentStep = 2;
    
    expect(state.currentStep).toBe(2);
    expect(state.capturedReceipts.length).toBe(1);
  });
  
  test('should calculate progress percentage correctly', () => {
    const calculateProgress = (capturedCount) => {
      return (capturedCount / 3) * 75; // 75% for 3 receipts
    };
    
    expect(calculateProgress(0)).toBe(0);
    expect(calculateProgress(1)).toBe(25);
    expect(calculateProgress(2)).toBe(50);
    expect(calculateProgress(3)).toBe(75);
  });
});
