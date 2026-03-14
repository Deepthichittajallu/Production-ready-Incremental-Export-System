const pool = require('../src/db/pool');
const { getWatermark, upsertWatermark } = require('../src/services/watermarkService');

// Mock the pool
jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('Watermark Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getWatermark', () => {
    test('should return watermark when it exists', async () => {
      const mockWatermark = {
        consumer_id: 'test-consumer',
        last_exported_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T10:05:00Z'),
      };
      
      pool.query.mockResolvedValue({ rows: [mockWatermark] });
      
      const result = await getWatermark('test-consumer');
      
      expect(result).toEqual(mockWatermark);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT consumer_id, last_exported_at'),
        ['test-consumer']
      );
    });
    
    test('should return null when watermark does not exist', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      
      const result = await getWatermark('non-existent');
      
      expect(result).toBeNull();
    });
    
    test('should propagate database errors', async () => {
      pool.query.mockRejectedValue(new Error('Database error'));
      
      await expect(getWatermark('test-consumer')).rejects.toThrow('Database error');
    });
  });
  
  describe('upsertWatermark', () => {
    let mockClient;
    
    beforeEach(() => {
      mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(mockClient);
    });
    
    test('should insert new watermark', async () => {
      const timestamp = new Date('2024-01-01T10:00:00Z');
      const mockResult = {
        rows: [{
          id: 1,
          consumer_id: 'new-consumer',
          last_exported_at: timestamp,
          updated_at: new Date(),
        }],
      };
      
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(mockResult) // INSERT
        .mockResolvedValueOnce(undefined); // COMMIT
      
      const result = await upsertWatermark('new-consumer', timestamp);
      
      expect(result).toEqual(mockResult.rows[0]);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });
    
    test('should update existing watermark', async () => {
      const timestamp = new Date('2024-01-02T10:00:00Z');
      const mockResult = {
        rows: [{
          id: 1,
          consumer_id: 'existing-consumer',
          last_exported_at: timestamp,
          updated_at: new Date(),
        }],
      };
      
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(mockResult) // INSERT ON CONFLICT
        .mockResolvedValueOnce(undefined); // COMMIT
      
      const result = await upsertWatermark('existing-consumer', timestamp);
      
      expect(result).toEqual(mockResult.rows[0]);
    });
    
    test('should rollback on error', async () => {
      const timestamp = new Date('2024-01-01T10:00:00Z');
      
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('Insert failed')); // INSERT fails
      
      await expect(upsertWatermark('test-consumer', timestamp)).rejects.toThrow('Insert failed');
      
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
    
    test('should release client even if rollback fails', async () => {
      const timestamp = new Date('2024-01-01T10:00:00Z');
      
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('Insert failed')) // INSERT fails
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails
      
      await expect(upsertWatermark('test-consumer', timestamp)).rejects.toThrow();
      
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
