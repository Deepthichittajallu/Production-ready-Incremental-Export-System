require('dotenv').config();
const express = require('express');
const pool = require('./db/pool');
const logger = require('./utils/logger');
const { getWatermark } = require('./services/watermarkService');
const {
  generateJobId,
  performFullExport,
  performIncrementalExport,
  performDeltaExport,
} = require('./services/exportService');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    headers: req.headers,
  });
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Full export endpoint
 */
app.post('/exports/full', async (req, res) => {
  const consumerId = req.headers['x-consumer-id'];
  
  if (!consumerId) {
    return res.status(400).json({
      error: 'Missing X-Consumer-ID header',
    });
  }
  
  const jobId = generateJobId();
  const outputFilename = `full_${consumerId}_${Date.now()}.csv`;
  
  // Start export asynchronously
  setImmediate(() => {
    performFullExport(consumerId, jobId).catch(error => {
      logger.error('Async export failed', {
        jobId,
        consumerId,
        error: error.message,
      });
    });
  });
  
  // Return 202 Accepted immediately
  res.status(202).json({
    jobId,
    status: 'started',
    exportType: 'full',
    outputFilename,
  });
});

/**
 * Incremental export endpoint
 */
app.post('/exports/incremental', async (req, res) => {
  const consumerId = req.headers['x-consumer-id'];
  
  if (!consumerId) {
    return res.status(400).json({
      error: 'Missing X-Consumer-ID header',
    });
  }
  
  const jobId = generateJobId();
  const outputFilename = `incremental_${consumerId}_${Date.now()}.csv`;
  
  // Start export asynchronously
  setImmediate(() => {
    performIncrementalExport(consumerId, jobId).catch(error => {
      logger.error('Async export failed', {
        jobId,
        consumerId,
        error: error.message,
      });
    });
  });
  
  // Return 202 Accepted immediately
  res.status(202).json({
    jobId,
    status: 'started',
    exportType: 'incremental',
    outputFilename,
  });
});

/**
 * Delta export endpoint
 */
app.post('/exports/delta', async (req, res) => {
  const consumerId = req.headers['x-consumer-id'];
  
  if (!consumerId) {
    return res.status(400).json({
      error: 'Missing X-Consumer-ID header',
    });
  }
  
  const jobId = generateJobId();
  const outputFilename = `delta_${consumerId}_${Date.now()}.csv`;
  
  // Start export asynchronously
  setImmediate(() => {
    performDeltaExport(consumerId, jobId).catch(error => {
      logger.error('Async export failed', {
        jobId,
        consumerId,
        error: error.message,
      });
    });
  });
  
  // Return 202 Accepted immediately
  res.status(202).json({
    jobId,
    status: 'started',
    exportType: 'delta',
    outputFilename,
  });
});

/**
 * Get watermark endpoint
 */
app.get('/exports/watermark', async (req, res) => {
  const consumerId = req.headers['x-consumer-id'];
  
  if (!consumerId) {
    return res.status(400).json({
      error: 'Missing X-Consumer-ID header',
    });
  }
  
  try {
    const watermark = await getWatermark(consumerId);
    
    if (!watermark) {
      return res.status(404).json({
        error: `No watermark found for consumer ${consumerId}`,
      });
    }
    
    res.status(200).json({
      consumerId: watermark.consumer_id,
      lastExportedAt: watermark.last_exported_at.toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get watermark', {
      consumerId,
      error: error.message,
    });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
  });
  res.status(500).json({
    error: 'Internal server error',
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    logger.info('Database connection established');
    
    app.listen(PORT, () => {
      logger.info(`Server started`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

// Start the server if not in test mode
if (require.main === module) {
  startServer();
}

module.exports = app; // Export for testing
