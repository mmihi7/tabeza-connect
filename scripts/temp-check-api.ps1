$result = Invoke-RestMethod -Uri "http://localhost:8765/api/status" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
if ($result) {
    Write-Host "Service is running on port 8765"
    $result | ConvertTo-Json -Depth 3
} else {
    Write-Host "Service NOT running on port 8765"
}