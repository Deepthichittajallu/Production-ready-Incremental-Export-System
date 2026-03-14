# CDC Incremental Export System

A production-ready, containerized data export system implementing Change Data Capture (CDC) principles for efficient synchronization of large datasets.

## Features

- **Change Data Capture**: Application-level CDC using timestamps and soft deletes
- **Watermarking**: Stateful processing with high-water mark tracking for each consumer
- **Multiple Export Strategies**:
  - Full export: Complete dataset dump
  - Incremental export: Only changed records since last export
  - Delta export: Changed records with operation types (INSERT/UPDATE/DELETE)
- **Asynchronous Processing**: Non-blocking API with background job execution
- **Structured Logging**: JSON-formatted logs for monitoring and debugging
- **High Test Coverage**: 70%+ code coverage with unit and integration tests

## Architecture

### System Components

```
┌─────────────────┐
│   API Client    │
└────────┬────────┘
         │ HTTP Requests
         │
┌────────▼────────┐
│  Express API    │
│   (Port 8080)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────────┐
│ Export│ │  Watermark  │
│Service│ │   Service   │
└───┬───┘ └──┬──────────┘
    │        │
    └────┬───┘
         │
    ┌────▼────┐
    │PostgreSQL│
    │Database │
    └─────────┘
```

### Database Schema

**users** table:
- `id` (BIGSERIAL): Unique identifier
- `name` (VARCHAR): User full name
- `email` (VARCHAR): User email (unique)
- `created_at` (TIMESTAMPTZ): Record creation timestamp
- `updated_at` (TIMESTAMPTZ): Last update timestamp
- `is_deleted` (BOOLEAN): Soft delete flag
- Index on `updated_at` for efficient CDC queries

**watermarks** table:
- `id` (SERIAL): Unique identifier
- `consumer_id` (VARCHAR): Consumer identifier (unique)
- `last_exported_at` (TIMESTAMPTZ): Last exported record timestamp
- `updated_at` (TIMESTAMPTZ): Watermark update timestamp

## Prerequisites

- Docker 20.10+
- Docker Compose 1.29+
- 4GB RAM minimum (for seeding 100k+ records)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd cdc-incremental-export-system
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

The default values in `.env.example` are sufficient for local development.

### 3. Start the System

Build and start all services with a single command:

```bash
docker-compose up --build
```

This will:
1. Build the Node.js application container
2. Start PostgreSQL database
3. Create tables with proper schema
4. Seed 100,000 users with distributed timestamps
5. Start the API server on port 8080

**Note**: Initial seeding takes 1-2 minutes. Watch the logs for completion:

```
db_1   | NOTICE:  Seeding database with 100,000 users...
db_1   | NOTICE:  Inserted 10000 users...
...
db_1   | NOTICE:  Seeding completed. Total users: 100000
```

### 4. Verify the System

Check the health endpoint:

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## API Reference

### Health Check

**Endpoint**: `GET /health`

**Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Full Export

Export all non-deleted users.

**Endpoint**: `POST /exports/full`

**Headers**:
- `X-Consumer-ID`: string (required) - Your consumer identifier

**Response** (202 Accepted):
```json
{
  "jobId": "job_1705318200000_abc123",
  "status": "started",
  "exportType": "full",
  "outputFilename": "full_consumer-1_1705318200000.csv"
}
```

**Example**:
```bash
curl -X POST http://localhost:8080/exports/full \
  -H "X-Consumer-ID: consumer-1"
```

### Incremental Export

Export only records changed since the last export for this consumer.

**Endpoint**: `POST /exports/incremental`

**Headers**:
- `X-Consumer-ID`: string (required)

**Prerequisites**: Must have an existing watermark (run full export first)

**Response** (202 Accepted):
```json
{
  "jobId": "job_1705318200000_def456",
  "status": "started",
  "exportType": "incremental",
  "outputFilename": "incremental_consumer-1_1705318200000.csv"
}
```

**Example**:
```bash
curl -X POST http://localhost:8080/exports/incremental \
  -H "X-Consumer-ID: consumer-1"
```

### Delta Export

Export changed records with operation types (INSERT/UPDATE/DELETE).

**Endpoint**: `POST /exports/delta`

**Headers**:
- `X-Consumer-ID`: string (required)

**Prerequisites**: Must have an existing watermark (run full export first)

**Response** (202 Accepted):
```json
{
  "jobId": "job_1705318200000_ghi789",
  "status": "started",
  "exportType": "delta",
  "outputFilename": "delta_consumer-1_1705318200000.csv"
}
```

**CSV Format**: Includes an `operation` column with values:
- `INSERT`: New record (created_at equals updated_at)
- `UPDATE`: Modified record
- `DELETE`: Soft-deleted record

**Example**:
```bash
curl -X POST http://localhost:8080/exports/delta \
  -H "X-Consumer-ID: consumer-1"
```

### Get Watermark

Retrieve the current watermark for a consumer.

**Endpoint**: `GET /exports/watermark`

**Headers**:
- `X-Consumer-ID`: string (required)

**Response** (200 OK):
```json
{
  "consumerId": "consumer-1",
  "lastExportedAt": "2024-01-15T10:25:00.000Z"
}
```

**Response** (404 Not Found):
```json
{
  "error": "No watermark found for consumer consumer-1"
}
```

**Example**:
```bash
curl http://localhost:8080/exports/watermark \
  -H "X-Consumer-ID: consumer-1"
```

## Export Files

All export files are written to the `./output/` directory as CSV files.

**File Naming Convention**:
- Full: `full_<consumer-id>_<timestamp>.csv`
- Incremental: `incremental_<consumer-id>_<timestamp>.csv`
- Delta: `delta_<consumer-id>_<timestamp>.csv`

