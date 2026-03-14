const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/db/pool');
const fs = require('fs');
const path = require('path');

// Mock the actual export functions to avoid database operations in tests
jest.mock('../src/services/exportService', () => {
  const original = jest.requireActual('../src/services/exportService');
  return {
    ...original,
    performFullExport: jest.fn().mockResolvedValue({ 
      success: true, 
      filename: 'test_full.csv', 
      rowsExported: 100 
    }),
    performIncrementalExport: jest.fn().mockResolvedValue({ 
      success: true, 
      filename: 'test_incremental.csv', 
      rowsExported: 10 
    }),
    performDeltaExport: jest.fn().mockResolvedValue({ 
      success: true, 
      filename: 'test_delta.csv', 
      rowsExported: 5 
    }),
  };
});

jest.mock('../src/services/watermarkService', () => ({
  getWatermark: jest.fn(),
  upsertWatermark: jest.fn(),
}));

const { getWatermark } = require('../src/services/watermarkService');

describe('API Endpoints', () => {
  describe('GET /health', () => {
    test('should return 200 with status ok', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });
  
  describe('POST /exports/full', () => {
    test('should return 202 with job details', async () => {
      const response = await request(app)
        .post('/exports/full')
        .set('X-Consumer-ID', 'test-consumer');
      
      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('status', 'started');
      expect(response.body).toHaveProperty('exportType', 'full');
      expect(response.body).toHaveProperty('outputFilename');
      expect(response.body.outputFilename).toContain('full_test-consumer');
    });
    
    test('should return 400 when X-Consumer-ID header is missing', async () => {
      const response = await request(app).post('/exports/full');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('POST /exports/incremental', () => {
    test('should return 202 with job details', async () => {
      const response = await request(app)
        .post('/exports/incremental')
        .set('X-Consumer-ID', 'test-consumer');
      
      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('status', 'started');
      expect(response.body).toHaveProperty('exportType', 'incremental');
      expect(response.body).toHaveProperty('outputFilename');
      expect(response.body.outputFilename).toContain('incremental_test-consumer');
    });
    
    test('should return 400 when X-Consumer-ID header is missing', async () => {
      const response = await request(app).post('/exports/incremental');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('POST /exports/delta', () => {
    test('should return 202 with job details', async () => {
      const response = await request(app)
        .post('/exports/delta')
        .set('X-Consumer-ID', 'test-consumer');
      
      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('status', 'started');
      expect(response.body).toHaveProperty('exportType', 'delta');
      expect(response.body).toHaveProperty('outputFilename');
      expect(response.body.outputFilename).toContain('delta_test-consumer');
    });
    
    test('should return 400 when X-Consumer-ID header is missing', async () => {
      const response = await request(app).post('/exports/delta');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('GET /exports/watermark', () => {
    test('should return 200 with watermark data when watermark exists', async () => {
      const mockWatermark = {
        consumer_id: 'test-consumer',
        last_exported_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T10:05:00Z'),
      };
      
      getWatermark.mockResolvedValue(mockWatermark);
      
      const response = await request(app)
        .get('/exports/watermark')
        .set('X-Consumer-ID', 'test-consumer');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('consumerId', 'test-consumer');
      expect(response.body).toHaveProperty('lastExportedAt');
      expect(new Date(response.body.lastExportedAt)).toBeInstanceOf(Date);
    });
    
    test('should return 404 when watermark does not exist', async () => {
      getWatermark.mockResolvedValue(null);
      
      const response = await request(app)
        .get('/exports/watermark')
        .set('X-Consumer-ID', 'non-existent-consumer');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
    
    test('should return 400 when X-Consumer-ID header is missing', async () => {
      const response = await request(app).get('/exports/watermark');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    test('should return 500 when database error occurs', async () => {
      getWatermark.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .get('/exports/watermark')
        .set('X-Consumer-ID', 'test-consumer');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
