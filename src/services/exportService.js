const pool = require('../db/pool');
const logger = require('../utils/logger');
const { writeCSV } = require('../utils/csvWriter');
const { getWatermark, upsertWatermark } = require('./watermarkService');
const { v4: uuidv4 } = require('crypto');

/**
 * Generates a unique job ID
 */
function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Determines the operation type for a record
 * @param {Object} record
 * @returns {string} 'INSERT', 'UPDATE', or 'DELETE'
 */
function determineOperation(record) {
  if (record.is_deleted) {
    return 'DELETE';
  }
  
  // If created_at equals updated_at, it's an INSERT
  const createdAt = new Date(record.created_at).getTime();
  const updatedAt = new Date(record.updated_at).getTime();
  
  if (createdAt === updatedAt) {
    return 'INSERT';
  }
  
  return 'UPDATE';
}

/**
 * Performs a full export of all non-deleted users
 * @param {string} consumerId
 * @param {string} jobId
 */
async function performFullExport(consumerId, jobId) {
  const startTime = Date.now();
  const filename = `full_${consumerId}_${Date.now()}.csv`;
  
  logger.info('Export job started', {
    jobId,
    consumerId,
    exportType: 'full',
  });
  
  try {
    // Query all non-deleted users, ordered by updated_at
    const result = await pool.query(
      `SELECT id, name, email, created_at, updated_at, is_deleted
       FROM users
       WHERE is_deleted = FALSE
       ORDER BY updated_at ASC`
    );
    
    const rows = result.rows;
    const headers = ['id', 'name', 'email', 'created_at', 'updated_at', 'is_deleted'];
    
    // Write to CSV
    await writeCSV(filename, headers, rows);
    
    // Update watermark with the latest updated_at from exported data
    if (rows.length > 0) {
      const latestUpdatedAt = rows[rows.length - 1].updated_at;
      await upsertWatermark(consumerId, latestUpdatedAt);
    }
    
    const duration = Date.now() - startTime;
    logger.info('Export job completed', {
      jobId,
      consumerId,
      exportType: 'full',
      rowsExported: rows.length,
      duration: `${duration}ms`,
      outputFilename: filename,
    });
    
    return { success: true, filename, rowsExported: rows.length };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Export job failed', {
      jobId,
      consumerId,
      exportType: 'full',
      error: error.message,
      duration: `${duration}ms`,
    });
    throw error;
  }
}

/**
 * Performs an incremental export of changed records
 * @param {string} consumerId
 * @param {string} jobId
 */
async function performIncrementalExport(consumerId, jobId) {
  const startTime = Date.now();
  const filename = `incremental_${consumerId}_${Date.now()}.csv`;
  
  logger.info('Export job started', {
    jobId,
    consumerId,
    exportType: 'incremental',
  });
  
  try {
    // Get the watermark
    const watermark = await getWatermark(consumerId);
    
    if (!watermark) {
      throw new Error(`No watermark found for consumer ${consumerId}. Please run a full export first.`);
    }
    
    // Query records updated after the watermark, excluding soft-deleted
    const result = await pool.query(
      `SELECT id, name, email, created_at, updated_at, is_deleted
       FROM users
       WHERE updated_at > $1 AND is_deleted = FALSE
       ORDER BY updated_at ASC`,
      [watermark.last_exported_at]
    );
    
    const rows = result.rows;
    const headers = ['id', 'name', 'email', 'created_at', 'updated_at', 'is_deleted'];
    
    // Write to CSV
    await writeCSV(filename, headers, rows);
    
    // Update watermark with the latest updated_at from exported data
    if (rows.length > 0) {
      const latestUpdatedAt = rows[rows.length - 1].updated_at;
      await upsertWatermark(consumerId, latestUpdatedAt);
    }
    
    const duration = Date.now() - startTime;
    logger.info('Export job completed', {
      jobId,
      consumerId,
      exportType: 'incremental',
      rowsExported: rows.length,
      duration: `${duration}ms`,
      outputFilename: filename,
    });
    
    return { success: true, filename, rowsExported: rows.length };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Export job failed', {
      jobId,
      consumerId,
      exportType: 'incremental',
      error: error.message,
      duration: `${duration}ms`,
    });
    throw error;
  }
}

/**
 * Performs a delta export with operation types
 * @param {string} consumerId
 * @param {string} jobId
 */
async function performDeltaExport(consumerId, jobId) {
  const startTime = Date.now();
  const filename = `delta_${consumerId}_${Date.now()}.csv`;
  
  logger.info('Export job started', {
    jobId,
    consumerId,
    exportType: 'delta',
  });
  
  try {
    // Get the watermark
    const watermark = await getWatermark(consumerId);
    
    if (!watermark) {
      throw new Error(`No watermark found for consumer ${consumerId}. Please run a full export first.`);
    }
    
    // Query records updated after the watermark (including soft-deleted for delta)
    const result = await pool.query(
      `SELECT id, name, email, created_at, updated_at, is_deleted
       FROM users
       WHERE updated_at > $1
       ORDER BY updated_at ASC`,
      [watermark.last_exported_at]
    );
    
    const rows = result.rows.map(row => ({
      operation: determineOperation(row),
      ...row,
    }));
    
    const headers = ['operation', 'id', 'name', 'email', 'created_at', 'updated_at', 'is_deleted'];
    
    // Write to CSV
    await writeCSV(filename, headers, rows);
    
    // Update watermark with the latest updated_at from exported data
    if (rows.length > 0) {
      const latestUpdatedAt = rows[rows.length - 1].updated_at;
      await upsertWatermark(consumerId, latestUpdatedAt);
    }
    
    const duration = Date.now() - startTime;
    logger.info('Export job completed', {
      jobId,
      consumerId,
      exportType: 'delta',
      rowsExported: rows.length,
      duration: `${duration}ms`,
      outputFilename: filename,
    });
    
    return { success: true, filename, rowsExported: rows.length };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Export job failed', {
      jobId,
      consumerId,
      exportType: 'delta',
      error: error.message,
      duration: `${duration}ms`,
    });
    throw error;
  }
}

module.exports = {
  generateJobId,
  performFullExport,
  performIncrementalExport,
  performDeltaExport,
  determineOperation, // Export for testing
};
