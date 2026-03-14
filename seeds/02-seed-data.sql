-- Idempotent seeding: Only seed if users table is empty
DO $$
DECLARE
    user_count INTEGER;
    base_timestamp TIMESTAMP WITH TIME ZONE;
    random_days INTEGER;
    random_hours INTEGER;
    random_minutes INTEGER;
    created_ts TIMESTAMP WITH TIME ZONE;
    updated_ts TIMESTAMP WITH TIME ZONE;
    should_delete BOOLEAN;
    i INTEGER;
BEGIN
    -- Check if users table already has data
    SELECT COUNT(*) INTO user_count FROM users;
    
    IF user_count = 0 THEN
        RAISE NOTICE 'Seeding database with 100,000 users...';
        
        -- Base timestamp: 30 days ago from now
        base_timestamp := NOW() - INTERVAL '30 days';
        
        -- Generate 100,000 users with distributed timestamps
        FOR i IN 1..100000 LOOP
            -- Random timestamp within the last 30 days
            random_days := floor(random() * 30)::INTEGER;
            random_hours := floor(random() * 24)::INTEGER;
            random_minutes := floor(random() * 60)::INTEGER;
            
            created_ts := base_timestamp + 
                         (random_days || ' days')::INTERVAL + 
                         (random_hours || ' hours')::INTERVAL + 
                         (random_minutes || ' minutes')::INTERVAL;
            
            -- updated_at is either same as created_at or later
            IF random() > 0.7 THEN
                -- 30% chance of being updated after creation
                updated_ts := created_ts + 
                             (floor(random() * (30 - random_days))::INTEGER || ' days')::INTERVAL +
                             (floor(random() * 24)::INTEGER || ' hours')::INTERVAL;
            ELSE
                updated_ts := created_ts;
            END IF;
            
            -- 1.5% chance of being soft-deleted (ensures at least 1%)
            should_delete := random() < 0.015;
            
            INSERT INTO users (name, email, created_at, updated_at, is_deleted)
            VALUES (
                'User ' || i,
                'user' || i || '@example.com',
                created_ts,
                updated_ts,
                should_delete
            );
            
            -- Log progress every 10000 records
            IF i % 10000 = 0 THEN
                RAISE NOTICE 'Inserted % users...', i;
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Seeding completed. Total users: %', i;
        
        -- Verify seeding
        SELECT COUNT(*) INTO user_count FROM users;
        RAISE NOTICE 'Final user count: %', user_count;
        
        SELECT COUNT(*) INTO user_count FROM users WHERE is_deleted = TRUE;
        RAISE NOTICE 'Soft-deleted users: %', user_count;
    ELSE
        RAISE NOTICE 'Users table already contains % records. Skipping seeding.', user_count;
    END IF;
END $$;