**CSV Headers**:
- Full/Incremental: `id,name,email,created_at,updated_at,is_deleted`
- Delta: `operation,id,name,email,created_at,updated_at,is_deleted`

## Testing

### Run All Tests

Execute the test suite inside the Docker container:

```bash
docker-compose exec app npm test
```

### Run Tests with Coverage

```bash
docker-compose exec app npm test -- --coverage
```

The coverage report will show detailed statistics for:
- Statement coverage
- Branch coverage
- Function coverage
- Line coverage

**Target**: Minimum 70% coverage across all metrics

### Run Tests Locally (Without Docker)

If you have Node.js installed locally:

```bash
npm install
npm test
```

**Note**: Integration tests require a running PostgreSQL database.

## Development

### Project Structure

```
.
├── docker-compose.yml      # Docker services configuration
├── Dockerfile              # Application container definition
├── package.json            # Node.js dependencies
├── jest.config.js          # Test configuration
├── .env.example            # Environment variables template
├── seeds/                  # Database seeding scripts
│   ├── 01-init-schema.sql
│   └── 02-seed-data.sql
├── src/                    # Application source code
│   ├── server.js           # Express API server
│   ├── db/
│   │   └── pool.js         # Database connection pool
│   ├── services/
│   │   ├── exportService.js      # Export logic
│   │   └── watermarkService.js   # Watermark management
│   └── utils/
│       ├── logger.js       # Structured logging
│       └── csvWriter.js    # CSV file writer
├── tests/                  # Test suite
│   ├── api.test.js
│   ├── exportService.test.js
│   ├── csvWriter.test.js
│   └── logger.test.js
└── output/                 # Export files (gitignored)
```

### Adding Dependencies

```bash
docker-compose exec app npm install <package-name>
```

### Viewing Logs

**Application logs**:
```bash
docker-compose logs -f app
```

**Database logs**:
```bash
docker-compose logs -f db
```

**All services**:
```bash
docker-compose logs -f
```

### Stopping the System

```bash
docker-compose down
```

To also remove volumes (database data):
```bash
docker-compose down -v
```

## Monitoring and Debugging

### Structured Logs

The application produces JSON-formatted logs with the following structure:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Export job completed",
  "jobId": "job_123",
  "consumerId": "consumer-1",
  "exportType": "full",
  "rowsExported": 99000,
  "duration": "2500ms"
}
```

**Key Events**:
- Export job started: `jobId`, `consumerId`, `exportType`
- Export job completed: `jobId`, `rowsExported`, `duration`
- Export job failed: `jobId`, `error`

### Database Inspection

Connect to the PostgreSQL database:

```bash
docker-compose exec db psql -U user -d mydatabase
```

**Useful queries**:

```sql
-- Check total users
SELECT COUNT(*) FROM users;

-- Check soft-deleted users
SELECT COUNT(*) FROM users WHERE is_deleted = TRUE;

-- Check timestamp distribution
SELECT MIN(updated_at), MAX(updated_at) FROM users;

-- View all watermarks
SELECT * FROM watermarks ORDER BY updated_at DESC;

-- View recent users
SELECT * FROM users ORDER BY updated_at DESC LIMIT 10;
```

## Performance Considerations

### Indexing

The `updated_at` column is indexed for optimal CDC query performance:

```sql
CREATE INDEX idx_users_updated_at ON users(updated_at);
```

This enables efficient range scans for incremental and delta exports.

### Asynchronous Processing

All export endpoints return `202 Accepted` immediately, with the actual export running in the background. This prevents timeout issues for large datasets.

### Scalability

For production deployments at scale, consider:

1. **Worker Separation**: Offload exports to dedicated worker processes using a message queue (RabbitMQ, SQS)
2. **Read Replicas**: Route export queries to read replicas to reduce load on primary database
3. **Partitioning**: Partition the users table by timestamp for faster queries
4. **Streaming**: For very large exports (millions of rows), consider streaming to S3/cloud storage instead of local files

## Watermarking Strategy

### How It Works

1. **First Export**: Full export establishes the initial watermark (latest `updated_at` timestamp)
2. **Subsequent Exports**: Incremental/delta exports query `WHERE updated_at > watermark`
3. **Atomicity**: Watermark is updated only after successful file write
4. **Consumer Isolation**: Each consumer has an independent watermark

### Handling Edge Cases

- **No watermark**: Incremental/delta exports fail with clear error message
- **Export failure**: Watermark remains unchanged, next export will retry
- **Multiple updates**: Only the latest version is captured (acceptable trade-off)

## Troubleshooting

### Database Connection Errors

**Symptom**: Application fails to start with "database not ready" errors

**Solution**: The healthcheck ensures the database is ready. If issues persist, increase the healthcheck timeout in `docker-compose.yml`.

### Seeding Takes Too Long

**Symptom**: Database seeding exceeds 5 minutes

**Solution**: This can happen on systems with limited resources. The seeding is idempotent, so you can let it complete. Future restarts will skip seeding.

### Export Files Not Created

**Symptom**: Export API returns 202 but no file appears in `./output/`

**Solution**: 
1. Check application logs: `docker-compose logs app`
2. Verify the volume mount is correct in `docker-compose.yml`
3. Check file permissions on the `./output/` directory

### Test Failures

**Symptom**: Tests fail with database errors

**Solution**: Ensure the database is running and accessible. Tests use mocks to avoid actual database operations, but some integration tests may require a live database.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `8080` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@db:5432/mydatabase` |
| `OUTPUT_DIR` | Directory for export files | `/app/output` |
| `LOG_LEVEL` | Logging level (error/warn/info/debug) | `info` |

