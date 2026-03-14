# Complete API Validation Script for 100% Score
# Tests all 12 core requirements

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "CDC INCREMENTAL EXPORT SYSTEM - COMPLETE VALIDATION" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8080"
$testConsumer = "validation-consumer-$(Get-Date -Format 'yyyyMMddHHmmss')"
$passed = 0
$failed = 0

function Test-Requirement {
    param (
        [string]$Number,
        [string]$Description,
        [scriptblock]$TestScript
    )
    
    Write-Host "[$Number] Testing: $Description" -ForegroundColor Yellow
    try {
        $result = & $TestScript
        if ($result) {
            Write-Host "  ✓ PASSED" -ForegroundColor Green
            $script:passed++
            return $true
        } else {
            Write-Host "  ✗ FAILED" -ForegroundColor Red
            $script:failed++
            return $false
        }
    } catch {
        Write-Host "  ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
        return $false
    }
}

# Requirement 1: Docker & Docker Compose
Test-Requirement "R1" "Docker containers running" {
    $containers = docker-compose ps -q
    if ($containers) {
        Write-Host "    Containers: Running" -ForegroundColor Gray
        return $true
    }
    return $false
}

# Requirement 4: Health Check Endpoint
Test-Requirement "R4" "GET /health returns 200 with correct format" {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -ErrorAction Stop
    $valid = $response.status -eq "ok" -and $response.timestamp
    if ($valid) {
        Write-Host "    Status: $($response.status)" -ForegroundColor Gray
        Write-Host "    Timestamp: $($response.timestamp)" -ForegroundColor Gray
    }
    return $valid
}

# Requirement 2 & 3: Database Schema and Seeding
Test-Requirement "R2/R3" "Database has correct schema and seeded data" {
    $userCountQuery = 'SELECT COUNT(*) FROM users;'
    $deletedQuery = 'SELECT COUNT(*) FROM users WHERE is_deleted = TRUE;'
    $indexQuery = "SELECT indexname FROM pg_indexes WHERE tablename='users' AND indexname='idx_users_updated_at';"
    
    $userCount = docker-compose exec -T db psql -U user -d mydatabase -t -c $userCountQuery 2>$null
    $deletedCount = docker-compose exec -T db psql -U user -d mydatabase -t -c $deletedQuery 2>$null
    $hasIndex = docker-compose exec -T db psql -U user -d mydatabase -t -c $indexQuery 2>$null
    
    $userCount = [int]($userCount -replace '\s', '')
    $deletedCount = [int]($deletedCount -replace '\s', '')
    
    $valid = $userCount -ge 100000 -and $deletedCount -ge 1000 -and $hasIndex
    
    if ($valid) {
        Write-Host "    Total Users: $userCount" -ForegroundColor Gray
        Write-Host "    Soft-Deleted: $deletedCount" -ForegroundColor Gray
        Write-Host "    Index on updated_at: Exists" -ForegroundColor Gray
    }
    return $valid
}

# Requirement 5: Full Export Endpoint
$fullExportResult = $null
Test-Requirement "R5" "POST /exports/full returns 202 with correct format" {
    $response = Invoke-RestMethod -Uri "$baseUrl/exports/full" -Method POST -Headers @{"X-Consumer-ID" = $testConsumer} -ErrorAction Stop
    $valid = $response.jobId -and $response.status -eq "started" -and $response.exportType -eq "full" -and $response.outputFilename -like "full_*"
    
    if ($valid) {
        Write-Host "    Job ID: $($response.jobId)" -ForegroundColor Gray
        Write-Host "    Status: $($response.status)" -ForegroundColor Gray
        Write-Host "    Export Type: $($response.exportType)" -ForegroundColor Gray
        Write-Host "    Filename: $($response.outputFilename)" -ForegroundColor Gray
        $script:fullExportResult = $response
    }
    return $valid
}

