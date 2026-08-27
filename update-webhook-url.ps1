# Update this with your NEW ngrok URL
$newNgrokUrl = Read-Host "Enter NEW ngrok URL (e.g., https://abc.ngrok-free.app)"
$webhookUrl = "$newNgrokUrl/api/webhooks/voice"

$apiKey = "ce4cf2fa-49d2-4ff7-b08a-6926d24f0624"
$assistantId = "3f72fb26-85e3-453d-880d-cedd3df88c93"

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
}

$body = @{
    "serverUrl" = $webhookUrl
    "serverUrlSecret" = "Yadav@2009"
} | ConvertTo-Json

Write-Host "`nUpdating Vapi with NEW webhook URL..." -ForegroundColor Yellow
Write-Host "New URL: $webhookUrl" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "https://api.vapi.ai/assistant/$assistantId" -Method PATCH -Headers $headers -Body $body
    Write-Host "`n✅ SUCCESS! New webhook URL set!" -ForegroundColor Green
    Write-Host "Server URL: $($response.serverUrl)" -ForegroundColor Green
    
    # Test the new endpoint
    Write-Host "`nTesting new endpoint..." -ForegroundColor Yellow
    $testResponse = Invoke-WebRequest -Uri "$newNgrokUrl/api/health" -Method GET
    Write-Host "✅ Health check passed!" -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
