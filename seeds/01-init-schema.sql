-- Create users table with CDC metadata columns
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create index on updated_at for efficient CDC queries
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);

-- Create watermarks table for tracking consumer export progress
CREATE TABLE IF NOT EXISTS watermarks (
    id SERIAL PRIMARY KEY,
    consumer_id VARCHAR(255) NOT NULL UNIQUE,
    last_exported_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on consumer_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_watermarks_consumer_id ON watermarks(consumer_id);