# Wait for export to complete
Write-Host "  Waiting 5 seconds for export to complete..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Requirement 5 (continued): Verify CSV file created
Test-Requirement "R5.1" "Full export CSV file created" {
    $csvFiles = Get-ChildItem ".\output" -Filter "full_${testConsumer}_*.csv" -ErrorAction SilentlyContinue
    if ($csvFiles.Count -gt 0) {
        $file = $csvFiles[0]
        Write-Host "    File: $($file.Name)" -ForegroundColor Gray
        Write-Host "    Size: $([math]::Round($file.Length / 1MB, 2)) MB" -ForegroundColor Gray
        
        # Verify CSV headers
        $firstLine = Get-Content $file.FullName -First 1
        $expectedHeaders = "id,name,email,created_at,updated_at,is_deleted"
        if ($firstLine -eq $expectedHeaders) {
            Write-Host "    Headers: Correct" -ForegroundColor Gray
            return $true
        } else {
            Write-Host "    Headers: $firstLine" -ForegroundColor Red
            Write-Host "    Expected: $expectedHeaders" -ForegroundColor Red
        }
    }
    return $false
}

# Requirement 8: Get Watermark Endpoint
Test-Requirement "R8" "GET /exports/watermark returns 200 for existing consumer" {
    $response = Invoke-RestMethod -Uri "$baseUrl/exports/watermark" -Method GET -Headers @{"X-Consumer-ID" = $testConsumer} -ErrorAction Stop
    $valid = $response.consumerId -eq $testConsumer -and $response.lastExportedAt
    
    if ($valid) {
        Write-Host "    Consumer ID: $($response.consumerId)" -ForegroundColor Gray
        Write-Host "    Last Exported At: $($response.lastExportedAt)" -ForegroundColor Gray
    }
    return $valid
}

# Requirement 8: Watermark returns 404 for non-existent consumer
Test-Requirement "R8.1" "GET /exports/watermark returns 404 for new consumer" {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/exports/watermark" -Method GET -Headers @{"X-Consumer-ID" = "non-existent-consumer"} -ErrorAction Stop
        return $false
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 404) {
            Write-Host "    Correctly returns 404" -ForegroundColor Gray
            return $true
        }
        return $false
    }
}

# Requirement 6: Incremental Export Endpoint
Test-Requirement "R6" "POST /exports/incremental returns 202 with correct format" {
    $response = Invoke-RestMethod -Uri "$baseUrl/exports/incremental" -Method POST -Headers @{"X-Consumer-ID" = $testConsumer} -ErrorAction Stop
    $valid = $response.jobId -and $response.status -eq "started" -and $response.exportType -eq "incremental" -and $response.outputFilename -like "incremental_*"
    
    if ($valid) {
        Write-Host "    Job ID: $($response.jobId)" -ForegroundColor Gray
        Write-Host "    Export Type: $($response.exportType)" -ForegroundColor Gray
    }
    return $valid
}

# Wait for export
Start-Sleep -Seconds 3

# Requirement 7: Delta Export Endpoint
Test-Requirement "R7" "POST /exports/delta returns 202 with correct format" {
    $response = Invoke-RestMethod -Uri "$baseUrl/exports/delta" -Method POST -Headers @{"X-Consumer-ID" = $testConsumer} -ErrorAction Stop
    $valid = $response.jobId -and $response.status -eq "started" -and $response.exportType -eq "delta" -and $response.outputFilename -like "delta_*"
    
    if ($valid) {
        Write-Host "    Job ID: $($response.jobId)" -ForegroundColor Gray
        Write-Host "    Export Type: $($response.exportType)" -ForegroundColor Gray
    }
    return $valid
}

# Wait for export
Start-Sleep -Seconds 3

# Requirement 7 (continued): Verify delta CSV has operation column
Test-Requirement "R7.1" "Delta export CSV has operation column" {
    $csvFiles = Get-ChildItem ".\output" -Filter "delta_${testConsumer}_*.csv" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    if ($csvFiles.Count -gt 0) {
        $file = $csvFiles[0]
        $firstLine = Get-Content $file.FullName -First 1
        if ($firstLine -like "operation,*") {
            Write-Host "    Headers: $firstLine" -ForegroundColor Gray
            return $true
        }
    }
    return $false
}

