const {
  determineOperation,
  generateJobId,
  performFullExport,
  performIncrementalExport,
  performDeltaExport,
} = require('../src/services/exportService');
const pool = require('../src/db/pool');
const { writeCSV } = require('../src/utils/csvWriter');
const { upsertWatermark, getWatermark } = require('../src/services/watermarkService');

// Mock dependencies
jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
}));

jest.mock('../src/utils/csvWriter', () => ({
  writeCSV: jest.fn(),
}));

jest.mock('../src/services/watermarkService', () => ({
  upsertWatermark: jest.fn(),
  getWatermark: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('Export Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('generateJobId', () => {
    test('should generate unique job ID', () => {
      const jobId1 = generateJobId();
      const jobId2 = generateJobId();
      
      expect(jobId1).toMatch(/^job_\d+_[a-z0-9]+$/);
      expect(jobId2).toMatch(/^job_\d+_[a-z0-9]+$/);
      expect(jobId1).not.toBe(jobId2);
    });
  });
  
  describe('determineOperation', () => {
    test('should return DELETE for soft-deleted records', () => {
      const record = {
        id: 1,
        is_deleted: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
      };
      expect(determineOperation(record)).toBe('DELETE');
    });
    
    test('should return INSERT when created_at equals updated_at', () => {
      const timestamp = new Date('2024-01-01T10:00:00Z');
      const record = {
        id: 1,
        is_deleted: false,
        created_at: timestamp,
        updated_at: timestamp,
      };
      expect(determineOperation(record)).toBe('INSERT');
    });
    
    test('should return UPDATE when updated_at is after created_at', () => {
      const record = {
        id: 1,
        is_deleted: false,
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-02T10:00:00Z'),
      };
      expect(determineOperation(record)).toBe('UPDATE');
    });
    
    test('should prioritize DELETE over INSERT/UPDATE', () => {
      const timestamp = new Date('2024-01-01T10:00:00Z');
      const record = {
        id: 1,
        is_deleted: true,
        created_at: timestamp,
        updated_at: timestamp,
      };
      expect(determineOperation(record)).toBe('DELETE');
    });
  });
  
  describe('performFullExport', () => {
    test('should export all non-deleted users and update watermark', async () => {
      const mockUsers = [
        { id: 1, name: 'User1', email: 'user1@test.com', created_at: new Date(), updated_at: new Date('2024-01-01'), is_deleted: false },
        { id: 2, name: 'User2', email: 'user2@test.com', created_at: new Date(), updated_at: new Date('2024-01-02'), is_deleted: false },
      ];
      
      pool.query.mockResolvedValue({ rows: mockUsers });
      writeCSV.mockResolvedValue(undefined);
      upsertWatermark.mockResolvedValue(undefined);
      
      const result = await performFullExport('test-consumer', 'job-123');
      
      expect(result.success).toBe(true);
      expect(result.rowsExported).toBe(2);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_deleted = FALSE')
      );
      expect(writeCSV).toHaveBeenCalled();
      expect(upsertWatermark).toHaveBeenCalledWith('test-consumer', mockUsers[1].updated_at);
    });
    
    test('should handle empty dataset', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      writeCSV.mockResolvedValue(undefined);
      
      const result = await performFullExport('test-consumer', 'job-123');
      
      expect(result.success).toBe(true);
      expect(result.rowsExported).toBe(0);
      expect(upsertWatermark).not.toHaveBeenCalled();
    });
    
    test('should throw error on database failure', async () => {
      pool.query.mockRejectedValue(new Error('Database error'));
      
      await expect(performFullExport('test-consumer', 'job-123')).rejects.toThrow('Database error');
    });
  });
  
  describe('performIncrementalExport', () => {
    test('should export only changed records after watermark', async () => {
      const watermarkDate = new Date('2024-01-01');
      const mockWatermark = { last_exported_at: watermarkDate };
      const mockUsers = [
        { id: 3, name: 'User3', email: 'user3@test.com', created_at: new Date(), updated_at: new Date('2024-01-02'), is_deleted: false },
      ];
      
      getWatermark.mockResolvedValue(mockWatermark);
      pool.query.mockResolvedValue({ rows: mockUsers });
      writeCSV.mockResolvedValue(undefined);
      upsertWatermark.mockResolvedValue(undefined);
      
      const result = await performIncrementalExport('test-consumer', 'job-456');
      
      expect(result.success).toBe(true);
      expect(result.rowsExported).toBe(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE updated_at > $1'),
        [watermarkDate]
      );
    });
    
    test('should throw error when no watermark exists', async () => {
      getWatermark.mockResolvedValue(null);
      
      await expect(performIncrementalExport('test-consumer', 'job-456')).rejects.toThrow('No watermark found');
    });
  });
  
  describe('performDeltaExport', () => {
    test('should export changed records with operation types', async () => {
      const watermarkDate = new Date('2024-01-01');
      const mockWatermark = { last_exported_at: watermarkDate };
      const now = new Date('2024-01-02T10:00:00Z');
      const mockUsers = [
        { id: 1, name: 'New', email: 'new@test.com', created_at: now, updated_at: now, is_deleted: false },
        { id: 2, name: 'Updated', email: 'updated@test.com', created_at: new Date('2024-01-01'), updated_at: now, is_deleted: false },
        { id: 3, name: 'Deleted', email: 'deleted@test.com', created_at: new Date('2024-01-01'), updated_at: now, is_deleted: true },
      ];
      
      getWatermark.mockResolvedValue(mockWatermark);
      pool.query.mockResolvedValue({ rows: mockUsers });
      writeCSV.mockResolvedValue(undefined);
      upsertWatermark.mockResolvedValue(undefined);
      
      const result = await performDeltaExport('test-consumer', 'job-789');
      
      expect(result.success).toBe(true);
      expect(result.rowsExported).toBe(3);
      
      // Verify writeCSV was called with operation column
      const csvCall = writeCSV.mock.calls[0];
      expect(csvCall[1][0]).toBe('operation');
      expect(csvCall[2][0].operation).toBe('INSERT');
      expect(csvCall[2][1].operation).toBe('UPDATE');
      expect(csvCall[2][2].operation).toBe('DELETE');
    });
    
    test('should throw error when no watermark exists', async () => {
      getWatermark.mockResolvedValue(null);
      
      await expect(performDeltaExport('test-consumer', 'job-789')).rejects.toThrow('No watermark found');
    });
  });
});
