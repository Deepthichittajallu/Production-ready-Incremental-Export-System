# CDC Incremental Export System

A production-ready, containerized data export system implementing Change
Data Capture (CDC) principles for efficient synchronization of large
datasets.

## Features

-   **Change Data Capture**: Application-level CDC using timestamps and
    soft deletes
-   **Watermarking**: Stateful processing with high-water mark tracking
    for each consumer
-   **Multiple Export Strategies**:
    -   Full export: Complete dataset dump
    -   Incremental export: Only changed records since last export
    -   Delta export: Changed records with operation types
        (INSERT/UPDATE/DELETE)
-   **Asynchronous Processing**: Non-blocking API with background job
    execution
-   **Structured Logging**: JSON-formatted logs for monitoring and
    debugging
-   **High Test Coverage**: 70%+ code coverage with unit and integration
    tests

## Architecture

### System Components

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

## Database Schema

### users Table

-   `id` (BIGSERIAL): Unique identifier\
-   `name` (VARCHAR): User full name\
-   `email` (VARCHAR): User email (unique)\
-   `created_at` (TIMESTAMPTZ): Record creation timestamp\
-   `updated_at` (TIMESTAMPTZ): Last update timestamp\
-   `is_deleted` (BOOLEAN): Soft delete flag

### watermarks Table

-   `id` (SERIAL): Unique identifier\
-   `consumer_id` (VARCHAR): Consumer identifier (unique)\
-   `last_exported_at` (TIMESTAMPTZ): Last exported record timestamp\
-   `updated_at` (TIMESTAMPTZ): Watermark update timestamp

## Prerequisites

-   Docker 20.10+
-   Docker Compose 1.29+
-   Minimum 4GB RAM

## Quick Start

### 1. Clone the Repository

``` bash
git clone <repository-url>
cd cdc-incremental-export-system
```

### 2. Setup Environment Variables

``` bash
cp .env.example .env
```

### 3. Start the System

``` bash
docker-compose up --build
```

This command will:

-   Build the Node.js container
-   Start PostgreSQL
-   Create database tables
-   Seed 100,000 records
-   Launch the API server on port **8080**

### 4. Verify the System

``` bash
curl http://localhost:8080/health
```

Expected response:

``` json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## API Endpoints

### Health Check

`GET /health`

Returns system health status.

### Full Export

`POST /exports/full`

Headers:

    X-Consumer-ID: consumer-1

Exports all non-deleted users.

### Incremental Export

`POST /exports/incremental`

Exports only records changed since the last export.

### Delta Export

`POST /exports/delta`

Exports changed records with operation types:

-   INSERT
-   UPDATE
-   DELETE

### Get Watermark

`GET /exports/watermark`

Returns the last exported timestamp for a consumer.

## Export Files

Export files are saved inside:

    ./output/

File naming format:

    full_<consumer-id>_<timestamp>.csv
    incremental_<consumer-id>_<timestamp>.csv
    delta_<consumer-id>_<timestamp>.csv

CSV Headers:

Full / Incremental

    id,name,email,created_at,updated_at,is_deleted

Delta

    operation,id,name,email,created_at,updated_at,is_deleted

## Running Tests

Run tests inside Docker:

``` bash
docker-compose exec app npm test
```

Run with coverage:

``` bash
docker-compose exec app npm test -- --coverage
```

Target coverage: **70%+**

## Development Structure

    .
    ├── docker-compose.yml
    ├── Dockerfile
    ├── package.json
    ├── jest.config.js
    ├── .env.example
    ├── seeds/
    ├── src/
    │   ├── server.js
    │   ├── db/
    │   ├── services/
    │   └── utils/
    ├── tests/
    └── output/

## Logging

Logs are structured JSON logs.

Example:

``` json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Export job completed",
  "rowsExported": 99000
}
```

## Performance Considerations

-   Index on `updated_at` for CDC queries
-   Asynchronous background export jobs
-   Supports scaling using worker queues
-   Suitable for large datasets

## Environment Variables

  -----------------------------------------------------------------------------------------------
  Variable                Description             Default
  ----------------------- ----------------------- -----------------------------------------------
  PORT                    API server port         8080

  DATABASE_URL            PostgreSQL connection   postgresql://user:password@db:5432/mydatabase

  OUTPUT_DIR              Export directory        /app/output

  LOG_LEVEL               Logging level           info
  -----------------------------------------------------------------------------------------------

## Author

Deepthi Chittajallu\
B.Tech CSE \| Data Systems \| Backend Development
