const pool = require('../db/pool');
const logger = require('../utils/logger');

/**
 * Gets the watermark for a consumer
 * @param {string} consumerId
 * @returns {Promise<Object|null>}
 */
async function getWatermark(consumerId) {
  const result = await pool.query(
    'SELECT consumer_id, last_exported_at, updated_at FROM watermarks WHERE consumer_id = $1',
    [consumerId]
  );
  
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Updates or creates a watermark for a consumer
 * @param {string} consumerId
 * @param {Date} lastExportedAt
 * @returns {Promise<void>}
 */
async function upsertWatermark(consumerId, lastExportedAt) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const result = await client.query(
      `INSERT INTO watermarks (consumer_id, last_exported_at, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (consumer_id)
       DO UPDATE SET 
         last_exported_at = EXCLUDED.last_exported_at,
         updated_at = NOW()
       RETURNING *`,
      [consumerId, lastExportedAt]
    );
    
    await client.query('COMMIT');
    
    logger.info('Watermark updated', {
      consumerId,
      lastExportedAt: lastExportedAt.toISOString(),
    });
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to update watermark', {
      consumerId,
      error: error.message,
    });
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getWatermark,
  upsertWatermark,
};
