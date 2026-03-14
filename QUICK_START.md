# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Start the System
```bash
docker-compose up --build
```

Wait for the seeding to complete (1-2 minutes). You'll see:
```
db_1   | NOTICE:  Seeding completed. Total users: 100000
app_1  | {"timestamp":"...","level":"info","message":"Server started","port":8080}
```

### Step 2: Test the API
```powershell
# Windows PowerShell
.\test-api.ps1
```

Or manually:
```powershell
# Health check
curl http://localhost:8080/health

# Full export
curl -X POST http://localhost:8080/exports/full -H "X-Consumer-ID: consumer-1"

# Get watermark
curl http://localhost:8080/exports/watermark -H "X-Consumer-ID: consumer-1"

# Incremental export
curl -X POST http://localhost:8080/exports/incremental -H "X-Consumer-ID: consumer-1"

# Delta export
curl -X POST http://localhost:8080/exports/delta -H "X-Consumer-ID: consumer-1"
```

### Step 3: Verify Results
```powershell
# Check export files
Get-ChildItem .\output\*.csv

# View logs
docker logs cdc-incremental-export-system_app_1

# Check database
docker-compose exec db psql -U user -d mydatabase -c "SELECT COUNT(*) FROM users;"
```

## 🧪 Run Tests
```bash
docker-compose exec app npm test
```

Expected output:
```
Test Suites: 5 passed
Tests:       39 passed
Coverage:    88.94% statements
```

## 📊 Project Structure
```
cdc-incremental-export-system/
├── docker-compose.yml          # Container orchestration
├── Dockerfile                  # App container definition
├── .env.example                # Environment variables template
├── package.json                # Node.js dependencies
├── README.md                   # Full documentation
├── SUBMISSION_CHECKLIST.md     # Requirements verification
├── test-api.ps1                # API testing script
├── src/
│   ├── server.js               # Express API server
│   ├── db/pool.js              # Database connection
│   ├── services/
│   │   ├── exportService.js    # Export logic (full/incremental/delta)
│   │   └── watermarkService.js # Watermark management
│   └── utils/
│       ├── logger.js           # Structured logging
│       └── csvWriter.js        # CSV file writer
├── seeds/
│   ├── 01-init-schema.sql      # Create tables & indexes
│   └── 02-seed-data.sql        # Generate 100k users
├── tests/                      # 39 tests, 88.94% coverage
│   ├── api.test.js
│   ├── exportService.test.js
│   ├── watermarkService.test.js
│   ├── csvWriter.test.js
│   └── logger.test.js
└── output/                     # Export CSV files (gitignored)
```

## 🎯 Key Features

✅ **Change Data Capture (CDC)** - Timestamp-based watermarking  
✅ **Multiple Export Strategies** - Full, incremental, delta  
✅ **Async Processing** - Non-blocking API with background jobs  
✅ **Production-Ready** - Error handling, logging, testing  
✅ **100k+ Dataset** - Realistic seeding with distributed timestamps  
✅ **88.94% Test Coverage** - Comprehensive unit & integration tests  

## 🛠️ Common Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Rebuild
docker-compose up --build

# Run tests
docker-compose exec app npm test

# Connect to database
docker-compose exec db psql -U user -d mydatabase

# Check service health
docker-compose ps
```

## 📖 Full Documentation

See [README.md](README.md) for:
- Complete API reference
- Architecture details
- Troubleshooting guide
- Performance considerations
- Development workflow

## ✅ Requirements Met

All 12 core requirements implemented:
1. ✓ Docker & Docker Compose setup
2. ✓ Database schema (users, watermarks)
3. ✓ Automated seeding (100k+ records)
4. ✓ Health check endpoint
5. ✓ Full export endpoint
6. ✓ Incremental export endpoint
7. ✓ Delta export endpoint
8. ✓ Get watermark endpoint
9. ✓ Atomic watermark updates
10. ✓ Structured logging (JSON)
11. ✓ 70%+ test coverage (88.94%)
12. ✓ .env.example file

## 🎓 Learning Outcomes

This project demonstrates:
- Application-level CDC implementation
- Watermarking for stateful data processing
- Asynchronous job handling
- Production-grade logging and error handling
- Containerized microservice architecture
- Test-driven development (TDD)

## 📞 Need Help?

1. Check [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md) for verification steps
2. Review logs: `docker-compose logs app`
3. See [README.md](README.md) Troubleshooting section
4. Ensure Docker Desktop is running
5. Verify ports 8080 and 5432 are available