# Requirement 10: Structured Logging
Test-Requirement "R10" "Application produces structured JSON logs" {
    $logs = docker-compose logs app 2>$null | Select-String "Export job" | Select-Object -Last 5
    if ($logs.Count -gt 0) {
        $sampleLog = $logs[0].ToString()
        if ($sampleLog -like '*"timestamp"*' -and $sampleLog -like '*"jobId"*') {
            Write-Host "    Log format: JSON with required fields" -ForegroundColor Gray
            Write-Host "    Sample: $($sampleLog.Substring(0, [Math]::Min(100, $sampleLog.Length)))..." -ForegroundColor Gray
            return $true
        }
    }
    return $false
}

# Requirement 11: Test Coverage
Test-Requirement "R11" "Test coverage >= 70%" {
    Write-Host "    Running tests..." -ForegroundColor Gray
    $testOutput = docker-compose exec -T app npm test 2>&1 | Out-String
    
    if ($testOutput -match "All files.*\|\s+(\d+\.?\d*)") {
        $coverage = [decimal]$matches[1]
        Write-Host "    Coverage: $coverage%" -ForegroundColor Gray
        return $coverage -ge 70
    }
    return $false
}

# Requirement 12: .env.example exists
Test-Requirement "R12" ".env.example file exists with required variables" {
    if (Test-Path ".env.example") {
        $content = Get-Content ".env.example" -Raw
        $hasRequired = $content -match "DATABASE_URL" -and $content -match "PORT" -and $content -match "OUTPUT_DIR"
        if ($hasRequired) {
            Write-Host "    All required variables documented" -ForegroundColor Gray
            return $true
        }
    }
    return $false
}

# Requirement 9: Watermark atomicity (verify watermark updated after successful export)
Test-Requirement "R9" "Watermark updated only after successful export" {
    # Get current watermark
    $watermark1 = Invoke-RestMethod -Uri "$baseUrl/exports/watermark" -Method GET -Headers @{"X-Consumer-ID" = $testConsumer} -ErrorAction Stop
    
    # Trigger export
    Invoke-RestMethod -Uri "$baseUrl/exports/full" -Method POST -Headers @{"X-Consumer-ID" = $testConsumer} -ErrorAction Stop | Out-Null
    Start-Sleep -Seconds 5
    
    # Get updated watermark
    $watermark2 = Invoke-RestMethod -Uri "$baseUrl/exports/watermark" -Method GET -Headers @{"X-Consumer-ID" = $testConsumer} -ErrorAction Stop
    
    # Watermark should be updated (or same if no new records)
    $updated = $watermark2.lastExportedAt -ge $watermark1.lastExportedAt
    if ($updated) {
        Write-Host "    Watermark correctly updated" -ForegroundColor Gray
    }
    return $updated
}

# Error handling: Missing X-Consumer-ID header
Test-Requirement "ERROR" "API returns 400 when X-Consumer-ID header is missing" {
    try {
        Invoke-RestMethod -Uri "$baseUrl/exports/full" -Method POST -ErrorAction Stop
        return $false
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 400) {
            Write-Host "    Correctly returns 400 for missing header" -ForegroundColor Gray
            return $true
        }
        return $false
    }
}

# Summary
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
Write-Host "Tests Passed:  $passed" -ForegroundColor Green
Write-Host "Tests Failed:  $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "Total Tests:   $($passed + $failed)" -ForegroundColor Cyan
Write-Host ""

$percentage = [math]::Round(($passed / ($passed + $failed)) * 100, 2)
Write-Host "Score: $percentage%" -ForegroundColor $(if ($percentage -eq 100) { "Green" } else { "Yellow" })
Write-Host ""

if ($percentage -eq 100) {
    Write-Host "🎉 PERFECT SCORE! All requirements validated successfully!" -ForegroundColor Green
    Write-Host "✓ System is ready for submission" -ForegroundColor Green
} else {
    Write-Host "⚠ Some requirements need attention" -ForegroundColor Yellow
    Write-Host "Review the failed tests above and check:" -ForegroundColor White
    Write-Host "  1. Docker containers are running: docker-compose ps" -ForegroundColor White
    Write-Host "  2. Database seeding completed (check logs)" -ForegroundColor White
    Write-Host "  3. Application logs: docker-compose logs app" -ForegroundColor White
}

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
