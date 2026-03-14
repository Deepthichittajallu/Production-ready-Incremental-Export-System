# CDC Export System API Test Script

Write-Host "CDC Incremental Export System - API Test Script" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8080"
$consumerId = "test-consumer-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Function to make HTTP requests
function Invoke-ApiRequest {
    param (
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Headers = @{}
    )
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl$Endpoint" -Method $Method -Headers $Headers -ErrorAction Stop
        return $response
    }
    catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
$health = Invoke-ApiRequest -Method GET -Endpoint "/health"
if ($health -and $health.status -eq "ok") {
    Write-Host "✓ Health check passed" -ForegroundColor Green
    Write-Host "  Status: $($health.status)" -ForegroundColor Gray
    Write-Host "  Timestamp: $($health.timestamp)" -ForegroundColor Gray
} else {
    Write-Host "✗ Health check failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Full Export
Write-Host "Test 2: Full Export" -ForegroundColor Yellow
$fullExport = Invoke-ApiRequest -Method POST -Endpoint "/exports/full" -Headers @{"X-Consumer-ID" = $consumerId}
if ($fullExport -and $fullExport.status -eq "started") {
    Write-Host "✓ Full export started" -ForegroundColor Green
    Write-Host "  Job ID: $($fullExport.jobId)" -ForegroundColor Gray
    Write-Host "  Export Type: $($fullExport.exportType)" -ForegroundColor Gray
    Write-Host "  Output File: $($fullExport.outputFilename)" -ForegroundColor Gray
    
    # Wait for export to complete
    Write-Host "  Waiting for export to complete..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
} else {
    Write-Host "✗ Full export failed" -ForegroundColor Red
}
Write-Host ""

# Test 3: Get Watermark
Write-Host "Test 3: Get Watermark" -ForegroundColor Yellow
$watermark = Invoke-ApiRequest -Method GET -Endpoint "/exports/watermark" -Headers @{"X-Consumer-ID" = $consumerId}
if ($watermark -and $watermark.consumerId) {
    Write-Host "✓ Watermark retrieved" -ForegroundColor Green
    Write-Host "  Consumer ID: $($watermark.consumerId)" -ForegroundColor Gray
    Write-Host "  Last Exported At: $($watermark.lastExportedAt)" -ForegroundColor Gray
} else {
    Write-Host "✗ Watermark retrieval failed" -ForegroundColor Red
}
Write-Host ""

# Test 4: Incremental Export
Write-Host "Test 4: Incremental Export" -ForegroundColor Yellow
$incrementalExport = Invoke-ApiRequest -Method POST -Endpoint "/exports/incremental" -Headers @{"X-Consumer-ID" = $consumerId}
if ($incrementalExport -and $incrementalExport.status -eq "started") {
    Write-Host "✓ Incremental export started" -ForegroundColor Green
    Write-Host "  Job ID: $($incrementalExport.jobId)" -ForegroundColor Gray
    Write-Host "  Export Type: $($incrementalExport.exportType)" -ForegroundColor Gray
    Write-Host "  Output File: $($incrementalExport.outputFilename)" -ForegroundColor Gray
} else {
    Write-Host "✗ Incremental export failed" -ForegroundColor Red
}
Write-Host ""

# Test 5: Delta Export
Write-Host "Test 5: Delta Export" -ForegroundColor Yellow
$deltaExport = Invoke-ApiRequest -Method POST -Endpoint "/exports/delta" -Headers @{"X-Consumer-ID" = $consumerId}
if ($deltaExport -and $deltaExport.status -eq "started") {
    Write-Host "✓ Delta export started" -ForegroundColor Green
    Write-Host "  Job ID: $($deltaExport.jobId)" -ForegroundColor Gray
    Write-Host "  Export Type: $($deltaExport.exportType)" -ForegroundColor Gray
    Write-Host "  Output File: $($deltaExport.outputFilename)" -ForegroundColor Gray
} else {
    Write-Host "✗ Delta export failed" -ForegroundColor Red
}
Write-Host ""

# Test 6: Check Output Files
Write-Host "Test 6: Verify Output Files" -ForegroundColor Yellow
$outputDir = ".\output"
if (Test-Path $outputDir) {
    $files = Get-ChildItem $outputDir -Filter "*.csv" | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-5) }
    if ($files.Count -gt 0) {
        Write-Host "✓ Found $($files.Count) export file(s)" -ForegroundColor Green
        foreach ($file in $files) {
            Write-Host "  - $($file.Name) ($([math]::Round($file.Length / 1KB, 2)) KB)" -ForegroundColor Gray
        }
    } else {
        Write-Host "✗ No recent export files found" -ForegroundColor Red
    }
} else {
    Write-Host "✗ Output directory not found" -ForegroundColor Red
}
Write-Host ""

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "API Testing Complete" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Check the output/ directory for CSV files" -ForegroundColor White
Write-Host "2. View application logs: docker-compose logs app" -ForegroundColor White
Write-Host "3. Connect to database: docker-compose exec db psql -U user -d mydatabase" -ForegroundColor White
